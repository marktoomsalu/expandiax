export const metadata = {
  title: "Privacy Policy",
  description: "What ExpandiaX collects, why, and how to control it.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated July 22, 2026.</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted">
        <p>
          This explains what ExpandiaX collects, why, and how you can control it. We collect as little as we can
          get away with while still making the app useful.
        </p>

        <section>
          <h2 className="font-serif text-xl text-ink">What we collect</h2>
          <p className="mt-2">
            <strong className="font-medium text-ink">Account details</strong> — your email, username, display name,
            avatar, and bio, whether you sign up with a password or with Google.
            <br />
            <strong className="mt-2 inline-block font-medium text-ink">Content you add</strong> — the countries and
            events you log, along with any photos, videos, notes, and ratings attached to them.
            <br />
            <strong className="mt-2 inline-block font-medium text-ink">Basic usage data</strong> — anonymous,
            privacy-friendly analytics (page views, not individual behaviour tracking) and error reports if
            something crashes, so we can fix it.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">How we use it</h2>
          <p className="mt-2">
            To run the app: show your archive back to you, show your public or friends-only content to the people
            your visibility settings allow, power the feed and follow system, and keep your account secure. We
            don&rsquo;t sell your data, and we don&rsquo;t use your content to train anything.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Who can see your content</h2>
          <p className="mt-2">
            Entirely up to you, per profile and per event: <strong className="font-medium text-ink">private</strong>{" "}
            (only you), <strong className="font-medium text-ink">friends</strong> (people who follow you and whom
            you follow back), or <strong className="font-medium text-ink">public</strong> (anyone with the link,
            and discoverable on Explore). You can change this at any time.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Where it&rsquo;s stored</h2>
          <p className="mt-2">
            Your data lives in Supabase (managed Postgres, authentication, and file storage). Sign-in with Google
            is handled by Google&rsquo;s own OAuth flow — we only receive your email and basic profile info from
            it, never your Google password. We use Vercel for hosting and privacy-friendly analytics, and Sentry
            for error monitoring.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Cookies</h2>
          <p className="mt-2">
            We use one cookie to keep you signed in and one to remember your light/dark theme preference. That&rsquo;s
            it — no tracking or advertising cookies.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Your rights</h2>
          <p className="mt-2">
            You can export a complete copy of your data or permanently delete your account, at any time, from your
            account settings — no need to ask us. Deleting your account removes your profile, your archive, and
            every photo and video you uploaded from our storage, and can&rsquo;t be undone.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Retention</h2>
          <p className="mt-2">
            We keep your data for as long as your account exists. If you delete your account, your data is removed
            from our active systems; backups that include it are cycled out shortly after.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Children</h2>
          <p className="mt-2">ExpandiaX isn&rsquo;t intended for anyone under 16.</p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Changes</h2>
          <p className="mt-2">
            If we change this policy in a way that matters, we&rsquo;ll do our best to let you know before it takes
            effect.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Contact</h2>
          <p className="mt-2">
            Questions, or want to exercise a data right directly? Reach out at{" "}
            <a href="mailto:support@expandiax.com" className="text-accent underline-offset-4 hover:underline">
              support@expandiax.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
