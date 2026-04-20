import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Copy, Check, Trash2, Plus, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { showSuccessToast, showErrorToast } from "@/components/Toast";

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CalendarSubscribeSection() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({
    queryKey: ["calendar-tokens"],
    queryFn: () => api.listCalendarTokens(),
  });

  const tokens = data?.tokens ?? [];

  const createMutation = useMutation({
    mutationFn: () => api.createCalendarToken(),
    onSuccess: (res) => {
      setCreatedUrl(res.url);
      qc.invalidateQueries({ queryKey: ["calendar-tokens"] });
    },
    onError: () => showErrorToast(t("calendar.createFailed" as any)),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeCalendarToken(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-tokens"] });
      showSuccessToast(t("calendar.revoked" as any));
    },
    onError: () => showErrorToast(t("calendar.revokeFailed" as any)),
  });

  const handleCopy = async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showErrorToast(t("calendar.copyFailed" as any));
    }
  };

  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-3">
        <CalendarClock size={18} className="text-accent flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{t("calendar.title" as any)}</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {t("calendar.desc" as any)}
          </p>
        </div>
      </div>

      {createdUrl && (
        <div className="mb-3 p-3 rounded-lg bg-accent-soft/20 border border-accent/30">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle size={14} className="text-accent flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary">
              {t("calendar.onceWarning" as any)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={createdUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="input !text-[11px] flex-1 font-mono"
            />
            <button
              onClick={handleCopy}
              className="btn btn-primary !py-1.5 !px-3 text-xs flex-shrink-0"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t("calendar.copied" as any) : t("calendar.copy" as any)}
            </button>
          </div>
          <button
            onClick={() => setCreatedUrl(null)}
            className="mt-2 text-[11px] text-text-tertiary hover:text-text-secondary"
          >
            {t("calendar.done" as any)}
          </button>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="space-y-2 mb-3">
          {tokens.map((tk) => (
            <li
              key={tk.id}
              className="flex items-center gap-2 text-xs py-2 border-b border-border/50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-text-secondary">
                  {t("calendar.createdAt" as any, { date: formatDate(tk.createdAt, locale) })}
                </div>
                {tk.lastUsedAt && (
                  <div className="text-text-tertiary text-[11px]">
                    {t("calendar.lastUsedAt" as any, { date: formatDate(tk.lastUsedAt, locale) })}
                  </div>
                )}
                {!tk.lastUsedAt && (
                  <div className="text-text-tertiary text-[11px]">
                    {t("calendar.neverUsed" as any)}
                  </div>
                )}
              </div>
              <button
                onClick={() => revokeMutation.mutate(tk.id)}
                disabled={revokeMutation.isPending}
                className="btn btn-ghost !py-1 !px-2 text-xs text-danger hover:bg-danger/10"
                aria-label={t("calendar.revoke" as any)}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        className="btn btn-ghost !py-1.5 !px-3 text-xs w-full justify-center border border-dashed border-border hover:border-accent hover:text-accent"
      >
        <Plus size={13} />
        {createMutation.isPending ? t("calendar.creating" as any) : t("calendar.createNew" as any)}
      </button>
    </div>
  );
}
