import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginRegisterPage } from '../pages/LoginRegisterPage';
import { ControlsPage } from '../pages/ControlsPage';
import { ControlDetailPage } from '../pages/ControlDetailPage';
import { EvidenceVaultPage } from '../pages/EvidenceVaultPage';
import { EvidenceDetailPage } from '../pages/EvidenceDetailPage';
import { TasksPage } from '../pages/TasksPage';
import { TaskDetailPage } from '../pages/TaskDetailPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { AuditorAccessPage } from '../pages/AuditorAccessPage';
import { RetentionPage } from '../pages/RetentionPage';
import { MembersPage } from '../pages/MembersPage';
import { FrameworksPage } from '../pages/FrameworksPage';
import { FrameworkUpgradePage } from '../pages/FrameworkUpgradePage';
import { AuditorViewPage } from '../pages/AuditorViewPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { AppShell } from '../components/layout/AppShell';

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<LoginRegisterPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/frameworks" element={<FrameworksPage />} />
          <Route path="/frameworks/upgrade" element={<FrameworkUpgradePage />} />
          <Route path="/controls" element={<ControlsPage />} />
          <Route path="/controls/:controlId" element={<ControlDetailPage />} />
          <Route path="/evidence" element={<EvidenceVaultPage />} />
          <Route path="/evidence/:evidenceId" element={<EvidenceDetailPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/auditor-access" element={<AuditorAccessPage />} />
          <Route path="/auditor-view" element={<AuditorViewPage />} />
          <Route path="/retention" element={<RetentionPage />} />
          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Not Found"
                description={<Link to="/">Return to dashboard</Link>}
              />
            }
          />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
