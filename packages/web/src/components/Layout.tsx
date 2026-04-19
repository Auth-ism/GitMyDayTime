import { useState, useEffect, useSyncExternalStore } from "react";
import { NavLink, useLocation, Outlet } from "react-router-dom";
import { Calendar, CalendarDays, BarChart3, Sun, Moon, Clock, LogOut, Search, Repeat, Globe, UserCircle, WifiOff, X, Layers, Bug, Command } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import NotificationBell from "@/components/NotificationBell";
import LogoutConfirmModal from "@/components/LogoutConfirmModal";
import OnboardingModal from "@/components/OnboardingModal";
import ChangelogModal, { shouldShowChangelog } from "@/components/ChangelogModal";
import BugReportModal from "@/components/BugReportModal";
import CommandPalette from "@/components/CommandPalette";

function EmailVerifyBanner() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("gmd-verify-banner-dismissed") === "1"; } catch { return false; }
  });

  const resend = async () => {
    await fetch("/api/auth/resend-verification", { method: "POST", credentials: "include" });
    setSent(true);
  };

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("gmd-verify-banner-dismissed", "1"); } catch {}
  };

  if (dismissed) return null;

  return (
    <div className="bg-accent-soft border-b border-accent/20 px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium text-text-secondary">
      {t("verify.banner" as any)}
      {sent ? (
        <span className="text-accent font-semibold ml-1">{t("verify.bannerSent" as any)}</span>
      ) : (
        <button onClick={resend} className="underline text-accent font-semibold ml-1">
          {t("verify.bannerLink" as any)}
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label={t("verify.bannerClose" as any)}
        className="ml-2 p-0.5 rounded hover:bg-accent/10 text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function useOnline() {
  return useSyncExternalStore(
    (cb) => { window.addEventListener("online", cb); window.addEventListener("offline", cb); return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); }; },
    () => navigator.onLine,
  );
}

const navIcons = {
  "/": Clock,
  "/week": CalendarDays,
  "/calendar": Calendar,
  "/stats": BarChart3,
  "/search": Search,
  "/recurring": Repeat,
} as const;

const PM_URL = "https://pm.byfeb.com";

// Desktop nav: all items
const navKeys = ["/", "/week", "/calendar", "/stats", "/search", "/recurring"] as const;
// Mobile tab bar: Home / Week / Cal / Stats (4 items, Projects is external)
const mobileNavKeys = ["/", "/week", "/calendar", "/stats"] as const;

const navLabelKeys = {
  "/": "nav.today",
  "/week": "nav.week",
  "/calendar": "nav.calendar",
  "/stats": "nav.stats",
  "/search": "nav.search",
  "/recurring": "nav.recurring",
} as const;

export default function Layout() {
  const { theme, toggle } = useTheme();
  const { logout, profile, user, refreshProfile } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const location = useLocation();
  const isOnline = useOnline();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (!profile.onboarded) {
      setShowOnboarding(true);
    } else if (shouldShowChangelog(__APP_VERSION__)) {
      setShowChangelog(true);
    }
  }, [profile?.onboarded]);

  const handleLogoutClick = () => setShowLogoutConfirm(true);
  const handleLogoutConfirm = () => { setShowLogoutConfirm(false); logout(); };

  const toggleLocale = () => setLocale(locale === "en" ? "tr" : "en" as Locale);

  return (
    <div className={cn("flex flex-col bg-bg-secondary", location.pathname.includes("/board") ? "h-dvh overflow-hidden" : "min-h-screen")}>
      {/* Desktop header */}
      <header className="border-b border-border sticky top-0 z-40 bg-bg/90 backdrop-blur-md hidden sm:block">
        <div className="px-4 sm:px-6 h-14 flex items-center">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 font-semibold text-text tracking-tight mr-8"
            aria-label="GitMyDayTime"
          >
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Clock size={15} className="text-bg" />
            </div>
            <span className="text-base">GitMyDayTime</span>
            <span className="text-[10px] text-text-tertiary font-normal -ml-1.5">v{__APP_VERSION__}</span>
          </NavLink>

          <nav aria-label="Main navigation" className="flex items-center gap-1 ml-auto">
            {navKeys.map((to) => {
              const Icon = navIcons[to];
              const label = t(navLabelKeys[to] as any);
              return (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  aria-label={label}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors",
                      isActive
                        ? "bg-accent text-bg font-medium"
                        : "text-text-secondary hover:text-text hover:bg-accent-soft"
                    )
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              );
            })}

            <a
              href={PM_URL}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text hover:bg-accent-soft transition-colors"
              title="GMD Projects"
            >
              <Layers size={16} />
              <span>{t("nav.projects" as any)}</span>
            </a>

            <div className="w-px h-5 bg-border mx-1.5" role="separator" />

            <NotificationBell />

            <button
              onClick={toggleLocale}
              aria-label={locale === "en" ? "Turkce" : "English"}
              className="btn-icon p-2 rounded-lg text-xs font-medium"
            >
              <Globe size={16} />
            </button>

            <button
              onClick={toggle}
              aria-label={t("nav.switchTheme", { theme: theme === "light" ? "dark" : "light" })}
              className="btn-icon p-2 rounded-lg"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <NavLink
              to="/profile"
              aria-label={t("profile.nav" as any)}
              className={({ isActive }) =>
                cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors overflow-hidden",
                  isActive
                    ? "bg-accent text-bg"
                    : "bg-accent-soft text-text-secondary hover:text-text"
                )
              }
            >
              {profile?.avatarUrl
                ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                : profile
                  ? (profile.displayName || profile.username).slice(0, 2).toUpperCase()
                  : <UserCircle size={16} />}
            </NavLink>

            <button
              onClick={handleLogoutClick}
              aria-label={t("nav.signOut")}
              className="btn-icon p-2 rounded-lg"
            >
              <LogOut size={16} />
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile header */}
      <header className="border-b border-border sticky top-0 z-40 bg-bg/90 backdrop-blur-md sm:hidden safe-top">
        <div className="px-3 h-12 flex items-center justify-between overflow-hidden">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-text tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Clock size={13} className="text-bg" />
            </div>
            <span className="text-sm">GitMyDayTime</span>
          </NavLink>
          <button
            onClick={() => setShowChangelog(true)}
            className="text-[9px] text-text-tertiary font-normal -ml-3 hover:text-accent transition-colors"
          >
            v{__APP_VERSION__}
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowCommandPalette(true)}
              aria-label="Issue ara"
              className="btn-icon p-2 rounded-lg"
            >
              <Search size={16} />
            </button>
            <NotificationBell />
            <button
              onClick={toggleLocale}
              aria-label={locale === "en" ? "Turkce" : "English"}
              className="btn-icon p-2 rounded-lg text-[10px] font-bold"
            >
              {locale === "en" ? "TR" : "EN"}
            </button>
            <button
              onClick={toggle}
              aria-label={t("nav.switchTheme", { theme: theme === "light" ? "dark" : "light" })}
              className="btn-icon p-2 rounded-lg"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <NavLink
              to="/profile"
              aria-label={t("profile.nav" as any)}
              className={({ isActive }) =>
                cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-colors overflow-hidden",
                  isActive
                    ? "bg-accent text-bg"
                    : "bg-accent-soft text-text-secondary hover:text-text"
                )
              }
            >
              {profile?.avatarUrl
                ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                : profile
                  ? (profile.displayName || profile.username).slice(0, 2).toUpperCase()
                  : <UserCircle size={14} />}
            </NavLink>
            <button
              onClick={handleLogoutClick}
              aria-label={t("nav.signOut")}
              className="btn-icon p-2 rounded-lg"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-danger-soft border-b border-danger/20 px-4 py-2 flex items-center justify-center gap-2 text-xs font-medium text-danger" role="alert">
          <WifiOff size={14} />
          {t("offline" as any)}
        </div>
      )}

      {user && !user.emailVerified && (
        <EmailVerifyBanner />
      )}

      <main
        className={cn(
          "pb-16 sm:pb-0 safe-main-bottom",
          location.pathname.includes("/board")
            ? "flex flex-col overflow-hidden flex-1"
            : "flex-1"
        )}
        id="main-content"
      >
        <div
          className={cn(
            "mx-auto px-4 sm:px-6",
            location.pathname.includes("/board")
              ? "flex flex-col flex-1 min-h-0 pt-4 sm:pt-6 w-full"
              : "py-4 sm:py-6",
            location.pathname === "/week" || location.pathname.includes("/board")
              ? "max-w-[1800px]"
              : "max-w-5xl"
          )}
        >
          <Outlet />
        </div>
      </main>

      {/* Footer — desktop only, minimal */}
      <footer className="hidden sm:block border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between text-[11px] text-text-tertiary">
          <span>© {new Date().getFullYear()} GitMyDayTime</span>
          <div className="flex items-center gap-3">
            <NavLink to="/changelog" className="hover:text-text transition-colors">
              Değişiklikler
            </NavLink>
            <button
              onClick={() => setShowBugReport(true)}
              className="flex items-center gap-1 hover:text-text transition-colors"
              title="Geri bildirim gönder"
            >
              <Bug size={12} />
              Geri bildirim
            </button>
            <a href="https://byfeb.com" target="_blank" rel="noopener noreferrer" className="hover:text-text transition-colors">
              <Globe size={13} />
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showLogoutConfirm && (
        <LogoutConfirmModal onConfirm={handleLogoutConfirm} onCancel={() => setShowLogoutConfirm(false)} />
      )}
      {showOnboarding && (
        <OnboardingModal onClose={() => {
          setShowOnboarding(false);
          api.updateProfile({ onboarded: true }).then(() => refreshProfile()).catch(() => {});
          if (shouldShowChangelog(__APP_VERSION__)) setShowChangelog(true);
        }} />
      )}
      {showChangelog && !showOnboarding && (
        <ChangelogModal version={__APP_VERSION__} onClose={() => setShowChangelog(false)} />
      )}
      {showBugReport && (
        <BugReportModal onClose={() => setShowBugReport(false)} />
      )}
      <CommandPalette open={showCommandPalette} onClose={() => setShowCommandPalette(false)} />

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-md border-t border-border sm:hidden safe-bottom"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {mobileNavKeys.map((to) => {
            const Icon = navIcons[to];
            const label = t(navLabelKeys[to] as any);
            return (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px]",
                    isActive
                      ? "text-accent"
                      : "text-text-tertiary"
                  )
                }
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </NavLink>
            );
          })}
          <a
            href={PM_URL}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px] text-text-tertiary"
          >
            <Layers size={20} />
            <span className="text-[10px] font-medium">{t("nav.projects" as any)}</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
