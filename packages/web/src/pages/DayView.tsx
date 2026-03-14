import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDayLog } from "@/hooks/useDayLog";
import TaskForm from "@/components/TaskForm";
import TaskItem from "@/components/TaskItem";
import PlanItem from "@/components/PlanItem";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, Target, MessageSquare, Filter } from "lucide-react";
import { CATEGORY_LABELS, todayStr, type Category } from "@gmd/shared";
import { cn } from "@/lib/cn";

function getDateStr(dateParam?: string): string {
  return dateParam || todayStr();
}

const categories = Object.entries(CATEGORY_LABELS) as [Category, string][];

export default function DayView() {
  const { date: dateParam } = useParams();
  const date = getDateStr(dateParam);
  const navigate = useNavigate();
  const { query, addTask, updateTask, deleteTask, addPlan, updatePlan, deletePlan } = useDayLog(date);
  const [filterCat, setFilterCat] = useState<Category | "all">("all");

  const dayLog = query.data;
  const today = todayStr();
  const isToday = date === today;

  const filteredTasks = dayLog?.tasks.filter((t) => filterCat === "all" || t.category === filterCat) || [];
  const filteredPlan = dayLog?.plan
    .filter((p) => filterCat === "all" || p.category === filterCat)
    .sort((a, b) => a.order - b.order) || [];

  const prevDay = () => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    navigate(`/day/${d.toISOString().split("T")[0]}`);
  };

  const nextDay = () => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + 1);
    navigate(`/day/${d.toISOString().split("T")[0]}`);
  };

  const completedPlan = dayLog?.plan.filter((p) => p.completed).length || 0;
  const totalPlan = dayLog?.plan.length || 0;
  const taskCount = dayLog?.tasks.length || 0;

  const displayDate = new Date(date + "T12:00:00");

  return (
    <div className="space-y-5">
      {/* Date header */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevDay} className="btn btn-ghost p-2" aria-label="Previous day">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[140px]">
            <h1 className="text-lg font-semibold leading-tight">
              {isToday ? "Today" : displayDate.toLocaleDateString("en-US", { weekday: "long" })}
            </h1>
            <p className="text-sm text-text-secondary">
              {displayDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <button onClick={nextDay} className="btn btn-ghost p-2" aria-label="Next day">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {!isToday && (
            <button
              onClick={() => navigate("/")}
              className="btn btn-ghost text-xs"
              aria-label="Go to today"
            >
              <CalendarDays size={14} />
              Today
            </button>
          )}
        </div>
      </div>

      {/* Summary strip */}
      {(taskCount > 0 || totalPlan > 0) && (
        <div className="flex gap-3" role="status" aria-label="Day summary">
          {totalPlan > 0 && (
            <div className="flex-1 card !py-3 flex items-center gap-3">
              <Target size={16} className="text-success flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{completedPlan}/{totalPlan}</p>
                <p className="text-xs text-text-secondary">Planned</p>
              </div>
              {/* Progress bar */}
              <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden" role="progressbar" aria-valuenow={completedPlan} aria-valuemax={totalPlan}>
                <div
                  className="h-full bg-success rounded-full transition-all duration-300"
                  style={{ width: `${totalPlan > 0 ? (completedPlan / totalPlan) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          {taskCount > 0 && (
            <div className="flex-1 card !py-3 flex items-center gap-3">
              <MessageSquare size={16} className="text-text-secondary flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{taskCount} note{taskCount !== 1 ? "s" : ""}</p>
                <p className="text-xs text-text-secondary">Today</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category filter */}
      {(taskCount > 0 || totalPlan > 0) && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Filter by category">
          <Filter size={14} className="text-text-tertiary flex-shrink-0" />
          <button
            type="button"
            role="radio"
            aria-checked={filterCat === "all"}
            onClick={() => setFilterCat("all")}
            className={cn(
              "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
              filterCat === "all"
                ? "bg-accent text-bg shadow-sm"
                : "bg-bg-elevated text-text-secondary hover:bg-bg-tertiary border border-border"
            )}
          >
            All
          </button>
          {categories.map(([key, label]) => {
            const count = (dayLog?.tasks.filter((t) => t.category === key).length || 0) +
              (dayLog?.plan.filter((p) => p.category === key).length || 0);
            if (count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={filterCat === key}
                onClick={() => setFilterCat(key)}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                  filterCat === key
                    ? "bg-accent text-bg shadow-sm"
                    : "bg-bg-elevated text-text-secondary hover:bg-bg-tertiary border border-border"
                )}
              >
                {label} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Plan section */}
      <section aria-labelledby="plan-heading">
        <TaskForm
          type="plan"
          loading={addPlan.isPending}
          onSubmit={(data) => addPlan.mutate(data)}
        />
        <div className="mt-2 space-y-1.5">
          <AnimatePresence mode="popLayout">
            {filteredPlan.map((item) => (
                <PlanItem
                  key={item.id}
                  item={item}
                  onToggle={(actualDuration) => updatePlan.mutate({
                    id: item.id,
                    completed: !item.completed,
                    ...(actualDuration !== undefined ? { actualDuration } : {}),
                  })}
                  onDelete={() => deletePlan.mutate(item.id)}
                />
              ))}
          </AnimatePresence>
          {dayLog && filteredPlan.length === 0 && filterCat === "all" && (
            <div className="text-center py-6 text-text-tertiary">
              <Target size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No plans yet</p>
              <p className="text-xs mt-0.5">Add what you want to accomplish</p>
            </div>
          )}
        </div>
      </section>

      {/* Activity log section */}
      <section aria-labelledby="activity-heading">
        <TaskForm
          type="task"
          loading={addTask.isPending}
          onSubmit={(data) => addTask.mutate(data)}
        />
        <div className="mt-2 space-y-1.5">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => updateTask.mutate({ id: task.id, completed: !task.completed })}
                onDelete={() => deleteTask.mutate(task.id)}
              />
            ))}
          </AnimatePresence>
          {dayLog && filteredTasks.length === 0 && filterCat === "all" && (
            <div className="text-center py-6 text-text-tertiary">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No notes yet</p>
              <p className="text-xs mt-0.5">Jot down quick thoughts or observations</p>
            </div>
          )}
        </div>
      </section>

      {/* Loading state */}
      {query.isLoading && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading day data">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-bg-tertiary rounded w-3/4 mb-2" />
              <div className="h-3 bg-bg-tertiary rounded w-1/2" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
