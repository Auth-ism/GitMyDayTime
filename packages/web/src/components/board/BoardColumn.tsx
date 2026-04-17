import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, GripVertical } from "lucide-react";
import { Reorder, useDragControls, type DragControls } from "framer-motion";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import IssueCard from "./IssueCard";
import type { BoardColumn as BoardColumnType, WorkflowStatus, Issue } from "@gmd/shared";

interface Props {
  column: BoardColumnType;
  projectId: string;
  currentUserId: string;
  onCreateIssue?: (statusId: string) => void;
  canCreate?: boolean;
  canEdit?: boolean;
  onAddToPlan?: (issueId: string, date: string) => Promise<void>;
  addToPlanPending?: boolean;
  onArchive?: (issueId: string) => void;
  archivePending?: boolean;
  onDropIssue?: (issueId: string, targetStatusId: string, targetIndex: number) => void;
  onReorder?: (orders: Array<{ issueId: string; sortOrder: number }>) => void;
  allStatuses?: WorkflowStatus[];
  onStatusChange?: (issueId: string, statusId: string) => void;
}

function DraggableIssueRow({ issue, listRef, onDragEnd, children }: {
  issue: Issue;
  listRef: React.RefObject<HTMLDivElement | null>;
  onDragEnd: () => void;
  children: (controls: DragControls) => React.ReactNode;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      key={issue.id}
      value={issue}
      as="div"
      layout="position"
      dragListener={false}
      dragControls={controls}
      dragConstraints={listRef}
      dragElastic={0.1}
      onDragEnd={onDragEnd}
    >
      {children(controls)}
    </Reorder.Item>
  );
}

export default function BoardColumn({ column, projectId, currentUserId, onCreateIssue, canCreate, canEdit, onAddToPlan, addToPlanPending, onArchive, archivePending, onDropIssue, onReorder, allStatuses, onStatusChange }: Props) {
  const { t } = useI18n();
  const { status, issues } = column;
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Touch drag reorder state (Framer Motion)
  const listRef = useRef<HTMLDivElement>(null);
  const [dragOrder, setDragOrder] = useState<Issue[] | null>(null);
  const dragOrderRef = useRef<Issue[] | null>(null);
  const issueIds = issues.map(i => i.id).join();
  useEffect(() => { setDragOrder(null); dragOrderRef.current = null; }, [issueIds]);
  const displayIssues = dragOrder ?? issues;

  const handleTouchReorder = useCallback((newOrder: Issue[]) => {
    dragOrderRef.current = newOrder;
    setDragOrder(newOrder);
  }, []);

  const handleTouchDragEnd = useCallback(() => {
    const order = dragOrderRef.current;
    if (order) {
      onReorder?.(order.map((issue, idx) => ({ issueId: issue.id, sortOrder: idx })));
    }
    setDragOrder(null);
    dragOrderRef.current = null;
  }, [onReorder]);

  const categoryDot: Record<string, string> = {
    todo:        "bg-border",
    in_progress: "bg-blue-400",
    done:        "bg-green-400",
  };

  const handleColumnDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const effectiveIndex = dragOverIndex !== null && targetIndex === issues.length ? dragOverIndex : targetIndex;
    setIsDragOver(false);
    setDragOverIndex(null);
    const issueId = e.dataTransfer.getData("issueId");
    const sourceStatusId = e.dataTransfer.getData("sourceStatusId");
    if (!issueId) return;

    if (sourceStatusId === status.id) {
      // Intra-column reorder
      const oldIndex = issues.findIndex(i => i.id === issueId);
      if (oldIndex === -1 || oldIndex === effectiveIndex) return;
      const newOrder = [...issues];
      const [moved] = newOrder.splice(oldIndex, 1);
      const insertAt = effectiveIndex > oldIndex ? effectiveIndex - 1 : effectiveIndex;
      newOrder.splice(insertAt, 0, moved);
      onReorder?.(newOrder.map((is, idx) => ({ issueId: is.id, sortOrder: idx })));
    } else {
      // Cross-column drop
      onDropIssue?.(issueId, status.id, effectiveIndex);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col min-w-[82vw] sm:min-w-[260px] max-w-[92vw] sm:max-w-[300px] w-full rounded-xl transition-colors snap-start h-full overflow-hidden",
        isDragOver && "bg-accent/5 ring-1 ring-accent/30"
      )}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsDragOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
          setDragOverIndex(null);
        }
      }}
      onDrop={(e) => handleColumnDrop(e, issues.length)}
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: status.color }}
        />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide truncate flex-1">
          {status.name}
        </span>
        <span className="text-[10px] text-text-tertiary bg-accent-soft px-1.5 py-0.5 rounded-full">
          {issues.length}
        </span>
        {canCreate && (
          <button
            onClick={() => onCreateIssue?.(status.id)}
            className="p-1 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors flex-shrink-0"
            aria-label={t("projects.addIssue" as any)}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <Reorder.Group
        ref={listRef}
        axis="y"
        values={displayIssues}
        onReorder={handleTouchReorder}
        className="flex flex-col flex-1 min-h-0 overflow-y-auto pr-0.5"
        as="div"
      >
        {issues.length === 0 && (
          <div className={cn(
            "border border-dashed rounded-lg p-4 text-center text-[11px] text-text-tertiary transition-colors",
            isDragOver ? "border-accent/50 bg-accent/5" : "border-border"
          )}>
            {isDragOver ? "Buraya bırak" : t("projects.noIssues" as any)}
          </div>
        )}

        {displayIssues.map((issue, idx) => (
          <DraggableIssueRow
            key={issue.id}
            issue={issue}
            listRef={listRef}
            onDragEnd={handleTouchDragEnd}
          >
            {(controls) => (
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
              >
                {/* Drop zone before each card — highlighted when this card is hovered */}
                <div
                  className={cn(
                    "rounded transition-all",
                    dragOverIndex === idx ? "bg-accent/40 h-1.5 my-1" : "h-px my-0.5 bg-transparent"
                  )}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex(idx); }}
                  onDrop={(e) => handleColumnDrop(e, idx)}
                />
                <IssueCard
                  issue={issue}
                  projectId={projectId}
                  currentUserId={currentUserId}
                  canEdit={canEdit}
                  onAddToPlan={onAddToPlan}
                  addToPlanPending={addToPlanPending}
                  onArchive={onArchive}
                  archivePending={archivePending}
                  onDragStart={() => setDragOverIndex(null)}
                  allStatuses={allStatuses}
                  onStatusChange={onStatusChange}
                  dragHandle={
                    <button
                      onPointerDown={(e) => { e.preventDefault(); controls.start(e); }}
                      style={{ touchAction: "none" }}
                      tabIndex={-1}
                      aria-label="Sürükle"
                      className="p-1 rounded-lg flex-shrink-0 cursor-grab active:cursor-grabbing text-text-tertiary/40 hover:text-text-tertiary transition-colors"
                    >
                      <GripVertical size={12} />
                    </button>
                  }
                />
              </div>
            )}
          </DraggableIssueRow>
        ))}

        {/* Drop zone at end */}
        <div
          className={cn(
            "h-1 rounded transition-all mt-0.5",
            dragOverIndex === issues.length ? "bg-accent/50 h-2 my-0.5" : ""
          )}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex(issues.length); }}
          onDragLeave={() => setDragOverIndex(null)}
          onDrop={(e) => handleColumnDrop(e, issues.length)}
        />
      </Reorder.Group>

    </div>
  );
}
