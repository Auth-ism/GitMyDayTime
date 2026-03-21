import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Reads locale from localStorage to avoid React hook dependency in class component
function getErrorText() {
  const locale = typeof localStorage !== "undefined" ? localStorage.getItem("gmd-locale") : null;
  const isTr = !locale || locale === "tr";
  return {
    title: isTr ? "Bir sorun oluştu" : "Something went wrong",
    desc: isTr ? "Beklenmeyen bir hata oluştu" : "An unexpected error occurred",
    refresh: isTr ? "Sayfayı yenile" : "Refresh page",
  };
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const txt = getErrorText();
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-danger-soft flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-danger" />
          </div>
          <h1 className="text-lg font-semibold text-text mb-1">{txt.title}</h1>
          <p className="text-sm text-text-secondary mb-6">{txt.desc}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            {txt.refresh}
          </button>
        </div>
      </div>
    );
  }
}
