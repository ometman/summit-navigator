import { Header } from '@/components/dashboard/header';
import { AdminConsole } from '@/components/admin/admin-console';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;

  return (
    <main>
      <Header />
      <AdminConsole initialTab={tab} />
    </main>
  );
}
