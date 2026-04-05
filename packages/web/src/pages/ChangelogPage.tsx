import { Link } from "react-router-dom";
import { ArrowLeft, Zap, Wrench, Gauge, AlertTriangle } from "lucide-react";
import { CHANGELOG, type ChangeType } from "@/data/changelog";
import { cn } from "@/lib/cn";

const TYPE_CONFIG: Record<ChangeType, { label: string; icon: typeof Zap; color: string }> = {
  feat:     { label: "Yeni",       icon: Zap,           color: "text-accent bg-accent/10" },
  fix:      { label: "Düzeltme",   icon: Wrench,        color: "text-amber-400 bg-amber-400/10" },
  perf:     { label: "Performans", icon: Gauge,         color: "text-green-400 bg-green-400/10" },
  breaking: { label: "Önemli",     icon: AlertTriangle, color: "text-red-400 bg-red-400/10" },
};

const BUMP_BADGE: Record<string, string> = {
  major: "bg-red-500/15 text-red-400 border-red-500/30",
  minor: "bg-accent/15 text-accent border-accent/30",
  patch: "bg-border text-text-tertiary border-border",
};

export default function ChangelogPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text transition-colors">
          <ArrowLeft size={13} />
          Ana sayfa
        </Link>
        <h1 className="font-bold text-text text-xl flex-1">Değişiklik Geçmişi</h1>
      </div>

      <div className="relative space-y-0">
        {/* Timeline line */}
        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-border" />

        {CHANGELOG.map((entry, i) => (
          <div key={entry.version} className="relative pl-10 pb-8">
            {/* Dot */}
            <div className={cn(
              "absolute left-0 top-1 w-[31px] h-[31px] rounded-full border-2 flex items-center justify-center",
              i === 0 ? "border-accent bg-accent/10" : "border-border bg-bg"
            )}>
              <div className={cn("w-2 h-2 rounded-full", i === 0 ? "bg-accent" : "bg-text-tertiary")} />
            </div>

            <div className="card p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-text">v{entry.version}</span>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", BUMP_BADGE[entry.bump])}>
                    {entry.bump}
                  </span>
                  {entry.summary && (
                    <span className="text-xs text-text-secondary font-medium">{entry.summary}</span>
                  )}
                </div>
                <span className="text-[11px] text-text-tertiary flex-shrink-0">{entry.date}</span>
              </div>

              {/* Changes */}
              <div className="space-y-1.5">
                {entry.changes.map((c, j) => {
                  const cfg = TYPE_CONFIG[c.type];
                  const Icon = cfg.icon;
                  return (
                    <div key={j} className="flex items-start gap-2">
                      <span className={cn("flex-shrink-0 mt-0.5 p-1 rounded", cfg.color)}>
                        <Icon size={10} />
                      </span>
                      <p className="text-xs text-text-secondary leading-relaxed">{c.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
