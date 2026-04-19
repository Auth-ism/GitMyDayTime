import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Layers, Search, X, Plus, Zap, BookOpen, CheckSquare, Bug, Minus } from "lucide-react";
import { showSuccessToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";
import { useProject, useIssues, useSprints, useSprintMutations } from "@/hooks/useProjects";
import CreateIssueModal from "@/components/board/CreateIssueModal";
import { cn } from "@/lib/cn";
import type { Issue, ProjectRole } from "@gmd/shared";

const PRIORITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-400",
  medium:   "bg-yellow-400",
  low:      "bg-blue-400",
  none:     "bg-border",
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

const CAN_EDIT: ProjectRole[] = ["owner", "admin", "developer", "reporter"];

function IssueRow({
  issue,
  projectId,
  onMoveToSprint,
  onRemoveFromSprint,
  sprints,
  targetSprintId,
  setTargetSprintId,
  canEdit,
}: {
  issue: Issue;
  projectId: string;
  onMoveToSprint: (issueId: string, sprintId: string) => void;
  onRemoveFromSprint: (issueId: string) => void;
  sprints: Array<{ id: string; name: string; status: string }>;
  targetSprintId: string;
  setTargetSprintId: (id: string) => void;
  canEdit: boolean;
}) {
  const TypeIcon = TYPE_ICONS[issue.issueType] ?? CheckSquare;

  return (
    <div className="flex items-center gap-2 py-2 px-3 hover:bg-accent/5 rounded-lg group transition-colors">
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", PRIORITY_DOT[issue.priority])} />
      <TypeIcon size={12} className={cn("flex-shrink-0", TYPE_COLORS[issue.issueType])} />
      <button
        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}/issues/${issue.id}`); showSuccessToast(`${issue.issueKey} kopyalandı`); }}
        className="font-mono text-[10px] text-text-tertiary flex-shrink-0 w-16 text-left hover:text-accent transition-colors"
        title="Linki kopyala"
      >{issue.issueKey}</button>
      <Link
        to={`/projects/${projectId}/issues/${issue.id}`}
        className="flex-1 text-xs text-text truncate hover:text-accent transition-colors min-w-0"
      >
        {issue.title}
      </Link>
      {issue.storyPoints != null && (
        <span className="text-[10px] font-mono bg-accent-soft text-accent px-1.5 py-0.5 rounded flex-shrink-0">
          {issue.storyPoints}SP
        </span>
      )}
      {canEdit && (
        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
          {issue.sprintId ? (
            <button
              onClick={() => onRemoveFromSprint(issue.id)}
              className="text-[10px] text-text-tertiary hover:text-danger px-2 py-0.5 rounded border border-border hover:border-danger/30 transition-colors"
            >
              Backlog'a taşı
            </button>
          ) : (
            sprints.filter(s => s.status !== "completed").length > 0 && (
              <div className="flex items-center gap-1">
                <select
                  className="input text-[10px] py-0.5 px-1.5"
                  value={targetSprintId}
                  onChange={e => setTargetSprintId(e.target.value)}
                  onClick={e => e.stopPropagation()}
                >
                  {sprints.filter(s => s.status !== "completed").map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => onMoveToSprint(issue.id, targetSprintId)}
                  className="text-[10px] text-accent hover:text-accent/80 px-2 py-0.5 rounded border border-accent/30 hover:border-accent/50 transition-colors whitespace-nowrap"
                >
                  Sprint'e ekle
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function BacklogPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useI18n();
  const { data: project, isLoading } = useProject(projectId);
  const { data: sprintsData = [] } = useSprints(projectId);
  const { setIssueSprint } = useSprintMutations(projectId!);

  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [targetSprintId, setTargetSprintId] = useState(() =>
    sprintsData.find(s => s.status === "active")?.id ?? sprintsData[0]?.id ?? ""
  );

  // Fetch all non-archived issues
  const { data: allIssuesData } = useIssues(projectId, { archived: "false" });
  const allIssues: Issue[] = (allIssuesData as any)?.issues ?? [];

  const activeSprint = sprintsData.find(s => s.status === "active");
  const canEdit = project?.myRole ? CAN_EDIT.includes(project.myRole) : false;

  const backlogIssues = useMemo(() =>
    allIssues.filter(i => !i.sprintId && !i.archived && (
      !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.issueKey.toLowerCase().includes(search.toLowerCase())
    )),
    [allIssues, search]
  );

  const sprintIssues = useMemo(() =>
    allIssues.filter(i => i.sprintId === activeSprint?.id && !i.archived && (
      !search || i.title.toLowerCase().includes(search.toLowerCase()) || i.issueKey.toLowerCase().includes(search.toLowerCase())
    )),
    [allIssues, activeSprint?.id, search]
  );

  const handleMoveToSprint = (issueId: string, sprintId: string) => {
    setIssueSprint.mutate({ issueId, sprintId });
  };

  const handleRemoveFromSprint = (issueId: string) => {
    setIssueSprint.mutate({ issueId, sprintId: null });
  };

  if (isLoading) return <div className="text-sm text-text-tertiary py-12 text-center">Yükleniyor...</div>;
  if (!project) return <div className="text-sm text-danger py-12 text-center">Proje bulunamadı</div>;

  const sprintPoints = sprintIssues.reduce((acc, i) => acc + (i.storyPoints ?? 0), 0);
  const backlogPoints = backlogIssues.reduce((acc, i) => acc + (i.storyPoints ?? 0), 0);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Link to={`/projects/${projectId}/board`} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text transition-colors w-fit">
            <ArrowLeft size={13} />
            Board
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Layers size={13} className="text-accent" />
            </div>
            <h1 className="font-semibold text-text text-base truncate flex-1 min-w-0">{project.name}</h1>
            <span className="text-[10px] font-mono text-text-tertiary bg-accent-soft px-1.5 py-0.5 rounded flex-shrink-0">
              {project.projectKey}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            <input
              className="input pl-7 text-xs py-1.5 w-full"
              placeholder={t("board.searchPlaceholder" as any)}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text">
                <X size={11} />
              </button>
            )}
          </div>
          {canEdit && (
            <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1 px-3 py-1.5 text-xs flex-shrink-0">
              <Plus size={13} />
              {t("projects.addIssue" as any)}
            </button>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Backlog column */}
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-secondary">
              Backlog
              <span className="ml-1.5 text-[10px] font-normal text-text-tertiary bg-accent-soft px-1.5 py-0.5 rounded-full">
                {backlogIssues.length}
              </span>
              {backlogPoints > 0 && (
                <span className="ml-1 text-[10px] text-text-tertiary">· {backlogPoints}SP</span>
              )}
            </span>
          </div>

          {backlogIssues.length === 0 ? (
            <p className="text-xs text-text-tertiary italic py-4 text-center">{t("projects.noIssues" as any)}</p>
          ) : (
            <div className="divide-y divide-border/50">
              {backlogIssues.map(issue => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  projectId={projectId!}
                  onMoveToSprint={handleMoveToSprint}
                  onRemoveFromSprint={handleRemoveFromSprint}
                  sprints={sprintsData}
                  targetSprintId={targetSprintId || sprintsData.filter(s => s.status !== "completed")[0]?.id || ""}
                  setTargetSprintId={setTargetSprintId}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </div>

        {/* Active sprint column */}
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-text-secondary">
              {activeSprint ? (
                <>
                  {activeSprint.name}
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-400 inline-block align-middle" />
                </>
              ) : (
                t("sprint.noActive" as any)
              )}
              {activeSprint && (
                <span className="ml-1.5 text-[10px] font-normal text-text-tertiary bg-accent-soft px-1.5 py-0.5 rounded-full">
                  {sprintIssues.length}
                </span>
              )}
              {sprintPoints > 0 && (
                <span className="ml-1 text-[10px] text-text-tertiary">· {sprintPoints}SP</span>
              )}
            </span>
          </div>

          {!activeSprint ? (
            <p className="text-xs text-text-tertiary italic py-4 text-center">{t("sprint.noActive" as any)}</p>
          ) : sprintIssues.length === 0 ? (
            <p className="text-xs text-text-tertiary italic py-4 text-center">{t("projects.noIssues" as any)}</p>
          ) : (
            <div className="divide-y divide-border/50">
              {sprintIssues.map(issue => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  projectId={projectId!}
                  onMoveToSprint={handleMoveToSprint}
                  onRemoveFromSprint={handleRemoveFromSprint}
                  sprints={sprintsData}
                  targetSprintId={targetSprintId || ""}
                  setTargetSprintId={setTargetSprintId}
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && projectId && (
        <CreateIssueModal
          projectId={projectId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
