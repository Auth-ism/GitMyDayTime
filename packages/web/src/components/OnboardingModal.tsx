import { useState } from "react";
import { Clock, CalendarDays, Layers, BarChart3, Search, X, ChevronRight, ChevronLeft } from "lucide-react";

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
    icon: Layers,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    title: "Projeler",
    desc: "Jira benzeri proje yönetimi. Kanban board, sprint'ler, issue'lar ve takım üyeleri. Görevleri kişisel planına da ekleyebilirsin.",
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
];

interface Props {
  onClose: () => void;
}

export default function OnboardingModal({ onClose }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const finish = () => {
    onClose();
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
