// NetTracker: يلتقط أحداث ETW الخاصة بالشبكة (Microsoft-Windows-Kernel-Network) ويجمّع البايتات
// لكل (تطبيق، عنوان وجهة) ثم يطبع سطر JSON كل ثانية. يحتاج صلاحيات المسؤول.
// لا يقرأ محتوى الحزم إطلاقاً، فقط: PID وحجم البيانات وعنوان الطرف الآخر.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Management;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Microsoft.Diagnostics.Tracing;
using Microsoft.Diagnostics.Tracing.Session;

static class Program
{
    sealed class Info { public string Key, Name, Path, Desc; }
    sealed class Row { public string Key, Name, Path, Desc, Ip; public long D, U; }

    static readonly Guid KernelNetwork = new Guid("7dd42a49-5329-4832-8dfd-43d979153a88");
    static readonly Guid KernelProcess = new Guid("22fb2cd6-0e7b-422b-a0c7-2fad1fd0e716");
    static readonly Dictionary<int, string> startNames = new Dictionary<int, string>();
    static readonly object Gate = new object();
    static Dictionary<string, Row> agg = new Dictionary<string, Row>();
    static volatile HashSet<string> localIps = new HashSet<string>();
    static readonly Dictionary<int, Info> pidCache = new Dictionary<int, Info>();
    static readonly Dictionary<string, string> descCache = new Dictionary<string, string>();
    static Dictionary<int, string> svcByPid = new Dictionary<int, string>();
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

    [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool CloseHandle(IntPtr h);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder sb, ref int size);

    static void Emit(string line) { lock (Console.Out) { Console.Out.WriteLine(line); Console.Out.Flush(); } }

    static int Main()
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        bool? elevated = TraceEventSession.IsElevated();
        if (elevated != true) { Emit("{\"err\":\"access\"}"); return 5; }

        RefreshLocal();
        RefreshServices();
        var maint = new Timer(_ =>
        {
            try { RefreshLocal(); } catch { }
            try { RefreshServices(); } catch { }
            lock (pidCache) pidCache.Clear(); // تفادي إعادة استخدام الـ PID
        }, null, 20000, 20000);

        TraceEventSession session;
        try
        {
            session = new TraceEventSession("InternetMeterETW");
            session.StopOnDispose = true;
            session.EnableProvider(KernelNetwork, TraceEventLevel.Informational, 0x30UL); // IPv4 | IPv6
            session.EnableProvider(KernelProcess, TraceEventLevel.Informational, 0x10UL); // بدء العمليات: لمعرفة اسم العمليات القصيرة العمر
        }
        catch (Exception ex) { Emit(Json.Serialize(new Dictionary<string, object> { { "err", ex.Message } })); return 1; }

        session.Source.AllEvents += OnEvent;
        var proc = new Thread(() => { try { session.Source.Process(); } catch { } }) { IsBackground = true };
        proc.Start();

        // إذا أُغلق الأب (أُغلقت قناة stdin) نُنهي الجلسة حتى لا تبقى يتيمة
        var watcher = new Thread(() =>
        {
            try { while (Console.In.Read() >= 0) { } } catch { }
            try { session.Dispose(); } catch { }
            Environment.Exit(0);
        }) { IsBackground = true };
        watcher.Start();

        Emit("{\"ready\":true}");
        while (true)
        {
            Thread.Sleep(1000);
            Dictionary<string, Row> snap;
            lock (Gate) { snap = agg; agg = new Dictionary<string, Row>(); }
            if (snap.Count == 0) { Emit("{\"rows\":[]}"); continue; }
            var rows = new List<Dictionary<string, object>>(snap.Count);
            foreach (var r in snap.Values)
                rows.Add(new Dictionary<string, object>
                {
                    { "k", r.Key }, { "n", r.Name }, { "p", r.Path }, { "fd", r.Desc }, { "ip", r.Ip }, { "d", r.D }, { "u", r.U },
                });
            Emit(Json.Serialize(new Dictionary<string, object> { { "rows", rows } }));
        }
    }

    static void OnEvent(TraceEvent e)
    {
        if (e.ProviderGuid == KernelProcess) { OnProcess(e); return; }
        if (e.ProviderGuid != KernelNetwork) return;
        int id = (int)e.ID;
        bool up = id == 10 || id == 26 || id == 42 || id == 58;
        bool down = id == 11 || id == 27 || id == 43 || id == 59;
        if (!up && !down) return;
        bool v6 = id == 26 || id == 27 || id == 58 || id == 59;

        byte[] b = e.EventData();
        int need = v6 ? 44 : 20;
        if (b == null || b.Length < need) return;

        int pid = BitConverter.ToInt32(b, 0);
        long size = BitConverter.ToUInt32(b, 4);
        string d, s;
        if (v6)
        {
            d = Ip6(b, 8); s = Ip6(b, 24);
        }
        else
        {
            d = b[8] + "." + b[9] + "." + b[10] + "." + b[11];
            s = b[12] + "." + b[13] + "." + b[14] + "." + b[15];
        }

        var local = localIps;
        bool dLocal = local.Contains(d), sLocal = local.Contains(s);
        if (dLocal && sLocal) return;
        string remote = dLocal ? s : d;
        if (remote.StartsWith("127.") || remote == "::1" || remote == "0.0.0.0" || remote == "::") return;

        Info info = Lookup(pid);
        string key = info.Key + "|" + remote;
        lock (Gate)
        {
            Row r;
            if (!agg.TryGetValue(key, out r))
            {
                r = new Row { Key = info.Key, Name = info.Name, Path = info.Path, Desc = info.Desc, Ip = remote };
                agg[key] = r;
            }
            if (up) r.U += size; else r.D += size;
        }
    }

    static void OnProcess(TraceEvent e)
    {
        if ((int)e.ID != 1) return; // ProcessStart
        try
        {
            int pid = Convert.ToInt32(e.PayloadByName("ProcessID"));
            string img = Convert.ToString(e.PayloadByName("ImageName"));
            if (string.IsNullOrEmpty(img)) return;
            lock (startNames) { if (startNames.Count > 5000) startNames.Clear(); startNames[pid] = Path.GetFileName(img); }
        }
        catch { }
    }

    static string Ip6(byte[] b, int off)
    {
        var a = new byte[16];
        Buffer.BlockCopy(b, off, a, 0, 16);
        string s = new System.Net.IPAddress(a).ToString();
        int p = s.IndexOf('%');
        return p > 0 ? s.Substring(0, p) : s;
    }

    static Info Lookup(int pid)
    {
        lock (pidCache) { Info c; if (pidCache.TryGetValue(pid, out c)) return c; }
        var i = new Info();
        string path = QueryPath(pid);
        string name = null;
        if (path != null) name = Path.GetFileName(path);
        else if (pid == 4) name = "System";
        else if (pid == 0) name = "Idle";
        else
        {
            lock (startNames) startNames.TryGetValue(pid, out name);
            if (name == null)
            {
                try { using (var p = Process.GetProcessById(pid)) name = p.ProcessName + ".exe"; }
                catch { name = "unknown"; }
            }
        }
        i.Name = name; i.Path = path; i.Key = name.ToLowerInvariant();
        i.Desc = Describe(path, name);
        string svc;
        if (i.Key == "svchost.exe" && svcByPid.TryGetValue(pid, out svc))
        {
            i.Key = "svchost.exe:" + svc;
            i.Desc = svc;
        }
        lock (pidCache) pidCache[pid] = i;
        return i;
    }

    static string QueryPath(int pid)
    {
        IntPtr h = OpenProcess(0x1000, false, pid); // PROCESS_QUERY_LIMITED_INFORMATION
        if (h == IntPtr.Zero) return null;
        try
        {
            var sb = new StringBuilder(1024);
            int size = sb.Capacity;
            return QueryFullProcessImageName(h, 0, sb, ref size) ? sb.ToString() : null;
        }
        finally { CloseHandle(h); }
    }

    static string Describe(string path, string fallback)
    {
        if (path == null) return fallback;
        lock (descCache)
        {
            string d;
            if (descCache.TryGetValue(path, out d)) return d;
            try
            {
                var vi = FileVersionInfo.GetVersionInfo(path);
                d = !string.IsNullOrWhiteSpace(vi.FileDescription) ? vi.FileDescription.Trim()
                  : !string.IsNullOrWhiteSpace(vi.ProductName) ? vi.ProductName.Trim() : fallback;
            }
            catch { d = fallback; }
            descCache[path] = d;
            return d;
        }
    }

    static void RefreshLocal()
    {
        var set = new HashSet<string>();
        foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (ni.OperationalStatus != OperationalStatus.Up) continue;
            foreach (var ua in ni.GetIPProperties().UnicastAddresses)
            {
                string s = ua.Address.ToString();
                int p = s.IndexOf('%');
                set.Add(p > 0 ? s.Substring(0, p) : s);
            }
        }
        localIps = set;
    }

    static void RefreshServices()
    {
        var map = new Dictionary<int, string>();
        using (var q = new ManagementObjectSearcher("SELECT Name, DisplayName, ProcessId FROM Win32_Service WHERE ProcessId > 0"))
        {
            foreach (ManagementObject m in q.Get())
            {
                int pid = Convert.ToInt32(m["ProcessId"]);
                string disp = Convert.ToString(m["DisplayName"]);
                if (!map.ContainsKey(pid)) map[pid] = disp; // أول خدمة داخل الحاوية
                m.Dispose();
            }
        }
        svcByPid = map;
    }
}
