import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Copy, Check, Trash2, Plus, AlertCircle } from "lucide-react";
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

export default function ApiTokensSection() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () => api.listApiTokens(),
  });

  const tokens = data?.tokens ?? [];

  const createMutation = useMutation({
    mutationFn: (tokenName: string) => api.createApiToken(tokenName),
    onSuccess: (res) => {
      setCreatedToken(res.token);
      setName("");
      qc.invalidateQueries({ queryKey: ["api-tokens"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error && err.message.startsWith("429")
        ? t("apiToken.rateLimited" as any)
        : t("apiToken.createFailed" as any);
      showErrorToast(msg);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeApiToken(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-tokens"] });
      showSuccessToast(t("apiToken.revoked" as any));
    },
    onError: () => showErrorToast(t("apiToken.revokeFailed" as any)),
  });

  const handleCopy = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showErrorToast(t("apiToken.copyFailed" as any));
    }
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createMutation.mutate(trimmed);
  };

  return (
    <div className="card">
      <div className="flex items-start gap-3 mb-3">
        <KeyRound size={18} className="text-accent flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold">{t("apiToken.title" as any)}</h3>
          <p className="text-xs text-text-secondary mt-0.5">
            {t("apiToken.desc" as any)}
          </p>
        </div>
      </div>

      {createdToken && (
        <div className="mb-3 p-3 rounded-lg bg-accent-soft/20 border border-accent/30">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle size={14} className="text-accent flex-shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary">
              {t("apiToken.onceWarning" as any)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={createdToken}
              onFocus={(e) => e.currentTarget.select()}
              className="input !text-[11px] flex-1 font-mono"
            />
            <button
              onClick={handleCopy}
              className="btn btn-primary !py-1.5 !px-3 text-xs flex-shrink-0"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? t("apiToken.copied" as any) : t("apiToken.copy" as any)}
            </button>
          </div>
          <button
            onClick={() => setCreatedToken(null)}
            className="mt-2 text-[11px] text-text-tertiary hover:text-text-secondary"
          >
            {t("apiToken.done" as any)}
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
                <div className="text-text font-medium truncate">{tk.name}</div>
                <div className="text-text-tertiary text-[11px]">
                  {t("apiToken.createdAt" as any, { date: formatDate(tk.createdAt, locale) })}
                </div>
                {tk.lastUsedAt ? (
                  <div className="text-text-tertiary text-[11px]">
                    {t("apiToken.lastUsedAt" as any, { date: formatDate(tk.lastUsedAt, locale) })}
                  </div>
                ) : (
                  <div className="text-text-tertiary text-[11px]">
                    {t("apiToken.neverUsed" as any)}
                  </div>
                )}
              </div>
              <button
                onClick={() => revokeMutation.mutate(tk.id)}
                disabled={revokeMutation.isPending}
                className="btn btn-ghost !py-1 !px-2 text-xs text-danger hover:bg-danger/10"
                aria-label={t("apiToken.revoke" as any)}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("apiToken.namePlaceholder" as any)}
          maxLength={64}
          className="input !text-xs flex-1"
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
        />
        <button
          onClick={handleCreate}
          disabled={createMutation.isPending || !name.trim()}
          className="btn btn-ghost !py-1.5 !px-3 text-xs flex-shrink-0 border border-dashed border-border hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <Plus size={13} />
          {createMutation.isPending ? t("apiToken.creating" as any) : t("apiToken.createNew" as any)}
        </button>
      </div>
    </div>
  );
}
