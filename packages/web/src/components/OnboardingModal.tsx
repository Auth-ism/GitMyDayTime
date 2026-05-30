import { useState } from "react";
import { Clock, CalendarDays, BarChart3, Search, X, ChevronRight, ChevronLeft, Tag } from "lucide-react";
import { DEFAULT_CATEGORIES, CATEGORY_COLORS, type Category } from "@gmd/shared";
import { useCategoryLabel } from "@/lib/i18n";
import { cn } from "@/lib/cn";

const STEPS = [
  {
    icon: Clock,
    color: "text-accent",
    bg: "bg-accent/10",
    title: "Bugün",
    desc: "Her gün yapmak istediklerini buraya ekle. Görevleri tamamlayıp süre kayıt edebilir, notlar alabilirsin. Pomodoro zamanlayıcısı da dahil.",
  },
  {
    icon: CalendarDays,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    title: "Hafta",
    desc: "Tüm haftana tek ekranda bak. Günler arası taşı, geçmiş günleri gözden geçir.",
  },
  {
    icon: BarChart3,
    color: "text-green-400",
    bg: "bg-green-400/10",
    title: "İstatistikler",
    desc: "Üretkenliğini ölç. Kategori dağılımı, tamamlama oranı, seri (streak) ve zaman içindeki aktiviten.",
  },
  {
    icon: Search,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    title: "Arama",
    desc: "Tüm günlerdeki plan ve notlarında ara. Geçmişte ne yaptığını kolayca bul.",
  },
  {
    icon: Tag,
    color: "text-pink-400",
    bg: "bg-pink-400/10",
    title: "Kategoriler",
    desc: "Hangi default kategorileri kullanmak istersin? İhtiyacın olmayanları kapat — istediğin zaman profilinden tekrar açabilirsin. Kendi kategorilerini de istediğin gibi ekleyebilirsin.",
    isCategoryStep: true as const,
  },
];

interface Props {
  // Resolves with the list of category keys the user opted out of (empty array = keep all).
  onClose: (hiddenCategories?: string[]) => void;
}

export default function OnboardingModal({ onClose }: Props) {
  const getCatLabel = useCategoryLabel();
  const [step, setStep] = useState(0);
  // All defaults selected by default → user deselects ones they don't want.
  const [selectedDefaults, setSelectedDefaults] = useState<string[]>(DEFAULT_CATEGORIES as unknown as string[]);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const isCategoryStep = "isCategoryStep" in current && current.isCategoryStep;

  const toggleDefault = (key: string) => {
    setSelectedDefaults(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const finish = () => {
    const hidden = (DEFAULT_CATEGORIES as unknown as string[]).filter(k => !selectedDefaults.includes(k));
    onClose(hidden);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/85 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-sm shadow-xl space-y-5">
        {/* Close */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest">
            Hoş Geldin — {step + 1}/{STEPS.length}
          </p>
          <button onClick={finish} className="btn-icon p-1 rounded-lg text-text-tertiary hover:text-text">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="text-center space-y-3 py-2">
          <div className={`w-14 h-14 rounded-2xl ${current.bg} flex items-center justify-center mx-auto`}>
            <Icon size={28} className={current.color} />
          </div>
          <h2 className="font-bold text-text text-lg">{current.title}</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{current.desc}</p>
        </div>

        {isCategoryStep && (
          <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto px-1">
            {(DEFAULT_CATEGORIES as unknown as string[]).map((key) => {
              const isOn = selectedDefaults.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDefault(key)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-2 rounded-md text-xs font-medium border transition-colors text-left",
                    isOn
                      ? "border-accent bg-accent/10 text-text"
                      : "border-border bg-bg-secondary text-text-tertiary hover:text-text-secondary"
                  )}
                >
                  <span
                    className={cn("w-2.5 h-2.5 rounded-full shrink-0", !isOn && "opacity-50")}
                    style={{ backgroundColor: CATEGORY_COLORS[key as Category] }}
                  />
                  <span className={cn("flex-1 truncate", !isOn && "line-through")}>{getCatLabel(key)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`rounded-full transition-all ${i === step ? "w-5 h-1.5 bg-accent" : "w-1.5 h-1.5 bg-border hover:bg-text-tertiary"}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-2">
          {step > 0 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="btn-secondary flex items-center gap-1 px-3 py-2 text-xs"
            >
              <ChevronLeft size={13} />
              Geri
            </button>
          ) : (
            <button onClick={finish} className="btn-secondary px-3 py-2 text-xs">
              Atla
            </button>
          )}
          <button
            onClick={isLast ? finish : () => setStep(s => s + 1)}
            className="btn-primary flex-1 flex items-center justify-center gap-1 py-2 text-xs"
          >
            {isLast ? "Başlayalım!" : (
              <>İleri <ChevronRight size={13} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
