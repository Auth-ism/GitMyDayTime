import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Search, Target, MessageSquare, Check, Clock, Bug, Zap, BookOpen, CheckSquare, Minus, Layers } from "lucide-react";
import { formatDuration } from "@gmd/shared";
import { useCategories } from "@/hooks/useCategories";
import { motion, AnimatePresence } from "framer-motion";

export default function SearchPage() {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { getCategoryColor } = useCategories();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => api.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  // Merge plans and tasks, sort by date descending
  const results = useMemo(() => {
    if (!data) return [];
    const items: Array<{ type: "plan" | "task"; date: string; data: any }> = [
      ...data.plans.map((p) => ({ type: "plan" as const, date: p.date, data: p })),
      ...data.tasks.map((t) => ({ type: "task" as const, date: t.date, data: t })),
    ];
    items.sort((a, b) => b.date.localeCompare(a.date));
    return items;
  }, [data]);

  const issueResults = data?.issues ?? [];
  const totalResults = results.length + issueResults.length;

  const ISSUE_TYPE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
    epic: Zap, story: BookOpen, task: CheckSquare, bug: Bug, sub_task: Minus,
  };
  const ISSUE_TYPE_COLORS: Record<string, string> = {
    epic: "text-purple-400", story: "text-blue-400", task: "text-green-400",
    bug: "text-red-400", sub_task: "text-text-tertiary",
  };
  const PRIORITY_COLORS: Record<string, string> = {
    critical: "text-red-400", high: "text-orange-400", medium: "text-yellow-400",
    low: "text-blue-400", none: "text-text-tertiary",
  };

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="flex items-center gap-3">
          <Search size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-base placeholder:text-text-tertiary"
            placeholder={t("search.placeholder")}
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
          {t("search.results", { count: totalResults, s: totalResults !== 1 ? "s" : "", query: debouncedQuery })}
        </p>
      )}

      {/* Issue results */}
      {issueResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={10} />
            Proje Görevleri ({issueResults.length})
          </p>
          {issueResults.map(issue => {
            const TypeIcon = ISSUE_TYPE_ICONS[issue.issueType] ?? CheckSquare;
            return (
              <Link
                key={issue.id}
                to={`/projects/${issue.projectId}/issues/${issue.id}`}
                className="block card text-left hover:border-border-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TypeIcon size={14} className={cn("flex-shrink-0", ISSUE_TYPE_COLORS[issue.issueType])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text truncate">{issue.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-text-tertiary">{issue.issueKey}</span>
                      <span className="flex items-center gap-1 text-[10px] text-text-tertiary">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: issue.statusColor }} />
                        {issue.statusName}
                      </span>
                      <span className={cn("text-[10px] font-medium", PRIORITY_COLORS[issue.priority])}>
                        {t(`issue.priority.${issue.priority}` as any)}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-text-tertiary bg-accent-soft px-1.5 py-0.5 rounded flex-shrink-0">
                    {issue.projectName}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {results.map((item) =>
          item.type === "plan" ? (
            <motion.button
              key={`plan-${item.data.id}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => navigate(`/day/${item.date}`)}
              className="w-full card text-left hover:border-border-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {item.data.completed ? (
                    <Check size={14} className="text-success" />
                  ) : (
                    <Target size={14} className="text-text-tertiary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm", item.data.completed && "line-through text-text-tertiary")}>
                    {item.data.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: getCategoryColor(item.data.category) + "20", color: getCategoryColor(item.data.category) }}
                    >
                      {getCatLabel(item.data.category)}
                    </span>
                    <span className="text-[10px] text-text-tertiary">{item.date}</span>
                    {item.data.duration && (
                      <span className="flex items-center gap-0.5 text-[10px] text-text-tertiary">
                        <Clock size={9} />
                        {formatDuration(item.data.duration)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          ) : (
            <motion.button
              key={`task-${item.data.id}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              onClick={() => navigate(`/day/${item.date}`)}
              className="w-full card text-left hover:border-border-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={14} className="text-text-tertiary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.data.description}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                      style={{ backgroundColor: getCategoryColor(item.data.category) + "20", color: getCategoryColor(item.data.category) }}
                    >
                      {getCatLabel(item.data.category)}
                    </span>
                    <span className="text-[10px] text-text-tertiary">{item.date}</span>
                    {item.data.duration && (
                      <span className="flex items-center gap-0.5 text-[10px] text-text-tertiary">
                        <Clock size={9} />
                        {formatDuration(item.data.duration)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.button>
          )
        )}
      </AnimatePresence>

      {debouncedQuery.length >= 2 && !isLoading && totalResults === 0 && (
        <div className="text-center py-12 text-text-tertiary">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t("search.noResults")}</p>
          <p className="text-xs mt-1">{t("search.tryDifferent")}</p>
        </div>
      )}

      {debouncedQuery.length < 2 && (
        <div className="text-center py-12 text-text-tertiary">
          <Search size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{t("search.searchAll")}</p>
          <p className="text-xs mt-1">{t("search.minChars")}</p>
        </div>
      )}
    </div>
  );
}
