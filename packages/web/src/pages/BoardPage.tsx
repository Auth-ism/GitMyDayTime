import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Layers, Settings, Users, Plus, Archive, RotateCcw, Trash2, BarChart2, List } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useProject, useArchivedIssues, useIssueMutations } from "@/hooks/useProjects";
import KanbanBoard from "@/components/board/KanbanBoard";
import CreateIssueModal from "@/components/board/CreateIssueModal";
import { useState } from "react";
import { cn } from "@/lib/cn";

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useI18n();
  const { data: project, isLoading } = useProject(projectId);
  const [showCreate, setShowCreate] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [activeSprint, setActiveSprint] = useState<string | null | undefined>(undefined);
  const { data: archivedData } = useArchivedIssues(projectId, showArchive);
  const { restoreIssue, permanentDeleteIssue } = useIssueMutations(projectId!);

  if (isLoading) {
    return (
      <div className="text-sm text-text-tertiary py-12 text-center">
        {t("projects.loadingBoard" as any)}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-sm text-danger py-12 text-center">
        Proje bulunamadı
      </div>
    );
  }

  const canManage = project.myRole === "owner" || project.myRole === "admin";
  const canCreate = project.myRole !== "viewer";

  return (
    <div className="space-y-4 max-w-none">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          to="/projects"
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text transition-colors"
        >
          <ArrowLeft size={13} />
          {t("projects.title" as any)}
        </Link>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Layers size={13} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-text text-base truncate">{project.name}</h1>
          </div>
          <span className="text-[10px] font-mono text-text-tertiary bg-accent-soft px-1.5 py-0.5 rounded">
            {project.projectKey}
          </span>
        </div>

        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          <Link
            to={`/projects/${projectId}/backlog`}
            className="btn-icon p-2 rounded-lg text-text-tertiary hover:text-text"
            title="Backlog"
          >
            <List size={15} />
          </Link>
          <Link
            to={`/projects/${projectId}/insights`}
            className="btn-icon p-2 rounded-lg text-text-tertiary hover:text-text"
            title="Raporlar"
          >
            <BarChart2 size={15} />
          </Link>
          <Link
            to={`/projects/${projectId}/members`}
            className="btn-icon p-2 rounded-lg flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text"
          >
            <Users size={15} />
            <span className="hidden sm:inline text-xs">{project.members?.length ?? 0}</span>
          </Link>
          {canManage && (
            <button
              onClick={() => setShowArchive(v => !v)}
              className={cn("btn-icon p-2 rounded-lg text-text-tertiary hover:text-text", showArchive && "text-accent")}
              title={t("issue.archivedIssues")}
            >
              <Archive size={15} />
            </button>
          )}
          {canManage && (
            <Link
              to={`/projects/${projectId}/settings`}
              className="btn-icon p-2 rounded-lg text-text-tertiary hover:text-text"
              title="Proje Ayarları"
            >
              <Settings size={15} />
            </Link>
          )}
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="btn-primary flex items-center gap-1 px-3 py-2 text-xs ml-1"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">{t("projects.addIssue" as any)}</span>
              <span className="sm:hidden">Ekle</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban board — full width, horizontal scroll */}
      <KanbanBoard
        projectId={projectId!}
        myRole={project.myRole}
        activeSprint={activeSprint}
        onSprintChange={setActiveSprint}
      />

      {/* Archived issues panel */}
      {showArchive && (
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">{t("issue.archivedIssues")} ({archivedData?.total ?? 0})</p>
          {!archivedData?.issues.length ? (
            <p className="text-xs text-text-tertiary italic py-2">{t("issue.noArchived")}</p>
          ) : (
            <div className="divide-y divide-border">
              {archivedData.issues.map(issue => (
                <div key={issue.id} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-[10px] text-text-tertiary flex-shrink-0">{issue.issueKey}</span>
                  <span className="text-xs text-text-secondary flex-1 truncate">{issue.title}</span>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => restoreIssue.mutateAsync(issue.id)}
                        disabled={restoreIssue.isPending}
                        className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-accent transition-colors disabled:opacity-50"
                      >
                        <RotateCcw size={11} />
                        {t("issue.restore")}
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(t("issue.permanentDeleteConfirm" as any))) {
                            permanentDeleteIssue.mutate(issue.id);
                          }
                        }}
                        disabled={permanentDeleteIssue.isPending}
                        className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-danger transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={11} />
                        {t("issue.permanentDelete" as any)}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreate && projectId && (
        <CreateIssueModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
