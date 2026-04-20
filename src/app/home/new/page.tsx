import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { NewRoomWizard } from './NewRoomWizard';

export const metadata: Metadata = {
  title: 'New room — onrepeat',
};

export const dynamic = 'force-dynamic';

export default async function NewRoomPage() {
  const session = await auth();
  if (!session?.userId) redirect('/');
  if (!session.handle) redirect('/');
  return <NewRoomWizard />;
}
