import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useMyAssignments } from "@/hooks/useProjects";

interface Props {
  date: string;
}

export default function DayViewProjectBanner({ date }: Props) {
  const { t } = useI18n();
  const { data } = useMyAssignments(date);
  const navigate = useNavigate();

  const unplanned = (data ?? []).filter(i => !i.planItemId);
  if (!unplanned.length) return null;

  const projectIds = [...new Set(unplanned.map(i => i.projectId))];
  const destination = projectIds.length === 1
    ? `/projects/${projectIds[0]}/board`
    : "/projects";

  const count = unplanned.length;
  const label = t("projects.banner" as any, { count });

  return (
    <div className="card border-l-4 border-accent flex items-center gap-3 px-3 py-2 mb-2">
      <Layers size={15} className="text-accent flex-shrink-0" />
      <span className="text-xs flex-1 text-text-secondary">{label}</span>
      <button
        onClick={() => navigate(destination)}
        className="text-xs text-accent hover:underline flex-shrink-0"
      >
        {t("projects.view" as any)}
      </button>
    </div>
  );
}
