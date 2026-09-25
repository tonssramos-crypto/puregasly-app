import { useAuth } from '../context/AuthContext';
import AppShell from '../components/AppShell';
import CustomerDashboard from './dashboards/CustomerDashboard';
import OwnerDashboard from './dashboards/OwnerDashboard';
import EmployeeDashboard from './dashboards/EmployeeDashboard';
import AdminDashboard from './dashboards/AdminDashboard';

export default function Dashboard() {
  const { user } = useAuth();

  switch (user.role) {
    case 'admin':
      return (
        <AppShell wide>
          <AdminDashboard user={user} />
        </AppShell>
      );
    case 'owner':
      return (
        <AppShell wide>
          <OwnerDashboard user={user} />
        </AppShell>
      );
    case 'employee':
      return (
        <AppShell>
          <EmployeeDashboard user={user} />
        </AppShell>
      );
    default:
      return (
        <AppShell wide>
          <CustomerDashboard user={user} />
        </AppShell>
      );
  }
}
