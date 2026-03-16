import { useReducer, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square, RotateCcw, Timer } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface Props {
  taskName?: string;
  onComplete?: (elapsedMinutes: number) => void;
  onClose: () => void;
}

type Phase = "work" | "break";

interface TimerState {
  phase: Phase;
  timeLeft: number;
  isRunning: boolean;
  totalWorked: number;
  workDuration: number;
  breakDuration: number;
}

type TimerAction =
  | { type: "tick" }
  | { type: "toggle" }
  | { type: "stop" }
  | { type: "reset" };

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case "tick": {
      if (!state.isRunning) return state;
      const next = state.timeLeft - 1;
      if (next <= 0) {
        navigator.vibrate?.([200, 100, 200]);
        if (state.phase === "work") {
          return {
            ...state,
            phase: "break",
            timeLeft: state.breakDuration,
            isRunning: false,
            totalWorked: state.totalWorked + state.timeLeft,
          };
        }
        return {
          ...state,
          phase: "work",
          timeLeft: state.workDuration,
          isRunning: false,
        };
      }
      return {
        ...state,
        timeLeft: next,
        totalWorked: state.phase === "work" ? state.totalWorked + 1 : state.totalWorked,
      };
    }
    case "toggle":
      return { ...state, isRunning: !state.isRunning };
    case "stop":
      return { ...state, isRunning: false };
    case "reset":
      return { ...state, phase: "work", timeLeft: state.workDuration, isRunning: false, totalWorked: 0 };
    default:
      return state;
  }
}

export default function PomodoroTimer({ taskName, onComplete, onClose }: Props) {
  const { t } = useI18n();
  const { profile } = useAuth();

  const workDuration = (profile?.pomodoroDuration ?? 25) * 60;
  const breakDuration = (profile?.breakDuration ?? 5) * 60;

  const [state, dispatch] = useReducer(timerReducer, {
    phase: "work",
    timeLeft: workDuration,
    isRunning: false,
    totalWorked: 0,
    workDuration,
    breakDuration,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!state.isRunning) {
      clearTimer();
      return;
    }
    intervalRef.current = setInterval(() => dispatch({ type: "tick" }), 1000);
    return clearTimer;
  }, [state.isRunning, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const duration = state.phase === "work" ? state.workDuration : state.breakDuration;
  const progress = 1 - state.timeLeft / duration;

  const handleStop = () => {
    dispatch({ type: "stop" });
    const workedMinutes = Math.round(state.totalWorked / 60);
    if (workedMinutes > 0 && onComplete) {
      onComplete(workedMinutes);
    }
    onClose();
  };

  const circumference = 2 * Math.PI * 45;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="card text-center space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer size={14} className="text-text-tertiary" />
          <span className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
            {t("pomo.title")}
          </span>
        </div>
        <span className={cn(
          "text-[10px] font-medium px-2 py-0.5 rounded-full",
          state.phase === "work"
            ? "bg-accent text-bg"
            : "bg-success/10 text-success"
        )}>
          {state.phase === "work" ? t("pomo.focus") : t("pomo.break")}
        </span>
      </div>

      {taskName && (
        <p className="text-sm font-medium truncate">{taskName}</p>
      )}

      {/* Circular progress */}
      <div className="relative w-32 h-32 mx-auto">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="var(--color-border)" strokeWidth="4" />
          <circle
            cx="50" cy="50" r="45" fill="none"
            stroke={state.phase === "work" ? "var(--color-accent)" : "var(--color-success)"}
            strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-mono font-bold tracking-wider">
            {formatTime(state.timeLeft)}
          </span>
        </div>
      </div>

      {/* Phase info */}
      <p className="text-xs text-text-tertiary">
        {state.phase === "work"
          ? `${profile?.pomodoroDuration ?? 25} ${t("profile.minutes" as any)}`
          : `${profile?.breakDuration ?? 5} ${t("profile.minutes" as any)}`}
      </p>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => dispatch({ type: "toggle" })}
          className="btn btn-primary !rounded-full !w-10 !h-10 !p-0"
          aria-label={state.isRunning ? t("pomo.pause") : t("pomo.start")}
        >
          {state.isRunning ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <button
          onClick={handleStop}
          className="btn btn-ghost !rounded-full !w-10 !h-10 !p-0"
          aria-label={t("pomo.stopSave")}
        >
          <Square size={14} />
        </button>
        <button
          onClick={() => dispatch({ type: "reset" })}
          className="btn btn-ghost !rounded-full !w-10 !h-10 !p-0"
          aria-label={t("pomo.reset")}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Elapsed */}
      {state.totalWorked > 0 && (
        <p className="text-xs text-text-tertiary">
          {t("pomo.totalFocused", { m: Math.floor(state.totalWorked / 60), s: state.totalWorked % 60 })}
        </p>
      )}
    </motion.div>
  );
}
