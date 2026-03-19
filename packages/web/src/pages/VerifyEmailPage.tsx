import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type State = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setState("error");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? setState("success") : setState("error")))
      .catch(() => setState("error"));
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {state === "loading" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Clock size={24} className="text-bg" />
            </div>
            <p className="text-sm text-text-secondary">{t("verify.loading" as any)}</p>
          </>
        )}

        {state === "success" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={24} className="text-accent" />
            </div>
            <h1 className="text-xl font-bold mb-2">{t("verify.successTitle" as any)}</h1>
            <p className="text-sm text-text-secondary mb-6">{t("verify.successDesc" as any)}</p>
            <Link to="/" className="btn btn-primary">{t("verify.goApp" as any)}</Link>
          </>
        )}

        {state === "error" && (
          <>
            <div className="w-14 h-14 rounded-2xl bg-danger-soft flex items-center justify-center mx-auto mb-4">
              <XCircle size={24} className="text-danger" />
            </div>
            <h1 className="text-xl font-bold mb-2">{t("verify.errorTitle" as any)}</h1>
            <p className="text-sm text-text-secondary mb-6">{t("verify.errorDesc" as any)}</p>
            <Link to="/" className="btn btn-primary">{t("verify.goApp" as any)}</Link>
          </>
        )}
      </div>
    </div>
  );
}
