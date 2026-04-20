import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service — Playlist',
  description: 'Terms of Service for the Playlist web application.',
};

const LAST_UPDATED = 'April 20, 2026';
const CONTACT_EMAIL = 'undefined0307@gmail.com';

export default function TermsPage() {
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
          <h1 className="text-3xl font-sans font-bold">Terms of Service</h1>
          <p className="text-xs font-mono text-cream-white/50">
            Last updated: {LAST_UPDATED}
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <p className="text-sm text-cream-white/80 leading-7">
            These Terms of Service (the &ldquo;Terms&rdquo;) govern your use
            of Playlist (the &ldquo;Service&rdquo;), a web application
            available at{' '}
            <a href="https://onrepeat.cc" className="text-warm-amber hover:underline">
              onrepeat.cc
            </a>
            . By accessing or using the Service you agree to these Terms. If
            you do not agree, please do not use the Service.
          </p>
        </section>

        <Section title="1. What the Service does">
          <p>
            The Service renders a YouTube playlist as a 3D carousel in your
            browser. You can sign in with Google to view your own playlists,
            open a public playlist link, or load a demo playlist. A
            client-side YouTube embed plays videos in the detail view.
          </p>
        </Section>

        <Section title="2. Accounts and authentication">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              Signing in uses Google OAuth 2.0. You must comply with the{' '}
              <a
                href="https://policies.google.com/terms"
                className="text-warm-amber hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Terms of Service
              </a>{' '}
              and the{' '}
              <a
                href="https://www.youtube.com/t/terms"
                className="text-warm-amber hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTube Terms of Service
              </a>{' '}
              while using the Service.
            </li>
            <li>
              You are responsible for activity that occurs under your Google
              account while signed in to the Service.
            </li>
            <li>
              You can revoke the Service&apos;s access at any time from your{' '}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-warm-amber hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Account permissions page
              </a>
              .
            </li>
          </ul>
        </Section>

        <Section title="3. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              Use the Service to violate any law, regulation, or third-party
              right, including copyright and the YouTube API Services Terms of
              Service.
            </li>
            <li>
              Attempt to scrape, reverse engineer, or overload the Service, or
              to access YouTube data through the Service in a way that would
              circumvent YouTube&apos;s own rate limits or terms.
            </li>
            <li>
              Use the Service to access or share content you do not have the
              right to access or share.
            </li>
          </ul>
        </Section>

        <Section title="4. Sharing feature">
          <p>
            The Service offers an optional &ldquo;Share&rdquo; action that
            switches one of your Private YouTube playlists to Unlisted using
            the YouTube Data API. This change is made only when you click the
            Share button. You can revert a playlist&apos;s privacy at any time
            from YouTube&apos;s own interface. The Service is not responsible
            for the content of the playlist you choose to share.
          </p>
        </Section>

        <Section title="5. Content from YouTube">
          <p>
            All audio, video, thumbnail, and metadata content displayed by the
            Service originates from YouTube and remains the property of its
            respective owners. Playback is delivered by YouTube&apos;s
            embedded player and is subject to YouTube&apos;s terms. The
            Service does not host or store any media.
          </p>
        </Section>

        <Section title="6. Intellectual property">
          <p>
            The Service interface, code, visual design, and textual content
            are provided for personal use. You may not copy, modify,
            distribute, or create derivative works of the Service&apos;s
            original assets except as permitted by applicable law.
          </p>
        </Section>

        <Section title="7. Availability and changes">
          <ul className="list-disc pl-5 flex flex-col gap-1.5">
            <li>
              The Service is provided &ldquo;as is&rdquo; and may be
              interrupted, changed, or discontinued at any time without
              notice.
            </li>
            <li>
              We may update features, remove features, or change these Terms.
              Meaningful changes to the Terms will be reflected in the
              &ldquo;Last updated&rdquo; date above.
            </li>
          </ul>
        </Section>

        <Section title="8. Disclaimer of warranties">
          <p>
            To the fullest extent permitted by law, the Service is provided
            without warranties of any kind, express or implied, including but
            not limited to warranties of merchantability, fitness for a
            particular purpose, and non-infringement.
          </p>
        </Section>

        <Section title="9. Limitation of liability">
          <p>
            To the fullest extent permitted by law, the Service and its
            maintainer shall not be liable for indirect, incidental, special,
            consequential, or punitive damages, or any loss of data, revenue,
            or profits, arising out of or related to your use of the Service.
          </p>
        </Section>

        <Section title="10. Termination">
          <p>
            You may stop using the Service at any time by signing out and
            revoking the Service&apos;s access from your Google Account. We
            may suspend or terminate access to the Service for any user at our
            discretion, including for violations of these Terms.
          </p>
        </Section>

        <Section title="11. Governing law">
          <p>
            These Terms are governed by the laws of the Republic of Korea,
            without regard to conflict-of-law rules. Any dispute will be
            resolved in the competent courts of the Republic of Korea unless
            otherwise required by applicable law.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            Questions about these Terms can be sent to{' '}
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
          <Link href="/privacy" className="hover:text-cream-white/70 transition-colors">
            Privacy Policy
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
