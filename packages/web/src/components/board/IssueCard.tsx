import { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Bug, Zap, BookOpen, CheckSquare, Minus, Plus, CornerDownRight, Archive, GripVertical, ChevronDown } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import { showSuccessToast } from "@/components/Toast";
import type { Issue, WorkflowStatus } from "@gmd/shared";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-l-red-500",
  high:     "border-l-orange-400",
  medium:   "border-l-yellow-400",
  low:      "border-l-blue-400",
  none:     "border-l-border",
};

const TYPE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  epic:     Zap,
  story:    BookOpen,
  task:     CheckSquare,
  bug:      Bug,
  sub_task: Minus,
};

const TYPE_COLORS: Record<string, string> = {
  epic:     "text-purple-400",
  story:    "text-blue-400",
  task:     "text-green-400",
  bug:      "text-red-400",
  sub_task: "text-text-tertiary",
};

interface Props {
  issue: Issue;
  projectId: string;
  currentUserId: string;
  canEdit?: boolean;
  onAddToPlan?: (issueId: string, date: string) => Promise<void>;
  addToPlanPending?: boolean;
  onArchive?: (issueId: string) => void;
  archivePending?: boolean;
  onDragStart?: (issueId: string, sourceStatusId: string) => void;
  allStatuses?: WorkflowStatus[];
  onStatusChange?: (issueId: string, statusId: string) => void;
  dragHandle?: React.ReactNode;
}

export default function IssueCard({
  issue, projectId, currentUserId, canEdit,
  onAddToPlan, addToPlanPending, onArchive, archivePending,
  onDragStart, allStatuses, onStatusChange, dragHandle,
}: Props) {
  const { t } = useI18n();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [planDate, setPlanDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [dragging, setDragging] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const TypeIcon = TYPE_ICONS[issue.issueType] ?? CheckSquare;
  const isAssignee = issue.assigneeId === currentUserId;
  const isOverdue = useMemo(
    () => !!issue.dueDate && new Date(issue.dueDate) < new Date() && issue.statusCategory !== "done",
    [issue.dueDate, issue.statusCategory],
  );

  const handleAddToPlan = async () => {
    await onAddToPlan?.(issue.id, planDate);
    setShowPlanModal(false);
    showSuccessToast(`${issue.issueKey} plana eklendi → Bugün`);
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("issueId", issue.id);
          e.dataTransfer.setData("sourceStatusId", issue.statusId);
          e.dataTransfer.effectAllowed = "move";
          setDragging(true);
          onDragStart?.(issue.id, issue.statusId);
        }}
        onDragEnd={() => setDragging(false)}
        className={cn(
          "card p-3 border-l-[3px] text-sm cursor-grab active:cursor-grabbing group transition-all hover:shadow-md",
          PRIORITY_COLORS[issue.priority],
          dragging && "opacity-40 scale-95"
        )}
      >
        <Link to={`/projects/${projectId}/issues/${issue.id}`} className="block space-y-2">
          <div className="flex items-start justify-between gap-1">
            <button
              type="button"
              onClick={e => {
                e.preventDefault();
                navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}/issues/${issue.id}`);
                showSuccessToast(`${issue.issueKey} kopyalandı`);
              }}
              className="text-[10px] font-mono text-text-tertiary flex-shrink-0 hover:text-accent transition-colors"
              title="Linki kopyala"
            >
              {issue.issueKey}
            </button>
            <div className="flex items-center gap-1 flex-shrink-0">
              <TypeIcon size={12} className={cn("mt-0.5", TYPE_COLORS[issue.issueType])} />
              {dragHandle}
            </div>
          </div>

          {issue.parentIssueKey && (
            <div className="flex items-center gap-1 text-[10px] bg-bg-subtle rounded px-1.5 py-0.5 -mx-0.5 border border-border/50">
              <CornerDownRight size={9} className="text-text-tertiary flex-shrink-0" />
              <span className="font-mono text-text-secondary font-medium flex-shrink-0">{issue.parentIssueKey}</span>
              {issue.parentTitle && (
                <span className="text-text-tertiary truncate">{issue.parentTitle}</span>
              )}
            </div>
          )}

          <p className="text-text text-xs font-medium leading-snug line-clamp-2">{issue.title}</p>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {isOverdue && issue.dueDate && (
                <div className="flex items-center gap-0.5 text-danger text-[10px]">
                  <CalendarDays size={10} />
                  <span>{issue.dueDate}</span>
                </div>
              )}
            </div>
            {issue.assigneeAvatarUrl ? (
              <img src={issue.assigneeAvatarUrl} alt={issue.assigneeUsername ?? ""} className="w-5 h-5 rounded-full flex-shrink-0 object-cover" />
            ) : issue.assigneeUsername ? (
              <div className="w-5 h-5 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-semibold text-text-secondary">{issue.assigneeUsername.slice(0, 2).toUpperCase()}</span>
              </div>
            ) : null}
          </div>
        </Link>

        {/* Hover actions — always visible on mobile, hover-reveal on desktop */}
        {(isAssignee || canEdit || (allStatuses && onStatusChange)) && (
          <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1 sm:border-0 sm:pt-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {isAssignee && !issue.planItemId && (
              <button
                onClick={(e) => { e.preventDefault(); setShowPlanModal(true); }}
                className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] text-accent hover:bg-accent/10 rounded transition-colors"
              >
                <Plus size={10} />
                {t("projects.addToPlan" as any)}
              </button>
            )}
            {isAssignee && issue.planItemId && (
              <div className="flex-1 text-[10px] text-green-400 text-center">
                ✓ {t("projects.inPlan" as any)}
              </div>
            )}

            {/* Quick status change */}
            {allStatuses && onStatusChange && (
              <div ref={statusMenuRef} className="relative">
                <button
                  onClick={(e) => { e.preventDefault(); setShowStatusMenu(v => !v); }}
                  className="flex items-center gap-0.5 py-1 px-1.5 text-[10px] text-text-secondary hover:bg-bg-secondary rounded transition-colors"
                  title="Durumu değiştir"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: allStatuses.find(s => s.id === issue.statusId)?.color ?? "#888" }}
                  />
                  <ChevronDown size={9} />
                </button>
                {showStatusMenu && (
                  <div
                    className="absolute bottom-full left-0 mb-1 bg-bg-elevated border border-border rounded-lg shadow-xl py-1 z-20 min-w-[130px]"
                    onClick={e => e.preventDefault()}
                  >
                    {allStatuses.map(s => (
                      <button
                        key={s.id}
                        onClick={(e) => {
                          e.preventDefault();
                          if (s.id !== issue.statusId) onStatusChange(issue.id, s.id);
                          setShowStatusMenu(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-left hover:bg-bg-secondary transition-colors",
                          s.id === issue.statusId && "text-text font-medium"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canEdit && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  if (confirmArchive) {
                    onArchive?.(issue.id);
                    setConfirmArchive(false);
                  } else {
                    setConfirmArchive(true);
                    setTimeout(() => setConfirmArchive(false), 3000);
                  }
                }}
                disabled={archivePending}
                className={cn(
                  "p-1 rounded transition-colors disabled:opacity-50",
                  confirmArchive
                    ? "bg-amber-400/15 text-amber-400"
                    : "text-text-tertiary hover:text-amber-400 hover:bg-amber-400/10"
                )}
                title={confirmArchive ? "Onayla" : (t("issue.archive" as any) || "Arşivle")}
              >
                <Archive size={11} />
              </button>
            )}
          </div>
        )}
      </div>

      {showPlanModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
          onClick={() => setShowPlanModal(false)}
        >
          <div className="card p-4 w-full max-w-xs shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-text text-sm mb-3">{t("projects.addToPlan" as any)}</h3>
            <DatePicker value={planDate} onChange={val => val && setPlanDate(val)} className="mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setShowPlanModal(false)} className="btn-secondary flex-1 py-2 text-xs">
                İptal
              </button>
              <button onClick={handleAddToPlan} disabled={addToPlanPending} className="btn-primary flex-1 py-2 text-xs disabled:opacity-50">
                {addToPlanPending ? "..." : "Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
