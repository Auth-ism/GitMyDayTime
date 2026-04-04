import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

type State = "loading" | "success" | "already" | "error";

export default function ProjectJoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>("loading");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("error"); setErrorMsg("Geçersiz davet bağlantısı."); return; }

    api.joinProject(token)
      .then(data => {
        setProjectId(data.projectId);
        setProjectName(data.projectName);
        setState("success");
        setTimeout(() => navigate(`/projects/${data.projectId}/board`), 2000);
      })
      .catch((err: Error) => {
        const msg = err.message || "Davet kabul edilemedi.";
        setErrorMsg(msg);
        setState(msg.toLowerCase().includes("zaten") ? "already" : "error");
      });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="card p-8 max-w-sm w-full text-center space-y-4">
        {state === "loading" && (
          <>
            <Loader2 size={36} className="text-accent animate-spin mx-auto" />
            <p className="text-sm text-text-secondary">Davet işleniyor...</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle2 size={36} className="text-green-400 mx-auto" />
            <div>
              <p className="font-semibold text-text text-base">Projeye katıldınız!</p>
              <p className="text-sm text-text-secondary mt-1">
                <span className="font-medium text-accent">{projectName}</span> projesine başarıyla eklendi.
              </p>
            </div>
            <p className="text-xs text-text-tertiary">Yönlendiriliyor...</p>
            <button
              onClick={() => navigate(`/projects/${projectId}/board`)}
              className="btn-primary w-full py-2 text-sm"
            >
              Projeye Git
            </button>
          </>
        )}

        {state === "already" && (
          <>
            <CheckCircle2 size={36} className="text-accent mx-auto" />
            <div>
              <p className="font-semibold text-text text-base">Zaten üyesiniz</p>
              <p className="text-sm text-text-secondary mt-1">{errorMsg}</p>
            </div>
            <button
              onClick={() => navigate("/projects")}
              className="btn-primary w-full py-2 text-sm"
            >
              Projelere Git
            </button>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle size={36} className="text-danger mx-auto" />
            <div>
              <p className="font-semibold text-text text-base">Davet geçersiz</p>
              <p className="text-sm text-text-secondary mt-1">{errorMsg}</p>
            </div>
            <p className="text-xs text-text-tertiary">Davet süresi dolmuş veya başka bir e-posta adresine gönderilmiş olabilir.</p>
            <button
              onClick={() => navigate("/projects")}
              className="btn-secondary w-full py-2 text-sm"
            >
              Ana Sayfaya Dön
            </button>
          </>
        )}
      </div>
    </div>
  );
}
