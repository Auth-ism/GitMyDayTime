import { Search, X, Tag, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { useProjectLabels } from "@/hooks/useProjects";

const ISSUE_TYPES = ["epic", "story", "task", "bug", "sub_task"] as const;
const PRIORITIES  = ["critical", "high", "medium", "low", "none"] as const;

const PRIORITY_ACTIVE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/40",
  high:     "bg-orange-400/15 text-orange-400 border-orange-400/40",
  medium:   "bg-yellow-400/15 text-yellow-400 border-yellow-400/40",
  low:      "bg-blue-400/15 text-blue-400 border-blue-400/40",
  none:     "bg-bg text-text border-border",
};

export interface BoardFilters {
  search: string;
  types: string[];
  priorities: string[];
  labels: string[];
  assignedToMe: boolean;
}

export const EMPTY_FILTERS: BoardFilters = { search: "", types: [], priorities: [], labels: [], assignedToMe: false };

interface Props {
  projectId: string;
  filters: BoardFilters;
  onChange: (filters: BoardFilters) => void;
}

export default function BoardFilterBar({ projectId, filters, onChange }: Props) {
  const { t } = useI18n();
  const { data: availableLabels = [] } = useProjectLabels(projectId);
  const hasActive = filters.search || filters.types.length > 0 || filters.priorities.length > 0 || filters.labels.length > 0 || filters.assignedToMe;

  const toggleType = (type: string) =>
    onChange({
      ...filters,
      types: filters.types.includes(type)
        ? filters.types.filter(v => v !== type)
        : [...filters.types, type],
    });

  const togglePriority = (p: string) =>
    onChange({
      ...filters,
      priorities: filters.priorities.includes(p)
        ? filters.priorities.filter(v => v !== p)
        : [...filters.priorities, p],
    });

  const toggleLabel = (l: string) =>
    onChange({
      ...filters,
      labels: filters.labels.includes(l)
        ? filters.labels.filter(v => v !== l)
        : [...filters.labels, l],
    });

  return (
    <div className="flex flex-col gap-2 mb-3">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-xs w-full">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            className="input pl-7 text-sm w-full py-1.5"
            placeholder={t("board.searchPlaceholder" as any)}
            value={filters.search}
            onChange={e => onChange({ ...filters, search: e.target.value })}
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Assigned to me toggle */}
        <button
          onClick={() => onChange({ ...filters, assignedToMe: !filters.assignedToMe })}
          className={cn(
            "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors whitespace-nowrap",
            filters.assignedToMe
              ? "bg-accent/15 text-accent border-accent/40"
              : "text-text-tertiary border-border hover:border-accent/30 hover:text-text"
          )}
        >
          <User size={11} />
          {t("board.myIssues" as any)}
        </button>

        {hasActive && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text px-2 py-1.5 rounded-lg hover:bg-bg-subtle transition-colors whitespace-nowrap"
          >
            <X size={11} />
            {t("board.clearFilters" as any)}
          </button>
        )}
      </div>

      {/* Chip filters */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-text-tertiary mr-0.5">{t("board.filterType" as any)}</span>
        {ISSUE_TYPES.map(type => (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors",
              filters.types.includes(type)
                ? "bg-accent/15 text-accent border-accent/40"
                : "text-text-tertiary border-border hover:border-accent/30 hover:text-text"
            )}
          >
            {t(`issue.type.${type}` as any)}
          </button>
        ))}

        <span className="text-[10px] text-text-tertiary ml-2 mr-0.5">{t("board.filterPriority" as any)}</span>
        {PRIORITIES.map(p => (
          <button
            key={p}
            onClick={() => togglePriority(p)}
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors",
              filters.priorities.includes(p)
                ? PRIORITY_ACTIVE[p]
                : "text-text-tertiary border-border hover:border-accent/30 hover:text-text"
            )}
          >
            {t(`issue.priority.${p}` as any)}
          </button>
        ))}

        {availableLabels.length > 0 && (
          <>
            <span className="text-[10px] text-text-tertiary ml-2 mr-0.5 flex items-center gap-0.5">
              <Tag size={9} />
              {t("board.filterLabel" as any)}
            </span>
            {availableLabels.map(l => (
              <button
                key={l}
                onClick={() => toggleLabel(l)}
                className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors",
                  filters.labels.includes(l)
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "text-text-tertiary border-border hover:border-accent/30 hover:text-text"
                )}
              >
                {l}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
