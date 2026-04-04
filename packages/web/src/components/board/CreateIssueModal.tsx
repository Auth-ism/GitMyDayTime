import { useState } from "react";
import { X, Tag, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useIssueMutations, useProject, useProjectLabels } from "@/hooks/useProjects";
import type { CreateIssueInput, IssuePriority, IssueType } from "@gmd/shared";
import DatePicker from "@/components/DatePicker";

interface Props {
  projectId: string;
  defaultStatusId?: string;
  parentId?: string;
  onClose: () => void;
}

const PRIORITIES: IssuePriority[] = ["critical", "high", "medium", "low", "none"];
const TYPES: IssueType[] = ["task", "bug", "story", "epic", "sub_task"];

export default function CreateIssueModal({ projectId, defaultStatusId, parentId, onClose }: Props) {
  const { t } = useI18n();
  const { data: project } = useProject(projectId);
  const { createIssue } = useIssueMutations(projectId);
  const { data: projectLabels = [] } = useProjectLabels(projectId);

  const [title, setTitle] = useState("");
  const [issueType, setIssueType] = useState<IssueType>(parentId ? "sub_task" : "task");
  const [priority, setPriority] = useState<IssuePriority>("medium");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState("");
  const [labelSuggestOpen, setLabelSuggestOpen] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createIssue.mutateAsync({
        title: title.trim(),
        issueType,
        priority,
        assigneeId: assigneeId || undefined,
        dueDate: dueDate || undefined,
        labels,
        parentId: parentId ?? undefined,
      } as CreateIssueInput);
      onClose();
    } catch (err: any) {
      setError(err.message || "Hata oluştu");
    }
  };

  const PRIORITY_LABELS: Record<IssuePriority, string> = {
    critical: t("issue.priority.critical" as any),
    high:     t("issue.priority.high" as any),
    medium:   t("issue.priority.medium" as any),
    low:      t("issue.priority.low" as any),
    none:     t("issue.priority.none" as any),
  };

  const TYPE_LABELS: Record<IssueType, string> = {
    epic:     t("issue.type.epic" as any),
    story:    t("issue.type.story" as any),
    task:     t("issue.type.task" as any),
    bug:      t("issue.type.bug" as any),
    sub_task: t("issue.type.sub_task" as any),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div className="card p-5 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text text-sm">{t("projects.addIssue" as any)}</h2>
          <button onClick={onClose} className="btn-icon p-1.5 rounded-lg" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <input
              className="input w-full"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t("projects.issueTitle" as any)}
              required
              autoFocus
              maxLength={500}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label mb-1 block text-[11px]">{t("projects.issueType" as any)}</label>
              <select
                className="input w-full text-sm"
                value={issueType}
                onChange={e => setIssueType(e.target.value as IssueType)}
              >
                {TYPES.map(type => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1 block text-[11px]">{t("projects.priority" as any)}</label>
              <select
                className="input w-full text-sm"
                value={priority}
                onChange={e => setPriority(e.target.value as IssuePriority)}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="label mb-1 block text-[11px]">{t("projects.assignee" as any)}</label>
              <select
                className="input w-full text-sm"
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
              >
                <option value="">Atanmamış</option>
                {project?.members.map(m => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName || m.username || m.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1 block text-[11px]">{t("projects.dueDate" as any)}</label>
              <DatePicker
                value={dueDate}
                onChange={val => setDueDate(val ?? "")}
                placeholder="Tarih seç"
                clearable
              />
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-1.5">
            <label className="label block text-[11px] flex items-center gap-1">
              <Tag size={11} />
              Etiketler
            </label>
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {labels.map(l => (
                  <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-accent/10 text-accent">
                    {l}
                    <button type="button" onClick={() => setLabels(prev => prev.filter(x => x !== l))}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative">
              <input
                type="text"
                className="input w-full text-sm"
                placeholder="Etiket ekle (Enter ile onayla)"
                value={labelInput}
                onChange={e => { setLabelInput(e.target.value); setLabelSuggestOpen(true); }}
                onFocus={() => setLabelSuggestOpen(true)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const trimmed = labelInput.trim().toLowerCase();
                    if (trimmed && !labels.includes(trimmed)) setLabels(prev => [...prev, trimmed]);
                    setLabelInput(""); setLabelSuggestOpen(false);
                  }
                  if (e.key === "Escape") { setLabelSuggestOpen(false); setLabelInput(""); }
                }}
                onBlur={() => setTimeout(() => setLabelSuggestOpen(false), 150)}
              />
              {labelSuggestOpen && labelInput.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-bg-elevated border border-border rounded-xl shadow-lg overflow-hidden max-h-36 overflow-y-auto">
                  {!labels.includes(labelInput.trim().toLowerCase()) && (
                    <button type="button" onMouseDown={e => e.preventDefault()}
                      onClick={() => { const t = labelInput.trim().toLowerCase(); if (!labels.includes(t)) setLabels(p => [...p, t]); setLabelInput(""); setLabelSuggestOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 text-xs">
                      <Plus size={11} className="text-accent" />
                      <span className="text-accent font-medium">"{labelInput.trim().toLowerCase()}"</span>
                      <span className="text-text-tertiary ml-1">ekle</span>
                    </button>
                  )}
                  {projectLabels.filter(l => l.includes(labelInput.trim().toLowerCase()) && !labels.includes(l)).map(l => (
                    <button key={l} type="button" onMouseDown={e => e.preventDefault()}
                      onClick={() => { setLabels(p => [...p, l]); setLabelInput(""); setLabelSuggestOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/10 text-xs text-text">
                      <Tag size={10} className="text-text-tertiary" />{l}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger-soft rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2 text-sm">
              İptal
            </button>
            <button
              type="submit"
              disabled={createIssue.isPending || !title.trim()}
              className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
            >
              {createIssue.isPending ? "..." : "Ekle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
