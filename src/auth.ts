import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

// Supabase persistence is optional at the code level: if SUPABASE_SERVICE_ROLE_KEY is not
// present in the environment (e.g. during a first local deploy, or if the server boots
// before the env var is populated), login continues to work with the pre-Supabase JWT-only
// flow. This lets us ship the auth wiring and the operator flip the env var on at their
// own pace.
function hasSupabaseCreds(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

interface SyncArgs {
  googleId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  accessToken: string | undefined;
  refreshToken: string | undefined;
  expiresAt: number | undefined;
  scope: string | undefined;
}

/**
 * Upsert the user row and persist the Google OAuth tokens to music_connections.
 * Returns the user's internal id and current handle so the JWT can carry them.
 */
async function syncUserAndConnection(args: SyncArgs): Promise<{
  userId: string | null;
  handle: string | null;
}> {
  if (!hasSupabaseCreds()) return { userId: null, handle: null };

  try {
    const supabase = getSupabaseAdmin();

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .upsert(
        {
          google_id: args.googleId,
          email: args.email,
          display_name: args.displayName,
          avatar_url: args.avatarUrl,
        },
        { onConflict: 'google_id' },
      )
      .select('id, handle')
      .single();

    if (userErr || !userRow) {
      console.error('[auth] user upsert failed:', userErr);
      return { userId: null, handle: null };
    }

    await supabase.from('music_connections').upsert(
      {
        user_id: userRow.id,
        provider: 'google',
        provider_account_id: args.googleId,
        access_token: args.accessToken ?? null,
        refresh_token: args.refreshToken ?? null,
        expires_at: args.expiresAt
          ? new Date(args.expiresAt * 1000).toISOString()
          : null,
        scope: args.scope ?? null,
      },
      { onConflict: 'user_id,provider' },
    );

    return { userId: userRow.id, handle: userRow.handle };
  } catch (err) {
    console.error('[auth] Supabase sync errored:', err);
    return { userId: null, handle: null };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      checks: ['state'],
      authorization: {
        params: {
          // Only request the Sensitive read-only YouTube scope. The Restricted /auth/youtube
          // (write) scope was dropped to make Google OAuth verification achievable without
          // a commercial security assessment. Playlist-privacy changes are now left to the
          // user on YouTube directly.
          scope: 'openid email profile https://www.googleapis.com/auth/youtube.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, trigger }) {
      // Refresh the handle from the DB when the client calls useSession().update()
      // after the first-sign-in modal saves a handle. Also runs as a cheap fallback
      // when a token has a userId but no handle yet — keeps the JWT consistent with
      // the users table without forcing the user to sign out and back in.
      if (
        hasSupabaseCreds() &&
        token.userId &&
        (trigger === 'update' || !token.handle)
      ) {
        try {
          const { data } = await getSupabaseAdmin()
            .from('users')
            .select('handle')
            .eq('id', token.userId)
            .maybeSingle();
          if (data) token.handle = data.handle ?? null;
        } catch (err) {
          console.error('[auth] handle refetch failed:', err);
        }
      }

      // Fresh sign-in: account is present. Persist the user and their OAuth tokens into
      // Supabase, and capture the internal user id + handle so the JWT can expose them.
      if (account && profile) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;

        const { userId, handle } = await syncUserAndConnection({
          googleId: account.providerAccountId!,
          email: (profile as { email?: string }).email ?? '',
          displayName:
            (profile as { name?: string | null }).name ?? null,
          avatarUrl:
            (profile as { picture?: string | null }).picture ?? null,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          scope: account.scope,
        });
        token.userId = userId;
        token.handle = handle;
      }

      // Return token if not expired (with 60s buffer)
      if (typeof token.expiresAt === 'number' && Date.now() < token.expiresAt * 1000 - 60_000) {
        return token;
      }

      // Refresh expired token
      if (token.refreshToken) {
        try {
          const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              grant_type: 'refresh_token',
              refresh_token: token.refreshToken as string,
            }),
          });
          const data = await res.json();
          if (data.access_token) {
            const newExpiresAt =
              Math.floor(Date.now() / 1000) + Number(data.expires_in);
            token.accessToken = data.access_token;
            token.expiresAt = newExpiresAt;

            // Keep music_connections in sync with the refreshed access token so server
            // routes using the persisted token don't fall out of date.
            if (token.userId && hasSupabaseCreds()) {
              try {
                await getSupabaseAdmin()
                  .from('music_connections')
                  .update({
                    access_token: data.access_token,
                    expires_at: new Date(newExpiresAt * 1000).toISOString(),
                  })
                  .eq('user_id', token.userId)
                  .eq('provider', 'google');
              } catch (e) {
                console.error('[auth] refresh persist failed:', e);
              }
            }
          }
        } catch (e) {
          console.error('Failed to refresh token:', e);
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Spread-then-override produces a fresh object whose shape matches the augmented
      // Session interface without fighting TypeScript's declaration-merging on
      // assignment. (Direct property assignment was intersecting with a nullable
      // upstream declaration in some setups.)
      return Object.assign(session, {
        accessToken: (token.accessToken as string) ?? '',
        userId: token.userId ?? null,
        handle: token.handle ?? null,
      });
    },
  },
});
