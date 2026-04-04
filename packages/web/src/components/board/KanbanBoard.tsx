import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useBoard, useProjectEvents, useIssueMutations } from "@/hooks/useProjects";
import { useAuth } from "@/lib/auth";
import BoardColumn from "./BoardColumn";
import CreateIssueModal from "./CreateIssueModal";
import BoardFilterBar, { EMPTY_FILTERS, type BoardFilters } from "./BoardFilterBar";
import type { ProjectRole } from "@gmd/shared";

interface Props {
  projectId: string;
  myRole?: ProjectRole;
}

const CAN_CREATE_ROLES: ProjectRole[] = ["owner", "admin", "developer", "reporter"];

export default function KanbanBoard({ projectId, myRole }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: board, isLoading } = useBoard(projectId);
  const { updateIssueStatus } = useIssueMutations(projectId);
  const [createStatusId, setCreateStatusId] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilters>(EMPTY_FILTERS);

  useProjectEvents(projectId);

  const filteredBoard = useMemo(() => {
    if (!board) return board;
    const hasFilter = filters.search || filters.types.length > 0 || filters.priorities.length > 0 || filters.labels.length > 0;
    if (!hasFilter) return board;
    const columns = { ...board.columns };
    for (const sid of Object.keys(columns)) {
      columns[sid] = {
        ...columns[sid],
        issues: columns[sid].issues.filter(issue => {
          if (filters.search && !issue.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
          if (filters.types.length > 0 && !filters.types.includes(issue.issueType)) return false;
          if (filters.priorities.length > 0 && !filters.priorities.includes(issue.priority)) return false;
          if (filters.labels.length > 0 && !filters.labels.some(l => issue.labels?.includes(l))) return false;
          return true;
        }),
      };
    }
    return { ...board, columns };
  }, [board, filters]);

  const canCreate = myRole ? CAN_CREATE_ROLES.includes(myRole) : false;

  if (isLoading) {
    return (
      <div className="text-sm text-text-tertiary py-12 text-center">
        {t("projects.loadingBoard" as any)}
      </div>
    );
  }

  if (!filteredBoard) return null;

  return (
    <>
      <BoardFilterBar projectId={projectId} filters={filters} onChange={setFilters} />
      <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 min-w-max snap-x snap-mandatory sm:snap-none">
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
                onCreateIssue={(sid) => setCreateStatusId(sid)}
                onDropIssue={(issueId, targetStatusId) =>
                  updateIssueStatus.mutate({ issueId, statusId: targetStatusId })
                }
              />
            );
          })}
        </div>
      </div>

      {createStatusId && (
        <CreateIssueModal
          projectId={projectId}
          defaultStatusId={createStatusId}
          onClose={() => setCreateStatusId(null)}
        />
      )}
    </>
  );
}
