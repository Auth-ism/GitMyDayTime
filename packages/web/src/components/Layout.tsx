import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Calendar, CalendarDays, BarChart3, Sun, Moon, Clock, LogOut } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "framer-motion";

const navItems = [
  { to: "/", icon: Clock, label: "Today" },
  { to: "/week", icon: CalendarDays, label: "Week" },
  { to: "/calendar", icon: Calendar, label: "Calendar" },
  { to: "/stats", icon: BarChart3, label: "Stats" },
];

export default function Layout() {
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-bg-secondary">
      {/* Desktop header */}
      <header className="border-b border-border sticky top-0 z-50 bg-bg/90 backdrop-blur-md hidden sm:block">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 font-semibold text-text tracking-tight"
            aria-label="GitMyDayTime — go to today"
          >
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <Clock size={15} className="text-bg" />
            </div>
            <span className="text-base">GitMyDayTime</span>
          </NavLink>

          <nav aria-label="Main navigation" className="flex items-center gap-1">
            {navItems.map(({ to, icon: Icon, label }) => (
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
            ))}

            <div className="w-px h-5 bg-border mx-1.5" role="separator" />

            <button
              onClick={toggle}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              className="btn-icon p-2 rounded-lg"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <button
              onClick={logout}
              aria-label="Sign out"
              className="btn-icon p-2 rounded-lg"
            >
              <LogOut size={16} />
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile header — minimal */}
      <header className="border-b border-border sticky top-0 z-50 bg-bg/90 backdrop-blur-md sm:hidden">
        <div className="px-4 h-12 flex items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-semibold text-text tracking-tight">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Clock size={13} className="text-bg" />
            </div>
            <span className="text-sm">GitMyDayTime</span>
          </NavLink>
          <div className="flex items-center gap-0.5">
            <button
              onClick={toggle}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              className="btn-icon p-2 rounded-lg"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={logout}
              aria-label="Sign out"
              className="btn-icon p-2 rounded-lg"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 sm:pb-0" id="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            className={cn(
              "mx-auto px-4 sm:px-6 py-4 sm:py-6",
              location.pathname === "/week" ? "max-w-6xl" : "max-w-3xl"
            )}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-50 bg-bg/95 backdrop-blur-md border-t border-border sm:hidden safe-bottom"
      >
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(({ to, icon: Icon, label }) => (
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
          ))}
        </div>
      </nav>
    </div>
  );
}
