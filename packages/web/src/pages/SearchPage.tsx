import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Search, Target, MessageSquare, Check, Clock } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_COLORS, formatDuration, type Category } from "@gmd/shared";
import { motion, AnimatePresence } from "framer-motion";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => api.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const totalResults = (data?.plans.length || 0) + (data?.tasks.length || 0);

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-text-tertiary"
            placeholder="Search tasks, plans, notes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {isLoading && (
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {debouncedQuery.length >= 2 && data && (
        <p className="text-xs text-text-tertiary">
          {totalResults} result{totalResults !== 1 ? "s" : ""} for "{debouncedQuery}"
        </p>
      )}

      {/* Plan results */}
      <AnimatePresence mode="popLayout">
        {data?.plans.map((item) => (
          <motion.button
            key={`plan-${item.id}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => navigate(`/day/${item.date}`)}
            className="w-full card text-left hover:border-border-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {item.completed ? (
                  <Check size={14} className="text-success" />
                ) : (
                  <Target size={14} className="text-text-tertiary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", item.completed && "line-through text-text-tertiary")}>
                  {item.description}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                    style={{ backgroundColor: CATEGORY_COLORS[item.category] + "20", color: CATEGORY_COLORS[item.category] }}
                  >
                    {CATEGORY_LABELS[item.category]}
                  </span>
                  <span className="text-[10px] text-text-tertiary">{item.date}</span>
                  {item.estimatedDuration && (
                    <span className="flex items-center gap-0.5 text-[10px] text-text-tertiary">
                      <Clock size={9} />
                      {formatDuration(item.estimatedDuration)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.button>
        ))}

        {data?.tasks.map((task) => (
          <motion.button
            key={`task-${task.id}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => navigate(`/day/${task.date}`)}
            className="w-full card text-left hover:border-border-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={14} className="text-text-tertiary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">{task.description}</p>
                <span className="text-[10px] text-text-tertiary">{task.date}</span>
              </div>
            </div>
          </motion.button>
        ))}
      </AnimatePresence>

      {debouncedQuery.length >= 2 && !isLoading && totalResults === 0 && (
        <div className="text-center py-12 text-text-tertiary">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No results found</p>
          <p className="text-xs mt-1">Try a different search term</p>
        </div>
      )}

      {debouncedQuery.length < 2 && (
        <div className="text-center py-12 text-text-tertiary">
          <Search size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">Search across all your days</p>
          <p className="text-xs mt-1">Type at least 2 characters</p>
        </div>
      )}
    </div>
  );
}
