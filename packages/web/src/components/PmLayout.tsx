import { useState } from "react";
import { NavLink, useLocation, Outlet } from "react-router-dom";
import { Sun, Moon, LogOut, Layers, UserCircle, Clock, Globe } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { useI18n, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import NotificationBell from "@/components/NotificationBell";
import LogoutConfirmModal from "@/components/LogoutConfirmModal";

const GMD_URL = "https://gmd.byfeb.com";

export default function PmLayout() {
  const { theme, toggle } = useTheme();
  const { logout, profile } = useAuth();
  const { locale, setLocale } = useI18n();
  const location = useLocation();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isBoard = location.pathname.includes("/board");
  const toggleLocale = () => setLocale(locale === "en" ? "tr" : "en" as Locale);

  const Avatar = () => profile?.avatarUrl
    ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
    : profile
      ? <span>{(profile.displayName || profile.username).slice(0, 2).toUpperCase()}</span>
      : <UserCircle size={16} />;

  return (
    <div className={cn("flex flex-col bg-bg-secondary", isBoard ? "h-dvh overflow-hidden" : "min-h-screen")}>
      {/* Desktop header */}
      <header className="border-b border-border sticky top-0 z-40 bg-bg/90 backdrop-blur-md hidden sm:block">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-4">
          {/* Logo */}
          <NavLink
            to="/projects"
            className="flex items-center gap-2.5 font-semibold text-text tracking-tight"
          >
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Layers size={15} className="text-bg" />
            </div>
            <span className="text-base">GMD Projects</span>
            <span className="text-[10px] text-text-tertiary font-normal -ml-1.5">v{__APP_VERSION__}</span>
          </NavLink>

          {/* Projects nav */}
          <nav aria-label="Main navigation" className="flex items-center gap-1">
            <NavLink
              to="/projects"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-accent text-bg font-medium"
                    : "text-text-secondary hover:text-text hover:bg-accent-soft"
                )
              }
            >
              <Layers size={16} />
              <span>Projeler</span>
            </NavLink>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Back to GMD */}
            <a
              href={GMD_URL}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text hover:bg-accent-soft transition-colors"
              title="GitMyDayTime'a dön"
            >
              <Clock size={16} />
              <span className="text-xs">Görevlerim</span>
            </a>

            <div className="w-px h-5 bg-border mx-1" role="separator" />

            <NotificationBell />

            <button onClick={toggleLocale} aria-label="Dil değiştir" className="btn-icon p-2 rounded-lg">
              <Globe size={16} />
            </button>

            <button onClick={toggle} aria-label="Tema değiştir" className="btn-icon p-2 rounded-lg">
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <NavLink
              to="/profile"
              className={({ isActive }) =>
                cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors overflow-hidden",
                  isActive ? "bg-accent text-bg" : "bg-accent-soft text-text-secondary hover:text-text"
                )
              }
            >
              <Avatar />
            </NavLink>

            <button onClick={() => setShowLogoutConfirm(true)} aria-label="Çıkış" className="btn-icon p-2 rounded-lg">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile header */}
      <header className="border-b border-border sticky top-0 z-40 bg-bg/90 backdrop-blur-md sm:hidden safe-top">
        <div className="px-3 h-12 flex items-center justify-between">
          <NavLink to="/projects" className="flex items-center gap-2 font-semibold text-text tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Layers size={13} className="text-bg" />
            </div>
            <span className="text-sm">GMD Projects</span>
          </NavLink>

          <div className="flex items-center gap-0.5">
            <NotificationBell />
            <button onClick={toggleLocale} className="btn-icon p-2 rounded-lg text-[10px] font-bold">
              {locale === "en" ? "TR" : "EN"}
            </button>
            <button onClick={toggle} className="btn-icon p-2 rounded-lg">
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-colors overflow-hidden",
                  isActive ? "bg-accent text-bg" : "bg-accent-soft text-text-secondary hover:text-text"
                )
              }
            >
              <Avatar />
            </NavLink>
            <button onClick={() => setShowLogoutConfirm(true)} className="btn-icon p-2 rounded-lg">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "pb-16 sm:pb-0",
          isBoard ? "flex flex-col overflow-hidden flex-1" : "flex-1"
        )}
        id="main-content"
      >
        <div
          className={cn(
            "mx-auto px-4 sm:px-6",
            isBoard
              ? "flex flex-col flex-1 min-h-0 pt-4 sm:pt-6 w-full max-w-[1800px]"
              : "py-4 sm:py-6 max-w-5xl"
          )}
        >
          <Outlet />
        </div>
      </main>

      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={() => { setShowLogoutConfirm(false); logout(); }}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-md border-t border-border sm:hidden safe-bottom"
      >
        <div className="flex items-center justify-around h-16 px-2">
          <NavLink
            to="/projects"
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px]",
                isActive ? "text-accent" : "text-text-tertiary"
              )
            }
          >
            <Layers size={20} />
            <span className="text-[10px] font-medium">Projeler</span>
          </NavLink>
          <a
            href={GMD_URL}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[60px] text-text-tertiary"
          >
            <Clock size={20} />
            <span className="text-[10px] font-medium">Görevler</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
