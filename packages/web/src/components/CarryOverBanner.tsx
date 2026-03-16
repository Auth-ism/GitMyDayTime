import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { todayStr } from "@gmd/shared";
import { useI18n } from "@/lib/i18n";
import { ArrowRight, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

interface Props {
  date: string;
}

export default function CarryOverBanner({ date }: Props) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(false);
  const today = todayStr();

  const { data: items } = useQuery({
    queryKey: ["carryover", date],
    queryFn: () => api.getCarryOver(date),
    enabled: date === today && !dismissed,
    staleTime: 60_000,
  });

  const carryOver = useMutation({
    mutationFn: () => api.doCarryOver(date),
    onSuccess: () => {
      const d = new Date(date + "T12:00:00");
      d.setDate(d.getDate() - 1);
      const yesterday = d.toISOString().split("T")[0];
      qc.invalidateQueries({ queryKey: ["daylog", date] });
      qc.invalidateQueries({ queryKey: ["daylog", yesterday] });
      qc.invalidateQueries({ queryKey: ["carryover", date] });
    },
  });

  const count = items?.length || 0;
  if (count === 0 || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="card !py-3 flex items-center gap-3 border-accent/30 bg-accent-soft/10"
      >
        <AlertTriangle size={16} className="text-accent flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {t("carry.incomplete", { count, s: count !== 1 ? "s" : "" })}
          </p>
          <p className="text-xs text-text-secondary mt-0.5 truncate">
            {items!.slice(0, 3).map((i) => i.description).join(", ")}
            {count > 3 && "..."}
          </p>
        </div>
        <button
          onClick={() => carryOver.mutate()}
          disabled={carryOver.isPending}
          className="btn btn-primary !py-1.5 !px-3 text-xs flex-shrink-0"
        >
          {carryOver.isPending ? t("carry.moving") : (
            <>
              {t("carry.carryOver")} <ArrowRight size={12} />
            </>
          )}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="btn-icon p-1 text-text-tertiary"
          aria-label={t("carry.dismiss")}
        >
          <X size={14} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
