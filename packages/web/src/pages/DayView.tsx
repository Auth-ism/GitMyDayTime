import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDayLog } from "@/hooks/useDayLog";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import TaskForm from "@/components/TaskForm";
import TaskItem from "@/components/TaskItem";
import PlanItem from "@/components/PlanItem";
import CarryOverBanner from "@/components/CarryOverBanner";
import StandupExport from "@/components/StandupExport";
import PomodoroTimer from "@/components/PomodoroTimer";
import { AnimatePresence, Reorder } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, Target, MessageSquare, Filter } from "lucide-react";
import { CATEGORY_LABELS, todayStr, type Category } from "@gmd/shared";
import { cn } from "@/lib/cn";
import { useSwipe } from "@/hooks/useSwipe";

function getDateStr(dateParam?: string): string {
  return dateParam || todayStr();
}

const categories = Object.keys(CATEGORY_LABELS) as Category[];

export default function DayView() {
  const { date: dateParam } = useParams();
  const date = getDateStr(dateParam);
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { query, addTask, updateTask, deleteTask, addPlan, updatePlan, deletePlan, reorderPlan, addChecklist, updateChecklist, deleteChecklist } = useDayLog(date);
  const [filterCat, setFilterCat] = useState<Category | "all">("all");
  const [pomodoroTask, setPomodoroTask] = useState<{ id: string; name: string } | null>(null);

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

  const swipeHandlers = useSwipe({ onSwipeLeft: nextDay, onSwipeRight: prevDay });

  const completedPlan = dayLog?.plan.filter((p) => p.completed).length || 0;
  const totalPlan = dayLog?.plan.length || 0;
  const taskCount = dayLog?.tasks.length || 0;

  const displayDate = new Date(date + "T12:00:00");
  const dateLoc = locale === "tr" ? "tr-TR" : "en-US";

  return (
    <div className="space-y-5" {...swipeHandlers}>
      {/* Date header */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevDay} className="btn btn-ghost p-2" aria-label={t("day.prevDay")}>
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[140px]">
            <h1 className="text-lg font-semibold leading-tight">
              {isToday ? t("day.today") : displayDate.toLocaleDateString(dateLoc, { weekday: "long" })}
            </h1>
            <p className="text-sm text-text-secondary">
              {displayDate.toLocaleDateString(dateLoc, { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <button onClick={nextDay} className="btn btn-ghost p-2" aria-label={t("day.nextDay")}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <StandupExport date={date} />
          <button
            onClick={() => navigate("/")}
            className={cn(
              "btn btn-ghost text-xs transition-opacity",
              isToday ? "opacity-0 pointer-events-none" : "opacity-100"
            )}
            aria-label={t("day.goToday")}
            tabIndex={isToday ? -1 : 0}
          >
            <CalendarDays size={14} />
            <span className="hidden sm:inline">{t("day.today")}</span>
          </button>
        </div>
      </div>

      {/* Carry over banner */}
      <CarryOverBanner date={date} />

      {/* Pomodoro timer */}
      <AnimatePresence>
        {pomodoroTask && (
          <PomodoroTimer
            taskName={pomodoroTask.name}
            onComplete={(minutes) => {
              updatePlan.mutate({
                id: pomodoroTask.id,
                completed: true,
                actualDuration: minutes,
              });
            }}
            onClose={() => setPomodoroTask(null)}
          />
        )}
      </AnimatePresence>

      {/* Summary strip */}
      {(taskCount > 0 || totalPlan > 0) && (
        <div className="flex gap-3" role="status">
          {totalPlan > 0 && (
            <div className="flex-1 card !py-3 flex items-center gap-3">
              <Target size={16} className="text-success flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{completedPlan}/{totalPlan}</p>
                <p className="text-xs text-text-secondary">{t("day.planned")}</p>
              </div>
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
                <p className="text-sm font-semibold">{t("day.notes", { count: taskCount, s: taskCount !== 1 ? "s" : "" })}</p>
                <p className="text-xs text-text-secondary">{t("day.today")}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category filter */}
      {(taskCount > 0 || totalPlan > 0) && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="radiogroup">
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
            {t("day.all")}
          </button>
          {categories.map((key) => {
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
                {getCatLabel(key)} <span className="opacity-60">{count}</span>
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
        <Reorder.Group
          axis="y"
          values={filteredPlan}
          onReorder={(newOrder) => {
            reorderPlan.mutate(newOrder.map((p) => p.id));
          }}
          className="mt-2 space-y-1.5"
          as="div"
        >
          {filteredPlan.map((item) => (
            <Reorder.Item key={item.id} value={item} as="div" dragListener={!item.completed}>
              <PlanItem
                item={item}
                onToggle={(actualDuration) => updatePlan.mutate({
                  id: item.id,
                  completed: !item.completed,
                  ...(actualDuration !== undefined ? { actualDuration } : {}),
                })}
                onDelete={() => deletePlan.mutate(item.id)}
                onUpdate={(data) => updatePlan.mutate({ id: item.id, ...data })}
                onStartPomodoro={() => setPomodoroTask({ id: item.id, name: item.description })}
                onAddChecklist={(desc) => addChecklist.mutate({ planId: item.id, description: desc })}
                onUpdateChecklist={(clId, data) => updateChecklist.mutate({ planId: item.id, clId, ...data })}
                onDeleteChecklist={(clId) => deleteChecklist.mutate({ planId: item.id, clId })}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
        {dayLog && filteredPlan.length === 0 && filterCat === "all" && (
          <div className="text-center py-6 text-text-tertiary">
            <Target size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t("day.noPlans")}</p>
            <p className="text-xs mt-0.5">{t("day.noPlansDesc")}</p>
          </div>
        )}
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
                onDelete={() => deleteTask.mutate(task.id)}
                onUpdate={(data) => updateTask.mutate({ id: task.id, ...data })}
              />
            ))}
          </AnimatePresence>
          {dayLog && filteredTasks.length === 0 && filterCat === "all" && (
            <div className="text-center py-6 text-text-tertiary">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t("day.noNotes")}</p>
              <p className="text-xs mt-0.5">{t("day.noNotesDesc")}</p>
            </div>
          )}
        </div>
      </section>

      {/* Loading state */}
      {query.isLoading && (
        <div className="space-y-3" aria-busy="true" aria-label={t("day.loading")}>
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
