import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Clock, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

export default function ApiKeyRequestSection() {
  const { locale } = useI18n();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["api-key-request"],
    queryFn: () => api.getApiKeyRequest(),
  });

  const submitMutation = useMutation({
    mutationFn: () => api.submitApiKeyRequest(reason.trim() || undefined),
    onSuccess: () => {
      showSuccessToast("Talebiniz iletildi, onay için bekleyin.");
      qc.invalidateQueries({ queryKey: ["api-key-request"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Gönderilemedi";
      showErrorToast(msg);
    },
  });

  if (isLoading) return null;

  const req = data?.request;

  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-3">
        <KeyRound size={18} className="text-accent flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">API Key</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            API key ile görevlerini ve planlarını dışarıdan okuyabilir, entegrasyonlar kurabilirsin.
          </p>
        </div>
      </div>

      {!req && (
        <div className="space-y-2">
          <textarea
            className="input !text-xs w-full resize-none"
            rows={2}
            placeholder="Kullanım amacı (isteğe bağlı)"
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="btn btn-primary !py-1.5 !px-4 text-xs w-full"
          >
            {submitMutation.isPending ? "Gönderiliyor…" : "API Key Talep Et"}
          </button>
        </div>
      )}

      {req?.status === "pending" && (
        <div className="flex items-center gap-2 text-xs text-text-secondary bg-bg-secondary rounded-lg px-3 py-2.5">
          <Clock size={13} className="text-amber-400 flex-shrink-0" />
          <span>
            Talebiniz inceleniyor —{" "}
            {new Date(req.requestedAt).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
        </div>
      )}

      {req?.status === "approved" && (
        <div className="flex items-center gap-2 text-xs text-success bg-success/10 rounded-lg px-3 py-2.5">
          <CheckCircle2 size={13} className="flex-shrink-0" />
          <span>Talebiniz onaylandı — API key email ile gönderildi.</span>
        </div>
      )}
    </div>
  );
}
