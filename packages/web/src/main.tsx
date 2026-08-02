import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ThemeProvider } from "@/lib/theme";
import { FontSizeProvider } from "@/lib/fontSize";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import ErrorBoundary from "@/components/ErrorBoundary";
import App from "@/App";
import { showErrorToast } from "@/components/Toast";
import "./index.css";

const standaloneMode = window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
document.documentElement.dataset.appMode = standaloneMode ? "standalone" : "browser";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Bir hata oluştu";
      // Skip 401 — api.ts already redirects to /login
      if (msg.startsWith("API error: 401")) return;
      showErrorToast(msg);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof Error && /429|401/.test(error.message)) return false;
        return failureCount < 1;
      },
    },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <I18nProvider>
            <ThemeProvider>
            <FontSizeProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </FontSizeProvider>
            </ThemeProvider>
          </I18nProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);

import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });
