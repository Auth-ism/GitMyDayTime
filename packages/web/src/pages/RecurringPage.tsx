import { useState } from "react";
import { useRecurringTasks } from "@/hooks/useRecurringTasks";
import { useCategories } from "@/hooks/useCategories";
import { useI18n, useCategoryLabel, useDayLabels, useRecurrenceLabel } from "@/lib/i18n";
import { type RecurrencePattern, type CreateRecurringTaskInput } from "@gmd/shared";
import { cn } from "@/lib/cn";
import { Plus, Trash2, Repeat, Power, Clock, Timer } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
const recurrenceKeys: RecurrencePattern[] = ["daily", "weekdays", "weekly", "custom"];

const QUICK_DURATIONS = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h", value: 120 },
];

export default function RecurringPage() {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const dayLabels = useDayLabels();
  const getRecLabel = useRecurrenceLabel();
  const { query, create, update, remove } = useRecurringTasks();
  const { allCategories, createCategory } = useCategories();
  const [showForm, setShowForm] = useState(false);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState("dev");
  const [recurrence, setRecurrence] = useState<RecurrencePattern>("daily");
  const [weekDay, setWeekDay] = useState(1);
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [time, setTime] = useState("");
  const [durMinutes, setDurMinutes] = useState<number | null>(null);

  const resetForm = () => {
    setDesc("");
    setCat("dev");
    setRecurrence("daily");
    setWeekDay(1);
    setCustomDays([]);
    setTime("");
    setDurMinutes(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim()) return;

    const data: CreateRecurringTaskInput = {
      description: desc.trim(),
      category: cat,
      recurrence,
      ...(durMinutes ? { duration: durMinutes } : {}),
      ...(time ? { scheduledTime: time } : {}),
      ...(recurrence === "weekly" ? { weekDay } : {}),
      ...(recurrence === "custom" ? { customDays } : {}),
    };

    create.mutate(data, {
      onSuccess: () => {
        resetForm();
        setShowForm(false);
      },
    });
  };

  const toggleDay = (day: number) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const tasks = query.data || [];
  const activeTasks = tasks.filter((t) => t.active);
  const inactiveTasks = tasks.filter((t) => !t.active);

  return (
    <div className="space-y-5">
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Repeat size={18} className="text-accent" />
          <div>
            <h1 className="text-lg font-semibold">{t("recurring.title")}</h1>
            <p className="text-xs text-text-secondary">{t("recurring.desc")}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          <Plus size={16} />
          <span className="hidden sm:inline">{t("form.add")}</span>
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="card space-y-3 overflow-hidden"
          >
            <input
              className="input"
              placeholder={t("recurring.taskDesc")}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              autoFocus
            />

            <div className="flex flex-wrap gap-1.5 items-center">
              {allCategories.map(({ key, label, isCustom }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCat(key)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                    cat === key
                      ? "bg-accent text-bg shadow-sm"
                      : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-transparent hover:border-border"
                  )}
                >
                  {isCustom ? label : getCatLabel(key)}
                </button>
              ))}
              {showNewCat ? (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (newCatName.trim()) {
                      createCategory.mutate({ name: newCatName.trim(), color: "#6b7280" });
                      setNewCatName("");
                      setShowNewCat(false);
                    }
                  }}
                >
                  <input
                    autoFocus
                    className="input !w-24 !text-xs !py-1 !px-2"
                    placeholder="Kategori..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onBlur={() => { if (!newCatName.trim()) setShowNewCat(false); }}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewCat(true)}
                  className="px-2 py-1.5 rounded-lg text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary border border-transparent hover:border-border transition-all"
                  title="Yeni kategori ekle"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-text-tertiary">{t("recurring.repeat")}</span>
              <div className="flex flex-wrap gap-1.5">
                {recurrenceKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRecurrence(key)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      recurrence === key
                        ? "bg-accent text-bg shadow-sm"
                        : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-transparent hover:border-border"
                    )}
                  >
                    {getRecLabel(key)}
                  </button>
                ))}
              </div>
            </div>

            {recurrence === "weekly" && (
              <div className="flex gap-1.5">
                {dayLabels.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWeekDay(i)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-xs font-medium transition-all",
                      weekDay === i
                        ? "bg-accent text-bg shadow-sm"
                        : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-transparent hover:border-border"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {recurrence === "custom" && (
              <div className="flex gap-1.5">
                {dayLabels.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      "w-10 h-10 rounded-lg text-xs font-medium transition-all",
                      customDays.includes(i)
                        ? "bg-accent text-bg shadow-sm"
                        : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-transparent hover:border-border"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-text-tertiary flex-shrink-0" />
                <span className="text-xs text-text-tertiary">{t("form.start")}</span>
                <input
                  type="time"
                  className="input !w-[7.5rem] !text-sm !py-1.5"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Timer size={14} className="text-text-tertiary flex-shrink-0" />
                <span className="text-xs text-text-tertiary">{t("form.duration")}</span>
                {QUICK_DURATIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDurMinutes(durMinutes === value ? null : value)}
                    className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium transition-all",
                      durMinutes === value
                        ? "bg-accent text-bg"
                        : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary border border-transparent hover:border-border"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={!desc.trim() || create.isPending}
                className="btn btn-primary"
              >
                <Plus size={16} />
                {t("recurring.create")}
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
                className="btn btn-ghost"
              >
                {t("recurring.cancel")}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {activeTasks.map((task) => (
            <RecurringTaskCard
              key={task.id}
              task={task}
              onToggle={() => update.mutate({ id: task.id, active: false })}
              onDelete={() => remove.mutate(task.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {activeTasks.length === 0 && !showForm && (
        <div className="text-center py-10 text-text-tertiary">
          <Repeat size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("recurring.noTasks")}</p>
          <p className="text-xs mt-0.5">{t("recurring.noTasksDesc")}</p>
        </div>
      )}

      {inactiveTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider px-1">
            {t("recurring.paused")}
          </p>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {inactiveTasks.map((task) => (
                <RecurringTaskCard
                  key={task.id}
                  task={task}
                  onToggle={() => update.mutate({ id: task.id, active: true })}
                  onDelete={() => remove.mutate(task.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {query.isLoading && (
        <div className="space-y-3" aria-busy="true">
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

function RecurringTaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: import("@gmd/shared").RecurringTask;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const getCatLabel = useCategoryLabel();
  const { getCategoryLabel } = useCategories();
  const dayLabels = useDayLabels();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const scheduleText = (() => {
    switch (task.recurrence) {
      case "daily": return t("recurring.everyDay");
      case "weekdays": return t("recurring.weekdays");
      case "weekly": return t("recurring.every", { day: dayLabels[task.weekDay ?? 0] });
      case "custom": return (task.customDays || []).map((d) => dayLabels[d]).join(", ");
      default: return "";
    }
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn("card flex items-center gap-3", !task.active && "opacity-50")}
    >
      <button
        onClick={onToggle}
        className={cn(
          "p-1.5 rounded-lg transition-colors",
          task.active
            ? "text-success hover:text-amber-500 hover:bg-amber-500/10"
            : "text-text-tertiary hover:text-success hover:bg-success/10"
        )}
        aria-label={task.active ? t("recurring.pause") : t("recurring.resume")}
      >
        <Power size={16} />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.description}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs px-1.5 py-0.5 rounded bg-bg-secondary text-text-secondary">
            {(() => {
              const custom = getCategoryLabel(task.category);
              return custom !== task.category ? custom : getCatLabel(task.category);
            })()}
          </span>
          <span className="text-xs text-text-tertiary">{scheduleText}</span>
          {task.scheduledTime && (
            <span className="text-xs text-text-tertiary">{task.scheduledTime}</span>
          )}
          {task.duration && (
            <span className="text-xs text-text-tertiary">{task.duration}m</span>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          if (confirmDelete) onDelete();
          else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
          }
        }}
        className={cn(
          "p-1.5 rounded-lg transition-colors",
          confirmDelete
            ? "text-danger bg-danger/10"
            : "text-text-tertiary hover:text-danger hover:bg-danger/10"
        )}
        aria-label={t("recurring.delete")}
      >
        <Trash2 size={16} />
      </button>
    </motion.div>
  );
}
