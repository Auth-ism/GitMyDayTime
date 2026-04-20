import { useEffect } from "react";
import { motion } from "framer-motion";
import { X, Keyboard } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface Props {
  onClose: () => void;
}

interface ShortcutEntry {
  keys: string[];
  labelKey: string;
}

interface ShortcutSection {
  titleKey: string;
  items: ShortcutEntry[];
}

const SECTIONS: ShortcutSection[] = [
  {
    titleKey: "shortcut.sectionActions",
    items: [
      { keys: ["p"], labelKey: "shortcut.plan" },
      { keys: ["n"], labelKey: "shortcut.note" },
      { keys: ["r"], labelKey: "shortcut.reminder" },
    ],
  },
  {
    titleKey: "shortcut.sectionNavigation",
    items: [
      { keys: ["/"], labelKey: "shortcut.search" },
      { keys: ["Ctrl", "K"], labelKey: "shortcut.palette" },
    ],
  },
  {
    titleKey: "shortcut.sectionGeneral",
    items: [
      { keys: ["?"], labelKey: "shortcut.showHelp" },
      { keys: ["Esc"], labelKey: "shortcut.closeModal" },
    ],
  },
];

export default function ShortcutHelp({ onClose }: Props) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcut-help-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard size={15} className="text-text-secondary" />
            <h2 id="shortcut-help-title" className="text-sm font-semibold">
              {t("shortcuts.title" as any)}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("edit.cancel" as any)}
            className="p-1.5 text-text-tertiary hover:text-text rounded-lg hover:bg-bg-tertiary"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.titleKey}>
              <div className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mb-1.5">
                {t(section.titleKey as any)}
              </div>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div key={item.labelKey} className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{t(item.labelKey as any)}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 text-[11px] font-mono bg-bg-secondary border border-border rounded-md text-text-tertiary min-w-[24px] text-center"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
