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
import { ChevronLeft, ChevronRight, CalendarDays, Target, MessageSquare, Bell, Filter, Copy, LayoutTemplate, AlignJustify, Clock, Keyboard } from "lucide-react";
import { DEFAULT_CATEGORIES, todayStr, type PlanItem as PlanItemData } from "@gmd/shared";
import { cn } from "@/lib/cn";
import { useSwipe } from "@/hooks/useSwipe";
import { useQueryClient } from "@tanstack/react-query";

function getDateStr(dateParam?: string): string {
  return dateParam || todayStr();
}

const categories = [...DEFAULT_CATEGORIES];

export default function DayView() {
  const { date: dateParam } = useParams();
  const date = getDateStr(dateParam);
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const getCatLabel = useCategoryLabel();
  const qc = useQueryClient();
  const { query, addTask, updateTask, deleteTask, addPlan, updatePlan, deletePlan, reorderPlan, addReminder, deleteReminder, addChecklist, updateChecklist, deleteChecklist } = useDayLog(date);
  const [filterCat, setFilterCat] = useState<string>("all");
  const [pomodoroTask, setPomodoroTask] = useState<{ id: string; name: string } | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [copyingDay, setCopyingDay] = useState(false);

  // Refs for focusing form inputs via shortcuts
  const planInputRef = useRef<HTMLInputElement | null>(null);
  const noteInputRef = useRef<HTMLInputElement | null>(null);
  const reminderInputRef = useRef<HTMLInputElement | null>(null);

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

  // Snapshot for undo restore
  const snapshotRef = useRef<typeof dayLog | undefined>(undefined);
  const handleDeletePlan = useCallback((id: string, description: string) => {
    snapshotRef.current = dayLog;
    deletePlanWithUndo(id, description, () => {
      if (snapshotRef.current) {
        qc.setQueryData(["daylog", date], snapshotRef.current);
      }
    });
    // Optimistic
    if (dayLog) {
      qc.setQueryData(["daylog", date], { ...dayLog, plan: dayLog.plan.filter((p) => p.id !== id) });
    }
  }, [dayLog, date, deletePlanWithUndo, qc]);

  const handleDeleteTask = useCallback((id: string, description: string) => {
    snapshotRef.current = dayLog;
    deleteTaskWithUndo(id, description, () => {
      if (snapshotRef.current) {
        qc.setQueryData(["daylog", date], snapshotRef.current);
      }
    });
    if (dayLog) {
      qc.setQueryData(["daylog", date], { ...dayLog, tasks: dayLog.tasks.filter((t) => t.id !== id) });
    }
  }, [dayLog, date, deleteTaskWithUndo, qc]);

  const handleDeleteReminder = useCallback((id: string, description: string) => {
    snapshotRef.current = dayLog;
    deleteReminderWithUndo(id, description, () => {
      if (snapshotRef.current) {
        qc.setQueryData(["daylog", date], snapshotRef.current);
      }
    });
    if (dayLog) {
      qc.setQueryData(["daylog", date], { ...dayLog, plan: dayLog.plan.filter((p) => p.id !== id) });
    }
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
    <div className="space-y-5" {...swipeHandlers}>
      <UndoToastContainer />

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

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowShortcutHelp(true)}
            className="btn btn-ghost p-2 text-text-tertiary"
            aria-label="Keyboard shortcuts"
            title="Klavye kisayollari (?)"
          >
            <Keyboard size={15} />
          </button>
          <button
            onClick={handleCopyYesterday}
            disabled={copyingDay}
            className="btn btn-ghost p-2 text-text-tertiary"
            aria-label="Dunden kopyala"
            title="Dunden kopyala"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={() => setShowTemplates(true)}
            className="btn btn-ghost p-2 text-text-tertiary"
            aria-label="Sablonlar"
            title="Plan sablonlari"
          >
            <LayoutTemplate size={15} />
          </button>
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
      {(taskCount > 0 || totalPlan > 0 || reminderCount > 0) && (
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
          {reminderCount > 0 && (
            <div className="flex-1 card !py-3 flex items-center gap-3">
              <Bell size={16} className="text-accent flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">{reminderCount}</p>
                <p className="text-xs text-text-secondary">{t("reminder.title" as any)}</p>
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
      {(taskCount > 0 || totalPlan > 0 || reminderCount > 0) && (
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
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
            <Target size={13} />
            Planlar
          </span>
          <button
            onClick={() => setShowTimeline((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border",
              showTimeline
                ? "border-accent bg-accent-soft text-text"
                : "border-border text-text-secondary hover:border-border-hover"
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
          } />

        <AnimatePresence mode="wait">
          {showTimeline ? (
            <div className="mt-2">
              <TimelineView plans={filteredPlan} />
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={displayPlan}
              onReorder={setDragOrder}
              className="mt-2 space-y-1.5"
              as="div"
            >
              {displayPlan.map((item) => (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  as="div"
                  dragListener={!item.completed}
                  onDragEnd={() => {
                    if (dragOrder) {
                      reorderPlan.mutate(dragOrder.map((p) => p.id));
                    }
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
          <div className="text-center py-6 text-text-tertiary">
            <Target size={24} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">{t("day.noPlans")}</p>
            <p className="text-xs mt-0.5">{t("day.noPlansDesc")}</p>
          </div>
        )}
      </section>

      {/* Reminders section */}
      <section aria-labelledby="reminders-heading">
        <TaskForm
          type="reminder"
          loading={addReminder.isPending}
          onSubmit={(data) => addReminder.mutate({ ...data, priority: data.priority ?? "normal" })}
        />
        <div className="mt-2 space-y-1.5">
          <AnimatePresence mode="popLayout">
            {filteredReminders.map((item) => (
              <ReminderItem
                key={item.id}
                item={item}
                onDelete={() => handleDeleteReminder(item.id, item.description)}
              />
            ))}
          </AnimatePresence>
          {dayLog && filteredReminders.length === 0 && (
            <div className="text-center py-4 text-text-tertiary">
              <Bell size={20} className="mx-auto mb-1.5 opacity-30" />
              <p className="text-xs">{t("reminder.empty" as any)}</p>
            </div>
          )}
        </div>
      </section>

      {/* Notes section */}
      <section aria-labelledby="notes-heading">
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
                onDelete={() => handleDeleteTask(task.id, task.description)}
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

      {/* Journal section */}
      {dayLog && <JournalSection date={date} />}

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
