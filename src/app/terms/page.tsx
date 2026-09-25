import Link from "next/link";
import { CompanyDetails, Ext, LegalList, LegalPage, LegalSection, Mail, Strong } from "@/components/LegalPage";
import { company } from "@/lib/company";
import { MIN_AGE } from "@/lib/legal";
import { COUNTRY_CAP, EVENT_CAP, PHOTO_CAP, VIDEO_CAP } from "@/lib/plan";

export const metadata = {
  title: "Terms of Service",
  description: "The terms that govern using ExpandiaX.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are the agreement between you and ExpandiaX for using our website and mobile apps - a personal
        archive for the countries you’ve visited and the events you want to remember. By creating an account or
        signing in, you agree to them. If you don’t agree, please don’t use ExpandiaX.
      </p>

      <LegalSection title="Who we are">
        <CompanyDetails />
        <p>
          “ExpandiaX”, “we” and “us” in these terms mean that company. You can reach us at{" "}
          <Mail address={company.supportEmail} />.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          You need to be at least {MIN_AGE} years old to use ExpandiaX. You’re responsible for the security of your
          account - use a real email address, keep your password to yourself, and tell us if you think someone else
          has access to it. Information you give us (display name, username, bio, home country) should be accurate and
          shouldn’t impersonate anyone else. One person, one account.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          Everything you add - countries, events, photos, videos, notes, ratings, comments - stays yours. To run the
          service we need your permission to use it, so by adding it you give us a worldwide, non-exclusive,
          royalty-free licence to store it, copy it (for example to compress a video or make a thumbnail), translate it
          when someone asks for a translation, and show it to the people your visibility settings allow - including in
          the feed, on Explore and on your public pages if you make them public, and in share images you create. The
          licence is only for running and improving ExpandiaX for you and the people you share with, and it ends when
          you delete the content or your account (copies in backups disappear on the schedule in our{" "}
          <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">Privacy Policy</Link>).
        </p>
        <p>
          You’re responsible for what you add. Only upload things you have the right to share, and be thoughtful about
          other people: if a photo or video shows someone, make sure they would be comfortable with it being shared. If
          someone asks you to take down something that shows them, please do.
        </p>
        <p>
          <Strong>Please note:</Strong> your photos and videos are stored at web addresses that are hard to guess but
          not password-protected. Your visibility settings decide who can find and see your memories in ExpandiaX, but
          anyone who has the exact address of a photo or video file can open it - so don’t share those addresses with
          anyone you wouldn’t show the photo to. We remove location and camera details (such as GPS coordinates) from
          photos and videos when you upload them.
        </p>
      </LegalSection>

      <LegalSection title="Rules">
        <p>We don’t tolerate objectionable content or abusive people. Don’t use ExpandiaX to:</p>
        <LegalList>
          <li>post anything illegal, or that infringes someone else’s copyright, trademark or privacy;</li>
          <li>
            share sexual content involving anyone under 18 (we report this to the authorities), or sexually explicit
            material of any kind;
          </li>
          <li>harass, threaten, bully or stalk anyone, or post hate speech or content that promotes violence or self-harm;</li>
          <li>publish other people’s private information (such as home addresses or ID documents) or share images of people without their consent;</li>
          <li>impersonate someone, or create accounts to mislead others;</li>
          <li>spam people, or scrape, copy or mass-download other people’s content;</li>
          <li>upload malware, or try to break, overload or get around the security of the service;</li>
          <li>come back with a new account after being removed.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Reporting and moderation">
        <p>
          Every profile, country page and event has a <Strong>Report</Strong> option. You can also email{" "}
          <Mail address={company.legalEmail} />, and use that address to tell us about content you believe is illegal
          or infringes your rights: include the link to the content, why you think it’s illegal or infringing, and your
          name and email (a good-faith statement that the details are accurate helps). We aim to look at every report
          within 24 hours.
        </p>
        <p>
          If something breaks these terms or the law, we can remove it, restrict features, or suspend or close the
          account. We decide based on a report or a clear violation, not arbitrarily, and a person reviews the serious
          cases. When we remove content or restrict an account we’ll tell you what we did and why, and how to contest
          it - just reply to that email or write to <Mail address={company.legalEmail} /> and someone will look at it
          again. We may act without notice where the law requires it or where someone’s safety is at risk. We may
          permanently remove people who repeatedly infringe others’ rights.
        </p>
        <p>
          You can also <Strong>block</Strong> any account from its profile. Blocking is your own decision: it hides the
          two of you from each other and ends any follows between you, without telling them and without affecting their
          account. It isn’t a report - if someone is breaking the rules, use Report as well. You can undo a block any
          time in Settings. A block by itself never leads to any action against an account; when several people report
          or block the same account, we look at it ourselves before deciding anything.
        </p>
      </LegalSection>

      <LegalSection title="Other people’s content">
        <p>
          If you follow someone or view a public profile, treat what you see the way you’d want your own archive
          treated - no scraping, reposting, or using someone’s photos or memories without asking them first.
        </p>
      </LegalSection>

      <LegalSection title="Premium">
        <p>
          ExpandiaX is free to use with limits ({COUNTRY_CAP.free} countries, {EVENT_CAP.free} events, and up to{" "}
          {PHOTO_CAP.free} photos and {VIDEO_CAP.free} videos per trip or event). <Strong>Premium</Strong> is an
          optional monthly subscription that raises those limits (unlimited countries and events; up to{" "}
          {PHOTO_CAP.premium} photos and {VIDEO_CAP.premium} videos), adds US States tracking and special territories,
          and lets you choose an accent colour for your public profile. What’s included is always shown where you
          subscribe.
        </p>
        <LegalList>
          <li>
            <Strong>Price and billing.</Strong> The monthly price is shown at checkout, including any taxes that apply
            to you. It’s charged when you subscribe and then every month until you cancel. Payments on our website are
            handled by Stripe.
          </li>
          <li>
            <Strong>Renewal and cancelling.</Strong> The subscription renews automatically each month. Cancel any time
            under Settings → Plan → Manage subscription; it then stays active until the end of the period you’ve paid
            for, and won’t renew.
          </li>
          <li>
            <Strong>Price changes.</Strong> If we change the price we’ll tell you at least 30 days beforehand, and you
            can cancel before it applies.
          </li>
          <li>
            <Strong>Your right to change your mind.</Strong> If you’re a consumer in the EU, you have 14 days from
            subscribing to withdraw without giving a reason. Because Premium starts right away - which you ask for when
            you subscribe - if you withdraw you’ll pay a proportionate part of the monthly price for the time you’ve
            already had it, and we refund the rest within 14 days. To withdraw, email{" "}
            <Mail address={company.supportEmail} /> with a clear statement that you’re withdrawing.
          </li>
          <li>
            <Strong>Refunds.</Strong> Outside that 14-day window, subscription fees for a period that has started aren’t
            refunded, except where the law requires it or we got something wrong (for example a double charge).
          </li>
          <li>
            <Strong>Deleting your account</Strong> cancels your subscription immediately, without a refund for the rest
            of the period.
          </li>
          <li>
            <Strong>In the mobile app.</Strong> Where Premium is bought inside the app, the purchase is made with Apple:
            Apple’s terms apply, you manage or cancel it in your Apple account, and refund requests go to Apple.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Exporting and deleting your data">
        <p>
          You can export a full copy of your data at any time and delete your account permanently from your account
          settings. Deleting your account removes your profile, countries, events, and all uploaded photos and videos
          from our storage, and cancels any Premium subscription bought on our website. This can’t be undone, so export
          first if you want to keep a copy. Some records (such as invoices) have to be kept for legal reasons - see the{" "}
          <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">Privacy Policy</Link>.
        </p>
      </LegalSection>

      <LegalSection title="Ending things">
        <p>
          You can stop using ExpandiaX and delete your account whenever you like. We may suspend or end your access if
          you seriously or repeatedly break these terms or the law, following the steps in “Reporting and moderation”
          above. If we decide to stop running ExpandiaX we’ll give you at least 30 days’ notice and a chance to export
          your data, and refund any Premium period you’ve paid for but won’t get.
        </p>
      </LegalSection>

      <LegalSection title="The service itself">
        <p>
          We work to keep ExpandiaX running and your data safe, but we can’t promise it will always be available or
          error-free, and it’s provided as it is, without warranties beyond those the law gives you. We’re not liable
          for losses arising from outages, bugs or data loss beyond what the law requires. Nothing in these terms limits liability that can’t be limited by law
          (for example for intent or gross negligence, or for death or personal injury), or any statutory rights you
          have as a consumer under the law of your country of residence - including your rights if digital content or a
          digital service isn’t as it should be.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We may update these terms as the product and the law change. If we make a change that matters, we’ll tell you
          at least 30 days before it takes effect, by email or in the app. If you don’t agree with it, you can delete
          your account before then; continuing to use ExpandiaX afterwards means you accept the new terms. Small
          changes (like fixing a typo or clarifying wording) can take effect straight away.
        </p>
      </LegalSection>

      <LegalSection title="Law and disputes">
        <p>
          These terms are governed by {company.country === "Estonia" ? "Estonian" : company.country} law. If you’re a
          consumer, you also keep the protection of the mandatory consumer laws of the country where you live, and you
          can bring a claim in the courts of your own country as well as in Estonia. If we can’t sort a problem out
          together, consumers in Estonia can turn to the Consumer Disputes Committee (
          <Ext href="https://komisjon.ee">komisjon.ee</Ext>), and you can always contact your local consumer authority.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms? Reach out at <Mail address={company.supportEmail} />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
