import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Locale = "en" | "tr";

const translations = {
  en: {
    // Nav
    "nav.today": "Today",
    "nav.week": "Week",
    "nav.calendar": "Calendar",
    "nav.stats": "Stats",
    "nav.search": "Search",
    "nav.recurring": "Recurring",
    "nav.signOut": "Sign out",
    "nav.switchTheme": "Switch to {theme} theme",

    // Categories
    "cat.dev": "Development",
    "cat.meeting": "Meeting",
    "cat.review": "Code Review",
    "cat.ops": "Operations",
    "cat.learning": "Learning",
    "cat.personal": "Personal",
    "cat.other": "Other",

    // Days
    "day.sun": "Sun",
    "day.mon": "Mon",
    "day.tue": "Tue",
    "day.wed": "Wed",
    "day.thu": "Thu",
    "day.fri": "Fri",
    "day.sat": "Sat",

    // Recurrence
    "rec.daily": "Every day",
    "rec.weekdays": "Weekdays",
    "rec.weekly": "Weekly",
    "rec.custom": "Custom",

    // DayView
    "day.today": "Today",
    "day.planned": "Planned",
    "day.notes": "{count} note{s}",
    "day.noPlans": "No plans yet",
    "day.noPlansDesc": "Add what you want to accomplish",
    "day.noNotes": "No notes yet",
    "day.noNotesDesc": "Jot down quick thoughts or observations",
    "day.prevDay": "Previous day",
    "day.nextDay": "Next day",
    "day.goToday": "Go to today",
    "day.all": "All",
    "day.loading": "Loading day data",

    // TaskForm
    "form.addPlan": "Add a plan item",
    "form.addNote": "Add a note",
    "form.plan": "Plan",
    "form.quickNotes": "Quick Notes",
    "form.whatWillYouDo": "What will you do?",
    "form.addNotePlace": "Add a note...",
    "form.addTag": "Add tag...",
    "form.start": "Start",
    "form.duration": "Duration",
    "form.custom": "Custom",
    "form.add": "Add",
    "form.addedSuccess": "Added successfully",

    // PlanItem
    "plan.markAs": "Mark \"{desc}\" as {status}",
    "plan.delete": "Delete \"{desc}\"",
    "plan.confirmDelete": "Confirm delete \"{desc}\"",
    "plan.startPomodoro": "Start pomodoro for \"{desc}\"",
    "plan.done": "Done",
    "plan.skip": "Skip",
    "plan.complete": "complete",
    "plan.incomplete": "incomplete",

    // TaskItem
    "task.deleteNote": "Delete note",
    "task.confirmDelete": "Confirm delete",
    "task.edit": "Edit note",

    // Inline edit
    "edit.save": "Save",
    "edit.cancel": "Cancel",

    // Checklist
    "checklist.add": "Add a step...",

    // CarryOver
    "carry.incomplete": "{count} incomplete task{s} from yesterday",
    "carry.moving": "Moving...",
    "carry.carryOver": "Carry over",
    "carry.dismiss": "Dismiss",

    // Standup
    "standup.btn": "Standup",
    "standup.title": "Daily Standup",
    "standup.yesterday": "Yesterday:",
    "standup.today": "Today:",
    "standup.blockers": "Blockers/Carryover:",
    "standup.nothingCompleted": "(nothing completed)",
    "standup.noPlans": "(no plans yet)",
    "standup.copy": "Copy to clipboard",
    "standup.copied": "Copied!",

    // Pomodoro
    "pomo.title": "Pomodoro",
    "pomo.focus": "Focus",
    "pomo.break": "Break",
    "pomo.pause": "Pause",
    "pomo.start": "Start",
    "pomo.stopSave": "Stop and save",
    "pomo.reset": "Reset timer",
    "pomo.totalFocused": "Total focused: {m}m {s}s",

    // WeekView
    "week.title": "Week",
    "week.thisWeek": "This week",
    "week.prevWeek": "Previous week",
    "week.nextWeek": "Next week",
    "week.empty": "Empty",

    // Calendar
    "cal.title": "Calendar",
    "cal.prevMonth": "Previous month",
    "cal.nextMonth": "Next month",
    "cal.daysTracked": "Days Tracked",
    "cal.totalTasks": "Total Tasks",
    "cal.dayStreak": "Day Streak",
    "cal.tasks": "Tasks",
    "cal.plans": "Plans",
    "cal.activities": "{count} activities",

    // Stats
    "stats.title": "Statistics",
    "stats.completed": "Completed",
    "stats.timeTracked": "Time Tracked",
    "stats.streak": "Streak",
    "stats.daysActive": "Days Active",
    "stats.dailyActivity": "Daily Activity (Last 30 days)",
    "stats.byCategory": "By Category",
    "stats.timeByCategory": "Time by Category",
    "stats.noData": "No data yet",
    "stats.noDataDesc": "Start logging activities to see your stats here",
    "stats.loading": "Loading statistics",

    // Search
    "search.placeholder": "Search tasks, plans, notes...",
    "search.results": "{count} result{s} for \"{query}\"",
    "search.noResults": "No results found",
    "search.tryDifferent": "Try a different search term",
    "search.searchAll": "Search across all your days",
    "search.minChars": "Type at least 2 characters",

    // Recurring
    "recurring.title": "Recurring Tasks",
    "recurring.desc": "Auto-added to your daily plan",
    "recurring.taskDesc": "Task description...",
    "recurring.repeat": "Repeat",
    "recurring.pause": "Pause",
    "recurring.resume": "Resume",
    "recurring.noTasks": "No recurring tasks yet",
    "recurring.noTasksDesc": "Create tasks that auto-appear in your daily plan",
    "recurring.paused": "Paused",
    "recurring.everyDay": "Every day",
    "recurring.weekdays": "Weekdays",
    "recurring.every": "Every {day}",
    "recurring.create": "Create",
    "recurring.cancel": "Cancel",
    "recurring.delete": "Delete",

    // Login
    "login.signIn": "Sign in",
    "login.signInDesc": "Sign in to continue",
    "login.register": "Register",
    "login.registerDesc": "Create your account",
    "login.email": "Email",
    "login.username": "Username",
    "login.password": "Password",
    "login.confirmPassword": "Confirm Password",
    "login.emailPlace": "you@example.com",
    "login.usernamePlace": "Choose a username",
    "login.passwordPlace": "Enter your password",
    "login.passwordPlaceNew": "Min 6 characters",
    "login.confirmPasswordPlace": "Confirm your password",
    "login.passwordsMismatch": "Passwords don't match",
    "login.error": "Something went wrong",
    "login.signingIn": "Signing in...",
    "login.creatingAccount": "Creating account...",
    "login.createAccount": "Create account",

    // Profile / Settings
    "profile.title": "Profile & Settings",
    "profile.account": "Account",
    "profile.preferences": "Preferences",
    "profile.security": "Security",
    "profile.displayName": "Display Name",
    "profile.displayNamePlace": "Your display name",
    "profile.bio": "Bio",
    "profile.bioPlace": "Tell something about yourself...",
    "profile.email": "Email",
    "profile.username": "Username",
    "profile.timezone": "Timezone",
    "profile.locale": "Language",
    "profile.theme": "Theme",
    "profile.themeDark": "Dark",
    "profile.themeLight": "Light",
    "profile.pomodoro": "Pomodoro",
    "profile.pomodoroDuration": "Focus Duration",
    "profile.breakDuration": "Break Duration",
    "profile.minutes": "min",
    "profile.dailyGoal": "Daily Goal",
    "profile.dailyGoalPlace": "Tasks per day",
    "profile.workHours": "Work Hours",
    "profile.workStart": "Start",
    "profile.workEnd": "End",
    "profile.defaultCategory": "Default Category",
    "profile.isPublic": "Public Profile",
    "profile.isPublicDesc": "Allow others to see your profile",
    "profile.save": "Save Changes",
    "profile.saving": "Saving...",
    "profile.saved": "Changes saved",
    "profile.changePassword": "Change Password",
    "profile.currentPassword": "Current Password",
    "profile.newPassword": "New Password",
    "profile.confirmNewPassword": "Confirm New Password",
    "profile.passwordChanged": "Password changed successfully",
    "profile.passwordsMismatch": "Passwords don't match",
    "profile.memberSince": "Member since",
    "profile.deleteAccount": "Delete Account",
    "profile.deleteAccountDesc": "This action cannot be undone",
    "profile.nav": "Profile",

    // General
    "loading": "Loading...",

    // Footer
    "footer.madeBy": "Made by",
    "footer.contact": "Contact",
    "footer.license": "MIT License",
    "footer.rights": "All rights reserved.",
    "footer.source": "Source",
  },
  tr: {
    // Nav
    "nav.today": "Bugun",
    "nav.week": "Hafta",
    "nav.calendar": "Takvim",
    "nav.stats": "Istatistik",
    "nav.search": "Arama",
    "nav.recurring": "Tekrar",
    "nav.signOut": "Cikis yap",
    "nav.switchTheme": "{theme} temaya gec",

    // Categories
    "cat.dev": "Gelistirme",
    "cat.meeting": "Toplanti",
    "cat.review": "Kod Inceleme",
    "cat.ops": "Operasyon",
    "cat.learning": "Ogrenme",
    "cat.personal": "Kisisel",
    "cat.other": "Diger",

    // Days
    "day.sun": "Paz",
    "day.mon": "Pzt",
    "day.tue": "Sal",
    "day.wed": "Car",
    "day.thu": "Per",
    "day.fri": "Cum",
    "day.sat": "Cmt",

    // Recurrence
    "rec.daily": "Her gun",
    "rec.weekdays": "Hafta ici",
    "rec.weekly": "Haftalik",
    "rec.custom": "Ozel",

    // DayView
    "day.today": "Bugun",
    "day.planned": "Planlanan",
    "day.notes": "{count} not",
    "day.noPlans": "Henuz plan yok",
    "day.noPlansDesc": "Yapmak istediklerini ekle",
    "day.noNotes": "Henuz not yok",
    "day.noNotesDesc": "Hizli dusunceler veya gozlemler yaz",
    "day.prevDay": "Onceki gun",
    "day.nextDay": "Sonraki gun",
    "day.goToday": "Bugune git",
    "day.all": "Tumu",
    "day.loading": "Gun verisi yukleniyor",

    // TaskForm
    "form.addPlan": "Plan ekle",
    "form.addNote": "Not ekle",
    "form.plan": "Plan",
    "form.quickNotes": "Hizli Notlar",
    "form.whatWillYouDo": "Ne yapacaksin?",
    "form.addNotePlace": "Not ekle...",
    "form.addTag": "Etiket ekle...",
    "form.start": "Baslangic",
    "form.duration": "Sure",
    "form.custom": "Ozel",
    "form.add": "Ekle",
    "form.addedSuccess": "Basariyla eklendi",

    // PlanItem
    "plan.markAs": "\"{desc}\" {status} olarak isaretle",
    "plan.delete": "\"{desc}\" sil",
    "plan.confirmDelete": "\"{desc}\" silmeyi onayla",
    "plan.startPomodoro": "\"{desc}\" icin pomodoro baslat",
    "plan.done": "Tamam",
    "plan.skip": "Atla",
    "plan.complete": "tamamlandi",
    "plan.incomplete": "tamamlanmadi",

    // TaskItem
    "task.deleteNote": "Notu sil",
    "task.confirmDelete": "Silmeyi onayla",
    "task.edit": "Notu duzenle",

    // Inline edit
    "edit.save": "Kaydet",
    "edit.cancel": "Iptal",

    // Checklist
    "checklist.add": "Adim ekle...",

    // CarryOver
    "carry.incomplete": "Dunden {count} tamamlanmamis gorev",
    "carry.moving": "Tasiniyor...",
    "carry.carryOver": "Tasi",
    "carry.dismiss": "Kapat",

    // Standup
    "standup.btn": "Standup",
    "standup.title": "Gunluk Standup",
    "standup.yesterday": "Dun:",
    "standup.today": "Bugun:",
    "standup.blockers": "Engeller/Devir:",
    "standup.nothingCompleted": "(tamamlanan yok)",
    "standup.noPlans": "(henuz plan yok)",
    "standup.copy": "Panoya kopyala",
    "standup.copied": "Kopyalandi!",

    // Pomodoro
    "pomo.title": "Pomodoro",
    "pomo.focus": "Odak",
    "pomo.break": "Mola",
    "pomo.pause": "Duraklat",
    "pomo.start": "Baslat",
    "pomo.stopSave": "Durdur ve kaydet",
    "pomo.reset": "Zamanlayiciyi sifirla",
    "pomo.totalFocused": "Toplam odak: {m}dk {s}sn",

    // WeekView
    "week.title": "Hafta",
    "week.thisWeek": "Bu hafta",
    "week.prevWeek": "Onceki hafta",
    "week.nextWeek": "Sonraki hafta",
    "week.empty": "Bos",

    // Calendar
    "cal.title": "Takvim",
    "cal.prevMonth": "Onceki ay",
    "cal.nextMonth": "Sonraki ay",
    "cal.daysTracked": "Takip Edilen",
    "cal.totalTasks": "Toplam Gorev",
    "cal.dayStreak": "Seri",
    "cal.tasks": "Gorevler",
    "cal.plans": "Planlar",
    "cal.activities": "{count} aktivite",

    // Stats
    "stats.title": "Istatistikler",
    "stats.completed": "Tamamlanan",
    "stats.timeTracked": "Takip Suresi",
    "stats.streak": "Seri",
    "stats.daysActive": "Aktif Gun",
    "stats.dailyActivity": "Gunluk Aktivite (Son 30 gun)",
    "stats.byCategory": "Kategoriye Gore",
    "stats.timeByCategory": "Kategoriye Gore Sure",
    "stats.noData": "Henuz veri yok",
    "stats.noDataDesc": "Istatistikleri gormek icin aktivite kaydetmeye basla",
    "stats.loading": "Istatistikler yukleniyor",

    // Search
    "search.placeholder": "Gorev, plan, not ara...",
    "search.results": "\"{query}\" icin {count} sonuc",
    "search.noResults": "Sonuc bulunamadi",
    "search.tryDifferent": "Farkli bir arama terimi dene",
    "search.searchAll": "Tum gunlerde ara",
    "search.minChars": "En az 2 karakter yaz",

    // Recurring
    "recurring.title": "Tekrarlayan Gorevler",
    "recurring.desc": "Gunluk planina otomatik eklenir",
    "recurring.taskDesc": "Gorev aciklamasi...",
    "recurring.repeat": "Tekrar",
    "recurring.pause": "Duraklat",
    "recurring.resume": "Devam et",
    "recurring.noTasks": "Henuz tekrarlayan gorev yok",
    "recurring.noTasksDesc": "Gunluk planinda otomatik gorunen gorevler olustur",
    "recurring.paused": "Duraklatildi",
    "recurring.everyDay": "Her gun",
    "recurring.weekdays": "Hafta ici",
    "recurring.every": "Her {day}",
    "recurring.create": "Olustur",
    "recurring.cancel": "Iptal",
    "recurring.delete": "Sil",

    // Login
    "login.signIn": "Giris yap",
    "login.signInDesc": "Devam etmek icin giris yap",
    "login.register": "Kayit ol",
    "login.registerDesc": "Hesabini olustur",
    "login.email": "E-posta",
    "login.username": "Kullanici adi",
    "login.password": "Sifre",
    "login.confirmPassword": "Sifre Tekrar",
    "login.emailPlace": "ornek@email.com",
    "login.usernamePlace": "Kullanici adi sec",
    "login.passwordPlace": "Sifreni gir",
    "login.passwordPlaceNew": "En az 6 karakter",
    "login.confirmPasswordPlace": "Sifreni tekrar gir",
    "login.passwordsMismatch": "Sifreler eslesmiyor",
    "login.error": "Bir seyler yanlis gitti",
    "login.signingIn": "Giris yapiliyor...",
    "login.creatingAccount": "Hesap olusturuluyor...",
    "login.createAccount": "Hesap olustur",

    // Profile / Settings
    "profile.title": "Profil ve Ayarlar",
    "profile.account": "Hesap",
    "profile.preferences": "Tercihler",
    "profile.security": "Guvenlik",
    "profile.displayName": "Gorunen Ad",
    "profile.displayNamePlace": "Gorunen adiniz",
    "profile.bio": "Hakkinda",
    "profile.bioPlace": "Kendiniz hakkinda bir seyler yazin...",
    "profile.email": "E-posta",
    "profile.username": "Kullanici Adi",
    "profile.timezone": "Saat Dilimi",
    "profile.locale": "Dil",
    "profile.theme": "Tema",
    "profile.themeDark": "Koyu",
    "profile.themeLight": "Acik",
    "profile.pomodoro": "Pomodoro",
    "profile.pomodoroDuration": "Odak Suresi",
    "profile.breakDuration": "Mola Suresi",
    "profile.minutes": "dk",
    "profile.dailyGoal": "Gunluk Hedef",
    "profile.dailyGoalPlace": "Gunluk gorev sayisi",
    "profile.workHours": "Calisma Saatleri",
    "profile.workStart": "Baslangic",
    "profile.workEnd": "Bitis",
    "profile.defaultCategory": "Varsayilan Kategori",
    "profile.isPublic": "Herkese Acik Profil",
    "profile.isPublicDesc": "Baskalarinin profilinizi gormesine izin verin",
    "profile.save": "Degisiklikleri Kaydet",
    "profile.saving": "Kaydediliyor...",
    "profile.saved": "Degisiklikler kaydedildi",
    "profile.changePassword": "Sifre Degistir",
    "profile.currentPassword": "Mevcut Sifre",
    "profile.newPassword": "Yeni Sifre",
    "profile.confirmNewPassword": "Yeni Sifre Tekrar",
    "profile.passwordChanged": "Sifre basariyla degistirildi",
    "profile.passwordsMismatch": "Sifreler eslesmiyor",
    "profile.memberSince": "Uyelik tarihi",
    "profile.deleteAccount": "Hesabi Sil",
    "profile.deleteAccountDesc": "Bu islem geri alinamaz",
    "profile.nav": "Profil",

    // General
    "loading": "Yukleniyor...",

    // Footer
    "footer.madeBy": "Yapımcı",
    "footer.contact": "İletişim",
    "footer.license": "MIT Lisans",
    "footer.rights": "Tüm hakları saklıdır.",
    "footer.source": "Kaynak Kod",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem("gmd-locale");
    if (stored === "tr" || stored === "en") return stored;
  } catch {}
  return "tr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("gmd-locale", l);
    document.documentElement.lang = l;
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, []);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = (translations[locale] as Record<string, string>)[key] || (translations.en as Record<string, string>)[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return text;
  };

  return (
    <I18nContext value={{ locale, setLocale, t }}>
      {children}
    </I18nContext>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// Helper to get category label via i18n
const CATEGORY_KEYS: Record<string, TranslationKey> = {
  dev: "cat.dev",
  meeting: "cat.meeting",
  review: "cat.review",
  ops: "cat.ops",
  learning: "cat.learning",
  personal: "cat.personal",
  other: "cat.other",
};

export function useCategoryLabel() {
  const { t } = useI18n();
  return (cat: string) => t(CATEGORY_KEYS[cat] || "cat.other");
}

const DAY_KEYS: TranslationKey[] = ["day.sun", "day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat"];

export function useDayLabels() {
  const { t } = useI18n();
  return DAY_KEYS.map((k) => t(k));
}

const RECURRENCE_KEYS: Record<string, TranslationKey> = {
  daily: "rec.daily",
  weekdays: "rec.weekdays",
  weekly: "rec.weekly",
  custom: "rec.custom",
};

export function useRecurrenceLabel() {
  const { t } = useI18n();
  return (rec: string) => t(RECURRENCE_KEYS[rec] || "rec.custom");
}
