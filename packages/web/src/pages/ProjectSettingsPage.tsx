import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Plus, Trash2, Star, Pencil, X, Play, StopCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useProject, useProjectMutations, useStatusMutations, useSprints, useSprintMutations } from "@/hooks/useProjects";
import DatePicker from "@/components/DatePicker";
import { cn } from "@/lib/cn";
import type { WorkflowStatus, Sprint } from "@gmd/shared";

const STATUS_COLORS = [
  "#6b7280", "#94a3b8", "#60a5fa", "#34d399", "#fbbf24",
  "#f87171", "#a78bfa", "#fb923c", "#f472b6", "#2dd4bf",
];

const CATEGORIES = ["todo", "in_progress", "done"] as const;

function StatusRow({
  status, projectId, canEdit,
}: { status: WorkflowStatus; projectId: string; canEdit: boolean }) {
  const { t } = useI18n();
  const { updateStatus, deleteStatus } = useStatusMutations(projectId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color);
  const [category, setCategory] = useState(status.category);
  const [deleteError, setDeleteError] = useState("");

  const handleSave = async () => {
    await updateStatus.mutateAsync({ sid: status.id, data: { name, color, category } });
    setEditing(false);
  };

  const handleSetDefault = async () => {
    await updateStatus.mutateAsync({ sid: status.id, data: { isDefault: true } });
  };

  const handleDelete = async () => {
    setDeleteError("");
    try {
      await deleteStatus.mutateAsync(status.id);
    } catch (err: any) {
      setDeleteError(err.message ?? "Silinemedi");
    }
  };

  const catColor = {
    todo:        "text-text-tertiary bg-bg-subtle",
    in_progress: "text-blue-400 bg-blue-400/10",
    done:        "text-green-400 bg-green-400/10",
  };

  if (editing) {
    return (
      <div className="p-3 bg-bg-subtle/50 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="input flex-1 text-sm py-1.5"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
          />
          <select
            className="input text-xs py-1.5 w-full sm:w-36"
            value={category}
            onChange={e => setCategory(e.target.value as typeof category)}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{t(`settings.statusCategory.${c}` as any)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-tertiary">Renk:</span>
          <div className="flex gap-1 flex-wrap">
            {STATUS_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn("w-5 h-5 rounded-full transition-transform hover:scale-110", color === c && "ring-2 ring-offset-1 ring-accent ring-offset-bg")}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="w-5 h-5 rounded-full border border-border overflow-hidden">
            <input
              type="color"
              className="w-8 h-8 -translate-x-1 -translate-y-1 cursor-pointer opacity-0 absolute"
              value={color}
              onChange={e => setColor(e.target.value)}
            />
            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: color }} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!name.trim() || updateStatus.isPending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
            {t("issue.saveComment")}
          </button>
          <button onClick={() => setEditing(false)} className="btn-secondary px-3 py-1.5 text-xs">
            {t("issue.cancelEdit")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 px-1 group hover:bg-bg-subtle/50 rounded-lg transition-colors">
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
      <span className="text-sm text-text flex-1 truncate">{status.name}</span>
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", catColor[status.category])}>
        {t(`settings.statusCategory.${status.category}` as any)}
      </span>
      {status.isDefault && (
        <span className="text-[10px] text-yellow-400 flex items-center gap-0.5">
          <Star size={9} fill="currentColor" />
          {t("settings.statusDefault")}
        </span>
      )}
      {canEdit && (
        <div className="hidden group-hover:flex items-center gap-1">
          {!status.isDefault && (
            <button
              onClick={handleSetDefault}
              title={t("settings.setDefault")}
              className="text-text-tertiary hover:text-yellow-400 p-1 rounded transition-colors"
            >
              <Star size={12} />
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className="text-text-tertiary hover:text-text p-1 rounded transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteStatus.isPending}
            className="text-text-tertiary hover:text-danger p-1 rounded transition-colors disabled:opacity-50"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
      {deleteError && (
        <span className="text-[10px] text-danger ml-1">{deleteError}</span>
      )}
    </div>
  );
}

function AddStatusForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { t } = useI18n();
  const { createStatus } = useStatusMutations(projectId);
  const [name, setName] = useState("");
  const [color, setColor] = useState(STATUS_COLORS[0]);
  const [category, setCategory] = useState<"todo" | "in_progress" | "done">("todo");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createStatus.mutateAsync({ name: name.trim(), color, category });
    onClose();
  };

  return (
    <div className="p-3 bg-accent/5 rounded-lg border border-accent/20 space-y-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          className="input flex-1 text-sm py-1.5"
          placeholder={t("settings.statusName")}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onClose(); }}
        />
        <select
          className="input text-xs py-1.5 w-full sm:w-36"
          value={category}
          onChange={e => setCategory(e.target.value as typeof category)}
        >
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{t(`settings.statusCategory.${c}` as any)}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-tertiary">Renk:</span>
        <div className="flex gap-1 flex-wrap">
          {STATUS_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn("w-5 h-5 rounded-full transition-transform hover:scale-110", color === c && "ring-2 ring-offset-1 ring-accent ring-offset-bg")}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={!name.trim() || createStatus.isPending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
          {createStatus.isPending ? "..." : t("settings.addStatus")}
        </button>
        <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs">
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function SprintRow({ sprint, projectId, hasActiveSprint }: { sprint: Sprint; projectId: string; hasActiveSprint: boolean }) {
  const { updateSprint, deleteSprint } = useSprintMutations(projectId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sprint.name);
  const [goal, setGoal] = useState(sprint.goal ?? "");
  const [startDate, setStartDate] = useState(sprint.startDate ?? "");
  const [endDate, setEndDate] = useState(sprint.endDate ?? "");

  const STATUS_LABEL: Record<string, string> = { planning: "Planlama", active: "Aktif", completed: "Tamamlandı" };
  const STATUS_COLOR: Record<string, string> = {
    planning: "text-text-tertiary bg-bg-subtle",
    active: "text-green-400 bg-green-400/10",
    completed: "text-text-tertiary bg-bg-subtle line-through",
  };

  const handleSave = async () => {
    await updateSprint.mutateAsync({ sprintId: sprint.id, data: { name, goal: goal || undefined, startDate: startDate || undefined, endDate: endDate || undefined } });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="p-3 bg-accent/5 rounded-lg border border-accent/20 space-y-2">
        <input autoFocus className="input w-full text-sm" value={name} onChange={e => setName(e.target.value)} placeholder="Sprint adı" />
        <input className="input w-full text-sm" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Hedef (opsiyonel)" />
        <div className="grid grid-cols-2 gap-2">
          <DatePicker value={startDate} onChange={v => setStartDate(v ?? "")} placeholder="Başlangıç" clearable />
          <DatePicker value={endDate} onChange={v => setEndDate(v ?? "")} placeholder="Bitiş" clearable />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={!name.trim() || updateSprint.isPending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
            {updateSprint.isPending ? "..." : "Kaydet"}
          </button>
          <button onClick={() => setEditing(false)} className="btn-secondary px-3 py-1.5 text-xs">İptal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2 px-1 group hover:bg-bg-subtle/50 rounded-lg transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text">{sprint.name}</span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", STATUS_COLOR[sprint.status])}>
            {STATUS_LABEL[sprint.status]}
          </span>
          {sprint.issueCount !== undefined && (
            <span className="text-[10px] text-text-tertiary">{sprint.issueCount} issue</span>
          )}
        </div>
        {sprint.goal && <p className="text-[11px] text-text-tertiary mt-0.5 truncate">{sprint.goal}</p>}
        {(sprint.startDate || sprint.endDate) && (
          <p className="text-[10px] text-text-tertiary">
            {sprint.startDate ?? "?"} → {sprint.endDate ?? "?"}
          </p>
        )}
      </div>
      <div className="hidden group-hover:flex items-center gap-1">
        {sprint.status === "planning" && !hasActiveSprint && (
          <button
            onClick={() => updateSprint.mutateAsync({ sprintId: sprint.id, data: { status: "active" } })}
            className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 px-1.5 py-0.5 rounded"
            title="Başlat"
          >
            <Play size={10} /> Başlat
          </button>
        )}
        {sprint.status === "active" && (
          <button
            onClick={() => updateSprint.mutateAsync({ sprintId: sprint.id, data: { status: "completed" } })}
            className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text px-1.5 py-0.5 rounded"
            title="Tamamla"
          >
            <StopCircle size={10} /> Bitir
          </button>
        )}
        {sprint.status !== "active" && (
          <button onClick={() => setEditing(true)} className="p-1 text-text-tertiary hover:text-text rounded">
            <Pencil size={11} />
          </button>
        )}
        <button
          onClick={() => deleteSprint.mutateAsync(sprint.id)}
          className="p-1 text-text-tertiary hover:text-danger rounded"
          title="Sil"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

function AddSprintForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { createSprint } = useSprintMutations(projectId);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createSprint.mutateAsync({ name: name.trim(), startDate: startDate || undefined, endDate: endDate || undefined });
    onClose();
  };

  return (
    <div className="p-3 bg-accent/5 rounded-lg border border-accent/20 space-y-2">
      <input autoFocus className="input w-full text-sm" placeholder="Sprint adı (ör. Sprint 1)" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") onClose(); }} />
      <div className="grid grid-cols-2 gap-2">
        <DatePicker value={startDate} onChange={v => setStartDate(v ?? "")} placeholder="Başlangıç" clearable />
        <DatePicker value={endDate} onChange={v => setEndDate(v ?? "")} placeholder="Bitiş" clearable />
      </div>
      <div className="flex gap-2">
        <button onClick={handleCreate} disabled={!name.trim() || createSprint.isPending} className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">
          {createSprint.isPending ? "..." : "Oluştur"}
        </button>
        <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-xs"><X size={12} /></button>
      </div>
    </div>
  );
}

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();

  const { data: project, isLoading } = useProject(projectId);
  const { updateProject, deleteProject } = useProjectMutations();
  const { data: sprints = [] } = useSprints(projectId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [boardType, setBoardType] = useState<"kanban" | "scrum">("kanban");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddSprint, setShowAddSprint] = useState(false);

  // Danger zone
  const [deleteConfirmKey, setDeleteConfirmKey] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setBoardType(project.boardType as "kanban" | "scrum");
    }
  }, [project]);

  if (isLoading) {
    return <div className="text-sm text-text-tertiary py-12 text-center">Yükleniyor...</div>;
  }
  if (!project) {
    return <div className="text-sm text-danger py-12 text-center">Proje bulunamadı.</div>;
  }

  const isOwner = project.myRole === "owner";
  const isAdmin = project.myRole === "admin" || isOwner;
  if (!isAdmin) {
    return <div className="text-sm text-text-tertiary py-12 text-center">Bu sayfaya erişim yetkiniz yok.</div>;
  }

  const isDirty = name !== project.name || description !== (project.description ?? "") || boardType !== project.boardType;

  const handleSave = async () => {
    if (!projectId || !name.trim()) return;
    setSaveStatus("saving");
    try {
      await updateProject.mutateAsync({
        id: projectId,
        data: { name: name.trim(), description: description || undefined, boardType },
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  };

  const handleDelete = async () => {
    if (!projectId || deleteConfirmKey !== project.projectKey) return;
    setDeleting(true);
    try {
      await deleteProject.mutateAsync(projectId);
      navigate("/projects");
    } catch {
      setDeleting(false);
    }
  };

  const statuses = project.statuses ?? [];

  return (
    <div className="space-y-5 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={`/projects/${projectId}/board`}
          className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text transition-colors"
        >
          <ArrowLeft size={13} />
          {project.name}
        </Link>
        <span className="text-text-tertiary">/</span>
        <h1 className="font-semibold text-text text-base">{t("settings.title")}</h1>
      </div>

      {/* General settings */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-text">Genel</h2>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">{t("projects.name")}</label>
          <input
            className="input w-full text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={64}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">{t("projects.description")}</label>
          <textarea
            className="input w-full text-sm resize-none min-h-[72px]"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Kısa bir açıklama..."
            maxLength={500}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-text-secondary">{t("projects.boardType")}</label>
          <div className="flex gap-2">
            <button
              onClick={() => setBoardType("kanban")}
              className={cn(
                "flex-1 py-2 text-xs rounded-lg border transition-colors font-medium",
                boardType === "kanban"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-text-tertiary hover:border-accent/50 hover:text-text"
              )}
            >
              {t("projects.kanban")}
            </button>
            <button
              onClick={() => setBoardType("scrum")}
              className={cn(
                "flex-1 py-2 text-xs rounded-lg border transition-colors font-medium",
                boardType === "scrum"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-text-tertiary hover:border-accent/50 hover:text-text"
              )}
            >
              {t("projects.scrum")}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            {saveStatus === "saved" && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Check size={11} />
                {t("settings.saved")}
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!isDirty || saveStatus === "saving" || !name.trim()}
            className="btn-primary px-4 py-2 text-xs disabled:opacity-50"
          >
            {saveStatus === "saving" ? t("settings.saving") : t("settings.save")}
          </button>
        </div>
      </div>

      {/* Workflow statuses */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">{t("settings.statuses")}</h2>
          {!showAddStatus && (
            <button
              onClick={() => setShowAddStatus(true)}
              className="flex items-center gap-1 text-xs text-text-tertiary hover:text-accent transition-colors"
            >
              <Plus size={12} />
              {t("settings.addStatus")}
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          {statuses.map(s => (
            <StatusRow key={s.id} status={s} projectId={projectId!} canEdit={isAdmin} />
          ))}
        </div>

        {showAddStatus && (
          <AddStatusForm projectId={projectId!} onClose={() => setShowAddStatus(false)} />
        )}
      </div>

      {/* Sprints */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Sprintler</h2>
          {isAdmin && (
            <button onClick={() => setShowAddSprint(true)} className="btn-icon p-1.5 rounded-lg text-text-tertiary hover:text-text">
              <Plus size={14} />
            </button>
          )}
        </div>
        {sprints.length === 0 && !showAddSprint && (
          <p className="text-xs text-text-tertiary italic">Henüz sprint yok</p>
        )}
        <div className="space-y-0.5">
          {sprints.map(s => (
            <SprintRow key={s.id} sprint={s} projectId={projectId!} hasActiveSprint={sprints.some(x => x.status === "active" && x.id !== s.id)} />
          ))}
        </div>
        {showAddSprint && (
          <AddSprintForm projectId={projectId!} onClose={() => setShowAddSprint(false)} />
        )}
      </div>

      {/* Project info (read-only) */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-text">Proje Bilgisi</h2>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-text-tertiary block mb-0.5">{t("projects.key")}</span>
            <span className="font-mono font-semibold text-text">{project.projectKey}</span>
          </div>
          <div>
            <span className="text-text-tertiary block mb-0.5">ID</span>
            <span className="font-mono text-text-tertiary text-[10px] break-all">{project.id.slice(0, 8)}...</span>
          </div>
          <div>
            <span className="text-text-tertiary block mb-0.5">Oluşturulma</span>
            <span className="text-text">{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
          <div>
            <span className="text-text-tertiary block mb-0.5">Üye</span>
            <span className="text-text">{project.memberCount ?? project.members?.length ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Danger zone (owner only) */}
      {isOwner && (
        <div className="card p-4 space-y-3 border-danger/30">
          <h2 className="text-sm font-semibold text-danger">{t("settings.dangerZone")}</h2>

          <div className="space-y-2">
            <p className="text-sm font-medium text-text">{t("settings.deleteProject")}</p>
            <p className="text-xs text-text-secondary">{t("settings.deleteProjectDesc")}</p>

            <div className="pt-1 space-y-2">
              <label className="text-xs text-text-secondary block">
                {t("settings.deleteConfirm")}{" "}
                <span className="font-mono font-semibold text-text">{project.projectKey}</span>
              </label>
              <input
                className="input w-full text-sm font-mono"
                placeholder={project.projectKey}
                value={deleteConfirmKey}
                onChange={e => setDeleteConfirmKey(e.target.value.toUpperCase())}
              />
              <button
                onClick={handleDelete}
                disabled={deleteConfirmKey !== project.projectKey || deleting}
                className="w-full py-2 text-xs bg-danger text-white rounded-lg hover:bg-danger/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? t("settings.deleting") : t("settings.deleteProject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
