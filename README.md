<div align="center">

<img src="assets/icon.png" width="110" alt="Internet Meter logo" />

# عدّاد الإنترنت · Internet Meter

**تابع استهلاك باقة الإنترنت لحظةً بلحظة، واعرف هل ستكفيك حتى نهاية الشهر.**
**Track your monthly internet quota in real time and know if it will last until the end of the cycle.**

[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4?logo=windows)](https://github.com/raiedahmed/InternetMeter/releases)
[![Electron](https://img.shields.io/badge/Electron-React%20%2B%20TypeScript-47848F?logo=electron)](https://www.electronjs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Privacy](https://img.shields.io/badge/data-100%25%20local-success)](#-الخصوصية--privacy)

[⬇️ تنزيل المثبّت · Download](https://github.com/raiedahmed/InternetMeter/releases/latest) · [العربية](#-بالعربية) · [English](#-english)

</div>

---

## 🇪🇬 بالعربية

### ما هو؟
**عدّاد الإنترنت** برنامج مجاني ومفتوح المصدر لويندوز، يحسب كل ما يمر عبر اتصالك بالإنترنت ويقارنه بباقتك الشهرية، ليخبرك بدقة: كم استهلكت؟ كم تبقّى؟ وكم يمكنك استخدامه يومياً دون أن تنتهي الباقة؟

### ✨ المميزات
| الميزة | الوصف |
|---|---|
| 📊 **عدّاد مباشر** | سرعة التحميل والرفع الآن، واستهلاك اليوم. |
| 🎯 **الحصة اليومية الآمنة** | كم جيجا يمكنك استخدامها اليوم لتكفيك الباقة حتى التجديد. |
| 🔮 **توقع ذكي** | "بمعدلك الحالي ستنتهي باقتك يوم كذا" قبل أن تحدث المشكلة. |
| 📅 **دورة فوترة مرنة** | حدّد يوم تجديد الباقة، والبرنامج يحسب الدورة تلقائياً. |
| 🔔 **تنبيهات** | إشعارات ويندوز عند بلوغ 50% / 80% / 90% / 95% (قابلة للتخصيص). |
| 🧮 **ماذا يعني المتبقي؟** | تحويل المتبقي إلى ساعات يوتيوب ومكالمات وأفلام. |
| 🎚️ **معايرة مع شركة الإنترنت** | أدخل الرقم الذي تعرضه شركتك فيتم ضبط العدّاد عليه. |
| 📈 **رسم بياني يومي** | استهلاك كل يوم في الدورة مقابل الحصة الآمنة. |
| 🧷 **يعمل في الخلفية** | أيقونة في شريط المهام، وتشغيل تلقائي اختياري مع ويندوز. |
| 🌐 **ثنائي اللغة** | عربي وإنجليزي بتبديل فوري (واجهة RTL/LTR)، وتُحفظ لغتك وتشمل التنبيهات وقائمة الأيقونة. |
| 🔒 **خصوصية كاملة** | كل البيانات على جهازك فقط، بلا حسابات ولا خوادم. |

### 📥 التثبيت
1. اذهب إلى صفحة [**Releases**](https://github.com/raiedahmed/InternetMeter/releases/latest).
2. نزّل `InternetMeter-Setup-x.y.z.exe` وشغّله واتبع المثبّت.
3. عند أول تشغيل أدخل سعة باقتك ويوم التجديد.

> ⚠️ المثبّت غير موقّع رقمياً حالياً، لذا قد تعرض ويندوز SmartScreen تحذيراً. اضغط **More info ← Run anyway**. الكود كله مفتوح للمراجعة هنا.

### ⚙️ كيف يعمل؟
يشغّل البرنامج سكربت PowerShell خفيفاً في الخلفية يقرأ عدّادات الأداء الخام `Win32_PerfRawData_Tcpip_NetworkInterface` (64-بت) **لكروت الشبكة الفعلية فقط** (Wi-Fi وEthernet) فلا يُحتسب VPN أو الأجهزة الافتراضية مرتين. تُحفظ الفروقات يومياً في ملف JSON محلي، كما يعوّض البرنامج الاستهلاك الذي حدث أثناء إغلاقه (ما لم يُعاد تشغيل الجهاز).

### ⚠️ ملاحظات مهمة
- العدّاد يحسب **كل** ما يمر عبر كرت الشبكة، بما فيه الشبكة المحلية (LAN)، وقد يختلف قليلاً عن حساب الشركة. استخدم خاصية **المعايرة** لتقريبه.
- كل 1 جيجا = 1024³ بايت. بعض الشركات تستخدم 1000³، فاضبط السعة وفق ذلك.
- لا يحسب البرنامج استهلاك الأجهزة الأخرى على الراوتر (مخطّط لإصدار قادم).

### 🗺️ خارطة الطريق
- [ ] الاستهلاك لكل تطبيق (ETW)
- [ ] قراءة استهلاك الراوتر وكل أجهزة المنزل
- [ ] الباقات الليلية والمجانية وانخفاض السرعة بعد حد معين
- [ ] تقارير PDF / Excel وويدجت عائم
- [ ] مقارنة الباقات واقتراح الأنسب

---

## 🇬🇧 English

### What is it?
**Internet Meter** is a free, open-source Windows app that counts everything flowing through your internet connection and compares it to your monthly data plan, telling you what you've used, what's left, and how much you can safely use per day.

### ✨ Features
- **Live meter** – current download/upload speed and today's usage.
- **Safe daily allowance** – how much you can use today so the plan lasts until renewal.
- **Smart forecast** – "At this pace your plan runs out on the 22nd", before it happens.
- **Flexible billing cycle** – choose your renewal day.
- **Alerts** – native Windows notifications at 50 / 80 / 90 / 95 % (configurable).
- **What does the remainder mean?** – converted to hours of video, calls, movies.
- **ISP calibration** – type the figure your provider shows and the meter syncs to it.
- **Bilingual** – Arabic (RTL) and English (LTR), switch instantly; applies to notifications and the tray menu too.
- **Daily chart**, **tray icon**, optional **start with Windows**.
- **100 % local** – no accounts, no servers, no telemetry.

### 📥 Install
Download the latest `InternetMeter-Setup-x.y.z.exe` from [Releases](https://github.com/raiedahmed/InternetMeter/releases/latest) and run it.
The installer is currently unsigned, so Windows SmartScreen may warn you: **More info → Run anyway**.

### 🛠️ Build from source
Requirements: Windows 10/11, [Node.js](https://nodejs.org/) 20+.

```bash
git clone https://github.com/raiedahmed/InternetMeter.git
cd InternetMeter
npm install

npm run dev      # development with hot reload (Vite + Electron)
npm run web      # UI only in the browser with mock data
npm run start    # build UI and run the desktop app
npm run dist     # produce the installer in ./release
```

### 🧱 Tech stack & structure
| Layer | Technology |
|---|---|
| Shell | Electron |
| UI | React 19 + TypeScript + Vite (RTL Arabic) |
| Metering | Persistent PowerShell process reading 64-bit NIC perf counters |
| Storage | Atomic-write JSON in `%APPDATA%` |
| Packaging | electron-builder (NSIS installer) |

```
electron/   main process, tray, notifications, NIC monitor, store
shared/     pure calculation logic (billing cycle, forecast) used by both sides
src/        React UI
assets/     icons
```

### 🔒 الخصوصية · Privacy
Only byte **counters** are read — never packet contents, addresses, or browsing history. Everything stays in `%APPDATA%\عدّاد الإنترنت\data.json` on your machine.

### 🤝 Contributing
Issues and pull requests are welcome! Please open an issue first to discuss larger changes.

### 📄 License
[MIT](LICENSE) © raiedahmed
