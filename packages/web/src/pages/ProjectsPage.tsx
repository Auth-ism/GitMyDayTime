import { useState } from "react";
import { Plus, Layers, FolderOpen } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useProjects } from "@/hooks/useProjects";
import ProjectCard from "@/components/projects/ProjectCard";
import CreateProjectModal from "@/components/projects/CreateProjectModal";

export default function ProjectsPage() {
  const { t } = useI18n();
  const { data: projects, isLoading } = useProjects();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={20} className="text-accent" />
          <h1 className="text-xl font-semibold text-text">{t("projects.title" as any)}</h1>
          {projects && projects.length > 0 && (
            <span className="text-xs text-text-tertiary bg-accent-soft px-2 py-0.5 rounded-full">
              {projects.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-1.5 px-3 py-2 text-sm"
        >
          <Plus size={15} />
          {t("projects.new" as any)}
        </button>
      </div>

      {isLoading && (
        <div className="text-sm text-text-tertiary py-8 text-center">
          {t("projects.loading" as any)}
        </div>
      )}

      {!isLoading && (!projects || projects.length === 0) && (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-accent-soft flex items-center justify-center mx-auto">
            <FolderOpen size={22} className="text-text-tertiary" />
          </div>
          <p className="text-text-secondary font-medium">{t("projects.empty" as any)}</p>
          <p className="text-sm text-text-tertiary">{t("projects.emptyDesc" as any)}</p>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm"
          >
            <Plus size={14} />
            {t("projects.new" as any)}
          </button>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
