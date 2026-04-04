import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bug, Zap, BookOpen, CheckSquare, Minus,
  CalendarDays, Trash2, Edit2, Check, X, ChevronDown, Link2, Plus, Tag,
} from "lucide-react";
import type { IssueLinkType } from "@gmd/shared";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useIssue, useIssueMutations, useCommentMutations, useProject, useIssueLinkMutations, useIssues, useProjectLabels, useSprints, useSprintMutations } from "@/hooks/useProjects";
import DatePicker from "@/components/DatePicker";
import MentionTextarea, { CommentText } from "@/components/MentionTextarea";
import { cn } from "@/lib/cn";

const PRIORITY_BG: Record<string, string> = {
  critical: "bg-red-500/10 text-red-500",
  high:     "bg-orange-400/10 text-orange-400",
  medium:   "bg-yellow-400/10 text-yellow-400",
  low:      "bg-blue-400/10 text-blue-400",
  none:     "bg-bg-subtle text-text-tertiary",
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

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "şimdi";
  if (mins < 60) return `${mins}d önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s önce`;
  const days = Math.floor(hours / 24);
  return `${days}g önce`;
}

function Avatar({ url, username }: { url?: string | null; username?: string | null }) {
  if (url) return <img src={url} alt={username ?? ""} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />;
  if (username) return (
    <div className="w-6 h-6 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
      <span className="text-[9px] font-semibold text-text-secondary">
        {username.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
  return null;
}

const LINK_LABELS: Record<string, string> = {
  relates_to:       "İlgili",
  blocks:           "Bloklayan",
  is_blocked_by:    "Bloklayan",
  duplicates:       "Kopyası",
  is_duplicated_by: "Kopyalayan",
};

const LINK_TYPE_OPTIONS: { value: IssueLinkType; label: string }[] = [
  { value: "relates_to",       label: "İlgili" },
  { value: "blocks",           label: "Bloklayan" },
  { value: "is_blocked_by",    label: "Tarafından Bloklanan" },
  { value: "duplicates",       label: "Kopyalayan" },
  { value: "is_duplicated_by", label: "Kopyası" },
];

function ChildIssuesSection({
  projectId, issue, canEdit, statuses,
}: {
  projectId: string;
  issue: import("@gmd/shared").IssueDetail;
  canEdit: boolean;
  statuses: import("@gmd/shared").WorkflowStatus[];
}) {
  const { createIssue } = useIssueMutations(projectId);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const children = issue.children ?? [];

  const handleAdd = async () => {
    const t = newTitle.trim();
    if (!t) return;
    await createIssue.mutateAsync({
      title: t,
      issueType: "sub_task",
      priority: "medium",
      parentId: issue.id,
    } as any);
    setNewTitle("");
    setAdding(false);
  };

  if (children.length === 0 && !canEdit) return null;

  const defaultStatus = statuses.find(s => s.isDefault) ?? statuses[0];

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
          <Minus size={12} className="text-text-tertiary" />
          Alt Görevler {children.length > 0 && <span className="text-text-tertiary">({children.length})</span>}
        </span>
        {canEdit && !adding && (
          <button onClick={() => setAdding(true)} className="btn-icon p-1 rounded text-text-tertiary hover:text-text">
            <Plus size={13} />
          </button>
        )}
      </div>

      {children.length > 0 && (
        <div className="space-y-0.5">
          {children.map(child => {
            const ChildIcon = TYPE_ICONS[child.issueType] ?? CheckSquare;
            const status = statuses.find(s => s.id === child.statusId);
            const isDone = status?.category === "done";
            return (
              <Link
                key={child.id}
                to={`/projects/${projectId}/issues/${child.id}`}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-bg-subtle transition-colors group"
              >
                <ChildIcon size={11} className={cn("flex-shrink-0", TYPE_COLORS[child.issueType])} />
                <span className="font-mono text-[10px] text-text-tertiary flex-shrink-0">{child.issueKey}</span>
                <span className={cn("text-xs flex-1 truncate", isDone && "line-through text-text-tertiary")}>
                  {child.title}
                </span>
                {status && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `${status.color}20`, color: status.color }}>
                    {status.name}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            className="input flex-1 text-sm py-1.5"
            placeholder="Alt görev başlığı..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
            }}
          />
          <button onClick={handleAdd} disabled={!newTitle.trim() || createIssue.isPending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
            {createIssue.isPending ? "..." : "Ekle"}
          </button>
          <button onClick={() => { setAdding(false); setNewTitle(""); }} className="btn-secondary px-2 py-1.5 text-xs">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

function IssueLinkSection({
  projectId, issueId, links, canEdit,
}: {
  projectId: string;
  issueId: string;
  links: NonNullable<import("@gmd/shared").IssueDetail["links"]>;
  canEdit: boolean;
}) {
  const { createLink, deleteLink } = useIssueLinkMutations(projectId, issueId);
  const [showPicker, setShowPicker] = useState(false);
  const [linkType, setLinkType] = useState<IssueLinkType>("relates_to");
  const [search, setSearch] = useState("");
  const { data: allIssues } = useIssues(showPicker ? projectId : undefined, { limit: 200 });

  const linkedIds = new Set(links.map(l => l.targetId));
  const pickerIssues = (allIssues?.issues ?? []).filter(i =>
    i.id !== issueId &&
    !linkedIds.has(i.id) &&
    (!search || i.title.toLowerCase().includes(search.toLowerCase()) || i.issueKey.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = async (targetId: string) => {
    await createLink.mutateAsync({ targetId, linkType });
    setShowPicker(false);
    setSearch("");
  };

  return (
    <div className="card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
          <Link2 size={12} />
          Bağlantılar {links.length > 0 && `(${links.length})`}
        </span>
        {canEdit && (
          <button onClick={() => setShowPicker(true)} className="text-[10px] text-text-tertiary hover:text-accent transition-colors flex items-center gap-1">
            <Plus size={10} />
            Ekle
          </button>
        )}
      </div>

      {links.length === 0 && (
        <p className="text-xs text-text-tertiary italic">Bağlantı yok</p>
      )}

      {links.map(link => (
        <div key={link.id} className="flex items-center gap-2 group">
          <span className="text-[10px] text-text-tertiary w-20 flex-shrink-0">{LINK_LABELS[link.linkType]}</span>
          <Link
            to={`/projects/${projectId}/issues/${link.targetId}`}
            className="flex items-center gap-1.5 flex-1 min-w-0 hover:text-accent transition-colors"
          >
            <span className="font-mono text-[10px] text-text-tertiary flex-shrink-0">{link.targetIssueKey}</span>
            <span className="text-xs text-text truncate">{link.targetTitle}</span>
            {link.targetStatusName && (
              <span className="flex items-center gap-1 text-[10px] text-text-tertiary flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: link.targetStatusColor }} />
                {link.targetStatusName}
              </span>
            )}
          </Link>
          {canEdit && (
            <button
              onClick={() => deleteLink.mutateAsync(link.id)}
              className="hidden group-hover:flex text-text-tertiary hover:text-danger transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}

      {/* Issue Picker Modal */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm"
          onClick={() => { setShowPicker(false); setSearch(""); }}
        >
          <div
            className="card w-full max-w-md shadow-xl flex flex-col"
            style={{ maxHeight: "70vh" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-text">Issue Bağla</span>
                <button onClick={() => { setShowPicker(false); setSearch(""); }} className="text-text-tertiary hover:text-text">
                  <X size={14} />
                </button>
              </div>
              <select
                className="input text-xs py-1.5 w-full mb-2"
                value={linkType}
                onChange={e => setLinkType(e.target.value as IssueLinkType)}
              >
                {LINK_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                autoFocus
                className="input w-full text-xs py-1.5"
                placeholder="Issue ara (başlık veya GMD-5)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Escape" && setShowPicker(false)}
              />
            </div>

            <div className="overflow-y-auto flex-1">
              {pickerIssues.length === 0 ? (
                <p className="text-xs text-text-tertiary text-center py-6 italic">Issue bulunamadı</p>
              ) : (
                pickerIssues.map(issue => (
                  <button
                    key={issue.id}
                    onClick={() => handleSelect(issue.id)}
                    disabled={createLink.isPending}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/5 transition-colors border-b border-border/50 last:border-0 disabled:opacity-50"
                  >
                    <span className="font-mono text-[10px] text-text-tertiary flex-shrink-0 w-16">{issue.issueKey}</span>
                    <span className="text-xs text-text truncate flex-1">{issue.title}</span>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: issue.statusColor ?? "#6b7280" }}
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IssuePage() {
  const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();

  const { data: project } = useProject(projectId);
  const { data: issue, isLoading } = useIssue(projectId, issueId);
  const { updateIssue, deleteIssue, addIssueToPlan, removeIssueFromPlan } = useIssueMutations(projectId!);
  const { addComment, updateComment, deleteComment } = useCommentMutations(projectId!, issueId!);
  const { data: sprints = [] } = useSprints(projectId);
  const { setIssueSprint } = useSprintMutations(projectId!);

  // Title edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");

  // Description edit
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  // Comment form
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");

  // Status dropdown
  const [statusOpen, setStatusOpen] = useState(false);

  // Priority dropdown
  const [priorityOpen, setPriorityOpen] = useState(false);

  // Assignee dropdown
  const [assigneeOpen, setAssigneeOpen] = useState(false);

  // Label input
  const [labelInput, setLabelInput] = useState("");
  const [labelSuggestOpen, setLabelSuggestOpen] = useState(false);
  const { data: projectLabels = [] } = useProjectLabels(projectId);

  // Plan date modal
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planDate, setPlanDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Active tab: comments | history
  const [activeTab, setActiveTab] = useState<"comments" | "history">("comments");

  if (isLoading) {
    return <div className="text-sm text-text-tertiary py-12 text-center">Yükleniyor...</div>;
  }
  if (!issue) {
    return <div className="text-sm text-danger py-12 text-center">Görev bulunamadı.</div>;
  }

  const myRole = project?.myRole;
  const canEdit = myRole && myRole !== "viewer" &&
    (["owner", "admin", "developer"].includes(myRole) || issue.reporterId === user?.id);
  const canDelete = myRole && (["owner", "admin"].includes(myRole) || issue.reporterId === user?.id);
  const canManageStatus = myRole && myRole !== "viewer";

  const TypeIcon = TYPE_ICONS[issue.issueType] ?? CheckSquare;
  const statuses = project?.statuses ?? [];

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || titleDraft === issue.title) { setEditingTitle(false); return; }
    await updateIssue.mutateAsync({ issueId: issue.id, data: { title: titleDraft } });
    setEditingTitle(false);
  };

  const handleSaveDesc = async () => {
    if (descDraft === (issue.description ?? "")) { setEditingDesc(false); return; }
    await updateIssue.mutateAsync({ issueId: issue.id, data: { description: descDraft || null } });
    setEditingDesc(false);
  };

  const handleStatusChange = async (statusId: string) => {
    setStatusOpen(false);
    await updateIssue.mutateAsync({ issueId: issue.id, data: { statusId } });
  };

  const handlePriorityChange = async (priority: string) => {
    setPriorityOpen(false);
    await updateIssue.mutateAsync({ issueId: issue.id, data: { priority: priority as any } });
  };

  const handleDelete = async () => {
    await deleteIssue.mutateAsync(issue.id);
    navigate(`/projects/${projectId}/board`);
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await addComment.mutateAsync({ content: commentText });
    setCommentText("");
  };

  const handleSaveComment = async (commentId: string) => {
    if (!editingCommentText.trim()) return;
    await updateComment.mutateAsync({ commentId, data: { content: editingCommentText } });
    setEditingCommentId(null);
  };

  const handleAddToPlan = async () => {
    await addIssueToPlan.mutateAsync({ issueId: issue.id, data: { date: planDate } });
    setShowPlanModal(false);
  };

  const currentStatus = statuses.find(s => s.id === issue.statusId);
  const priorities = ["critical", "high", "medium", "low", "none"] as const;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-text-tertiary flex-wrap">
        <Link to="/projects" className="hover:text-text transition-colors">{t("projects.title")}</Link>
        <span>/</span>
        <Link to={`/projects/${projectId}/board`} className="hover:text-text transition-colors flex items-center gap-1">
          <ArrowLeft size={11} />
          {project?.name ?? "..."}
        </Link>
        <span>/</span>
        <span className="font-mono text-text-secondary">{issue.issueKey}</span>
      </div>

      {/* Parent link */}
      {issue.parentId && (
        <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
          <span>Alt görev:</span>
          <Link
            to={`/projects/${projectId}/issues/${issue.parentId}`}
            className="flex items-center gap-1 text-accent hover:underline"
          >
            <span className="font-mono">{issue.parentIssueKey}</span>
            <span className="truncate max-w-[120px] sm:max-w-[200px]">{issue.parentTitle}</span>
          </Link>
        </div>
      )}

      {/* Title */}
      <div className="flex items-start gap-2">
        <TypeIcon size={16} className={cn("mt-1 flex-shrink-0", TYPE_COLORS[issue.issueType])} />
        {editingTitle ? (
          <div className="flex-1 flex gap-2 items-start">
            <input
              autoFocus
              className="input flex-1 text-base font-semibold"
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
            />
            <button onClick={handleSaveTitle} className="btn-icon p-1.5 rounded-lg text-green-400 hover:bg-green-400/10 mt-0.5">
              <Check size={14} />
            </button>
            <button onClick={() => setEditingTitle(false)} className="btn-icon p-1.5 rounded-lg text-text-tertiary hover:bg-bg-subtle mt-0.5">
              <X size={14} />
            </button>
          </div>
        ) : (
          <h1
            className={cn("flex-1 text-base font-semibold text-text leading-snug", canEdit && "cursor-pointer hover:text-accent")}
            onClick={() => { if (canEdit) { setTitleDraft(issue.title); setEditingTitle(true); } }}
          >
            {issue.title}
            {canEdit && <Edit2 size={11} className="inline ml-1.5 text-text-tertiary opacity-0 group-hover:opacity-100" />}
          </h1>
        )}
      </div>

      {/* Main layout */}
      <div className="flex flex-col md:flex-row gap-5">

        {/* ── Left: Description + Comments + History ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Description */}
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">{t("issue.description")}</span>
              {canEdit && !editingDesc && (
                <button
                  onClick={() => { setDescDraft(issue.description ?? ""); setEditingDesc(true); }}
                  className="btn-icon p-1 rounded text-text-tertiary hover:text-text"
                >
                  <Edit2 size={12} />
                </button>
              )}
            </div>
            {editingDesc ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  className="input w-full text-sm resize-y min-h-[80px]"
                  placeholder={t("issue.descriptionPlaceholder")}
                  value={descDraft}
                  onChange={e => setDescDraft(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveDesc} disabled={updateIssue.isPending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
                    {t("issue.saveComment")}
                  </button>
                  <button onClick={() => setEditingDesc(false)} className="btn-secondary px-3 py-1.5 text-xs">
                    {t("issue.cancelEdit")}
                  </button>
                </div>
              </div>
            ) : (
              <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", issue.description ? "text-text" : "text-text-tertiary italic")}>
                {issue.description ?? t("issue.noDescription")}
              </p>
            )}
          </div>

          {/* Links */}
          <IssueLinkSection
            projectId={projectId!}
            issueId={issueId!}
            links={issue.links ?? []}
            canEdit={!!canEdit}
          />

          {/* Sub-tasks (children) */}
          {issue.issueType !== "sub_task" && (
            <ChildIssuesSection
              projectId={projectId!}
              issue={issue}
              canEdit={!!canEdit}
              statuses={statuses}
            />
          )}

          {/* Tabs: Comments | Activity */}
          <div className="card p-4 space-y-3">
            <div className="flex gap-4 border-b border-border pb-2">
              <button
                onClick={() => setActiveTab("comments")}
                className={cn("text-xs font-medium pb-2 -mb-2 border-b-2 transition-colors", activeTab === "comments" ? "border-accent text-accent" : "border-transparent text-text-tertiary hover:text-text")}
              >
                {t("issue.comments")} {issue.comments?.length ? `(${issue.comments.length})` : ""}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={cn("text-xs font-medium pb-2 -mb-2 border-b-2 transition-colors", activeTab === "history" ? "border-accent text-accent" : "border-transparent text-text-tertiary hover:text-text")}
              >
                {t("issue.history")} {issue.history?.length ? `(${issue.history.length})` : ""}
              </button>
            </div>

            {activeTab === "comments" && (
              <div className="space-y-3">
                {/* Comment list */}
                {issue.comments?.length === 0 && (
                  <p className="text-xs text-text-tertiary italic py-2">{t("issue.noComments")}</p>
                )}
                {issue.comments?.map(comment => (
                  <div key={comment.id} className="flex gap-2.5 group">
                    <Avatar url={comment.authorAvatarUrl} username={comment.authorUsername} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-text">{comment.authorUsername}</span>
                        <span className="text-[10px] text-text-tertiary">{relativeTime(comment.createdAt)}</span>
                        {(comment.authorId === user?.id || myRole === "admin" || myRole === "owner") && editingCommentId !== comment.id && (
                          <div className="hidden group-hover:flex items-center gap-1 ml-auto">
                            {comment.authorId === user?.id && (
                              <button
                                onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); }}
                                className="text-[10px] text-text-tertiary hover:text-text"
                              >
                                {t("issue.editComment")}
                              </button>
                            )}
                            <button
                              onClick={() => deleteComment.mutateAsync(comment.id)}
                              className="text-[10px] text-danger hover:text-danger/80"
                            >
                              {t("issue.deleteComment")}
                            </button>
                          </div>
                        )}
                      </div>
                      {editingCommentId === comment.id ? (
                        <div className="space-y-2">
                          <MentionTextarea
                            autoFocus
                            className="input w-full text-sm resize-y min-h-[60px]"
                            value={editingCommentText}
                            onChange={setEditingCommentText}
                            members={project?.members}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveComment(comment.id)} disabled={updateComment.isPending} className="btn-primary px-2.5 py-1 text-xs disabled:opacity-50">
                              {t("issue.saveComment")}
                            </button>
                            <button onClick={() => setEditingCommentId(null)} className="btn-secondary px-2.5 py-1 text-xs">
                              {t("issue.cancelEdit")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <CommentText content={comment.content} />
                      )}
                    </div>
                  </div>
                ))}

                {/* Add comment */}
                {myRole && myRole !== "viewer" && (
                  <div className="flex gap-2.5 pt-1">
                    <div className="w-6 h-6 rounded-full bg-accent-soft flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-semibold text-text-secondary">
                        {user?.username?.slice(0, 2).toUpperCase() ?? "ME"}
                      </span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <MentionTextarea
                        className="input w-full text-sm resize-none min-h-[60px]"
                        placeholder={t("issue.commentPlaceholder")}
                        value={commentText}
                        onChange={setCommentText}
                        members={project?.members}
                        onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || addComment.isPending}
                        className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {addComment.isPending ? "..." : t("issue.addComment")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="space-y-2">
                {issue.history?.length === 0 && (
                  <p className="text-xs text-text-tertiary italic py-2">{t("issue.noHistory")}</p>
                )}
                {issue.history?.map(h => (
                  <div key={h.id} className="flex items-start gap-2 text-xs text-text-secondary">
                    <span className="text-[10px] text-text-tertiary flex-shrink-0 mt-0.5">{relativeTime(h.changedAt)}</span>
                    <span>
                      <span className="font-medium text-text">{h.changedByUsername ?? "?"}</span>
                      {" changed "}
                      <span className="font-mono text-text-secondary">{h.field}</span>
                      {h.oldValue != null && <> from <span className="line-through text-text-tertiary">{String(h.oldValue)}</span></>}
                      {h.newValue != null && <> to <span className="text-text">{String(h.newValue)}</span></>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="md:w-56 flex-shrink-0 space-y-3">

          {/* Status */}
          <div className="card p-3 space-y-1.5">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{t("issue.status")}</span>
            {canManageStatus ? (
              <div className="relative">
                <button
                  onClick={() => setStatusOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-border hover:border-accent/50 transition-colors text-sm text-text"
                >
                  <span className="flex items-center gap-1.5">
                    {currentStatus && (
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: currentStatus.color }} />
                    )}
                    {currentStatus?.name ?? "–"}
                  </span>
                  <ChevronDown size={12} className="text-text-tertiary flex-shrink-0" />
                </button>
                {statusOpen && (
                  <div className="absolute top-full left-0 right-0 sm:left-0 sm:right-0 mt-1 bg-bg-elevated border border-border rounded-xl shadow-lg z-20 overflow-hidden min-w-[180px]">
                    {statuses.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleStatusChange(s.id)}
                        className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent/10 transition-colors", s.id === issue.statusId && "bg-accent/5 font-medium")}
                      >
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-text px-1">
                {currentStatus && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentStatus.color }} />}
                {currentStatus?.name ?? "–"}
              </div>
            )}
          </div>

          {/* Priority */}
          <div className="card p-3 space-y-1.5">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{t("projects.priority")}</span>
            {canEdit ? (
              <div className="relative">
                <button
                  onClick={() => setPriorityOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-border hover:border-accent/50 transition-colors text-sm"
                >
                  <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", PRIORITY_BG[issue.priority])}>
                    {t(`issue.priority.${issue.priority}` as any)}
                  </span>
                  <ChevronDown size={12} className="text-text-tertiary flex-shrink-0" />
                </button>
                {priorityOpen && (
                  <div className="absolute top-full left-0 right-0 sm:left-0 sm:right-0 mt-1 bg-bg-elevated border border-border rounded-xl shadow-lg z-20 overflow-hidden min-w-[180px]">
                    {priorities.map(p => (
                      <button
                        key={p}
                        onClick={() => handlePriorityChange(p)}
                        className={cn("w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 transition-colors", p === issue.priority && "bg-accent/5")}
                      >
                        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", PRIORITY_BG[p])}>
                          {t(`issue.priority.${p}` as any)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded inline-block", PRIORITY_BG[issue.priority])}>
                {t(`issue.priority.${issue.priority}` as any)}
              </span>
            )}
          </div>

          {/* Assignee */}
          <div className="card p-3 space-y-1.5">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{t("projects.assignee")}</span>
            {canEdit ? (
              <div className="relative">
                <button
                  onClick={() => setAssigneeOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-border hover:border-accent/50 transition-colors"
                >
                  {issue.assigneeUsername ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar url={issue.assigneeAvatarUrl} username={issue.assigneeUsername} />
                      <span className="text-xs text-text truncate">{issue.assigneeDisplayName ?? issue.assigneeUsername}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-text-tertiary italic">{t("issue.unassigned")}</span>
                  )}
                  <ChevronDown size={12} className="text-text-tertiary flex-shrink-0" />
                </button>
                {assigneeOpen && (
                  <div className="absolute top-full left-0 right-0 sm:left-0 sm:right-0 mt-1 bg-bg-elevated border border-border rounded-xl shadow-lg z-20 overflow-hidden min-w-[180px] max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { updateIssue.mutate({ issueId: issue.id, data: { assigneeId: null } }); setAssigneeOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 transition-colors text-xs text-text-tertiary italic"
                    >
                      {t("issue.unassigned")}
                    </button>
                    {(project?.members ?? []).map(m => (
                      <button
                        key={m.userId}
                        onClick={() => { updateIssue.mutate({ issueId: issue.id, data: { assigneeId: m.userId } }); setAssigneeOpen(false); }}
                        className={cn("w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 transition-colors", m.userId === issue.assigneeId && "bg-accent/5")}
                      >
                        <Avatar url={m.avatarUrl} username={m.username} />
                        <span className="text-xs text-text truncate">{m.displayName ?? m.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-1">
                {issue.assigneeUsername ? (
                  <>
                    <Avatar url={issue.assigneeAvatarUrl} username={issue.assigneeUsername} />
                    <span className="text-xs text-text">{issue.assigneeDisplayName ?? issue.assigneeUsername}</span>
                  </>
                ) : (
                  <span className="text-xs text-text-tertiary italic">{t("issue.unassigned")}</span>
                )}
              </div>
            )}
          </div>

          {/* Reporter */}
          <div className="card p-3 space-y-1.5">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{t("issue.reporter")}</span>
            <div className="flex items-center gap-2 text-sm text-text px-1">
              <span className="text-xs">{issue.reporterUsername ?? "–"}</span>
            </div>
          </div>

          {/* Labels */}
          <div className="card p-3 space-y-2">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide flex items-center gap-1">
              <Tag size={10} />
              Etiketler
            </span>

            {/* Existing labels */}
            {(issue.labels ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(issue.labels ?? []).map(label => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent"
                  >
                    {label}
                    {canEdit && (
                      <button
                        onClick={() => {
                          const next = (issue.labels ?? []).filter(l => l !== label);
                          updateIssue.mutate({ issueId: issue.id, data: { labels: next } });
                        }}
                        className="hover:text-danger transition-colors"
                      >
                        <X size={10} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}

            {/* Add label input */}
            {canEdit && (
              <div className="relative">
                <input
                  className="input w-full text-xs py-1.5"
                  placeholder="Etiket ekle..."
                  value={labelInput}
                  onChange={e => { setLabelInput(e.target.value); setLabelSuggestOpen(true); }}
                  onFocus={() => setLabelSuggestOpen(true)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && labelInput.trim()) {
                      e.preventDefault();
                      const trimmed = labelInput.trim().toLowerCase();
                      if (!(issue.labels ?? []).includes(trimmed)) {
                        updateIssue.mutate({ issueId: issue.id, data: { labels: [...(issue.labels ?? []), trimmed] } });
                      }
                      setLabelInput("");
                      setLabelSuggestOpen(false);
                    }
                    if (e.key === "Escape") { setLabelSuggestOpen(false); setLabelInput(""); }
                  }}
                  onBlur={() => setTimeout(() => setLabelSuggestOpen(false), 150)}
                />
                {labelSuggestOpen && labelInput.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-bg-elevated border border-border rounded-xl shadow-lg overflow-hidden max-h-36 overflow-y-auto">
                    {/* Exact match / new label option */}
                    {!(issue.labels ?? []).includes(labelInput.trim().toLowerCase()) && (
                      <button
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          const trimmed = labelInput.trim().toLowerCase();
                          updateIssue.mutate({ issueId: issue.id, data: { labels: [...(issue.labels ?? []), trimmed] } });
                          setLabelInput("");
                          setLabelSuggestOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 transition-colors text-xs"
                      >
                        <Plus size={11} className="text-accent" />
                        <span className="text-accent font-medium">"{labelInput.trim().toLowerCase()}"</span>
                        <span className="text-text-tertiary ml-1">ekle</span>
                      </button>
                    )}
                    {/* Existing label suggestions */}
                    {projectLabels
                      .filter(l => l.includes(labelInput.trim().toLowerCase()) && !(issue.labels ?? []).includes(l))
                      .map(l => (
                        <button
                          key={l}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            updateIssue.mutate({ issueId: issue.id, data: { labels: [...(issue.labels ?? []), l] } });
                            setLabelInput("");
                            setLabelSuggestOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 transition-colors text-xs text-text"
                        >
                          <Tag size={10} className="text-text-tertiary" />
                          {l}
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
            )}

            {(issue.labels ?? []).length === 0 && !canEdit && (
              <p className="text-xs text-text-tertiary italic">Etiket yok</p>
            )}
          </div>

          {/* Due date */}
          {(issue.dueDate || canEdit) && (
            <div className="card p-3 space-y-1.5">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">{t("projects.dueDate")}</span>
              {canEdit ? (
                <DatePicker
                  value={issue.dueDate ?? ""}
                  onChange={val => updateIssue.mutateAsync({ issueId: issue.id, data: { dueDate: val } })}
                  clearable
                />
              ) : (
                <div className={cn("flex items-center gap-1.5 text-xs px-1", issue.dueDate && new Date(issue.dueDate) < new Date() && issue.statusCategory !== "done" ? "text-danger" : "text-text")}>
                  <CalendarDays size={11} />
                  {issue.dueDate ?? "–"}
                </div>
              )}
            </div>
          )}

          {/* Sprint */}
          {sprints.length > 0 && (
            <div className="card p-3 space-y-1.5">
              <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">Sprint</span>
              {canEdit ? (
                <select
                  className="input w-full text-xs"
                  value={issue.sprintId ?? ""}
                  onChange={e => setIssueSprint.mutate({ issueId: issue.id, sprintId: e.target.value || null })}
                >
                  <option value="">Backlog</option>
                  {sprints.filter(s => s.status !== "completed").map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-text px-1">
                  {sprints.find(s => s.id === issue.sprintId)?.name ?? "Backlog"}
                </span>
              )}
            </div>
          )}

          {/* Plan bridge */}
          <div className="card p-3 space-y-1.5">
            <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wide">Plan</span>
            {issue.planItemId ? (
              <div className="space-y-1.5">
                <Link
                  to={`/day/${planDate}`}
                  className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 px-1 transition-colors"
                >
                  <CalendarDays size={11} />
                  ✓ {planDate} — {t("projects.inPlan")}
                </Link>
                <button
                  onClick={() => removeIssueFromPlan.mutateAsync(issue.id)}
                  disabled={removeIssueFromPlan.isPending}
                  className="w-full text-[10px] text-text-tertiary hover:text-danger transition-colors py-0.5 px-1 text-left disabled:opacity-50"
                >
                  Plandan kaldır
                </button>
              </div>
            ) : issue.assigneeId === user?.id ? (
              <button
                onClick={() => setShowPlanModal(true)}
                className="w-full btn-secondary py-1.5 text-xs"
              >
                + {t("projects.addToPlan")}
              </button>
            ) : (
              <span className="text-xs text-text-tertiary px-1 italic">Atanmamış</span>
            )}
          </div>

          {/* Dates */}
          <div className="card p-3 space-y-1.5 text-[10px] text-text-tertiary">
            <div>{t("issue.created")}: {new Date(issue.createdAt).toLocaleDateString()}</div>
            <div>{t("issue.updated")}: {new Date(issue.updatedAt).toLocaleDateString()}</div>
          </div>

          {/* Delete */}
          {canDelete && (
            <div className="pt-1">
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)} className="w-full text-xs text-text-tertiary hover:bg-bg-subtle py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                  <Trash2 size={12} />
                  {t("issue.archive")}
                </button>
              ) : (
                <div className="card p-3 border-border space-y-2">
                  <p className="text-xs text-text-secondary">{t("issue.archiveConfirm")}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1 py-1.5 text-xs">
                      İptal
                    </button>
                    <button onClick={handleDelete} disabled={deleteIssue.isPending} className="flex-1 py-1.5 text-xs bg-bg border border-border text-text rounded-lg hover:bg-bg-subtle disabled:opacity-50">
                      {deleteIssue.isPending ? "..." : t("issue.archive")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Plan date modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm" onClick={() => setShowPlanModal(false)}>
          <div className="card p-4 w-full max-w-xs shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-text text-sm mb-3">{t("projects.addToPlan")}</h3>
            <DatePicker value={planDate} onChange={val => val && setPlanDate(val)} className="mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setShowPlanModal(false)} className="btn-secondary flex-1 py-2 text-xs">İptal</button>
              <button onClick={handleAddToPlan} disabled={addIssueToPlan.isPending} className="btn-primary flex-1 py-2 text-xs disabled:opacity-50">
                {addIssueToPlan.isPending ? "..." : "Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
