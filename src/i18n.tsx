import { createContext, useContext } from 'react';

export type Lang = 'ar' | 'en';

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dict = {
  ar: {
    appName: 'عدّاد الإنترنت',
    loading: 'جارٍ التحميل…',
    settings: '⚙ الإعدادات',
    downNow: 'سرعة التحميل الآن',
    upNow: 'سرعة الرفع الآن',
    switchLang: 'English',
    bannerOver: 'انتهت باقتك لهذه الدورة.',
    bannerRunOut: 'بمعدل استهلاكك الحالي ستنتهي باقتك يوم {date} — قبل نهاية الدورة ({end}).',
    bannerWarn: 'اقتربت من حد الباقة، لكنها ما تزال تكفي بمعدلك الحالي.',
    bannerOk: 'ممتاز! باقتك ستكفيك حتى نهاية الدورة بمعدل استهلاكك الحالي.',
    remaining: 'المتبقي',
    cycle: 'دورة الفوترة: {a} ← {b} · متبقي {n} يوم',
    today: 'استهلاك اليوم',
    safeDaily: 'الحصة اليومية الآمنة',
    safeHint: 'كي تكفيك الباقة حتى النهاية',
    avgDaily: 'متوسط استهلاكك اليومي',
    sinceStart: 'منذ بداية الدورة',
    forecast: 'التوقع لنهاية الدورة',
    overPlan: 'أعلى من باقتك ⚠',
    withinPlan: 'ضمن حدود باقتك',
    dailyChart: 'الاستهلاك اليومي خلال الدورة',
    hoverHint: 'مرّر على عمود لرؤية التفاصيل',
    safeLabel: 'الحصة الآمنة',
    meaning: 'ماذا يعني المتبقي لك؟',
    approx: '(تقديري)',
    actYoutube: 'ساعات يوتيوب (1080p)',
    actCalls: 'ساعات مكالمات فيديو',
    actMovies: 'أفلام HD',
    actMusic: 'ساعات موسيقى',
    welcome: 'مرحباً! لنُعدّ باقتك',
    settingsTitle: 'الإعدادات',
    quota: 'سعة الباقة الشهرية (جيجابايت)',
    renewDay: 'يوم تجديد الباقة من الشهر (1 – 31)',
    ispUsage: 'الاستهلاك الحالي حسب شركة الإنترنت (جيجابايت) — اختياري',
    ispPlaceholder: 'مثال: 85.4',
    ispNote: 'يُستخدم لمعايرة البرنامج مع رقم الشركة، خاصةً إن كنت قد استهلكت جزءاً قبل التثبيت.',
    alertsAt: 'تنبيهات عند بلوغ',
    autoStart: 'تشغيل البرنامج تلقائياً مع ويندوز',
    language: 'اللغة',
    cancel: 'إلغاء',
    save: 'حفظ',
  },
  en: {
    appName: 'Internet Meter',
    loading: 'Loading…',
    settings: '⚙ Settings',
    downNow: 'Current download speed',
    upNow: 'Current upload speed',
    switchLang: 'العربية',
    bannerOver: 'Your plan is used up for this cycle.',
    bannerRunOut: 'At your current pace your plan will run out on {date} — before the cycle ends ({end}).',
    bannerWarn: 'You are close to your limit, but the plan still lasts at your current pace.',
    bannerOk: 'Great! Your plan will last until the end of the cycle at your current pace.',
    remaining: 'Remaining',
    cycle: 'Billing cycle: {a} → {b} · {n} days left',
    today: "Today's usage",
    safeDaily: 'Safe daily allowance',
    safeHint: 'So the plan lasts until renewal',
    avgDaily: 'Your daily average',
    sinceStart: 'Since cycle start',
    forecast: 'End-of-cycle forecast',
    overPlan: 'Above your plan ⚠',
    withinPlan: 'Within your plan',
    dailyChart: 'Daily usage this cycle',
    hoverHint: 'Hover a bar for details',
    safeLabel: 'Safe allowance',
    meaning: 'What does your remainder mean?',
    approx: '(approx.)',
    actYoutube: 'Hours of YouTube (1080p)',
    actCalls: 'Hours of video calls',
    actMovies: 'HD movies',
    actMusic: 'Hours of music',
    welcome: "Welcome! Let's set up your plan",
    settingsTitle: 'Settings',
    quota: 'Monthly plan size (GB)',
    renewDay: 'Renewal day of the month (1 – 31)',
    ispUsage: 'Current usage according to your ISP (GB) — optional',
    ispPlaceholder: 'e.g. 85.4',
    ispNote: 'Used to calibrate the meter to your ISP figure, especially if you used data before installing.',
    alertsAt: 'Alert me at',
    autoStart: 'Start with Windows',
    language: 'Language',
    cancel: 'Cancel',
    save: 'Save',
  },
} as const;

export type Key = keyof (typeof dict)['ar'];

export function detectLang(): Lang {
  return (typeof navigator !== 'undefined' && navigator.language || 'en').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

export function makeI18n(lang: Lang) {
  const t = (key: Key, params?: Record<string, string | number>) => {
    let s: string = dict[lang][key];
    if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
    return s;
  };
  const fmtDate = (d: Date) => (lang === 'ar' ? `${d.getDate()} ${AR_MONTHS[d.getMonth()]}` : `${EN_MONTHS[d.getMonth()]} ${d.getDate()}`);
  return { lang, t, fmtDate };
}

export type I18n = ReturnType<typeof makeI18n>;
export const I18nContext = createContext<I18n>(makeI18n('ar'));
export const useI18n = () => useContext(I18nContext);
