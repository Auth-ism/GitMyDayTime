import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import Layout from "@/components/Layout";
import DayView from "@/pages/DayView";
import WeekView from "@/pages/WeekView";
import CalendarPage from "@/pages/CalendarPage";
import StatsPage from "@/pages/StatsPage";
import SearchPage from "@/pages/SearchPage";
import RecurringPage from "@/pages/RecurringPage";
import ProfilePage from "@/pages/ProfilePage";
import LoginPage from "@/pages/LoginPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ProjectsPage from "@/pages/ProjectsPage";
import BoardPage from "@/pages/BoardPage";
import IssuePage from "@/pages/IssuePage";
import ProjectMembersPage from "@/pages/ProjectMembersPage";
import ProjectSettingsPage from "@/pages/ProjectSettingsPage";
import { Clock } from "lucide-react";

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
    <Routes>
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      {!isAuthenticated ? (
        <Route path="*" element={<LoginPage />} />
      ) : (
        <>
          <Route element={<Layout />}>
            <Route path="/" element={<DayView />} />
            <Route path="/day/:date" element={<DayView />} />
            <Route path="/week" element={<WeekView />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<Navigate to="board" replace />} />
            <Route path="/projects/:projectId/board" element={<BoardPage />} />
            <Route path="/projects/:projectId/issues/:issueId" element={<IssuePage />} />
            <Route path="/projects/:projectId/members" element={<ProjectMembersPage />} />
            <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
            <Route path="/projects/join/:token" element={<ProjectsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </>
      )}
    </Routes>
  );
}
