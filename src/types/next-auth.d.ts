// NextAuth v5 ships its core types in `@auth/core`, so we have to augment both
// `next-auth` (which re-exports Session) and `@auth/core/types` (where the actual
// interface lives) to make TypeScript see our extra fields everywhere.

import 'next-auth';
import '@auth/core/types';
import '@auth/core/jwt';

declare module '@auth/core/types' {
  interface Session {
    accessToken: string;
    /** Internal Supabase users.id. Null when Supabase is not configured. */
    userId: string | null;
    /** User-chosen @handle. Null until the user picks one (first-sign-in modal). */
    handle: string | null;
  }
}

declare module 'next-auth' {
  interface Session {
    accessToken: string;
    userId: string | null;
    handle: string | null;
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    /** Internal Supabase users.id. Null when Supabase is not configured. */
    userId?: string | null;
    /** User-chosen @handle. Null until picked. */
    handle?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    userId?: string | null;
    handle?: string | null;
  }
}
