import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDayLog } from "@/hooks/useDayLog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useI18n, useCategoryLabel } from "@/lib/i18n";
import { api } from "@/lib/api";
import TaskForm from "@/components/TaskForm";
import TaskItem from "@/components/TaskItem";
import PlanItem from "@/components/PlanItem";
import ReminderItem from "@/components/ReminderItem";
import CarryOverBanner from "@/components/CarryOverBanner";
import StandupExport from "@/components/StandupExport";
import PomodoroTimer from "@/components/PomodoroTimer";
import JournalSection from "@/components/JournalSection";
import TimelineView from "@/components/TimelineView";
import TemplatesModal from "@/components/TemplatesModal";
import ShortcutHelp from "@/components/ShortcutHelp";
import { UndoToastContainer, useUndoDelete } from "@/components/UndoToast";
import { AnimatePresence, Reorder } from "framer-motion";
import { ChevronLeft, ChevronRight, CalendarDays, Target, MessageSquare, Bell, Copy, LayoutTemplate, AlignJustify, Clock, Keyboard } from "lucide-react";
import { todayStr, type PlanItem as PlanItemData } from "@gmd/shared";
import { cn } from "@/lib/cn";
import { useSwipe } from "@/hooks/useSwipe";
import { useQueryClient } from "@tanstack/react-query";
import { useCategories } from "@/hooks/useCategories";

function getDateStr(dateParam?: string): string {
  return dateParam || todayStr();
}

export default function DayView() {
  const { date: dateParam } = useParams();
  const date = getDateStr(dateParam);
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const getCatLabel = useCategoryLabel();
  const qc = useQueryClient();
  const { query, addTask, updateTask, deleteTask, addPlan, updatePlan, deletePlan, reorderPlan, addReminder, deleteReminder, addChecklist, updateChecklist, deleteChecklist } = useDayLog(date);
  const { allCategories } = useCategories();
  const [filterCat, setFilterCat] = useState<string>("all");
  const [pomodoroTask, setPomodoroTask] = useState<{ id: string; name: string } | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [copyingDay, setCopyingDay] = useState(false);

  const dayLog = query.data;
  const today = todayStr();
  const isToday = date === today;

  const filteredTasks = dayLog?.tasks.filter((t) => filterCat === "all" || t.category === filterCat) || [];
  const filteredPlan = dayLog?.plan
    .filter((p) => p.itemType !== "reminder" && (filterCat === "all" || p.category === filterCat))
    .sort((a, b) => a.order - b.order) || [];
  const filteredReminders = dayLog?.plan
    .filter((p) => p.itemType === "reminder")
    .sort((a, b) => (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? "")) || [];

  // Local drag state
  const [dragOrder, setDragOrder] = useState<PlanItemData[] | null>(null);
  const planIds = filteredPlan.map((p) => p.id).join();
  useEffect(() => { setDragOrder(null); }, [planIds]);
  const displayPlan = dragOrder ?? filteredPlan;

  // Undo delete
  const { deletePlanWithUndo, deleteTaskWithUndo, deleteReminderWithUndo } = useUndoDelete({
    onDeletePlan: (id) => deletePlan.mutate(id),
    onDeleteTask: (id) => deleteTask.mutate(id),
    onDeleteReminder: (id) => deletePlan.mutate(id),
  });

  const snapshotRef = useRef<typeof dayLog | undefined>(undefined);
  const handleDeletePlan = useCallback((id: string, description: string) => {
    snapshotRef.current = dayLog;
    deletePlanWithUndo(id, description, () => {
      if (snapshotRef.current) qc.setQueryData(["daylog", date], snapshotRef.current);
    });
    if (dayLog) qc.setQueryData(["daylog", date], { ...dayLog, plan: dayLog.plan.filter((p) => p.id !== id) });
  }, [dayLog, date, deletePlanWithUndo, qc]);

  const handleDeleteTask = useCallback((id: string, description: string) => {
    snapshotRef.current = dayLog;
    deleteTaskWithUndo(id, description, () => {
      if (snapshotRef.current) qc.setQueryData(["daylog", date], snapshotRef.current);
    });
    if (dayLog) qc.setQueryData(["daylog", date], { ...dayLog, tasks: dayLog.tasks.filter((t) => t.id !== id) });
  }, [dayLog, date, deleteTaskWithUndo, qc]);

  const handleDeleteReminder = useCallback((id: string, description: string) => {
    snapshotRef.current = dayLog;
    deleteReminderWithUndo(id, description, () => {
      if (snapshotRef.current) qc.setQueryData(["daylog", date], snapshotRef.current);
    });
    if (dayLog) qc.setQueryData(["daylog", date], { ...dayLog, plan: dayLog.plan.filter((p) => p.id !== id) });
  }, [dayLog, date, deleteReminderWithUndo, qc]);

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

  const handleCopyYesterday = async () => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    const fromDate = d.toISOString().split("T")[0];
    setCopyingDay(true);
    try {
      await api.copyDayPlans(date, fromDate);
      qc.invalidateQueries({ queryKey: ["daylog", date] });
    } finally {
      setCopyingDay(false);
    }
  };

  const shortcutHandlers = useMemo(() => ({
    onPlan: () => {
      const el = document.getElementById("input-plan");
      if (el) (el as HTMLInputElement).focus();
    },
    onNote: () => {
      const el = document.getElementById("input-task");
      if (el) (el as HTMLInputElement).focus();
    },
    onReminder: () => {
      const el = document.getElementById("input-reminder");
      if (el) (el as HTMLInputElement).focus();
    },
    onSearch: () => navigate("/search"),
    onHelp: () => setShowShortcutHelp((v) => !v),
  }), [navigate]);

  useKeyboardShortcuts(shortcutHandlers);

  const completedPlan = dayLog?.plan.filter((p) => p.itemType !== "reminder" && p.completed).length || 0;
  const totalPlan = dayLog?.plan.filter((p) => p.itemType !== "reminder").length || 0;
  const reminderCount = filteredReminders.length;
  const taskCount = dayLog?.tasks.length || 0;

  const displayDate = new Date(date + "T12:00:00");
  const dateLoc = locale === "tr" ? "tr-TR" : "en-US";

  return (
    <div className="space-y-3" {...swipeHandlers}>
      <UndoToastContainer />

      {/* Date header — compact */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={prevDay} className="btn btn-ghost p-2" aria-label={t("day.prevDay")}>
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[130px]">
            <h1 className="text-base font-semibold leading-tight">
              {isToday ? t("day.today") : displayDate.toLocaleDateString(dateLoc, { weekday: "long" })}
            </h1>
            <p className="text-xs text-text-secondary">
              {displayDate.toLocaleDateString(dateLoc, { month: "long", day: "numeric" })}
            </p>
          </div>
          <button onClick={nextDay} className="btn btn-ghost p-2" aria-label={t("day.nextDay")}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-0.5">
          <button onClick={() => setShowShortcutHelp(true)} className="btn btn-ghost p-2 text-text-tertiary hidden sm:flex" aria-label="Keyboard shortcuts">
            <Keyboard size={14} />
          </button>
          <button onClick={handleCopyYesterday} disabled={copyingDay} className="btn btn-ghost p-2 text-text-tertiary" title="Dunden kopyala">
            <Copy size={14} />
          </button>
          <button onClick={() => setShowTemplates(true)} className="btn btn-ghost px-2 py-1.5 text-text-tertiary text-[11px] gap-1" title="Şablonlar">
            <LayoutTemplate size={14} />
            <span className="hidden sm:inline">Şablon</span>
          </button>
          <StandupExport date={date} />
          {!isToday && (
            <button onClick={() => navigate("/")} className="btn btn-ghost text-xs" aria-label={t("day.goToday")}>
              <CalendarDays size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Inline progress bar — only when plans exist */}
      {totalPlan > 0 && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-300"
              style={{ width: `${(completedPlan / totalPlan) * 100}%` }}
            />
          </div>
          <span className="text-xs text-text-tertiary font-medium tabular-nums">{completedPlan}/{totalPlan}</span>
          {reminderCount > 0 && (
            <>
              <span className="text-text-tertiary">·</span>
              <span className="text-xs text-text-tertiary flex items-center gap-1"><Bell size={11} />{reminderCount}</span>
            </>
          )}
          {taskCount > 0 && (
            <>
              <span className="text-text-tertiary">·</span>
              <span className="text-xs text-text-tertiary flex items-center gap-1"><MessageSquare size={11} />{taskCount}</span>
            </>
          )}
        </div>
      )}

      {/* Category filter — compact pills */}
      {(taskCount > 0 || totalPlan > 0) && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1" role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={filterCat === "all"}
            onClick={() => setFilterCat("all")}
            className={cn(
              "px-2 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap",
              filterCat === "all"
                ? "bg-accent text-bg"
                : "text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary"
            )}
          >
            {t("day.all")}
          </button>
          {allCategories.map(({ key, label, isCustom }) => {
            const count = (dayLog?.tasks.filter((t) => t.category === key).length || 0) +
              (dayLog?.plan.filter((p) => p.itemType !== "reminder" && p.category === key).length || 0);
            if (count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={filterCat === key}
                onClick={() => setFilterCat(key)}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap",
                  filterCat === key
                    ? "bg-accent text-bg"
                    : "text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary"
                )}
              >
                {isCustom ? label : getCatLabel(key)} <span className="opacity-50">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Carry over banner */}
      <CarryOverBanner date={date} />

      {/* Pomodoro timer */}
      <AnimatePresence>
        {pomodoroTask && (
          <PomodoroTimer
            taskName={pomodoroTask.name}
            onComplete={(minutes) => {
              updatePlan.mutate({ id: pomodoroTask.id, completed: true, actualDuration: minutes });
            }}
            onClose={() => setPomodoroTask(null)}
          />
        )}
      </AnimatePresence>

      {/* Plan section */}
      <section>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
            <Target size={12} />
            {t("form.plan")}
          </span>
          <button
            onClick={() => setShowTimeline((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border",
              showTimeline
                ? "bg-accent text-bg border-accent"
                : "bg-bg-secondary text-text-secondary border-border hover:border-accent hover:text-accent"
            )}
          >
            {showTimeline ? <AlignJustify size={12} /> : <Clock size={12} />}
            {showTimeline ? "Liste" : "Zaman"}
          </button>
        </div>

        <TaskForm
          type="plan"
          loading={addPlan.isPending}
          onSubmit={(data) =>
            addPlan.mutate({
              ...data,
              itemType: data.itemType ?? "plan",
              priority: data.priority ?? "normal",
            })
          }
        />

        <AnimatePresence mode="wait">
          {showTimeline ? (
            <div className="mt-1.5">
              <TimelineView plans={filteredPlan} />
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={displayPlan}
              onReorder={setDragOrder}
              className="mt-1.5 space-y-1"
              as="div"
            >
              {displayPlan.map((item) => (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  as="div"
                  dragListener={!item.completed}
                  onDragEnd={() => {
                    if (dragOrder) reorderPlan.mutate(dragOrder.map((p) => p.id));
                  }}
                >
                  <PlanItem
                    item={item}
                    onToggle={(actualDuration) => updatePlan.mutate({
                      id: item.id,
                      completed: !item.completed,
                      ...(actualDuration !== undefined ? { actualDuration } : {}),
                    })}
                    onDelete={() => handleDeletePlan(item.id, item.description)}
                    onUpdate={(data) => updatePlan.mutate({ id: item.id, ...data })}
                    onStartPomodoro={() => setPomodoroTask({ id: item.id, name: item.description })}
                    onAddChecklist={(desc) => addChecklist.mutate({ planId: item.id, description: desc })}
                    onUpdateChecklist={(clId, data) => updateChecklist.mutate({ planId: item.id, clId, ...data })}
                    onDeleteChecklist={(clId) => deleteChecklist.mutate({ planId: item.id, clId })}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </AnimatePresence>

        {dayLog && filteredPlan.length === 0 && filterCat === "all" && (
          <p className="text-center py-4 text-xs text-text-tertiary">{t("day.noPlans")}</p>
        )}
      </section>

      {/* Reminders section */}
      <section>
        <TaskForm
          type="reminder"
          loading={addReminder.isPending}
          onSubmit={(data) => addReminder.mutate({ ...data, priority: data.priority ?? "normal" })}
        />
        <div className="mt-1.5 space-y-1">
          <AnimatePresence mode="popLayout">
            {filteredReminders.map((item) => (
              <ReminderItem
                key={item.id}
                item={item}
                onDelete={() => handleDeleteReminder(item.id, item.description)}
              />
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Notes section */}
      <section>
        <TaskForm
          type="task"
          loading={addTask.isPending}
          onSubmit={(data) => addTask.mutate(data)}
        />
        <div className="mt-1.5 space-y-1">
          <AnimatePresence mode="popLayout">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onDelete={() => handleDeleteTask(task.id, task.description)}
                onUpdate={(data) => updateTask.mutate({ id: task.id, ...data })}
              />
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Journal section */}
      {dayLog && <JournalSection date={date} />}

      {/* Loading state */}
      {query.isLoading && (
        <div className="space-y-2" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-3 bg-bg-tertiary rounded w-3/4 mb-1.5" />
              <div className="h-2.5 bg-bg-tertiary rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showTemplates && (
          <TemplatesModal
            date={date}
            currentPlans={dayLog?.plan || []}
            onClose={() => setShowTemplates(false)}
            onApplied={() => {
              qc.invalidateQueries({ queryKey: ["daylog", date] });
              setShowTemplates(false);
            }}
          />
        )}
        {showShortcutHelp && (
          <ShortcutHelp onClose={() => setShowShortcutHelp(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
