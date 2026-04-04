import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { Clock, ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isValid = password.length >= 6 && password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || loading) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "invalid_token") {
          setError(t("reset.invalidToken" as any));
        } else {
          setError(t("login.error"));
        }
      }
    } catch {
      setError(t("login.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <Clock size={24} className="text-bg" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">GitMyDayTime</h1>
          <p className="text-sm text-text-secondary mt-1">
            {t("reset.desc" as any)}
          </p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-accent" />
            </div>
            <p className="text-sm text-text-secondary mb-6">{t("reset.success" as any)}</p>
            <button
              onClick={() => navigate("/")}
              className="btn btn-primary w-full !py-3 text-base"
            >
              {t("login.signIn")}
              <ArrowRight size={16} />
            </button>
          </div>
        ) : !token ? (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger-soft px-3 py-2.5 rounded-lg">
            <AlertCircle size={15} className="flex-shrink-0" />
            {t("reset.invalidToken" as any)}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {t("reset.newPassword" as any)}
              </label>
              <input
                type="password"
                className="input !text-base !py-3"
                placeholder={t("reset.newPasswordPlace" as any)}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoFocus
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                {t("reset.confirm" as any)}
              </label>
              <input
                type="password"
                className="input !text-base !py-3"
                placeholder={t("reset.confirmPlace" as any)}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                autoComplete="new-password"
              />
            </div>

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
                <span className="animate-pulse">{t("reset.submitting" as any)}</span>
              ) : (
                <>
                  {t("reset.submit" as any)}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
