import Link from "next/link";
import { CompanyDetails, Ext, LegalList, LegalPage, LegalSection, Mail, Strong } from "@/components/LegalPage";
import { company } from "@/lib/company";
import { MIN_AGE } from "@/lib/legal";

export const metadata = {
  title: "Privacy Policy",
  description: "What ExpandiaX collects, why, and how to control it.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This explains what ExpandiaX collects about you, why, who else gets to handle it, and how you stay in control.
        We collect only what we need to run the app, we don’t sell your data, and we don’t show ads.
      </p>

      <LegalSection title="Who is responsible for your data">
        <CompanyDetails />
        <p>
          This company decides how and why your personal data is used (in data-protection terms, the “controller”).
          Questions or requests about your data: <Mail address={company.privacyEmail} />.
        </p>
      </LegalSection>

      <LegalSection title="What we collect, and why">
        <LegalList>
          <li>
            <Strong>Account details</Strong> - your email, username, display name, avatar and bio, whether you sign up
            with a password, Apple or Google (from Apple or Google we receive only your name and email, depending on
            what you allow). <em>Why:</em> to create and run your account. <em>Legal basis:</em> it’s needed to provide
            the service you asked for (contract).
          </li>
          <li>
            <Strong>What you add</Strong> - the countries and events you log, photos, videos, notes, ratings, home
            country, songs you pick, and your comments, likes, follows and blocks. <em>Why:</em> that is the app.{" "}
            <em>Legal basis:</em> contract.
          </li>
          <li>
            <Strong>Photo and video details.</Strong> We remove location and camera information (GPS coordinates,
            device model, embedded timestamps) from photos and videos when you upload them. Your browser may read a
            photo’s date to pre-fill the date field; that reading happens on your device and isn’t stored.
          </li>
          <li>
            <Strong>Technical data</Strong> - IP address, browser and device type, and error reports, plus anonymous
            page-view statistics without cookies. <em>Why:</em> to keep the service secure, fix crashes and understand
            which pages get used. <em>Legal basis:</em> our legitimate interest in running a secure, working service.
          </li>
          <li>
            <Strong>Approximate location</Strong> - to show concerts and events happening near you in the feed, we use
            the rough city our hosting provider works out from your IP address (no location permission, and we don’t
            store it). Only a rough area of about 20-40 km is passed on to find events - never your exact position. If
            it isn’t available we use the home country on your profile. <em>Legal basis:</em> our legitimate interest
            in showing you relevant events.
          </li>
          <li>
            <Strong>Notifications</Strong> - if you use the app and allow notifications, a device token so we can send
            push notifications about likes, comments and new followers; and emails such as “X started following you” and
            an optional weekly digest (each digest has a one-click unsubscribe). <em>Legal basis:</em> contract, and
            your consent for push notifications, which you can withdraw in your device’s settings at any time.
          </li>
          <li>
            <Strong>Payments</Strong> - if you subscribe to Premium on our website, Stripe takes the payment (we never
            see your card number) and tells us your plan, renewal date and Stripe customer and subscription IDs. In the
            app, Apple handles the purchase and RevenueCat tells us whether you’re Premium. <em>Legal basis:</em>{" "}
            contract, and our legal duty to keep accounting records.
          </li>
          <li>
            <Strong>Reports and moderation</Strong> - reports you send us (who sent it, what it’s about, what you wrote)
            and what we decide. <em>Why:</em> to keep ExpandiaX safe and meet our legal duties. <em>Legal basis:</em>{" "}
            legitimate interest and legal obligation.
          </li>
          <li>
            <Strong>Agreement records</Strong> - when you sign up with email, the date and the version of the Terms and
            Privacy Policy you agreed to. <em>Legal basis:</em> our legitimate interest in being able to show what was
            agreed.
          </li>
        </LegalList>
        <p>
          We don’t use your content to train AI models, we don’t sell your data, and we never use your notification
          token for advertising or to track you across other apps or services.
        </p>
      </LegalSection>

      <LegalSection title="Who else handles your data">
        <p>
          We use these companies to run ExpandiaX. Each only gets what it needs for its job and acts on our
          instructions:
        </p>
        <LegalList>
          <li>
            <Strong>Supabase</Strong> - database, sign-in and file storage
            {company.dataRegion ? ` (data centre: ${company.dataRegion})` : ""}.
          </li>
          <li>
            <Strong>Vercel</Strong> - hosting, and anonymous, cookieless page-view analytics.
          </li>
          <li>
            <Strong>Sentry</Strong> - error monitoring, so we can fix crashes.
          </li>
          <li>
            <Strong>Firebase Cloud Messaging (Google)</Strong> and <Strong>Apple’s push service</Strong> - to deliver
            push notifications to the app.
          </li>
          <li>
            <Strong>Resend</Strong> - to send our emails.
          </li>
          <li>
            <Strong>Stripe</Strong> - website payments. <Strong>Apple</Strong> and <Strong>RevenueCat</Strong> - in-app
            purchases.
          </li>
          <li>
            <Strong>Apple</Strong> and <Strong>Google</Strong> - if you choose to sign in with them.
          </li>
          <li>
            <Strong>DeepL</Strong> (Germany) - when you tap <em>Translate</em> on a post, its text (title, subtitle and
            note) is sent to DeepL to be translated. We don’t keep the result.
          </li>
          <li>
            <Strong>Spotify</Strong> - song search goes through our server to Spotify. The Spotify player loads only
            when you tap play on a song; from then on Spotify may set cookies and handles data under its own privacy
            policy. Song previews come from Apple’s public music search, and only the song and artist name are sent.
          </li>
          <li>
            <Strong>Ticketmaster</Strong>, <Strong>setlist.fm</Strong> and <Strong>Bandsintown</Strong> - to find
            concerts and events: the name of an artist you log or have seen, and for events near you the rough area
            described above. Nothing that identifies you is sent. Ticket links open their websites, which have their
            own privacy policies.
          </li>
        </LegalList>
        <p>
          We may also share information when the law requires it, or to protect someone’s safety. Otherwise we don’t
          share your data.
        </p>
      </LegalSection>

      <LegalSection title="Data sent outside the EU">
        <p>
          Some of these companies are based in the United States. Where your data goes outside the EU/EEA, we rely on a
          recognised safeguard - the EU–US Data Privacy Framework where the company is certified, or the European
          Commission’s Standard Contractual Clauses. Ask us at <Mail address={company.privacyEmail} /> if you’d like
          details.
        </p>
      </LegalSection>

      <LegalSection title="Who can see your content">
        <p>
          Entirely up to you, per profile and per event: <Strong>private</Strong> (only you), <Strong>friends</Strong>{" "}
          (people who follow you and whom you follow back), or <Strong>public</Strong> (anyone, discoverable on Explore,
          and public pages can also show up in search engines like Google). You can change this at any time, and you can{" "}
          <Strong>block</Strong> anyone to hide the two of you from each other.
        </p>
        <p>
          <Strong>One thing to know:</Strong> your photos and videos are stored at web addresses that are hard to guess
          but not password-protected. Your visibility settings control who can find and see your memories in ExpandiaX;
          anyone who has the exact address of a file can open it. Don’t share those addresses with people you wouldn’t
          show the photo to.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and similar storage">
        <p>
          We only use what the app needs to work: a cookie that keeps you signed in, and a small setting on your device
          that remembers your light/dark theme. We don’t use advertising or tracking cookies, and our analytics don’t
          use cookies, so there’s no cookie banner. The one exception is if you tap play on a Spotify song (see above),
          and Stripe’s checkout page, which is Stripe’s own site.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <LegalList>
          <li>
            <Strong>Your account and everything you added:</Strong> as long as your account exists. When you delete it,
            your profile, content and uploaded files are removed straight away from our live systems, and copies in
            backups are overwritten within 30 days.
          </li>
          <li>
            <Strong>Billing records</Strong> (invoices and payment records held by Stripe and us): kept for 7 years
            because accounting law requires it, even after you delete your account.
          </li>
          <li>
            <Strong>Reports and moderation records:</Strong> kept for up to 12 months after the case is closed, or
            longer if we need them for a legal claim.
          </li>
          <li>
            <Strong>Error reports:</Strong> a few months at most.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can: see what we hold about you; correct it; have it deleted; get a copy in a portable format; ask us to
          restrict how we use it; object to uses based on our legitimate interests; and withdraw consent you’ve given.
          Most of this you can do yourself, right now, in <Strong>Settings</Strong> - edit your profile, export a full
          copy of your data, or permanently delete your account and everything in it. For anything else, write to{" "}
          <Mail address={company.privacyEmail} /> and we’ll reply within one month.
        </p>
        <p>
          If you think we’re handling your data unlawfully, you have the right to complain to the Estonian Data
          Protection Inspectorate (Andmekaitse Inspektsioon, <Ext href="https://www.aki.ee">aki.ee</Ext>) or to the
          data-protection authority in the country where you live. We’d appreciate the chance to fix it first.
        </p>
        <p>We don’t make decisions about you by automated means that have legal or similarly significant effects.</p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Data travels over encrypted connections, access to the database is restricted by per-user rules, and only a
          small number of people can reach the systems that hold it. No service can promise perfect security; if a
          breach ever puts your rights at risk, we’ll tell you and the authorities as the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          ExpandiaX isn’t intended for anyone under {MIN_AGE}. If we learn that we hold an account belonging to someone
          younger, we’ll delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy in a way that matters, we’ll tell you at least 30 days before it takes effect, by
          email or in the app. The date at the top shows when it was last updated. Our{" "}
          <Link href="/terms" className="text-accent underline-offset-4 hover:underline">Terms of Service</Link> explain
          the rest of how ExpandiaX works.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions, or want to use a data right directly? Reach out at <Mail address={company.privacyEmail} />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
