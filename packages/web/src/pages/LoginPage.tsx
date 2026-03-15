import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Clock, ArrowRight, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { Moon, Sun } from "lucide-react";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, register } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setError("");
    setLoading(true);

    const result =
      mode === "login"
        ? await login(email, password)
        : await register(email, username, password);

    if (!result.ok) {
      setError(result.error || "Something went wrong");
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
      {/* Theme toggle */}
      <button
        onClick={toggle}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
        className="fixed top-4 right-4 btn-icon p-2.5 rounded-xl"
      >
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>

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
            {mode === "login" ? "Sign in to continue" : "Create your account"}
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
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === "register" ? "bg-bg text-text shadow-sm" : "text-text-secondary"
            }`}
          >
            Register
          </button>
        </div>

        {/* Form — key forces full remount so browser autofill resets between modes */}
        <form key={mode} onSubmit={handleSubmit} className="space-y-4" autoComplete={mode === "register" ? "off" : "on"}>
          <div>
            <label htmlFor={`${mode}-email`} className="block text-sm font-medium text-text-secondary mb-1.5">
              Email
            </label>
            <input
              id={`${mode}-email`}
              name="email"
              type="email"
              className="input !text-base !py-3"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              autoFocus
              autoComplete={mode === "login" ? "email" : "email"}
            />
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="reg-username" className="block text-sm font-medium text-text-secondary mb-1.5">
                Username
              </label>
              <input
                id="reg-username"
                name={`username-${Date.now()}`}
                type="text"
                className="input !text-base !py-3"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                autoComplete="one-time-code"
              />
            </div>
          )}

          <div>
            <label htmlFor={`${mode}-password`} className="block text-sm font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <input
              id={`${mode}-password`}
              name="password"
              type="password"
              className="input !text-base !py-3"
              placeholder={mode === "register" ? "Min 6 characters" : "Enter your password"}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "register" && (
            <div>
              <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-text-secondary mb-1.5">
                Confirm Password
              </label>
              <input
                id="reg-confirm-password"
                name="confirm-password"
                type="password"
                className="input !text-base !py-3"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                autoComplete="new-password"
              />
            </div>
          )}

          {/* Error message */}
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
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </span>
            ) : (
              <>
                {mode === "login" ? "Sign in" : "Create account"}
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
