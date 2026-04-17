import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BarChart2 } from "lucide-react";
import { useProject, useSprints, useIssues } from "@/hooks/useProjects";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const isSmall = () => typeof window !== "undefined" && window.innerWidth < 640;

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#60a5fa", none: "#6b7280",
};
const TYPE_COLORS: Record<string, string> = {
  epic: "#a855f7", story: "#3b82f6", task: "#22c55e", bug: "#ef4444", sub_task: "#9ca3af",
};
const STATUS_CAT_COLORS: Record<string, string> = {
  todo: "#6b7280", in_progress: "#60a5fa", done: "#22c55e",
};

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  return arr.reduce<Record<string, number>>((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}

export default function ProjectInsightsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project } = useProject(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: issuesData } = useIssues(projectId, { limit: 200 });
  const issues = issuesData?.issues ?? [];

  if (!project) return <div className="text-sm text-text-tertiary py-12 text-center">Yükleniyor...</div>;

  // ── Breakdowns ────────────────────────────────────────────────
  const byPriority = groupBy(issues, i => i.priority);
  const byType = groupBy(issues, i => i.issueType);
  const byStatusCat = groupBy(issues, i => i.statusCategory ?? "todo");

  const priorityData = Object.entries(byPriority).map(([name, value]) => ({ name, value }));
  const typeData = Object.entries(byType).map(([name, value]) => ({ name, value }));
  const statusData = Object.entries(byStatusCat).map(([name, value]) => ({
    name: name === "todo" ? "Yapılacak" : name === "in_progress" ? "Devam Eden" : "Tamamlandı",
    value,
    cat: name,
  }));

  // ── Sprint velocity ───────────────────────────────────────────
  const completedSprints = sprints.filter(s => s.status === "completed");
  const velocityData = completedSprints.map(s => ({
    name: s.name,
    issues: issues.filter(i => i.sprintId === s.id).length,
    done: issues.filter(i => i.sprintId === s.id && i.statusCategory === "done").length,
  }));

  // ── Burndown for active sprint ────────────────────────────────
  const activeSprint = sprints.find(s => s.status === "active");
  const sprintIssues = activeSprint ? issues.filter(i => i.sprintId === activeSprint.id) : [];
  const sprintTotal = sprintIssues.length;
  const sprintDone = sprintIssues.filter(i => i.statusCategory === "done").length;
  const sprintPct = sprintTotal > 0 ? Math.round((sprintDone / sprintTotal) * 100) : 0;

  // ── Assignee breakdown ────────────────────────────────────────
  const assigneeMap = groupBy(
    issues.filter(i => i.assigneeUsername),
    i => i.assigneeUsername!
  );
  const assigneeData = Object.entries(assigneeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  const LABEL_PRIORITY: Record<string, string> = {
    critical: "Kritik", high: "Yüksek", medium: "Orta", low: "Düşük", none: "Yok",
  };
  const LABEL_TYPE: Record<string, string> = {
    epic: "Epic", story: "Story", task: "Task", bug: "Bug", sub_task: "Sub-task",
  };

  const tooltipStyle = {
    backgroundColor: "var(--color-bg-elevated)",
    border: "1px solid var(--color-border)",
    borderRadius: "8px",
    fontSize: "11px",
    color: "var(--color-text)",
  };
  const tooltipLabelStyle = { color: "var(--color-text)", fontWeight: 600 };
  const tooltipItemStyle = { color: "var(--color-text-secondary)" };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/projects/${projectId}/board`} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text">
          <ArrowLeft size={13} />
          Board
        </Link>
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-accent" />
          <h1 className="font-semibold text-text text-base">{project.name} — Raporlar</h1>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Toplam Issue", value: issues.length },
          { label: "Tamamlandı", value: sprintDone || byStatusCat["done"] || 0 },
          { label: "Sprint Sayısı", value: sprints.length },
          { label: "Üye", value: project.members?.length ?? 0 },
        ].map(k => (
          <div key={k.label} className="card p-4 text-center">
            <div className="text-2xl font-bold text-text">{k.value}</div>
            <div className="text-[11px] text-text-tertiary mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Active sprint progress */}
      {activeSprint && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-text">{activeSprint.name} — İlerleme</span>
            <span className="text-xs text-text-tertiary">{sprintDone}/{sprintTotal} tamamlandı</span>
          </div>
          <div className="w-full bg-bg-subtle rounded-full h-3 overflow-hidden">
            <div
              className="h-3 rounded-full bg-accent transition-all"
              style={{ width: `${sprintPct}%` }}
            />
          </div>
          <div className="text-xs text-text-tertiary text-right">{sprintPct}%</div>
        </div>
      )}

      {/* Charts row 1: Status + Priority */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Durum</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" outerRadius={65} dataKey="value" label={({ name, value }) => `${name} (${value})`} labelLine={false} fontSize={10} activeShape={() => <g />}>
                {statusData.map((entry) => (
                  <Cell key={entry.cat} fill={STATUS_CAT_COLORS[entry.cat] ?? "#6b7280"} />
                ))}
              </Pie>
              <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Öncelik</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={priorityData} layout="vertical" margin={{ left: isSmall() ? 20 : 40 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tickFormatter={k => LABEL_PRIORITY[k] ?? k} width={60} tick={{ fontSize: 11 }} />
              <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v, _, p) => [v, LABEL_PRIORITY[p.payload.name] ?? p.payload.name]} />
              <Bar dataKey="value" radius={4} activeBar={false}>
                {priorityData.map(entry => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2: Type + Assignee */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Issue Türü</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typeData} layout="vertical" margin={{ left: isSmall() ? 25 : 50 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tickFormatter={k => LABEL_TYPE[k] ?? k} width={65} tick={{ fontSize: 11 }} />
              <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} formatter={(v, _, p) => [v, LABEL_TYPE[p.payload.name] ?? p.payload.name]} />
              <Bar dataKey="value" radius={4} activeBar={false}>
                {typeData.map(entry => (
                  <Cell key={entry.name} fill={TYPE_COLORS[entry.name] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {assigneeData.length > 0 && (
          <div className="card p-4 space-y-3">
            <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Kişiye Göre</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={assigneeData} layout="vertical" margin={{ left: isSmall() ? 30 : 55 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
                <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
                <Bar dataKey="value" fill="var(--color-accent)" radius={4} activeBar={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Velocity */}
      {velocityData.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Sprint Velocity</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={velocityData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip cursor={false} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="issues" name="Toplam" fill="#60a5fa" radius={[4, 4, 0, 0]} activeBar={false} />
              <Bar dataKey="done" name="Tamamlandı" fill="#22c55e" radius={[4, 4, 0, 0]} activeBar={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
