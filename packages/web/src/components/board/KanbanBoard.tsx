import { useState, useMemo, useRef, useEffect } from "react";
import { Flag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useBoard, useProjectEvents, useIssueMutations, useSprints, useSprintMutations } from "@/hooks/useProjects";
import { useAuth } from "@/lib/auth";
import BoardColumn from "./BoardColumn";
import CreateIssueModal from "./CreateIssueModal";
import BoardFilterBar, { EMPTY_FILTERS, type BoardFilters } from "./BoardFilterBar";
import type { ProjectRole } from "@gmd/shared";
import { cn } from "@/lib/cn";

interface Props {
  projectId: string;
  myRole?: ProjectRole;
  activeSprint?: string | null;
  onSprintChange?: (sprintId: string | null) => void;
}

const CAN_CREATE_ROLES: ProjectRole[] = ["owner", "admin", "developer", "reporter"];
const CAN_EDIT_ROLES: ProjectRole[] = ["owner", "admin", "developer"];
const CAN_MANAGE_ROLES: ProjectRole[] = ["owner", "admin"];

export default function KanbanBoard({ projectId, myRole, activeSprint, onSprintChange }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: board, isLoading } = useBoard(projectId, activeSprint);
  const { updateIssueStatus, reorderIssues, addIssueToPlan, deleteIssue } = useIssueMutations(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { completeSprint } = useSprintMutations(projectId);
  const [createStatusId, setCreateStatusId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeIncompleteAction, setCompleteIncompleteAction] = useState<"backlog" | "next_sprint">("backlog");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Convert vertical mouse wheel to horizontal board scroll,
  // unless the cursor is over a column list that still has room to scroll vertically.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // native horizontal input (trackpad)
      if (e.deltaY === 0) return;
      const target = e.target as Element;
      const colList = target.closest("[data-col-scroll]") as HTMLElement | null;
      if (colList) {
        const atTop = colList.scrollTop <= 0;
        const atBottom = colList.scrollTop + colList.clientHeight >= colList.scrollHeight - 1;
        if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return;
      }
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useProjectEvents(projectId);

  const activeSprint_ = sprints.find(s => s.id === activeSprint && s.status === "active");
  const canManage = myRole ? CAN_MANAGE_ROLES.includes(myRole) : false;

  const filteredBoard = useMemo(() => {
    if (!board) return board;
    const hasFilter = filters.search || filters.types.length > 0 || filters.priorities.length > 0 || filters.labels.length > 0 || filters.assignedToMe;
    if (!hasFilter) return board;
    const columns = { ...board.columns };
    for (const sid of Object.keys(columns)) {
      columns[sid] = {
        ...columns[sid],
        issues: columns[sid].issues.filter(issue => {
          if (filters.assignedToMe && issue.assigneeId !== user?.id) return false;
          if (filters.search && !issue.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
          if (filters.types.length > 0 && !filters.types.includes(issue.issueType)) return false;
          if (filters.priorities.length > 0 && !filters.priorities.includes(issue.priority)) return false;
          if (filters.labels.length > 0 && !filters.labels.some(l => issue.labels?.includes(l))) return false;
          return true;
        }),
      };
    }
    return { ...board, columns };
  }, [board, filters, user?.id]);

  const canCreate = myRole ? CAN_CREATE_ROLES.includes(myRole) : false;
  const canEdit = myRole ? CAN_EDIT_ROLES.includes(myRole) : false;

  const handleCompleteSprint = async () => {
    if (!activeSprint) return;
    await completeSprint.mutateAsync({
      sprintId: activeSprint,
      data: { incompleteAction: completeIncompleteAction },
    });
    setShowCompleteDialog(false);
    onSprintChange?.(null);
  };

  if (isLoading) {
    return (
      <div className="text-sm text-text-tertiary py-12 text-center">
        {t("projects.loadingBoard" as any)}
      </div>
    );
  }

  if (!filteredBoard) return null;

  // Count non-done issues in the currently active sprint view
  const incompleteCnt = activeSprint_
    ? Object.values(board!.columns).reduce((acc, col) => {
        if (col.status.category !== "done") acc += col.issues.length;
        return acc;
      }, 0)
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Sprint selector */}
      {(sprints.length > 0 || onSprintChange) && (
        <div className="flex-shrink-0 flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[11px] text-text-tertiary flex-shrink-0">Sprint:</span>
          <div className="flex items-center gap-1 flex-wrap flex-1">
            <button
              onClick={() => onSprintChange?.(null)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                activeSprint === null || activeSprint === undefined
                  ? "bg-accent/15 text-accent border-accent/40"
                  : "text-text-tertiary border-border hover:border-accent/30 hover:text-text"
              }`}
            >
              {t("board.allSprints" as any)}
            </button>
            <button
              onClick={() => onSprintChange?.("backlog")}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                activeSprint === "backlog"
                  ? "bg-accent/15 text-accent border-accent/40"
                  : "text-text-tertiary border-border hover:border-accent/30 hover:text-text"
              }`}
            >
              Backlog
            </button>
            {sprints.map(s => (
              <button
                key={s.id}
                onClick={() => onSprintChange?.(s.id)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                  activeSprint === s.id
                    ? "bg-accent/15 text-accent border-accent/40"
                    : "text-text-tertiary border-border hover:border-accent/30 hover:text-text"
                }`}
              >
                {s.name}
                {s.status === "active" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Complete sprint button — only for active sprint, admin+ */}
          {canManage && activeSprint_ && (
            <button
              onClick={() => setShowCompleteDialog(true)}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors flex-shrink-0"
            >
              <Flag size={11} />
              {t("sprint.complete" as any)}
            </button>
          )}
        </div>
      )}

      <div className="flex-shrink-0">
        <BoardFilterBar projectId={projectId} filters={filters} onChange={setFilters} />
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto overflow-y-hidden flex-1 min-h-0 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
      >
          {filteredBoard.statuses.map(status => {
            const column = filteredBoard.columns[status.id];
            if (!column) return null;
            return (
              <BoardColumn
                key={status.id}
                column={column}
                projectId={projectId}
                currentUserId={user?.id ?? ""}
                canCreate={canCreate}
                canEdit={canEdit}
                onAddToPlan={(issueId, date) => addIssueToPlan.mutateAsync({ issueId, data: { date } })}
                addToPlanPending={addIssueToPlan.isPending}
                onArchive={(issueId) => deleteIssue.mutate(issueId)}
                archivePending={deleteIssue.isPending}
                onCreateIssue={(sid) => setCreateStatusId(sid)}
                onDropIssue={(issueId, targetStatusId, targetIndex) => {
                  updateIssueStatus.mutate({ issueId, statusId: targetStatusId });
                  const col = filteredBoard.columns[targetStatusId];
                  if (col) {
                    const others = col.issues.filter(i => i.id !== issueId);
                    const newOrder = [...others.slice(0, targetIndex), { id: issueId }, ...others.slice(targetIndex)];
                    reorderIssues.mutate(newOrder.map((is, idx) => ({ issueId: is.id, sortOrder: idx })));
                  }
                }}
                onReorder={(orders) => reorderIssues.mutate(orders)}
                allStatuses={filteredBoard.statuses}
                onStatusChange={(issueId, statusId) => updateIssueStatus.mutate({ issueId, statusId })}
              />
            );
          })}
      </div>

      {createStatusId && (
        <CreateIssueModal
          projectId={projectId}
          defaultStatusId={createStatusId}
          onClose={() => setCreateStatusId(null)}
        />
      )}

      {/* Complete sprint dialog */}
      {showCompleteDialog && activeSprint_ && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
          onClick={() => setShowCompleteDialog(false)}
        >
          <div
            className="card p-5 w-full max-w-sm shadow-xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="font-semibold text-text text-sm mb-1">
                {t("sprint.completeTitle" as any)} — {activeSprint_.name}
              </h3>
              <p className="text-xs text-text-secondary">
                {incompleteCnt > 0
                  ? `${incompleteCnt} ${t("sprint.incompleteIssues" as any)}`
                  : t("sprint.noIncomplete" as any)}
              </p>
            </div>

            {incompleteCnt > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
                  {t("sprint.incompleteAction" as any)}
                </p>
                <label className={cn(
                  "flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
                  completeIncompleteAction === "backlog" ? "border-accent/50 bg-accent/5" : "border-border hover:border-accent/30"
                )}>
                  <input
                    type="radio"
                    name="action"
                    value="backlog"
                    checked={completeIncompleteAction === "backlog"}
                    onChange={() => setCompleteIncompleteAction("backlog")}
                    className="accent-accent"
                  />
                  <div>
                    <p className="text-xs font-medium text-text">{t("sprint.moveToBacklog" as any)}</p>
                    <p className="text-[10px] text-text-tertiary">{t("sprint.moveToBacklogDesc" as any)}</p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowCompleteDialog(false)}
                className="btn-secondary flex-1 py-2 text-xs"
              >
                {t("issue.cancelEdit")}
              </button>
              <button
                onClick={handleCompleteSprint}
                disabled={completeSprint.isPending}
                className="flex-1 py-2 text-xs disabled:opacity-50 rounded-lg font-medium bg-green-500 hover:bg-green-600 text-white border border-green-500 transition-colors"
              >
                {completeSprint.isPending ? "..." : t("sprint.complete" as any)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
