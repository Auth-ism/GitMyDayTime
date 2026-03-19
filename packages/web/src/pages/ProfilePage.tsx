import { useState, useEffect, useRef } from "react";
import { User, Settings, Shield, Clock, Save, Check, Eye, EyeOff, ChevronDown, Download, Upload, Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme, type Theme } from "@/lib/theme";
import { useI18n, type Locale } from "@/lib/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { UserProfile, UpdateProfileInput } from "@gmd/shared";

const TIMEZONES = [
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
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

type Tab = "account" | "preferences" | "security";

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();

  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [form, setForm] = useState<Partial<UpdateProfileInput>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Push notifications
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Export state
  const [exporting, setExporting] = useState(false);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Check push notification support
  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(supported);
    if (supported) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setPushEnabled(!!sub);
        });
      }).catch(() => {});
    }
  }, []);

  // Initialize form from profile
  useEffect(() => {
    if (profile) {
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
      });
    }
  }, [profile]);

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
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setPushEnabled(false);
        setForm({ ...form, pushNotifications: false });
      } else {
        const { publicKey } = await api.getVapidKey();
        if (!publicKey) return;
        const reg = await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        await api.subscribePush(sub.toJSON() as PushSubscriptionJSON);
        setPushEnabled(true);
        setForm({ ...form, pushNotifications: true });
      }
    } catch (err) {
      console.error("Push toggle failed:", err);
    } finally {
      setPushLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.updateProfile(form);
      await refreshProfile();

      // Sync theme and locale with local providers
      if (form.theme && form.theme !== theme) {
        setTheme(form.theme as Theme);
      }
      if (form.locale && form.locale !== locale) {
        setLocale(form.locale as Locale);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.passwordsMismatch" as any));
      return;
    }
    setPasswordSaving(true);
    setPasswordError("");
    setPasswordSaved(false);
    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 2000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const initials = profile
    ? (profile.displayName || profile.username).slice(0, 2).toUpperCase()
    : "?";

  const tabs: { key: Tab; icon: typeof User; labelKey: string }[] = [
    { key: "account", icon: User, labelKey: "profile.account" },
    { key: "preferences", icon: Settings, labelKey: "profile.preferences" },
    { key: "security", icon: Shield, labelKey: "profile.security" },
  ];

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-text-tertiary">{t("loading" as any)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — compact */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center text-bg text-sm font-semibold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-text truncate">
            {profile.displayName || profile.username}
          </h1>
          <p className="text-xs text-text-tertiary">@{profile.username}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-bg-secondary rounded-xl border border-border">
        {tabs.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center",
              activeTab === key
                ? "bg-bg-elevated text-text shadow-sm border border-border"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            <Icon size={15} />
            <span className="hidden sm:inline">{t(labelKey as any)}</span>
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <FormField label={t("profile.displayName" as any)}>
              <input
                className="input"
                value={form.displayName ?? ""}
                onChange={(e) => setForm({ ...form, displayName: e.target.value || null })}
                placeholder={t("profile.displayNamePlace" as any)}
              />
            </FormField>

            <FormField label={t("profile.bio" as any)}>
              <textarea
                className="input resize-none"
                rows={3}
                value={form.bio ?? ""}
                onChange={(e) => setForm({ ...form, bio: e.target.value || null })}
                placeholder={t("profile.bioPlace" as any)}
                maxLength={256}
              />
              <p className="text-xs text-text-tertiary mt-1 text-right">
                {(form.bio ?? "").length}/256
              </p>
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t("profile.email" as any)}>
                <input
                  className="input"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>

              <FormField label={t("profile.username" as any)}>
                <input
                  className="input"
                  value={form.username ?? ""}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label={t("profile.timezone" as any)}>
              <div className="relative">
                <select
                  className="input appearance-none pr-8"
                  value={form.timezone ?? "Europe/Istanbul"}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace("_", " ")}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              </div>
            </FormField>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-text">{t("profile.isPublic" as any)}</p>
                <p className="text-xs text-text-tertiary">{t("profile.isPublicDesc" as any)}</p>
              </div>
              <Toggle
                checked={form.isPublic ?? false}
                onChange={(v) => setForm({ ...form, isPublic: v })}
              />
            </div>
          </div>

          {/* Notifications */}
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-text">{t("profile.notifications" as any)}</h3>

            <FormField label={t("profile.phoneNumber" as any)}>
              <input
                className="input"
                type="tel"
                value={form.phoneNumber ?? ""}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value || null })}
                placeholder="+90 555 000 00 00"
              />
              <p className="text-xs text-text-tertiary mt-1">{t("profile.phoneNumberDesc" as any)}</p>
            </FormField>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-text">{t("profile.emailNotifications" as any)}</p>
                <p className="text-xs text-text-tertiary">{t("profile.emailNotificationsDesc" as any)}</p>
              </div>
              <Toggle
                checked={form.emailNotifications ?? false}
                onChange={(v) => setForm({ ...form, emailNotifications: v })}
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-text">{t("profile.smsNotifications" as any)}</p>
                <p className="text-xs text-text-tertiary">{t("profile.smsNotificationsDesc" as any)}</p>
              </div>
              <Toggle
                checked={form.smsNotifications ?? false}
                onChange={(v) => setForm({ ...form, smsNotifications: v })}
              />
            </div>

            {pushSupported && (
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm font-medium text-text">Web Push Bildirimleri</p>
                  <p className="text-xs text-text-tertiary">Tarayici bildirimleri al</p>
                </div>
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  className={cn(
                    "btn !py-1.5 !px-3 text-xs",
                    pushEnabled ? "bg-success text-bg" : "btn-primary"
                  )}
                >
                  <Bell size={12} />
                  {pushLoading ? "..." : pushEnabled ? "Devre Disi" : "Etkinlestir"}
                </button>
              </div>
            )}
          </div>

          {/* Data Export / Import */}
          <div className="card space-y-3">
            <h3 className="text-sm font-semibold text-text">Veri Yonetimi</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleExport} disabled={exporting} className="btn btn-ghost border border-border text-sm">
                <Download size={15} />
                {exporting ? "Hazirlaniyor..." : "Disa Aktar"}
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="btn btn-ghost border border-border text-sm">
                <Upload size={15} />
                {importing ? "Yukleniyor..." : "Ice Aktar"}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            {importResult && (
              <p className={cn("text-xs", importResult.includes("basarisiz") ? "text-danger" : "text-success")}>{importResult}</p>
            )}
          </div>

          <SaveButton
            onClick={handleSave}
            saving={saving}
            saved={saved}
            error={error}
            t={t}
          />
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="space-y-4">
          <div className="card space-y-4">
            {/* Theme */}
            <FormField label={t("profile.theme" as any)}>
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((th) => (
                  <button
                    key={th}
                    onClick={() => setForm({ ...form, theme: th })}
                    className={cn(
                      "flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all",
                      form.theme === th
                        ? "border-accent bg-accent-soft text-text"
                        : "border-border text-text-secondary hover:border-border-hover"
                    )}
                  >
                    {t(th === "light" ? "profile.themeLight" as any : "profile.themeDark" as any)}
                  </button>
                ))}
              </div>
            </FormField>

            {/* Language */}
            <FormField label={t("profile.locale" as any)}>
              <div className="flex gap-2">
                {(["tr", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setForm({ ...form, locale: l })}
                    className={cn(
                      "flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all",
                      form.locale === l
                        ? "border-accent bg-accent-soft text-text"
                        : "border-border text-text-secondary hover:border-border-hover"
                    )}
                  >
                    {l === "tr" ? "Turkce" : "English"}
                  </button>
                ))}
              </div>
            </FormField>

            {/* Default Category */}
            <FormField label={t("profile.defaultCategory" as any)}>
              <div className="relative">
                <select
                  className="input appearance-none pr-8"
                  value={form.defaultCategory ?? "other"}
                  onChange={(e) => setForm({ ...form, defaultCategory: e.target.value as any })}
                >
                  {CATEGORIES.map(({ value, labelKey }) => (
                    <option key={value} value={value}>{t(labelKey as any)}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              </div>
            </FormField>
          </div>

          {/* Pomodoro Settings */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={16} className="text-text-secondary" />
              <h3 className="text-sm font-semibold text-text">{t("profile.pomodoro" as any)}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label={t("profile.pomodoroDuration" as any)}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={120}
                    value={form.pomodoroDuration ?? 25}
                    onChange={(e) => setForm({ ...form, pomodoroDuration: parseInt(e.target.value) || 25 })}
                  />
                  <span className="text-xs text-text-tertiary shrink-0">{t("profile.minutes" as any)}</span>
                </div>
              </FormField>

              <FormField label={t("profile.breakDuration" as any)}>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="input"
                    min={1}
                    max={60}
                    value={form.breakDuration ?? 5}
                    onChange={(e) => setForm({ ...form, breakDuration: parseInt(e.target.value) || 5 })}
                  />
                  <span className="text-xs text-text-tertiary shrink-0">{t("profile.minutes" as any)}</span>
                </div>
              </FormField>
            </div>
          </div>

          {/* Work Hours & Goal */}
          <div className="card space-y-4">
            <FormField label={t("profile.dailyGoal" as any)}>
              <input
                type="number"
                className="input"
                min={1}
                max={100}
                value={form.dailyGoal ?? ""}
                onChange={(e) => setForm({ ...form, dailyGoal: e.target.value ? parseInt(e.target.value) : null })}
                placeholder={t("profile.dailyGoalPlace" as any)}
              />
            </FormField>

            <div>
              <p className="text-sm font-medium text-text mb-2">{t("profile.workHours" as any)}</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField label={t("profile.workStart" as any)}>
                  <input
                    type="time"
                    className="input"
                    value={form.workStartTime ?? ""}
                    onChange={(e) => setForm({ ...form, workStartTime: e.target.value || null })}
                  />
                </FormField>
                <FormField label={t("profile.workEnd" as any)}>
                  <input
                    type="time"
                    className="input"
                    value={form.workEndTime ?? ""}
                    onChange={(e) => setForm({ ...form, workEndTime: e.target.value || null })}
                  />
                </FormField>
              </div>
            </div>
          </div>

          <SaveButton
            onClick={handleSave}
            saving={saving}
            saved={saved}
            error={error}
            t={t}
          />
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h3 className="text-sm font-semibold text-text">{t("profile.changePassword" as any)}</h3>

            <FormField label={t("profile.currentPassword" as any)}>
              <div className="relative">
                <input
                  type={showCurrentPw ? "text" : "password"}
                  className="input pr-10"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>

            <FormField label={t("profile.newPassword" as any)}>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  className="input pr-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </FormField>

            <FormField label={t("profile.confirmNewPassword" as any)}>
              <input
                type="password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </FormField>

            {passwordError && (
              <p className="text-sm text-danger">{passwordError}</p>
            )}

            {passwordSaved && (
              <p className="text-sm text-success flex items-center gap-1.5">
                <Check size={14} />
                {t("profile.passwordChanged" as any)}
              </p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="btn btn-primary w-full"
            >
              {passwordSaving ? t("profile.saving" as any) : t("profile.changePassword" as any)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// -- Helper components --

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-1.5">{label}</label>
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
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors shrink-0",
        checked ? "bg-accent" : "bg-border"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-bg transition-transform shadow-sm",
          checked && "translate-x-5"
        )}
      />
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
  return arr.buffer as ArrayBuffer;
}

function SaveButton({
  onClick,
  saving,
  saved,
  error,
  t,
}: {
  onClick: () => void;
  saving: boolean;
  saved: boolean;
  error: string;
  t: (key: any) => string;
}) {
  return (
    <div>
      {error && <p className="text-sm text-danger mb-2">{error}</p>}
      <button
        onClick={onClick}
        disabled={saving}
        className={cn(
          "btn w-full transition-all",
          saved ? "bg-success text-bg" : "btn-primary"
        )}
      >
        {saved ? (
          <>
            <Check size={16} />
            {t("profile.saved")}
          </>
        ) : saving ? (
          t("profile.saving")
        ) : (
          <>
            <Save size={16} />
            {t("profile.save")}
          </>
        )}
      </button>
    </div>
  );
}
