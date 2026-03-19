import { motion } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "p", desc: "Plan ekle" },
  { key: "n", desc: "Not ekle" },
  { key: "r", desc: "Hatirlatici ekle" },
  { key: "/", desc: "Arama" },
  { key: "?", desc: "Bu ekrani goster" },
];

export default function ShortcutHelp({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xs bg-bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard size={15} className="text-text-secondary" />
            <h2 className="text-sm font-semibold">Klavye Kisayollari</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-text-tertiary hover:text-text rounded-lg hover:bg-bg-tertiary">
            <X size={15} />
          </button>
        </div>
        <div className="p-4 space-y-2">
          {SHORTCUTS.map(({ key, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{desc}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded-md text-text-tertiary">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
