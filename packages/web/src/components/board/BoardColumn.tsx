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
  onDropIssue?: (issueId: string, targetStatusId: string) => void;
}

export default function BoardColumn({ column, projectId, currentUserId, onCreateIssue, canCreate, onDropIssue }: Props) {
  const { t } = useI18n();
  const { status, issues } = column;
  const [isDragOver, setIsDragOver] = useState(false);

  const categoryDot: Record<string, string> = {
    todo:        "bg-border",
    in_progress: "bg-blue-400",
    done:        "bg-green-400",
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
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const issueId = e.dataTransfer.getData("issueId");
        const sourceStatusId = e.dataTransfer.getData("sourceStatusId");
        if (issueId && sourceStatusId !== status.id) {
          onDropIssue?.(issueId, status.id);
        }
      }}
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

      <div className="flex flex-col gap-2 flex-1 min-h-[60px]">
        {issues.length === 0 && (
          <div className={cn(
            "border border-dashed rounded-lg p-4 text-center text-[11px] text-text-tertiary transition-colors",
            isDragOver ? "border-accent/50 bg-accent/5" : "border-border"
          )}>
            {isDragOver ? "Buraya bırak" : t("projects.noIssues" as any)}
          </div>
        )}
        {issues.map(issue => (
          <IssueCard
            key={issue.id}
            issue={issue}
            projectId={projectId}
            currentUserId={currentUserId}
          />
        ))}
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
