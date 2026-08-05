import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2, LayoutTemplate, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api, ApiError } from "@/lib/api";
import { showSuccessToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";
import type { PlanTemplate, PlanItem, CreateTemplateInput } from "@gmd/shared";
import { cn } from "@/lib/cn";

interface Props {
  date: string;
  currentPlans: PlanItem[];
  onClose: () => void;
  onApplied: () => void;
}

export default function TemplatesModal({ date, currentPlans, onClose, onApplied }: Props) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [newName, setNewName] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: () => api.getTemplates(),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api.deleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  const createTemplate = useMutation({
    mutationFn: (data: CreateTemplateInput) => api.createTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["templates"] });
      setNewName("");
      setSaving(false);
    },
    onError: () => setSaving(false),
  });

  const handleSaveToday = () => {
    if (!newName.trim()) return;
    const plans = currentPlans.filter((p) => p.itemType !== "reminder");
    if (plans.length === 0) return;
    setSaving(true);
    createTemplate.mutate({
      name: newName.trim(),
      items: plans.map((p) => ({
        description: p.description,
        category: p.category,
        duration: p.duration ?? undefined,
        scheduledTime: p.scheduledTime ?? undefined,
        priority: p.priority ?? "normal",
      })),
    });
  };

  const handleApply = async (template: PlanTemplate) => {
    setApplying(template.id);
    try {
      let skipped = 0;
      for (const item of template.items) {
        try {
          await api.addPlan(date, {
            description: item.description,
            category: item.category,
            duration: item.duration,
            scheduledTime: item.scheduledTime,
            itemType: "plan",
            priority: item.priority ?? "normal",
          });
        } catch (err) {
          // Zaten var olan satır şablonun geri kalanını durdurmasın (GMD-7).
          if (err instanceof ApiError && err.status === 409) { skipped++; continue; }
          throw err;
        }
      }
      const copied = template.items.length - skipped;
      if (copied === 0) showSuccessToast(t("copy.allDuplicates", { skipped }));
      else if (skipped > 0) showSuccessToast(t("copy.partial", { copied, skipped }));
      setApplied(template.id);
      setTimeout(() => setApplied(null), 1500);
      onApplied();
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        className="w-full max-w-md bg-bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={16} className="text-text-secondary" />
            <h2 className="text-sm font-semibold">Plan Sablonlari</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-tertiary hover:text-text rounded-lg hover:bg-bg-tertiary">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Save current day as template */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Bugunü Kaydet</p>
            <div className="flex gap-2">
              <input
                className="input flex-1 !text-sm"
                placeholder="Sablon adi..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveToday(); }}
              />
              <button
                onClick={handleSaveToday}
                disabled={saving || !newName.trim() || currentPlans.filter((p) => p.itemType !== "reminder").length === 0}
                className="btn btn-primary !px-3"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Templates list */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Sablonlar</p>
            {isLoading && (
              <div className="py-6 text-center text-sm text-text-tertiary">Yukleniyor...</div>
            )}
            {!isLoading && templates.length === 0 && (
              <div className="py-6 text-center">
                <LayoutTemplate size={24} className="mx-auto mb-2 text-text-tertiary opacity-40" />
                <p className="text-sm text-text-tertiary">Henuz sablon yok</p>
              </div>
            )}
            {templates.map((tmpl) => (
              <div key={tmpl.id} className="flex items-center gap-2 p-3 bg-bg-secondary rounded-xl border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{tmpl.name}</p>
                  <p className="text-xs text-text-tertiary">{tmpl.items.length} plan</p>
                </div>
                <button
                  onClick={() => handleApply(tmpl)}
                  disabled={applying === tmpl.id}
                  className={cn(
                    "btn !py-1.5 !px-3 text-xs",
                    applied === tmpl.id ? "bg-success text-bg" : "btn-primary"
                  )}
                >
                  {applied === tmpl.id ? <Check size={12} /> : applying === tmpl.id ? "..." : "Uygula"}
                </button>
                <button
                  onClick={() => deleteTemplate.mutate(tmpl.id)}
                  className="p-1.5 text-text-tertiary hover:text-danger hover:bg-danger-soft rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
