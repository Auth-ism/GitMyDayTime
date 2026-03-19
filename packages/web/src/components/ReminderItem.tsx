import { Bell, Trash2, Clock } from "lucide-react";
import type { PlanItem } from "@gmd/shared";
import { cn } from "@/lib/cn";

interface Props {
  item: PlanItem;
  onDelete: () => void;
}

export default function ReminderItem({ item, onDelete }: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
        item.notificationSent
          ? "bg-bg border-border opacity-60"
          : "bg-bg border-border"
      )}
    >
      <div className="flex items-center gap-1.5 shrink-0">
        <Bell size={14} className={cn(item.notificationSent ? "text-text-tertiary" : "text-accent")} />
        {item.scheduledTime && (
          <span className="text-xs font-semibold text-accent tabular-nums flex items-center gap-1">
            <Clock size={11} />
            {item.scheduledTime}
          </span>
        )}
      </div>

      <p className={cn(
        "flex-1 text-sm",
        item.notificationSent ? "text-text-tertiary line-through" : "text-text"
      )}>
        {item.description}
      </p>

      {item.notificationSent && (
        <span className="text-[10px] text-text-tertiary font-medium shrink-0">gönderildi</span>
      )}

      <button
        onClick={onDelete}
        className="shrink-0 p-1 rounded-md text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors"
        aria-label="Hatırlatıcıyı sil"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
