import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n, type Locale } from "@/lib/i18n";
import { Clock, ArrowRight, AlertCircle, Globe, Github, Mail, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const toggleLocale = () => setLocale(locale === "en" ? "tr" : "en" as Locale);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (mode === "register" && password !== confirmPassword) {
      setError(t("login.passwordsMismatch"));
      return;
    }

    setError("");
    setLoading(true);

    const result =
      mode === "login"
        ? await login(email, password)
        : await register(email, username, password);

    if (!result.ok) {
      const errKey = result.error === "pending_approval" ? "login.pendingApprovalError" : "login.error";
      setError(t(errKey as any) || result.error || t("login.error"));
      setLoading(false);
    } else if (result.pending) {
      setPendingApproval(true);
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
  };

  const isValid =
    mode === "login"
      ? email && password
      : email && username && password && confirmPassword;

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      {/* Top controls */}
      <div className="fixed top-4 right-4 flex items-center gap-1">
        <button
          onClick={toggleLocale}
          aria-label={locale === "en" ? "Turkce" : "English"}
          className="btn-icon p-2.5 rounded-xl text-xs font-bold"
        >
          {locale === "en" ? "TR" : "EN"}
        </button>
        <button
          onClick={toggle}
          aria-label={t("nav.switchTheme", { theme: theme === "light" ? "dark" : "light" })}
          className="btn-icon p-2.5 rounded-xl"
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>

      {pendingApproval ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={24} className="text-accent" />
          </div>
          <h1 className="text-xl font-bold tracking-tight mb-2">{t("login.pendingTitle" as any)}</h1>
          <p className="text-sm text-text-secondary leading-relaxed">{t("login.pendingDesc" as any)}</p>
        </motion.div>
      ) : (

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <Clock size={24} className="text-bg" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">GitMyDayTime</h1>
          <p className="text-sm text-text-secondary mt-1">
            {mode === "login" ? t("login.signInDesc") : t("login.registerDesc")}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg bg-surface border border-border mb-6 p-1">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "login" ? "bg-bg text-text shadow-sm" : "text-text-secondary"
            }`}
          >
            {t("login.signIn")}
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "register" ? "bg-bg text-text shadow-sm" : "text-text-secondary"
            }`}
          >
            {t("login.register")}
          </button>
        </div>

        <form key={mode} onSubmit={handleSubmit} className="space-y-4" autoComplete={mode === "register" ? "off" : "on"}>
          <div>
            <label htmlFor={`${mode}-email`} className="block text-sm font-medium text-text-secondary mb-1.5">
              {t("login.email")}
            </label>
            <input
              id={`${mode}-email`}
              name="email"
              type="email"
              className="input !text-base !py-3"
              placeholder={t("login.emailPlace")}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              autoFocus
              autoComplete="email"
            />
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="reg-username" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t("login.username")}
              </label>
              <input
                id="reg-username"
                name={`username-${Date.now()}`}
                type="text"
                className="input !text-base !py-3"
                placeholder={t("login.usernamePlace")}
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                autoComplete="one-time-code"
              />
            </div>
          )}

          <div>
            <label htmlFor={`${mode}-password`} className="block text-sm font-medium text-text-secondary mb-1.5">
              {t("login.password")}
            </label>
            <input
              id={`${mode}-password`}
              name="password"
              type="password"
              className="input !text-base !py-3"
              placeholder={mode === "register" ? t("login.passwordPlaceNew") : t("login.passwordPlace")}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-text-secondary mb-1.5">
                {t("login.confirmPassword")}
              </label>
              <input
                id="reg-confirm-password"
                name="confirm-password"
                type="password"
                className="input !text-base !py-3"
                placeholder={t("login.confirmPasswordPlace")}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-sm text-danger bg-danger-soft px-3 py-2.5 rounded-lg"
              role="alert"
            >
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={!isValid || loading}
            className="btn btn-primary w-full !py-3 text-base"
          >
            {loading ? (
              <span className="animate-pulse">
                {mode === "login" ? t("login.signingIn") : t("login.creatingAccount")}
              </span>
            ) : (
              <>
                {mode === "login" ? t("login.signIn") : t("login.createAccount")}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </motion.div>

      )}

      {/* Footer */}
      <div className="fixed bottom-4 left-0 right-0 flex items-center justify-center gap-3 text-[11px] text-text-tertiary">
        <span>{t("footer.madeBy" as any)} <a href="https://github.com/firatege" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-text transition-colors font-medium">firatege</a></span>
        <span>·</span>
        <a href="https://github.com/firatege/GitMyDayTime" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-text transition-colors">
          <Github size={12} />
          <span>{t("footer.source" as any)}</span>
        </a>
        <span>·</span>
        <a href="mailto:firategebayram@gmail.com" className="flex items-center gap-1 hover:text-text transition-colors">
          <Mail size={12} />
          <span>{t("footer.contact" as any)}</span>
        </a>
      </div>
    </div>
  );
}
