import { useState } from "react";
import { Bug, X, Send, CheckCircle } from "lucide-react";

type ReportType = "bug" | "feature" | "other";

const TYPE_LABELS: Record<ReportType, string> = {
  bug: "Hata (Bug)",
  feature: "Özellik İsteği",
  other: "Diğer",
};

interface Props {
  onClose: () => void;
}

export default function BugReportModal({ onClose }: Props) {
  const [type, setType] = useState<ReportType>("bug");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!desc.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, description: desc.trim(), url: location.href }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Gönderilemedi");
      } else {
        setSent(true);
      }
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card p-5 w-full max-w-sm shadow-xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Bug size={15} className="text-accent" />
            </div>
            <h2 className="font-semibold text-text text-sm">Geri Bildirim</h2>
          </div>
          <button onClick={onClose} className="btn-icon p-1 rounded-lg text-text-tertiary hover:text-text">
            <X size={14} />
          </button>
        </div>

        {sent ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle size={32} className="text-green-400 mx-auto" />
            <p className="text-sm font-medium text-text">Teşekkürler!</p>
            <p className="text-xs text-text-tertiary">Geri bildiriminiz iletildi.</p>
            <button onClick={onClose} className="btn-primary px-6 py-2 text-xs mt-2">
              Kapat
            </button>
          </div>
        ) : (
          <>
            {/* Type selector */}
            <div className="flex gap-1.5">
              {(Object.keys(TYPE_LABELS) as ReportType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex-1 text-[11px] py-1.5 rounded-lg border transition-colors font-medium ${
                    type === t
                      ? "bg-accent/15 text-accent border-accent/40"
                      : "text-text-tertiary border-border hover:border-accent/30 hover:text-text"
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-text-secondary">Açıklama</label>
              <textarea
                className="input w-full resize-none text-xs py-2"
                rows={4}
                placeholder={type === "bug" ? "Ne oldu? Adımları açıkla..." : "Neye ihtiyacın var?"}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                autoFocus
              />
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary flex-1 py-2 text-xs">
                İptal
              </button>
              <button
                onClick={submit}
                disabled={loading || !desc.trim()}
                className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 text-xs disabled:opacity-50"
              >
                {loading ? "..." : (
                  <>
                    <Send size={11} />
                    Gönder
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
