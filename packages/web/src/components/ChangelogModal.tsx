import { Link } from "react-router-dom";
import { X, Zap, Wrench, Gauge, AlertTriangle } from "lucide-react";
import { CHANGELOG, type ChangeType } from "@/data/changelog";
import { cn } from "@/lib/cn";

const LS_KEY = "gmd-seen-version";

function majorMinor(v: string) {
  const [maj, min] = v.split(".").map(Number);
  return `${maj}.${min}`;
}

export function shouldShowChangelog(appVersion: string): boolean {
  try {
    const seen = localStorage.getItem(LS_KEY);
    if (!seen) return true;
    // Show if major or minor changed
    return majorMinor(seen) !== majorMinor(appVersion);
  } catch { return false; }
}

export function markChangelogSeen(appVersion: string) {
  try { localStorage.setItem(LS_KEY, appVersion); } catch {}
}

const TYPE_CONFIG: Record<ChangeType, { label: string; icon: typeof Zap; color: string }> = {
  feat:     { label: "Yeni",    icon: Zap,           color: "text-accent bg-accent/10" },
  fix:      { label: "Düzeltme", icon: Wrench,       color: "text-amber-400 bg-amber-400/10" },
  perf:     { label: "Performans", icon: Gauge,      color: "text-green-400 bg-green-400/10" },
  breaking: { label: "Önemli",  icon: AlertTriangle, color: "text-red-400 bg-red-400/10" },
};

interface Props {
  version: string;
  onClose: () => void;
}

export default function ChangelogModal({ version, onClose }: Props) {
  const latest = CHANGELOG[0];

  const handleClose = () => {
    markChangelogSeen(version);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/85 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="card p-5 w-full max-w-sm shadow-xl space-y-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono bg-accent/15 text-accent px-2 py-0.5 rounded-md font-semibold">
                v{latest.version}
              </span>
              <span className="text-[10px] text-text-tertiary">{latest.date}</span>
            </div>
            <h2 className="font-bold text-text text-base">
              {latest.summary ?? "Güncelleme"}
            </h2>
          </div>
          <button onClick={handleClose} className="btn-icon p-1 rounded-lg text-text-tertiary hover:text-text flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Changes */}
        <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
          {latest.changes.map((c, i) => {
            const cfg = TYPE_CONFIG[c.type];
            const Icon = cfg.icon;
            return (
              <div key={i} className="flex items-start gap-2.5">
                <span className={cn("flex-shrink-0 mt-0.5 p-1 rounded-md", cfg.color)}>
                  <Icon size={10} />
                </span>
                <p className="text-xs text-text-secondary leading-relaxed">{c.text}</p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-2 border-t border-border flex items-center justify-between">
          <Link
            to="/changelog"
            onClick={handleClose}
            className="text-[11px] text-text-tertiary hover:text-accent transition-colors"
          >
            Tüm değişiklikler →
          </Link>
          <button onClick={handleClose} className="btn-primary px-4 py-1.5 text-xs">
            Harika!
          </button>
        </div>
      </div>
    </div>
  );
}
