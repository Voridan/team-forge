import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { ConditionalGoogleOAuth } from '@/providers/google-oauth-provider';
import { SessionBootstrap } from '@/components/app/session-bootstrap';
import { RealtimeProvider } from '@/realtime/realtime-provider';
import { ProtectedRoute } from '@/routes/protected-route';
import { AppLayout } from '@/routes/app-layout';
import { AuthLayout } from '@/routes/auth/auth-layout';
import { LoginPage } from '@/routes/auth/login-page';
import { RegisterPage } from '@/routes/auth/register-page';
import { DashboardPage } from '@/routes/dashboard-page';
import { AcceptInvitationPage } from '@/routes/invitations/accept-invitation-page';
import { ProfilePage } from '@/routes/profile-page';
import { TeamsPage } from '@/routes/teams/teams-page';
import { TeamDetailPage } from '@/routes/teams/team-detail-page';

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <ConditionalGoogleOAuth>
          <BrowserRouter>
            <SessionBootstrap>
              <Routes>
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                </Route>

                {/* Public — handles its own logged-in / logged-out branching. */}
                <Route path="/invitations/accept" element={<AcceptInvitationPage />} />

                <Route
                  element={
                    <RealtimeProvider>
                      <ProtectedRoute />
                    </RealtimeProvider>
                  }
                >
                  <Route element={<AppLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="teams" element={<TeamsPage />} />
                    <Route path="teams/:teamId" element={<TeamDetailPage />} />
                    <Route path="profile" element={<ProfilePage />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </SessionBootstrap>
          </BrowserRouter>
          <Toaster position="bottom-right" richColors closeButton />
        </ConditionalGoogleOAuth>
      </QueryProvider>
    </ThemeProvider>
  );
}
