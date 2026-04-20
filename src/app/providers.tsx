'use client';

import { SessionProvider } from 'next-auth/react';
import { HandlePickerModal } from '@/components/ui/HandlePickerModal';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <HandlePickerModal />
    </SessionProvider>
  );
}
