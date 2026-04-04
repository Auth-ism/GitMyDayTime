import { useState } from "react";
import { X, Layers } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useProjectMutations } from "@/hooks/useProjects";
import type { CreateProjectInput } from "@gmd/shared";

interface Props {
  onClose: () => void;
}

export default function CreateProjectModal({ onClose }: Props) {
  const { t } = useI18n();
  const { createProject } = useProjectMutations();
  const [name, setName] = useState("");
  const [projectKey, setProjectKey] = useState("");
  const [description, setDescription] = useState("");
  const [boardType, setBoardType] = useState<"kanban" | "scrum">("kanban");
  const [error, setError] = useState("");

  const keyFromName = (n: string) =>
    n.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "";

  const handleNameChange = (v: string) => {
    setName(v);
    if (!projectKey) setProjectKey(keyFromName(v));
  };

  const handleKeyChange = (v: string) => {
    setProjectKey(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^[A-Z][A-Z0-9]{1,9}$/.test(projectKey)) {
      setError(t("projects.keyHint" as any));
      return;
    }
    try {
      await createProject.mutateAsync({
        name: name.trim(),
        projectKey,
        description: description.trim() || undefined,
        boardType,
      } as CreateProjectInput);
      onClose();
    } catch (err: any) {
      setError(err.message || "Hata oluştu");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-accent" />
            <h2 className="font-semibold text-text">{t("projects.new" as any)}</h2>
          </div>
          <button onClick={onClose} className="btn-icon p-1.5 rounded-lg" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label mb-1 block">{t("projects.name" as any)}</label>
            <input
              className="input w-full"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Takımım Projesi"
              maxLength={64}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label mb-1 block">{t("projects.key" as any)}</label>
            <input
              className="input w-full font-mono uppercase"
              value={projectKey}
              onChange={e => handleKeyChange(e.target.value)}
              placeholder="ALPHA"
              maxLength={10}
              required
            />
            <p className="text-[11px] text-text-tertiary mt-1">{t("projects.keyHint" as any)}</p>
          </div>

          <div>
            <label className="label mb-1 block">{t("projects.description" as any)}</label>
            <textarea
              className="input w-full resize-none"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="İsteğe bağlı açıklama..."
              maxLength={256}
              rows={2}
            />
          </div>

          <div>
            <label className="label mb-2 block">{t("projects.boardType" as any)}</label>
            <div className="flex gap-2">
              {(["kanban", "scrum"] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setBoardType(type)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    boardType === type
                      ? "bg-accent text-bg border-accent"
                      : "border-border text-text-secondary hover:border-accent/40"
                  }`}
                >
                  {t(`projects.${type}` as any)}
                </button>
              ))}
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
              disabled={createProject.isPending || !name.trim() || !projectKey}
              className="btn-primary flex-1 py-2 text-sm disabled:opacity-50"
            >
              {createProject.isPending ? t("projects.creating" as any) : t("projects.createBtn" as any)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
