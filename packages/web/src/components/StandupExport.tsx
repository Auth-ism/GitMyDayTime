import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Copy, Check, ClipboardList, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  date: string;
}

export default function StandupExport({ date }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const yesterday = (() => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  const { data: yesterdayLog } = useQuery({
    queryKey: ["daylog", yesterday],
    queryFn: () => api.getDayLog(yesterday),
    enabled: open,
  });

  const { data: todayLog } = useQuery({
    queryKey: ["daylog", date],
    queryFn: () => api.getDayLog(date),
    enabled: open,
  });

  const standupText = useMemo(() => {
    const lines: string[] = [];

    const completedYesterday = yesterdayLog?.plan.filter((p) => p.completed) || [];
    const incompletedYesterday = yesterdayLog?.plan.filter((p) => !p.completed) || [];

    lines.push(`**${t("standup.yesterday")}**`);
    if (completedYesterday.length > 0) {
      completedYesterday.forEach((p) => lines.push(`  - ${p.description}`));
    } else {
      lines.push(`  - ${t("standup.nothingCompleted")}`);
    }

    const todayPlans = todayLog?.plan || [];
    lines.push("");
    lines.push(`**${t("standup.today")}**`);
    if (todayPlans.length > 0) {
      todayPlans.forEach((p) => lines.push(`  - ${p.description}`));
    } else {
      lines.push(`  - ${t("standup.noPlans")}`);
    }

    if (incompletedYesterday.length > 0) {
      lines.push("");
      lines.push(`**${t("standup.blockers")}**`);
      incompletedYesterday.forEach((p) => lines.push(`  - ${p.description}`));
    }

    return lines.join("\n");
  }, [yesterdayLog, todayLog, t]);

  const handleCopy = async () => {
    const plain = standupText.replace(/\*\*/g, "");
    await navigator.clipboard.writeText(plain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn btn-ghost text-xs"
        aria-label={t("standup.btn")}
      >
        <ClipboardList size={14} />
        <span className="hidden sm:inline">{t("standup.btn")}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card w-full max-w-md max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList size={16} />
                  {t("standup.title")}
                </h2>
                <button onClick={() => setOpen(false)} className="btn-icon p-1">
                  <X size={16} />
                </button>
              </div>

              <pre className="text-sm whitespace-pre-wrap bg-bg-secondary rounded-lg p-3 border border-border text-text-secondary leading-relaxed">
                {standupText}
              </pre>

              <button
                onClick={handleCopy}
                className="btn btn-primary w-full mt-3 !py-2.5"
              >
                {copied ? (
                  <>
                    <Check size={14} /> {t("standup.copied")}
                  </>
                ) : (
                  <>
                    <Copy size={14} /> {t("standup.copy")}
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
