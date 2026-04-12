import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bug, Zap, BookOpen, CheckSquare, Minus, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { motion } from "framer-motion";

const TYPE_ICONS = {
  epic:     Zap,
  story:    BookOpen,
  task:     CheckSquare,
  bug:      Bug,
  sub_task: Minus,
} as const;

const TYPE_COLORS = {
  epic:     "text-purple-400",
  story:    "text-blue-400",
  task:     "text-green-400",
  bug:      "text-red-400",
  sub_task: "text-text-tertiary",
} as const;

interface SearchIssue {
  id: string; issueKey: string; title: string;
  projectId: string; projectName: string;
  priority: string; issueType: string;
  statusName: string; statusColor: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchIssue[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query);
        setResults(data.issues.slice(0, 8));
        setSelected(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const go = useCallback((issue: SearchIssue) => {
    navigate(`/projects/${issue.projectId}/issues/${issue.id}`);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(v => Math.min(v + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected(v => Math.max(v - 1, 0)); }
    else if (e.key === "Enter" && results[selected]) go(results[selected]);
    else if (e.key === "Escape") onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] p-4 bg-bg/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.12 }}
        className="w-full max-w-lg bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border">
          <Search size={15} className="text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-tertiary"
            placeholder={t("cmd.placeholder" as any)}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          {loading && (
            <div className="w-3.5 h-3.5 border-2 border-accent/30 border-t-accent rounded-full animate-spin flex-shrink-0" />
          )}
          <button onClick={onClose} className="text-text-tertiary hover:text-text transition-colors p-0.5">
            <X size={13} />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="py-1 max-h-[55vh] overflow-y-auto" role="listbox">
            {results.map((issue, i) => {
              const Icon = TYPE_ICONS[issue.issueType as keyof typeof TYPE_ICONS] ?? CheckSquare;
              const colorCls = TYPE_COLORS[issue.issueType as keyof typeof TYPE_COLORS] ?? "text-text-tertiary";
              return (
                <li key={issue.id} role="option" aria-selected={i === selected}>
                  <button
                    onClick={() => go(issue)}
                    onMouseEnter={() => setSelected(i)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors",
                      i === selected ? "bg-accent/10" : "hover:bg-bg-secondary"
                    )}
                  >
                    <Icon size={12} className={cn("flex-shrink-0 mt-px", colorCls)} />
                    <span className="text-[10px] font-mono text-text-tertiary flex-shrink-0 w-[4.5rem]">{issue.issueKey}</span>
                    <span className="text-xs text-text flex-1 truncate">{issue.title}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-text-tertiary hidden sm:inline">{issue.projectName}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded border border-border/60 font-medium"
                        style={{ color: issue.statusColor }}
                      >
                        {issue.statusName}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <p className="px-4 py-6 text-sm text-text-tertiary text-center">{t("cmd.noResults" as any)}</p>
        )}

        {!query.trim() && (
          <p className="px-4 py-4 text-xs text-text-tertiary text-center">{t("cmd.hint" as any)}</p>
        )}

        {/* Footer hints — desktop only */}
        <div className="px-3.5 py-2 border-t border-border hidden sm:flex items-center gap-4 text-[10px] text-text-tertiary">
          <span><kbd className="font-mono bg-bg-secondary border border-border rounded px-1 py-0.5">↑↓</kbd> {t("cmd.navigate" as any)}</span>
          <span><kbd className="font-mono bg-bg-secondary border border-border rounded px-1 py-0.5">↵</kbd> {t("cmd.open" as any)}</span>
          <span><kbd className="font-mono bg-bg-secondary border border-border rounded px-1 py-0.5">Esc</kbd> {t("cmd.close" as any)}</span>
          <span className="ml-auto opacity-60">Ctrl/⌘ K</span>
        </div>
      </motion.div>
    </div>
  );
}
