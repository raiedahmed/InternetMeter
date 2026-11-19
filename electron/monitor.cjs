const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const os = require('os');

// سكربت PowerShell دائم التشغيل يقرأ عدّادات 64-بت لكروت الشبكة الفعلية فقط
// (Wi-Fi / Ethernet) ويتجاهل الكروت الافتراضية وVPN لتفادي العدّ المزدوج.
// المصدر: عدّادات الأداء الخام Win32_PerfRawData_Tcpip_NetworkInterface (64-بت، تعمل مع كل التعريفات
// حتى كروت USB Wi-Fi التي لا تدعم Get-NetAdapterStatistics). أسماؤها تُحوَّل: ( ) → [ ] و # / \ → _
const SCRIPT = String.raw`
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'
$map = @{}; $last = [DateTime]::MinValue
while ($true) {
  if (([DateTime]::Now - $last).TotalSeconds -gt 15) {
    $map = @{}
    Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' } | ForEach-Object {
      $k = $_.InterfaceDescription.Replace('(', '[').Replace(')', ']').Replace('#', '_').Replace('/', '_').Replace('\', '_')
      $map[$k] = $_.Name
    }
    $last = [DateTime]::Now
  }
  $out = @()
  foreach ($r in (Get-CimInstance Win32_PerfRawData_Tcpip_NetworkInterface)) {
    if ($map.ContainsKey($r.Name)) {
      $out += [pscustomobject]@{ n = $map[$r.Name]; r = [int64]$r.BytesReceivedPersec; t = [int64]$r.BytesSentPersec }
    }
  }
  [Console]::Out.WriteLine((ConvertTo-Json -InputObject @($out) -Compress))
  Start-Sleep -Seconds 1
}`;

class Monitor extends EventEmitter {
  constructor(counters) {
    super();
    this.counters = counters; // { boot, adapters: { name: {r,t} } } محفوظة بين التشغيلات
    this.boot = Math.round((Date.now() - os.uptime() * 1000) / 60000); // دقائق، لاكتشاف إعادة التشغيل
    this.sameBoot = Math.abs(this.boot - (counters.boot || 0)) <= 2;
    this.seen = new Set();
    this.lastT = 0;
    this.buf = '';
  }

  start() {
    const enc = Buffer.from(SCRIPT, 'utf16le').toString('base64');
    this.ps = spawn('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc],
      { windowsHide: true });
    this.ps.stdout.setEncoding('utf8');
    this.ps.stdout.on('data', (c) => {
      this.buf += c;
      let i;
      while ((i = this.buf.indexOf('\n')) >= 0) {
        const line = this.buf.slice(0, i).trim();
        this.buf = this.buf.slice(i + 1);
        if (line) this.onLine(line);
      }
    });
    this.ps.on('exit', () => { if (!this.stopped) setTimeout(() => this.start(), 3000); });
    this.ps.on('error', (e) => this.emit('error', e));
  }

  onLine(line) {
    let arr;
    try { arr = JSON.parse(line); } catch { return; }
    if (!Array.isArray(arr)) arr = [arr];
    const now = Date.now();
    const dt = this.lastT ? (now - this.lastT) / 1000 : 0;
    this.lastT = now;

    let down = 0, up = 0, catchup = 0;
    for (const a of arr) {
      const prev = this.counters.adapters[a.n];
      if (prev && (this.seen.has(a.n) || this.sameBoot) && a.r >= prev.r && a.t >= prev.t) {
        const dr = a.r - prev.r, dtx = a.t - prev.t;
        if (!this.seen.has(a.n)) catchup += dr + dtx; // استهلاك حدث والبرنامج مغلق
        down += dr; up += dtx;
      }
      // في حال انخفض العدّاد (إعادة تشغيل/إعادة ضبط الكرت) نعتمد القيمة كخط أساس جديد
      this.counters.adapters[a.n] = { r: a.r, t: a.t };
      this.seen.add(a.n);
    }
    this.counters.boot = this.boot;
    this.emit('sample', { down, up, dt, catchup });
  }

  stop() { this.stopped = true; try { this.ps.kill(); } catch { /* ignore */ } }
}

module.exports = { Monitor };
