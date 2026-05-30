import { Routes, Route } from "react-router-dom";
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
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ChangelogPage from "@/pages/ChangelogPage";
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
          <Route element={<Layout />}>
            <Route path="/" element={<DayView />} />
            <Route path="/day/:date" element={<DayView />} />
            <Route path="/week" element={<WeekView />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/changelog" element={<ChangelogPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </>
      )}
    </Routes>
    </>
  );
}
