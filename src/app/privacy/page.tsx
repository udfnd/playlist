import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — Playlist',
  description: 'Privacy Policy for the Playlist web application.',
};

const LAST_UPDATED = 'April 20, 2026';
const CONTACT_EMAIL = 'undefined0307@gmail.com';

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh w-full bg-matte-black text-cream-white px-5 py-10 md:py-16">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-cream-white/60 hover:text-cream-white transition-colors w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
              clipRule="evenodd"
            />
          </svg>
          Back to app
        </Link>

        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-sans font-bold">Privacy Policy</h1>
          <p className="text-xs font-mono text-cream-white/50">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <p className="text-sm text-cream-white/80 leading-7">
            Playlist (the &ldquo;Service&rdquo;, available at{' '}
            <a
              href="https://onrepeat.cc"
              className="text-warm-amber hover:underline"
            >
              onrepeat.cc
            </a>
            ) is a lightweight web application that visualizes a YouTube
            playlist as a 3D carousel. This Privacy Policy describes what
            information the Service accesses, how it is used, and what choices
            you have.
          </p>
        </section>

        <Section title="1. Information we access">
          <p>
            When you sign in with Google, the Service requests the following
            information through Google OAuth 2.0:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong className="text-cream-white">Basic profile</strong>: your
              Google account email address, display name, and profile picture
              URL. These identify you inside the Service UI only.
            </li>
            <li>
              <strong className="text-cream-white">YouTube Data</strong>:
              read-only access to your YouTube playlists (titles, thumbnails,
              item counts, video IDs). The Service never modifies your
              YouTube account; changes such as making a private playlist
              unlisted or public must be performed by you directly on
              YouTube.
            </li>
          </ul>
          <p>
            No other Google services, Drive files, contacts, or personal
            content are accessed.
          </p>
        </Section>

        <Section title="2. How we use the information">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              To display your playlist library so you can pick a playlist to
              open in the 3D carousel.
            </li>
            <li>
              To load the songs of a selected playlist and render them as
              album-cover cards.
            </li>
            <li>
              To keep your session alive via a short-lived access token and, if
              available, refresh it transparently.
            </li>
          </ul>
          <p>
            We do not use your data for advertising, profiling, training AI
            models, or any purpose other than operating the Service for you.
          </p>
        </Section>

        <Section title="3. Data storage and retention">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong className="text-cream-white">No server database.</strong>{' '}
              The Service does not maintain a user database. Profile and
              playlist data are fetched on demand from Google and discarded
              when your browser tab closes or your session expires.
            </li>
            <li>
              <strong className="text-cream-white">Session cookie.</strong> An
              encrypted, HTTP-only session cookie (issued by NextAuth) stores
              your OAuth access and refresh tokens for the duration of your
              session. This cookie lives only in your browser and is cleared
              when you sign out.
            </li>
            <li>
              <strong className="text-cream-white">Hosting logs.</strong> Our
              hosting provider (Vercel) may record transient request metadata
              (IP, user agent, timestamp) for operational and security
              purposes. These logs are managed by Vercel and are not used by
              us for tracking.
            </li>
          </ul>
        </Section>

        <Section title="4. Sharing with third parties">
          <p>
            We do not sell, rent, or disclose your data to third parties. The
            Service interacts with two third-party platforms strictly to
            deliver its features:
          </p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong className="text-cream-white">Google / YouTube</strong>{' '}
              &mdash; for OAuth sign-in and the YouTube Data API. Governed by
              the{' '}
              <a
                href="https://policies.google.com/privacy"
                className="text-warm-amber hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Privacy Policy
              </a>
              .
            </li>
            <li>
              <strong className="text-cream-white">Vercel</strong> &mdash; for
              web hosting. Governed by the{' '}
              <a
                href="https://vercel.com/legal/privacy-policy"
                className="text-warm-amber hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vercel Privacy Policy
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="5. Google API Services User Data Policy">
          <p>
            The Service&apos;s use and transfer of information received from
            Google APIs adheres to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-warm-amber hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. YouTube data is used
            only to render the in-app carousel and the associated listening
            rooms. It is read-only and never sold, transferred for
            advertising, or used to train generalized AI models.
          </p>
        </Section>

        <Section title="6. Your choices">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              <strong className="text-cream-white">Sign out</strong> at any
              time from the playlist picker page. Signing out immediately
              invalidates the session cookie.
            </li>
            <li>
              <strong className="text-cream-white">Revoke access</strong>{' '}
              entirely at{' '}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-warm-amber hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Account &rarr; Security &rarr; Third-party apps
              </a>
              . This removes the Service&apos;s access to your Google account
              and invalidates any stored tokens.
            </li>
            <li>
              <strong className="text-cream-white">Data requests</strong>.
              Because we do not store personal data server-side, there is
              nothing for us to export or delete on our side; revoking access
              fully removes our ability to fetch your data.
            </li>
          </ul>
        </Section>

        <Section title="7. Children">
          <p>
            The Service is not directed at children under 13 and we do not
            knowingly collect information from children.
          </p>
        </Section>

        <Section title="8. Changes to this policy">
          <p>
            We may update this Privacy Policy as the Service evolves.
            Meaningful changes will be reflected in the &ldquo;Last
            updated&rdquo; date above.
          </p>
        </Section>

        <Section title="9. Contact">
          <p>
            Questions about this Privacy Policy can be sent to{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-warm-amber hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <footer className="pt-4 border-t border-cream-white/10 text-xs text-cream-white/40">
          <Link href="/terms" className="hover:text-cream-white/70 transition-colors">
            Terms of Service
          </Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:text-cream-white/70 transition-colors">
            Home
          </Link>
        </footer>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-sans font-semibold">{title}</h2>
      <div className="text-sm text-cream-white/75 leading-7 flex flex-col gap-3">
        {children}
      </div>
    </section>
  );
}
