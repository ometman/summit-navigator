import { PassWorkspace } from '@/components/pass/pass-workspace';

export default async function PassPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const resolved = await searchParams;
  const initialMode = resolved?.mode === 'scanner' ? 'scanner' : 'pass';

  return <PassWorkspace initialMode={initialMode} />;
}
