import { redirect } from 'next/navigation';
import { getServerSession, hasAdminAccess } from '@/lib/auth';
import AdminDashboard from '@/app/components/admin-dashboard';

export default async function AdminPage() {
  const session = await getServerSession();

  if (!session || !hasAdminAccess(session)) {
    redirect('/auth/login');
  }

  return <AdminDashboard email={session.email} role={session.role} />;
}
