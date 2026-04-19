import { useState, useRef, useEffect } from "react";
import { Bell, Check, ExternalLink } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";

type Notification = {
  id: string;
  type: string;
  message: string;
  url: string | null;
  read: boolean;
  actorName: string | null;
  createdAt: string;
  projectId: string | null;
  issueId: string | null;
};

function relTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "şimdi";
  if (mins < 60) return `${mins}d`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}s`;
  return `${Math.floor(hours / 24)}g`;
}

const TYPE_ICON: Record<string, string> = {
  comment_mention: "💬",
  issue_assigned: "📋",
  issue_done: "✅",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => api.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const notifications: Notification[] = data?.notifications ?? [];
  const unread = data?.unread ?? 0;

  // Browser tab badge + title — unread counter across app icon / tab
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (unread > 0) {
      nav.setAppBadge?.(unread).catch(() => {});
    } else {
      nav.clearAppBadge?.().catch(() => {});
    }
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");
    document.title = unread > 0 ? `(${unread > 99 ? "99+" : unread}) ${baseTitle}` : baseTitle;
  }, [unread]);

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead.mutateAsync(n.id);
    setOpen(false);
    if (n.url) navigate(n.url);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "btn-icon p-2 rounded-lg relative",
          open && "bg-bg-subtle"
        )}
        aria-label="Bildirimler"
      >
        <Bell size={16} className={unread > 0 ? "text-accent" : "text-text-tertiary"} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-auto sm:top-full mt-2 sm:w-80 z-50 bg-bg-elevated border border-border rounded-xl shadow-xl overflow-hidden"
          style={{ maxHeight: "calc(100dvh - 80px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-xs font-semibold text-text">Bildirimler</span>
            {unread > 0 && (
              <button
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
              >
                <Check size={10} />
                Tümünü oku
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-xs text-text-tertiary italic text-center py-8">Bildirim yok</p>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-bg-subtle transition-colors border-b border-border/50 last:border-0",
                    !n.read && "bg-accent/5"
                  )}
                >
                  <span className="text-sm flex-shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs leading-snug", n.read ? "text-text-secondary" : "text-text font-medium")}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-text-tertiary mt-0.5">{relTime(n.createdAt)}</p>
                  </div>
                  {n.url && <ExternalLink size={10} className="flex-shrink-0 mt-1 text-text-tertiary" />}
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
