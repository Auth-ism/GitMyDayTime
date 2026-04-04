import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import IssueCard from "./IssueCard";
import type { BoardColumn as BoardColumnType } from "@gmd/shared";

interface Props {
  column: BoardColumnType;
  projectId: string;
  currentUserId: string;
  onCreateIssue?: (statusId: string) => void;
  canCreate?: boolean;
  onDropIssue?: (issueId: string, targetStatusId: string, targetIndex: number) => void;
  onReorder?: (orders: Array<{ issueId: string; sortOrder: number }>) => void;
}

export default function BoardColumn({ column, projectId, currentUserId, onCreateIssue, canCreate, onDropIssue, onReorder }: Props) {
  const { t } = useI18n();
  const { status, issues } = column;
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const categoryDot: Record<string, string> = {
    todo:        "bg-border",
    in_progress: "bg-blue-400",
    done:        "bg-green-400",
  };

  const handleColumnDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragOverIndex(null);
    const issueId = e.dataTransfer.getData("issueId");
    const sourceStatusId = e.dataTransfer.getData("sourceStatusId");
    if (!issueId) return;

    if (sourceStatusId === status.id) {
      // Intra-column reorder
      const oldIndex = issues.findIndex(i => i.id === issueId);
      if (oldIndex === -1 || oldIndex === targetIndex) return;
      const newOrder = [...issues];
      const [moved] = newOrder.splice(oldIndex, 1);
      const insertAt = targetIndex > oldIndex ? targetIndex - 1 : targetIndex;
      newOrder.splice(insertAt, 0, moved);
      onReorder?.(newOrder.map((is, idx) => ({ issueId: is.id, sortOrder: idx })));
    } else {
      // Cross-column drop
      onDropIssue?.(issueId, status.id, targetIndex);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col min-w-[82vw] sm:min-w-[260px] max-w-[92vw] sm:max-w-[300px] w-full rounded-xl transition-colors snap-start",
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
      <div className="flex items-center gap-2 mb-3 px-1">
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
      </div>

      <div className="flex flex-col flex-1 min-h-[60px]">
        {issues.length === 0 && (
          <div className={cn(
            "border border-dashed rounded-lg p-4 text-center text-[11px] text-text-tertiary transition-colors",
            isDragOver ? "border-accent/50 bg-accent/5" : "border-border"
          )}>
            {isDragOver ? "Buraya bırak" : t("projects.noIssues" as any)}
          </div>
        )}

        {issues.map((issue, idx) => (
          <div key={issue.id}>
            {/* Drop zone before each card */}
            <div
              className={cn(
                "h-1 rounded transition-all",
                dragOverIndex === idx ? "bg-accent/50 h-2 my-0.5" : "my-0.5"
              )}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex(idx); }}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleColumnDrop(e, idx)}
            />
            <IssueCard
              issue={issue}
              projectId={projectId}
              currentUserId={currentUserId}
              onDragStart={() => setDragOverIndex(null)}
            />
          </div>
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
      </div>

      {canCreate && (
        <button
          onClick={() => onCreateIssue?.(status.id)}
          className="mt-2 flex items-center gap-1 py-2 px-3 rounded-lg text-xs text-text-tertiary hover:text-accent hover:bg-accent/5 transition-colors w-full"
        >
          <Plus size={13} />
          {t("projects.addIssue" as any)}
        </button>
      )}
    </div>
  );
}
