import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { NavLink, useLocation, Outlet } from "react-router-dom";
import { Calendar, CalendarDays, BarChart3, Sun, Moon, Clock, LogOut, Search, Repeat, Globe, UserCircle, WifiOff, X, Layers, Bug, Command, type LucideIcon } from "lucide-react";
import { useTheme, resolveTheme, type Theme } from "@/lib/theme";
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
import ShortcutHelp from "@/components/ShortcutHelp";
import InstallPrompt from "@/components/InstallPrompt";
import { AnimatePresence } from "framer-motion";

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
const LAST_DATE_VIEW_KEY = "gmd-last-date-view";

// Desktop nav: all items
const navKeys = ["/", "/week", "/calendar", "/stats", "/search", "/recurring"] as const;
// Mobile tab bar keeps the date views in one slot; switch Week/Calendar from the page icon.
type MobileNavItem = {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  end?: boolean;
  match?: string[];
};

const mobileNavItems: MobileNavItem[] = [
  { to: "/", icon: Clock, labelKey: "nav.today", end: true },
  { to: "/week", icon: CalendarDays, labelKey: "nav.week", match: ["/week", "/calendar"] },
  { to: "/stats", icon: BarChart3, labelKey: "nav.stats" },
  { to: "/profile", icon: UserCircle, labelKey: "profile.nav" },
];

const navLabelKeys = {
  "/": "nav.today",
  "/week": "nav.week",
  "/calendar": "nav.calendar",
  "/stats": "nav.stats",
  "/search": "nav.search",
  "/recurring": "nav.recurring",
} as const;

export default function Layout() {
  const { theme, setTheme, hadStoredTheme } = useTheme();
  const { logout, profile, user, refreshProfile } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const location = useLocation();
  const standaloneApp = document.documentElement.dataset.appMode === "standalone";
  const isOnline = useOnline();
  const [lastDateView, setLastDateView] = useState<"/week" | "/calendar">(() => {
    try {
      const stored = localStorage.getItem(LAST_DATE_VIEW_KEY);
      return stored === "/calendar" ? "/calendar" : "/week";
    } catch {
      return "/week";
    }
  });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(v => !v);
        return;
      }
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
        e.preventDefault();
        setShowShortcutHelp(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Safari's edge-swipe history navigation is outside the scroll container and
  // ignores overscroll-behavior. Prevent it only when the gesture starts on
  // page content, leaving taps on controls and in-app swipes available.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 639px)").matches || document.documentElement.dataset.appMode !== "standalone") return;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      const target = event.target as HTMLElement | null;
      if (!touch || touch.clientX > 20 || target?.closest("button, a, input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    return () => document.removeEventListener("touchstart", handleTouchStart);
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
  const openCommandPalette = () => {
    flushSync(() => setShowCommandPalette(true));
    document.getElementById("command-palette-input")?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (location.pathname !== "/week" && location.pathname !== "/calendar") return;
    const next = location.pathname as "/week" | "/calendar";
    setLastDateView(next);
    try { localStorage.setItem(LAST_DATE_VIEW_KEY, next); } catch {}
  }, [location.pathname]);

  const toggleLocale = () => setLocale(locale === "en" ? "tr" : "en" as Locale);

  // The header toggle used to be local-only, so users/profiles.theme drifted apart:
  // the settings form seeded its picker from the stale server value and saving it
  // snapped the app back to that value. Persist every toggle so the two agree.
  const toggleTheme = () => {
    const next: Theme = resolveTheme(theme) === "light" ? "dark" : "light";
    setTheme(next);
    api.updateProfile({ theme: next }).catch(() => {});
  };

  // Reconcile once per session. A theme stored on this device is the user's most
  // recent explicit choice, so it wins and gets pushed up; a fresh device has
  // nothing to go on and adopts whatever the account already has.
  const themeSyncedRef = useRef(false);
  useEffect(() => {
    if (!profile || themeSyncedRef.current) return;
    themeSyncedRef.current = true;
    const serverTheme = profile.theme as Theme | undefined;
    if (!serverTheme || serverTheme === theme) return;
    if (hadStoredTheme) {
      api.updateProfile({ theme }).catch(() => {});
    } else {
      setTheme(serverTheme);
    }
  }, [profile, theme, hadStoredTheme, setTheme]);

  return (
    <div
      className={cn(
        "flex flex-col bg-bg-secondary",
        standaloneApp
          ? "h-[100dvh] overflow-hidden sm:h-auto sm:min-h-screen sm:overflow-visible"
          : "min-h-screen overflow-visible",
        location.pathname.includes("/board") && "sm:h-dvh sm:overflow-hidden"
      )}
    >
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
              onClick={toggleTheme}
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
      <header className={cn(
        "mobile-shell-chrome border-b border-border z-40 bg-bg/90 backdrop-blur-md sm:hidden safe-top shrink-0",
        standaloneApp && "sticky top-0"
      )}>
        <div className="px-3 h-14 flex items-center justify-between overflow-hidden">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-text tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Clock size={16} className="text-bg" />
            </div>
            <span className="text-sm">GMD</span>
          </NavLink>
          <div className="flex items-center gap-0.5">
            <NotificationBell iconSize={20} />
            <button
              onClick={openCommandPalette}
              aria-label="Issue ara"
              className="btn-icon p-2 rounded-lg"
            >
              <Search size={20} />
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

      <InstallPrompt />

      <main
        className={cn(
          "flex-1 sm:overflow-visible sm:overscroll-auto mobile-page-scroll",
          standaloneApp
            ? "min-h-0 overflow-y-auto pb-16 safe-main-bottom"
            : "overflow-visible pb-0",
          location.pathname.includes("/board")
            ? "flex flex-col overflow-hidden flex-1"
            : "flex-1",
          (location.pathname === "/" || location.pathname.startsWith("/day/") || ["/calendar", "/week", "/profile"].includes(location.pathname)) && "mobile-bounded-scroll"
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
        <OnboardingModal onClose={(hiddenCategories) => {
          setShowOnboarding(false);
          api.updateProfile({
            onboarded: true,
            ...(hiddenCategories && hiddenCategories.length > 0 ? { hiddenCategories } : {}),
          }).then(() => refreshProfile()).catch(() => {});
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
      <AnimatePresence>
        {showShortcutHelp && (
          <ShortcutHelp onClose={() => setShowShortcutHelp(false)} />
        )}
      </AnimatePresence>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className={cn(
          "mobile-shell-chrome left-0 right-0 z-40 bg-bg/95 backdrop-blur-md border-t border-border sm:hidden safe-bottom",
          standaloneApp ? "fixed bottom-0" : "static"
        )}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {mobileNavItems.map(({ to, icon: Icon, labelKey, end, match }) => {
            const targetTo = match?.includes("/week") && match.includes("/calendar") ? lastDateView : to;
            const active = match?.some((path) => location.pathname === path) ?? (end ? location.pathname === to : location.pathname.startsWith(to));
            const label = targetTo === "/calendar" ? t("nav.calendar" as any) : t(labelKey as any);
            return (
              <NavLink
                key={to}
                to={targetTo}
                end={end}
                aria-label={label}
                className={() =>
                  cn(
                    "flex items-center justify-center p-2.5 rounded-xl transition-colors min-w-[52px]",
                    active
                      ? "text-accent"
                      : "text-text-tertiary"
                  )
                }
              >
                {to === "/profile" && profile?.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" className={cn("w-6 h-6 rounded-md object-cover", active && "ring-1 ring-accent")} />
                ) : (
                  <Icon size={24} />
                )}
                <span className="sr-only">{label}</span>
              </NavLink>
            );
          })}
          <a
            href={PM_URL}
            aria-label={t("nav.projects" as any)}
            className="flex items-center justify-center p-2.5 rounded-xl transition-colors min-w-[52px] text-text-tertiary"
          >
            <Layers size={24} />
            <span className="sr-only">{t("nav.projects" as any)}</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
