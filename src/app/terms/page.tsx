export const metadata = {
  title: "Terms of Service",
  description: "The terms that govern using ExpandiaX.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-3xl md:text-4xl">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted">Last updated July 22, 2026.</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted">
        <p>
          These terms cover your use of ExpandiaX (&ldquo;we&rdquo;, &ldquo;us&rdquo;), a personal archive for the
          countries you&rsquo;ve visited and the events you want to remember. By creating an account, you agree to
          them.
        </p>

        <section>
          <h2 className="font-serif text-xl text-ink">Your account</h2>
          <p className="mt-2">
            You need to be at least 16 years old to use ExpandiaX. You&rsquo;re responsible for the security of your
            account — use a real email address, keep your password to yourself, and let us know if you think someone
            else has access to it. Information you give us (display name, username, bio, home country) should be
            accurate and not impersonate anyone else.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Your content</h2>
          <p className="mt-2">
            Everything you add — countries, events, photos, videos, notes, ratings — stays yours. By uploading it,
            you give us permission to store it and to show it to whoever your visibility settings allow (just you,
            your mutual followers, or anyone with the link), so the app can actually work. You&rsquo;re responsible
            for what you upload: don&rsquo;t post anything you don&rsquo;t have the rights to, anything illegal, or
            anything that could seriously harm or harass someone else.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Other people&rsquo;s content</h2>
          <p className="mt-2">
            If you follow someone or view a public profile, treat what you see the way you&rsquo;d want your own
            archive treated — no scraping, reposting, or using someone&rsquo;s photos or memories without asking
            them first. Every profile, country page, and event has a Report option; use it if you see something
            that shouldn&rsquo;t be there, and we&rsquo;ll take a look.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Enforcement</h2>
          <p className="mt-2">
            We can remove content or suspend an account that breaks these terms, is used to harass or impersonate
            someone, or is being used for anything illegal. We&rsquo;ll generally do this only in response to a
            report or a clear violation, not arbitrarily.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Exporting and deleting your data</h2>
          <p className="mt-2">
            You can export a full copy of your data at any time and delete your account permanently from your
            account settings. Deleting your account removes your profile, countries, events, and all uploaded
            photos and videos from our storage. This can&rsquo;t be undone, so export first if you want to keep a
            copy.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">The service itself</h2>
          <p className="mt-2">
            ExpandiaX is provided as-is, without warranties of any kind. We aim to keep it running and your data
            safe, but we can&rsquo;t guarantee the service will always be available or error-free, and we&rsquo;re
            not liable for losses arising from outages, bugs, or data loss beyond what applicable law requires.
            Nothing here limits any statutory rights you have as a consumer under the law of your country of
            residence.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Changes</h2>
          <p className="mt-2">
            We may update these terms as the product changes. If we make a material change, we&rsquo;ll do our best
            to let you know before it takes effect. Continuing to use ExpandiaX after a change means you accept the
            new terms.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-xl text-ink">Contact</h2>
          <p className="mt-2">
            Questions about these terms? Reach out at{" "}
            <a href="mailto:mark@expandiax.com" className="text-accent underline-offset-4 hover:underline">
              mark@expandiax.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
