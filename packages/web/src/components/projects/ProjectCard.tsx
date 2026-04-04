import { Link } from "react-router-dom";
import { Layers, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { useI18n } from "@/lib/i18n";
import type { Project } from "@gmd/shared";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-accent/15 text-accent",
  admin: "bg-purple-500/15 text-purple-400",
  developer: "bg-green-500/15 text-green-400",
  reporter: "bg-yellow-500/15 text-yellow-400",
  viewer: "bg-border text-text-tertiary",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  developer: "Developer",
  reporter: "Reporter",
  viewer: "Viewer",
};

interface Props {
  project: Project;
}

export default function ProjectCard({ project }: Props) {
  const { t } = useI18n();

  return (
    <Link
      to={`/projects/${project.id}/board`}
      className="card p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Layers size={15} className="text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-text text-sm truncate group-hover:text-accent transition-colors">
              {project.name}
            </h3>
            <span className="text-[10px] font-mono text-text-tertiary">{project.projectKey}</span>
          </div>
        </div>
        {project.myRole && (
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0", ROLE_COLORS[project.myRole])}>
            {ROLE_LABELS[project.myRole]}
          </span>
        )}
      </div>

      {project.description && (
        <p className="text-xs text-text-secondary line-clamp-2">{project.description}</p>
      )}

      <div className="flex items-center justify-between text-[11px] text-text-tertiary">
        <div className="flex items-center gap-1">
          <Users size={11} />
          <span>{t("projects.members" as any, { count: project.memberCount ?? 0 })}</span>
        </div>
        <span className={cn(
          "px-1.5 py-0.5 rounded text-[10px] font-medium",
          project.boardType === "scrum"
            ? "bg-purple-500/10 text-purple-400"
            : "bg-blue-500/10 text-blue-400"
        )}>
          {project.boardType === "scrum" ? t("projects.scrum" as any) : t("projects.kanban" as any)}
        </span>
      </div>
    </Link>
  );
}
