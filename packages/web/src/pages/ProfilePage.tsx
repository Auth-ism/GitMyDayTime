import { useState, useEffect, useRef } from "react";
import {
  User, Settings, Shield, Clock, Save, Check, Eye, EyeOff, ChevronDown,
  Download, Upload, Bell, Camera, Mail, AlertCircle, Plus, Pencil, Trash2,
  X, Tag, Smartphone, Palette,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme, type Theme } from "@/lib/theme";
import { useFontSize, type FontSize } from "@/lib/fontSize";
import { useI18n, useCategoryLabel, type Locale } from "@/lib/i18n";
import { useCategories } from "@/hooks/useCategories";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "framer-motion";
import { CATEGORY_COLORS, type UpdateProfileInput } from "@gmd/shared";
import { PRESET_COLORS } from "@/components/TaskForm";
import CalendarSubscribeSection from "@/components/CalendarSubscribeSection";
import ApiTokensSection from "@/components/ApiTokensSection";

const TIMEZONES = [
  "Europe/Istanbul", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Europe/Moscow", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Asia/Tokyo", "Asia/Shanghai", "Asia/Dubai",
  "Australia/Sydney", "Pacific/Auckland",
];

const CATEGORIES = [
  { value: "dev", labelKey: "cat.dev" },
  { value: "meeting", labelKey: "cat.meeting" },
  { value: "review", labelKey: "cat.review" },
  { value: "ops", labelKey: "cat.ops" },
  { value: "learning", labelKey: "cat.learning" },
  { value: "personal", labelKey: "cat.personal" },
  { value: "other", labelKey: "cat.other" },
] as const;

type Tab = "account" | "preferences" | "notifications" | "security";

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 8) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}

function rawPhone(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

export default function ProfilePage() {
  const { profile, refreshProfile, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { fontSize, setFontSize } = useFontSize();
  const { t, locale, setLocale } = useI18n();

  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [form, setForm] = useState<Partial<UpdateProfileInput>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Email change (now in security tab)
  const [emailPassword, setEmailPassword] = useState("");
  const [emailChanged, setEmailChanged] = useState(false);
  const originalEmail = useRef("");

  // Email verification
  const [verifySent, setVerifySent] = useState(false);
  const [verifySending, setVerifySending] = useState(false);

  // Push notifications
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Export/Import
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Phone
  const [phoneDisplay, setPhoneDisplay] = useState("");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(supported);
    if (supported) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => setPushEnabled(!!sub));
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (profile) {
      originalEmail.current = profile.email;
      setForm({
        displayName: profile.displayName,
        bio: profile.bio,
        email: profile.email,
        username: profile.username,
        timezone: profile.timezone,
        locale: profile.locale as "tr" | "en",
        theme: profile.theme as "light" | "dark",
        pomodoroDuration: profile.pomodoroDuration,
        breakDuration: profile.breakDuration,
        dailyGoal: profile.dailyGoal,
        workStartTime: profile.workStartTime,
        workEndTime: profile.workEndTime,
        defaultCategory: profile.defaultCategory as any,
        isPublic: profile.isPublic,
        phoneNumber: profile.phoneNumber,
        smsNotifications: profile.smsNotifications,
        emailNotifications: profile.emailNotifications,
        pushNotifications: profile.pushNotifications,
        planEmailNotifications: profile.planEmailNotifications,
        planSmsNotifications: profile.planSmsNotifications,
        planPushNotifications: profile.planPushNotifications,
        reminderEmailNotifications: profile.reminderEmailNotifications,
        reminderSmsNotifications: profile.reminderSmsNotifications,
        reminderPushNotifications: profile.reminderPushNotifications,
        notifyBeforeMinutes: profile.notifyBeforeMinutes ?? 0,
        silentHoursStart: profile.silentHoursStart ?? null,
        silentHoursEnd: profile.silentHoursEnd ?? null,
        fontSize: profile.fontSize ?? "normal",
        weeklyRecapEnabled: profile.weeklyRecapEnabled ?? false,
      });
      setPhoneDisplay(profile.phoneNumber ? formatPhoneInput(profile.phoneNumber) : "");
      if (profile.avatarUrl) setAvatarPreview(profile.avatarUrl);
    }
  }, [profile]);

  useEffect(() => {
    setEmailChanged(!!form.email && form.email !== originalEmail.current);
  }, [form.email]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 150_000) { setError("Fotograf cok buyuk (max 150KB)"); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      try { await api.uploadAvatar(base64); await refreshProfile(); }
      catch { setError("Avatar yuklenemedi"); }
    };
    reader.readAsDataURL(file);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.exportData();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gmd-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* noop */ } finally { setExporting(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await api.importData(data);
      setImportResult(`${result.plans} plan, ${result.tasks} gorev, ${result.recurringTasks} tekrar, ${result.journals} jurnal yuklendi`);
    } catch (err: any) {
      setImportResult("Yukleme basarisiz: " + (err.message || "Bilinmeyen hata"));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTogglePush = async () => {
    if (!pushSupported) return;
    setPushLoading(true);
    try {
      if (pushEnabled) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        await api.unsubscribePush();
        await api.updateProfile({ pushNotifications: false });
        await refreshProfile();
        setPushEnabled(false);
        setForm((f) => ({ ...f, pushNotifications: false }));
      } else {
        const { publicKey } = await api.getVapidKey();
        if (!publicKey) { console.error("VAPID public key is empty"); return; }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") { console.warn("Notification permission denied:", permission); return; }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        await api.subscribePush(sub.toJSON() as PushSubscriptionJSON);
        await api.updateProfile({ pushNotifications: true });
        await refreshProfile();
        setPushEnabled(true);
        setForm((f) => ({ ...f, pushNotifications: true }));
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
      alert("Push bildirimi etkinleştirilemedi: " + (err instanceof Error ? err.message : String(err)));
    } finally { setPushLoading(false); }
  };

  const handleSave = async () => {
    const phone = rawPhone(phoneDisplay);
    if (phone && (phone.length !== 10 || !phone.startsWith("5"))) {
      setError("Gecersiz telefon numarasi (5XXXXXXXXX formatinda 10 hane)");
      return;
    }
    if (emailChanged && !emailPassword) {
      setError("E-posta degistirmek icin mevcut sifrenizi girin");
      return;
    }
    setSaving(true); setError(""); setSaved(false);
    try {
      const payload = {
        ...form,
        phoneNumber: phone || null,
        ...(emailChanged ? { currentPassword: emailPassword } : {}),
      };
      await api.updateProfile(payload);
      await refreshProfile();
      if (form.theme && form.theme !== theme) setTheme(form.theme as Theme);
      if (form.locale && form.locale !== locale) setLocale(form.locale as Locale);
      if (form.fontSize && form.fontSize !== fontSize) setFontSize(form.fontSize as FontSize);
      setEmailPassword("");
      originalEmail.current = form.email || originalEmail.current;
      setEmailChanged(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || "Kaydetme basarisiz");
    } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) { setPasswordError(t("profile.passwordsMismatch" as any)); return; }
    setPasswordSaving(true); setPasswordError(""); setPasswordSaved(false);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err: any) { setPasswordError(err.message || "Failed to change password"); }
    finally { setPasswordSaving(false); }
  };

  const initials = profile
    ? (profile.displayName || profile.username).slice(0, 2).toUpperCase()
    : "?";

  const tabs: { key: Tab; icon: typeof User; labelKey: string }[] = [
    { key: "account", icon: User, labelKey: "profile.account" },
    { key: "preferences", icon: Settings, labelKey: "profile.preferences" },
    { key: "notifications", icon: Bell, labelKey: "profile.notifications" },
    { key: "security", icon: Shield, labelKey: "profile.security" },
  ];

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-text-tertiary">{t("loading" as any)}</p>
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && e.target instanceof HTMLInputElement) {
      // Don't trigger save for inputs inside CategoryManager
      const target = e.target as HTMLElement;
      if (target.closest("[data-category-manager]")) return;
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4" onKeyDown={handleKeyDown}>
      {/* Compact header */}
      <div className="flex items-center gap-3">
        <div className="relative group shrink-0">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-accent-soft text-text-secondary flex items-center justify-center text-xs font-semibold">
              {initials}
            </div>
          )}
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="absolute inset-0 rounded-xl bg-black/30 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center"
          >
            <Camera size={14} className="text-white" />
          </button>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-text truncate">{profile.displayName || profile.username}</h1>
          <p className="text-[11px] text-text-tertiary">@{profile.username}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 p-0.5 bg-bg-tertiary/50 rounded-lg">
        {tabs.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all flex-1",
              activeTab === key
                ? "bg-bg-elevated text-text shadow-sm"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{t(labelKey as any)}</span>
          </button>
        ))}
      </div>

      {/* === ACCOUNT TAB === */}
      {activeTab === "account" && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <Section>
            <Field label={t("profile.displayName" as any)}>
              <input className="input-sm" value={form.displayName ?? ""} onChange={(e) => setForm({ ...form, displayName: e.target.value || null })} placeholder={t("profile.displayNamePlace" as any)} />
            </Field>
            <Field label={t("profile.username" as any)}>
              <input className="input-sm" value={form.username ?? ""} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label={t("profile.bio" as any)}>
              <textarea className="input-sm resize-none" rows={2} value={form.bio ?? ""} onChange={(e) => setForm({ ...form, bio: e.target.value || null })} placeholder={t("profile.bioPlace" as any)} maxLength={256} />
              <span className="text-[10px] text-text-tertiary float-right">{(form.bio ?? "").length}/256</span>
            </Field>
          </Section>

          <Section>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("profile.timezone" as any)}>
                <div className="relative">
                  <select className="input-sm appearance-none pr-7" value={form.timezone ?? "Europe/Istanbul"} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
                </div>
              </Field>
              <Field label={t("profile.locale" as any)}>
                <div className="flex gap-1.5">
                  {(["tr", "en"] as const).map((l) => (
                    <button key={l} onClick={() => setForm({ ...form, locale: l })} className={cn("flex-1 py-1.5 rounded-md text-xs font-medium transition-all", form.locale === l ? "bg-accent text-bg" : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary")}>
                      {l === "tr" ? "TR" : "EN"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <ToggleRow
              label={t("profile.isPublic" as any)}
              desc={t("profile.isPublicDesc" as any)}
              checked={form.isPublic ?? false}
              onChange={(v) => setForm({ ...form, isPublic: v })}
            />
          </Section>

          <CategoryManager />

          <SaveBar onClick={handleSave} saving={saving} saved={saved} error={error} t={t} />
        </motion.div>
      )}

      {/* === PREFERENCES TAB === */}
      {activeTab === "preferences" && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <Section icon={<Palette size={14} className="text-text-secondary" />} title={t("profile.theme" as any)}>
            <div className="flex gap-1.5">
              {(["system", "light", "dark"] as const).map((th) => (
                <button key={th} onClick={() => setForm({ ...form, theme: th })} className={cn("flex-1 py-1.5 rounded-md text-xs font-medium transition-all", form.theme === th ? "bg-accent text-bg" : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary")}>
                  {th === "system" ? t("profile.themeSystem" as any) : t(th === "light" ? "profile.themeLight" as any : "profile.themeDark" as any)}
                </button>
              ))}
            </div>
          </Section>

          <Section icon={<Palette size={14} className="text-text-secondary" />} title={t("profile.fontSize" as any)}>
            <div className="flex gap-1.5">
              {(["small", "normal", "large", "xlarge"] as const).map((sz) => (
                <button key={sz} onClick={() => setForm({ ...form, fontSize: sz })} className={cn("flex-1 py-1.5 rounded-md text-xs font-medium transition-all", form.fontSize === sz ? "bg-accent text-bg" : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary")}>
                  {t(`profile.fontSize${sz.charAt(0).toUpperCase()}${sz.slice(1)}` as any)}
                </button>
              ))}
            </div>
          </Section>

          <Section>
            <Field label={t("profile.defaultCategory" as any)}>
              <div className="relative">
                <select className="input-sm appearance-none pr-7" value={form.defaultCategory ?? "other"} onChange={(e) => setForm({ ...form, defaultCategory: e.target.value as any })}>
                  {CATEGORIES.map(({ value, labelKey }) => <option key={value} value={value}>{t(labelKey as any)}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              </div>
            </Field>
          </Section>

          <Section icon={<Clock size={14} className="text-text-secondary" />} title={t("profile.pomodoro" as any)}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("profile.pomodoroDuration" as any)}>
                <div className="flex items-center gap-1.5">
                  <input type="number" className="input-sm" min={1} max={120} value={form.pomodoroDuration ?? 25} onChange={(e) => setForm({ ...form, pomodoroDuration: parseInt(e.target.value) || 25 })} />
                  <span className="text-[10px] text-text-tertiary shrink-0">{t("profile.minutes" as any)}</span>
                </div>
              </Field>
              <Field label={t("profile.breakDuration" as any)}>
                <div className="flex items-center gap-1.5">
                  <input type="number" className="input-sm" min={1} max={60} value={form.breakDuration ?? 5} onChange={(e) => setForm({ ...form, breakDuration: parseInt(e.target.value) || 5 })} />
                  <span className="text-[10px] text-text-tertiary shrink-0">{t("profile.minutes" as any)}</span>
                </div>
              </Field>
            </div>
          </Section>

          <Section>
            <Field label={t("profile.dailyGoal" as any)}>
              <input type="number" className="input-sm" min={1} max={100} value={form.dailyGoal ?? ""} onChange={(e) => setForm({ ...form, dailyGoal: e.target.value ? parseInt(e.target.value) : null })} placeholder={t("profile.dailyGoalPlace" as any)} />
            </Field>
            <div>
              <p className="text-[11px] font-medium text-text-tertiary mb-1.5">{t("profile.workHours" as any)}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("profile.workStart" as any)}>
                  <input type="time" className="input-sm" value={form.workStartTime ?? ""} onChange={(e) => setForm({ ...form, workStartTime: e.target.value || null })} />
                </Field>
                <Field label={t("profile.workEnd" as any)}>
                  <input type="time" className="input-sm" value={form.workEndTime ?? ""} onChange={(e) => setForm({ ...form, workEndTime: e.target.value || null })} />
                </Field>
              </div>
            </div>
          </Section>

          <SaveBar onClick={handleSave} saving={saving} saved={saved} error={error} t={t} />
        </motion.div>
      )}

      {/* === NOTIFICATIONS TAB === */}
      {activeTab === "notifications" && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Browser push — master switch */}
          {pushSupported && (
            <Section icon={<Bell size={14} className="text-text-secondary" />} title={t("profile.browserPush" as any)}>
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-text-tertiary">{t("profile.browserPushDesc" as any)}</p>
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0",
                    pushEnabled ? "bg-success/10 text-success" : "bg-accent-soft text-text-secondary hover:text-text"
                  )}
                >
                  {pushLoading ? "..." : pushEnabled ? t("profile.pushActive" as any) : t("profile.pushEnable" as any)}
                </button>
              </div>
            </Section>
          )}

          {/* Plan notifications */}
          <Section icon={<Clock size={14} className="text-accent" />} title={t("profile.planNotifications" as any)}>
            <p className="text-[10px] text-text-tertiary -mt-1 mb-2">{t("profile.planNotificationsDesc" as any)}</p>
            <div className="grid grid-cols-3 gap-2">
              <NotifChip icon={<Mail size={12} />} label={t("profile.viaEmail" as any)} checked={form.planEmailNotifications ?? true} onChange={(v) => setForm({ ...form, planEmailNotifications: v })} />
              <NotifChip icon={<Smartphone size={12} />} label={t("profile.viaSms" as any)} checked={form.planSmsNotifications ?? false} onChange={(v) => setForm({ ...form, planSmsNotifications: v })} />
              <NotifChip icon={<Bell size={12} />} label={t("profile.viaPush" as any)} checked={form.planPushNotifications ?? true} onChange={(v) => setForm({ ...form, planPushNotifications: v })} />
            </div>
          </Section>

          {/* Weekly recap */}
          <Section icon={<Mail size={14} className="text-text-secondary" />} title={t("profile.weeklyRecap" as any)}>
            <p className="text-[10px] text-text-tertiary -mt-1 mb-2">{t("profile.weeklyRecapDesc" as any)}</p>
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                className="accent-accent"
                checked={form.weeklyRecapEnabled ?? false}
                onChange={(e) => setForm({ ...form, weeklyRecapEnabled: e.target.checked })}
              />
              <span className="text-text-secondary">{t("profile.weeklyRecapEnable" as any)}</span>
            </label>
          </Section>

          {/* Reminder notifications */}
          <Section icon={<Bell size={14} className="text-amber-500" />} title={t("profile.reminderNotifications" as any)}>
            <p className="text-[10px] text-text-tertiary -mt-1 mb-2">{t("profile.reminderNotificationsDesc" as any)}</p>
            <div className="grid grid-cols-3 gap-2">
              <NotifChip icon={<Mail size={12} />} label={t("profile.viaEmail" as any)} checked={form.reminderEmailNotifications ?? true} onChange={(v) => setForm({ ...form, reminderEmailNotifications: v })} />
              <NotifChip icon={<Smartphone size={12} />} label={t("profile.viaSms" as any)} checked={form.reminderSmsNotifications ?? false} onChange={(v) => setForm({ ...form, reminderSmsNotifications: v })} />
              <NotifChip icon={<Bell size={12} />} label={t("profile.viaPush" as any)} checked={form.reminderPushNotifications ?? true} onChange={(v) => setForm({ ...form, reminderPushNotifications: v })} />
            </div>
          </Section>

          {/* Advance notification */}
          <Section icon={<Clock size={14} className="text-text-secondary" />} title={t("profile.notifyBefore" as any)}>
            <p className="text-[10px] text-text-tertiary -mt-1 mb-2">{t("profile.notifyBeforeDesc" as any)}</p>
            <div className="flex flex-wrap gap-1.5">
              {[0, 5, 10, 15, 30].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setForm({ ...form, notifyBeforeMinutes: mins })}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                    (form.notifyBeforeMinutes ?? 0) === mins
                      ? "bg-accent text-bg shadow-sm"
                      : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-transparent hover:border-border"
                  )}
                >
                  {mins === 0 ? t("profile.notifyBeforeOff" as any) : `${mins} dk`}
                </button>
              ))}
            </div>
          </Section>

          {/* Silent hours */}
          <Section icon={<Bell size={14} className="text-text-secondary" />} title={t("profile.silentHours" as any)}>
            <p className="text-[10px] text-text-tertiary -mt-1 mb-2">{t("profile.silentHoursDesc" as any)}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("profile.silentFrom" as any)}>
                <input
                  type="time"
                  className="input-sm"
                  value={form.silentHoursStart ?? ""}
                  onChange={(e) => setForm({ ...form, silentHoursStart: e.target.value || null })}
                />
              </Field>
              <Field label={t("profile.silentTo" as any)}>
                <input
                  type="time"
                  className="input-sm"
                  value={form.silentHoursEnd ?? ""}
                  onChange={(e) => setForm({ ...form, silentHoursEnd: e.target.value || null })}
                />
              </Field>
            </div>
          </Section>

          {/* Phone number — show if any SMS is enabled */}
          {(form.planSmsNotifications || form.reminderSmsNotifications) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
              <Section icon={<Smartphone size={14} className="text-text-secondary" />} title={t("profile.phoneNumber" as any)}>
                <input
                  className="input-sm"
                  type="tel"
                  inputMode="numeric"
                  value={phoneDisplay}
                  onChange={(e) => {
                    const formatted = formatPhoneInput(e.target.value);
                    setPhoneDisplay(formatted);
                    setForm({ ...form, phoneNumber: rawPhone(formatted) || null });
                  }}
                  placeholder="5XX XXX XX XX"
                  maxLength={13}
                />
                <p className="text-[10px] text-text-tertiary mt-0.5">{t("profile.phoneNumberDesc" as any)}</p>
              </Section>
            </motion.div>
          )}

          <SaveBar onClick={handleSave} saving={saving} saved={saved} error={error} t={t} />
        </motion.div>
      )}

      {/* === SECURITY TAB === */}
      {activeTab === "security" && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Email */}
          <Section icon={<Mail size={14} className="text-text-secondary" />} title={t("profile.email" as any)}>
            <Field label={t("profile.email" as any)}>
              <input className="input-sm" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {emailChanged && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-1.5 overflow-hidden">
                  <p className="text-[10px] text-text-tertiary mb-1">E-posta degistirmek icin sifrenizi girin</p>
                  <input type="password" className="input-sm" placeholder="Mevcut sifre" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} />
                </motion.div>
              )}
              <div className="mt-1">
                {user?.emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
                    <Check size={10} /> {t("profile.emailVerified" as any)}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-500">
                      <AlertCircle size={10} /> {t("profile.emailNotVerified" as any)}
                    </span>
                    {verifySent ? (
                      <span className="text-[10px] text-accent font-medium">{t("verify.bannerSent" as any)}</span>
                    ) : (
                      <button
                        onClick={async () => {
                          setVerifySending(true);
                          try { await fetch("/api/auth/resend-verification", { method: "POST", credentials: "include" }); setVerifySent(true); }
                          catch {} finally { setVerifySending(false); }
                        }}
                        disabled={verifySending}
                        className="text-[10px] text-accent font-medium underline hover:text-accent/80 transition-colors"
                      >
                        {verifySending ? "..." : t("profile.resendVerification" as any)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Field>
          </Section>

          {/* Change password */}
          <Section icon={<Shield size={14} className="text-text-secondary" />} title={t("profile.changePassword" as any)}>
            <Field label={t("profile.currentPassword" as any)}>
              <div className="relative">
                <input type={showCurrentPw ? "text" : "password"} className="input-sm pr-10" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary">
                  {showCurrentPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <Field label={t("profile.newPassword" as any)}>
              <div className="relative">
                <input type={showNewPw ? "text" : "password"} className="input-sm pr-10" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary">
                  {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <Field label={t("profile.confirmNewPassword" as any)}>
              <input type="password" className="input-sm" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </Field>
            {passwordError && <p className="text-[11px] text-danger">{passwordError}</p>}
            {passwordSaved && <p className="text-[11px] text-success flex items-center gap-1"><Check size={12} />{t("profile.passwordChanged" as any)}</p>}
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="btn btn-primary w-full !py-1.5 !text-xs"
            >
              {passwordSaving ? t("profile.saving" as any) : t("profile.changePassword" as any)}
            </button>
          </Section>

          {/* Data */}
          <Section icon={<Download size={14} className="text-text-secondary" />} title={t("profile.dataManagement" as any)}>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExport} disabled={exporting} className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors">
                <Download size={12} />
                {exporting ? "..." : t("profile.exportData" as any)}
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium bg-bg-secondary text-text-secondary hover:bg-bg-tertiary transition-colors">
                <Upload size={12} />
                {importing ? "..." : t("profile.importData" as any)}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            {importResult && <p className={cn("text-[10px]", importResult.includes("basarisiz") ? "text-danger" : "text-success")}>{importResult}</p>}
          </Section>

          {/* Calendar subscribe */}
          <CalendarSubscribeSection />

          {/* API Tokens (PAT) */}
          <ApiTokensSection />

          <SaveBar onClick={handleSave} saving={saving} saved={saved} error={error} t={t} />
        </motion.div>
      )}
    </div>
  );
}

/* ---- Helpers ---- */

function Section({ children, icon, title }: { children: React.ReactNode; icon?: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-xl bg-bg-elevated border border-border/50 p-3 space-y-3">
      {(icon || title) && (
        <div className="flex items-center gap-1.5">
          {icon}
          <h3 className="text-xs font-semibold text-text">{title}</h3>
        </div>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-text-tertiary mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", checked ? "bg-accent" : "bg-border")}
    >
      <span className={cn("absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-bg transition-transform shadow-sm", checked && "translate-x-4")} />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange, icon }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-xs font-medium text-text">{label}</p>
          <p className="text-[10px] text-text-tertiary">{desc}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function NotifChip({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all border",
        checked
          ? "bg-accent/10 border-accent/30 text-text"
          : "bg-bg-secondary border-transparent text-text-tertiary hover:text-text-secondary"
      )}
    >
      {icon}
      {label}
    </button>
  );
}


function CategoryManager() {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { profile, refreshProfile } = useAuth();
  const { userCategories, createCategory, updateCategory, deleteCategory } = useCategories();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [localHidden, setLocalHidden] = useState<string[] | null>(null);

  const hiddenCategories: string[] = localHidden ?? profile?.hiddenCategories ?? [];

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCategory.mutate({ name: newName.trim(), color: newColor }, {
      onSuccess: () => { setNewName(""); setNewColor("#3b82f6"); setShowAdd(false); },
    });
  };

  const handleUpdate = () => {
    if (!editId || !editName.trim()) return;
    updateCategory.mutate({ id: editId, name: editName.trim(), color: editColor }, {
      onSuccess: () => setEditId(null),
    });
  };

  const handleDelete = (id: string) => {
    deleteCategory.mutate(id, { onSuccess: () => setConfirmDeleteId(null) });
  };

  const toggleDefaultCategory = (key: string) => {
    const isHidden = hiddenCategories.includes(key);
    const updated = isHidden
      ? hiddenCategories.filter((c) => c !== key)
      : [...hiddenCategories, key];
    setLocalHidden(updated);
    api.updateProfile({ hiddenCategories: updated })
      .then(() => refreshProfile())
      .finally(() => setLocalHidden(null));
  };

  return (
    <Section>
      <div data-category-manager className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Tag size={14} className="text-text-secondary" />
          <h3 className="text-xs font-semibold text-text">{t("profile.categories" as any)}</h3>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="p-1 rounded-md text-text-tertiary hover:text-accent hover:bg-accent-soft transition-colors">
          {showAdd ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      {/* Default categories with visibility toggle */}
      <div className="space-y-0.5">
        {CATEGORIES.map(({ value, labelKey }) => {
          const isHidden = hiddenCategories.includes(value);
          return (
            <div key={value} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg-secondary transition-colors group">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[value as keyof typeof CATEGORY_COLORS] }} />
              <span className={cn("text-xs font-medium flex-1 truncate", isHidden ? "text-text-tertiary line-through" : "text-text")}>{getCatLabel(value)}</span>
              <button
                onClick={() => toggleDefaultCategory(value)}
                className={cn(
                  "p-0.5 rounded transition-colors",
                  isHidden ? "text-text-tertiary hover:text-accent" : "text-accent hover:text-text-tertiary"
                )}
                aria-label={isHidden ? "Show category" : "Hide category"}
              >
                {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          );
        })}
      </div>

      {/* Divider between defaults and customs */}
      {(userCategories.length > 0 || showAdd) && (
        <div className="border-t border-border my-1" />
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-bg-secondary">
              <input autoFocus className="input-sm flex-1" placeholder={t("profile.categoryName" as any)} value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); handleCreate(); } }} />
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewColor(c)} className={cn("w-6 h-6 rounded-full transition-all shrink-0", newColor === c ? "ring-2 ring-offset-1 ring-accent scale-110" : "hover:scale-110")} style={{ backgroundColor: c }} />
                ))}
              </div>
              <button onClick={handleCreate} disabled={!newName.trim() || createCategory.isPending} className="btn btn-primary !py-1 !px-2.5 !text-[11px]">
                {createCategory.isPending ? "..." : t("form.add" as any)}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-0.5">
        <AnimatePresence mode="popLayout">
          {userCategories.map((cat) => (
            <motion.div key={cat.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-bg-secondary transition-colors group">
              {editId === cat.id ? (
                <>
                  <div className="flex gap-1 shrink-0 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setEditColor(c)} className={cn("w-5 h-5 rounded-full transition-all", editColor === c ? "ring-2 ring-offset-1 ring-accent scale-110" : "hover:scale-110")} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <input autoFocus className="input-sm flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); handleUpdate(); } if (e.key === "Escape") setEditId(null); }} />
                  <button onClick={handleUpdate} className="p-0.5 text-success hover:bg-success/10 rounded transition-colors"><Check size={13} /></button>
                  <button onClick={() => setEditId(null)} className="p-0.5 text-text-tertiary hover:bg-bg-tertiary rounded transition-colors"><X size={13} /></button>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs font-medium text-text flex-1 truncate">{cat.name}</span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditColor(cat.color); }} className="p-0.5 text-text-tertiary hover:text-accent hover:bg-accent-soft rounded transition-colors"><Pencil size={12} /></button>
                    {confirmDeleteId === cat.id ? (
                      <button onClick={() => handleDelete(cat.id)} className="p-0.5 text-danger bg-danger/10 rounded transition-colors text-[10px] font-medium px-1.5">{t("recurring.delete" as any)}</button>
                    ) : (
                      <button onClick={() => { setConfirmDeleteId(cat.id); setTimeout(() => setConfirmDeleteId(null), 3000); }} className="p-0.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded transition-colors"><Trash2 size={12} /></button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      </div>
    </Section>
  );
}

function SaveBar({ onClick, saving, saved, error, t }: { onClick: () => void; saving: boolean; saved: boolean; error: string; t: (key: any) => string }) {
  return (
    <div>
      {error && <p className="text-[11px] text-danger mb-1.5">{error}</p>}
      <button onClick={onClick} disabled={saving} className={cn("btn w-full !py-2 !text-xs transition-all", saved ? "bg-success text-bg" : "btn-primary")}>
        {saved ? (<><Check size={14} />{t("profile.saved")}</>) : saving ? t("profile.saving") : (<><Save size={14} />{t("profile.save")}</>)}
      </button>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
  return arr.buffer as ArrayBuffer;
}
