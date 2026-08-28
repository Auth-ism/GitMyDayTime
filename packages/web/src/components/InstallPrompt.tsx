import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "gmd-install-prompt-dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export default function InstallPrompt() {
  const { t } = useI18n();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch { /* storage can be unavailable in private browsing */ }

    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(userAgent);
    if (isIOS) setPlatform("ios");
    else if (isAndroid) setPlatform("android");

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => setDeferredPrompt(null);

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* noop */ }
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (dismissed || isStandalone() || (!deferredPrompt && !platform)) return null;

  const isSafari = platform === "ios" && !deferredPrompt;

  return (
    <div className="shrink-0 border-b border-border bg-bg-elevated px-3 py-2.5 sm:hidden">
      <div className="flex items-center gap-2.5">
        {isSafari ? <Share size={17} className="text-text-secondary shrink-0" /> : <Download size={17} className="text-text-secondary shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-text">{t("install.title" as any)}</p>
          <p className="text-[10px] leading-snug text-text-tertiary">
            {isSafari ? t("install.safari" as any) : deferredPrompt ? t("install.description" as any) : t("install.browser" as any)}
          </p>
        </div>
        {deferredPrompt && (
          <button onClick={install} className="shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-medium text-bg">
            {t("install.button" as any)}
          </button>
        )}
        <button onClick={dismiss} aria-label={t("install.dismiss" as any)} className="btn-icon p-1 rounded-lg shrink-0">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
