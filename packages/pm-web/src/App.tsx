import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import PmLayout from "@/components/PmLayout";
import LoginPage from "@/pages/LoginPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ProjectsPage from "@/pages/ProjectsPage";
import BoardPage from "@/pages/BoardPage";
import IssuePage from "@/pages/IssuePage";
import ProjectMembersPage from "@/pages/ProjectMembersPage";
import ProjectSettingsPage from "@/pages/ProjectSettingsPage";
import ProjectInsightsPage from "@/pages/ProjectInsightsPage";
import ProjectJoinPage from "@/pages/ProjectJoinPage";
import BacklogPage from "@/pages/BacklogPage";
import { Clock } from "lucide-react";
import { ToastContainer } from "@/components/Toast";

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-3 animate-pulse">
          <Clock size={20} className="text-bg" />
        </div>
        <p className="text-sm text-text-tertiary">Loading...</p>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <LoadingScreen />;

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {!isAuthenticated ? (
          <Route path="*" element={<LoginPage />} />
        ) : (
          <>
            <Route element={<PmLayout />}>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:projectId" element={<Navigate to="board" replace />} />
              <Route path="/projects/:projectId/board" element={<BoardPage />} />
              <Route path="/projects/:projectId/backlog" element={<BacklogPage />} />
              <Route path="/projects/:projectId/issues/:issueId" element={<IssuePage />} />
              <Route path="/projects/:projectId/members" element={<ProjectMembersPage />} />
              <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
              <Route path="/projects/:projectId/insights" element={<ProjectInsightsPage />} />
              <Route path="/projects/join/:token" element={<ProjectJoinPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </>
        )}
      </Routes>
    </>
  );
}
