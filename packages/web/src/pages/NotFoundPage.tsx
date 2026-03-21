import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { Home } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const stars = useMemo(
    () =>
      Array.from({ length: 50 }, () => ({
        w: Math.random() > 0.85 ? 2 : 1,
        x: Math.random() * 100,
        y: Math.random() * 100,
        o: 0.1 + Math.random() * 0.25,
        d: 2 + Math.random() * 4,
        dl: Math.random() * 3,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 bg-bg flex items-center justify-center overflow-hidden">
      {/* Star field */}
      <div className="absolute inset-0">
        {stars.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-text"
            style={{
              width: s.w,
              height: s.w,
              left: `${s.x}%`,
              top: `${s.y}%`,
              opacity: s.o,
              animation: `twinkle ${s.d}s ease-in-out infinite ${s.dl}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center px-6">
        {/* 404 with black hole as "0" */}
        <div className="flex items-center justify-center gap-1 sm:gap-3 mb-8 select-none">
          <span className="text-[80px] sm:text-[140px] font-black tracking-tighter text-text opacity-15 leading-none">
            4
          </span>

          {/* Black hole "0" */}
          <div className="relative w-[80px] h-[80px] sm:w-[140px] sm:h-[140px] flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, transparent 35%, rgba(99,102,241,.08) 50%, transparent 70%)",
                animation: "pulseGlow 4s ease-in-out infinite",
              }}
            />
            <div
              className="absolute rounded-full border border-text/[.06]"
              style={{ width: "100%", height: "100%", animation: "spinSlow 20s linear infinite" }}
            />
            <div
              className="absolute rounded-full border border-text/[.1]"
              style={{ width: "80%", height: "80%", animation: "spinSlow 14s linear infinite reverse" }}
            />
            <div
              className="absolute rounded-full border border-text/[.15]"
              style={{ width: "60%", height: "60%", animation: "spinSlow 9s linear infinite" }}
            />
            <div
              className="absolute rounded-full bg-bg"
              style={{
                width: "38%",
                height: "38%",
                boxShadow: "0 0 40px 15px rgba(0,0,0,.8), 0 0 80px 30px rgba(0,0,0,.4)",
              }}
            />
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <div
                key={i}
                className="absolute w-full h-full"
                style={{ animation: `spinSlow ${10 + i * 2}s linear infinite${i % 2 ? " reverse" : ""}` }}
              >
                <div
                  className="absolute w-1 h-1 rounded-full bg-text"
                  style={{ top: "8%", left: "50%", opacity: 0.15 + (i % 3) * 0.08, transform: `rotate(${deg}deg)` }}
                />
              </div>
            ))}
            <div
              className="absolute rounded-full"
              style={{
                width: "90%",
                height: "90%",
                background: "conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,.03) 25%, transparent 50%, rgba(255,255,255,.02) 75%, transparent 100%)",
                animation: "spinSlow 25s linear infinite",
              }}
            />
          </div>

          <span className="text-[80px] sm:text-[140px] font-black tracking-tighter text-text opacity-15 leading-none">
            4
          </span>
        </div>

        <h1 className="text-lg sm:text-xl font-semibold text-text mb-2">
          {t("notfound.title" as any)}
        </h1>
        <p className="text-sm text-text-secondary mb-8 text-center max-w-xs">
          {t("notfound.desc" as any)}
        </p>

        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-bg text-sm font-medium transition-all hover:opacity-90 active:scale-[.97]"
        >
          <Home size={15} />
          {t("notfound.home" as any)}
        </button>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.4; }
        }
        @keyframes spinSlow {
          to { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: .6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
