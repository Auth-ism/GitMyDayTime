import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";

interface SearchResult {
  id: string;
  description: string;
  category: string;
  date: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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
        const combined: SearchResult[] = [
          ...(data.plans ?? []).map((p: { id: string; description: string; category: string; date: string }) => ({
            id: p.id, description: p.description, category: p.category, date: p.date,
          })),
          ...(data.tasks ?? []).map((t: { id: string; description: string; category: string; date: string }) => ({
            id: t.id, description: t.description, category: t.category, date: t.date,
          })),
        ].slice(0, 8);
        setResults(combined);
        setSelected(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const go = useCallback((item: SearchResult) => {
    navigate(`/day/${item.date}`);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(v => Math.min(v + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelected(v => Math.max(v - 1, 0)); }
    else if (e.key === "Enter" && results[selected]) go(results[selected]);
    else if (e.key === "Escape") onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] p-4 bg-bg/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-lg bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-border">
          <Search size={15} className="text-text-tertiary flex-shrink-0" />
          <input
            id="command-palette-input"
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

        {results.length > 0 && (
          <ul className="py-1 max-h-[55vh] overflow-y-auto" role="listbox">
            {results.map((item, i) => (
              <li key={item.id} role="option" aria-selected={i === selected}>
                <button
                  onClick={() => go(item)}
                  onMouseEnter={() => setSelected(i)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors",
                    i === selected ? "bg-accent/10" : "hover:bg-bg-secondary"
                  )}
                >
                  <Calendar size={12} className="flex-shrink-0 text-text-tertiary mt-px" />
                  <span className="text-xs text-text flex-1 truncate">{item.description}</span>
                  <span className="text-[10px] text-text-tertiary flex-shrink-0">{item.date}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.trim() && !loading && results.length === 0 && (
          <p className="px-4 py-6 text-sm text-text-tertiary text-center">{t("cmd.noResults" as any)}</p>
        )}

        {!query.trim() && (
          <p className="px-4 py-4 text-xs text-text-tertiary text-center">{t("cmd.hint" as any)}</p>
        )}

        <div className="px-3.5 py-2 border-t border-border hidden sm:flex items-center gap-4 text-[10px] text-text-tertiary">
          <span><kbd className="font-mono bg-bg-secondary border border-border rounded px-1 py-0.5">↑↓</kbd> {t("cmd.navigate" as any)}</span>
          <span><kbd className="font-mono bg-bg-secondary border border-border rounded px-1 py-0.5">↵</kbd> {t("cmd.open" as any)}</span>
          <span><kbd className="font-mono bg-bg-secondary border border-border rounded px-1 py-0.5">Esc</kbd> {t("cmd.close" as any)}</span>
          <span className="ml-auto opacity-60">Ctrl/⌘ K</span>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
