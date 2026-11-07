import Link from "next/link";
import { LegalList, LegalPage, LegalSection, Mail, Strong } from "@/components/LegalPage";
import { company } from "@/lib/company";

export const metadata = {
  title: "Delete your account",
  description: "How to delete your ExpandiaX account and data.",
};

// Public on purpose: app stores require a web page where people can ask to
// delete their account without having the app installed.
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your ExpandiaX account">
      <p>
        You can delete your ExpandiaX account and everything in it at any time - or just some of your data. Here&rsquo;s how.
      </p>

      <LegalSection title="In the app or on the website (instant)">
        <LegalList>
          <li>
            Sign in, open <Strong>Settings</Strong> (from your profile, or{" "}
            <Link href="/settings" className="text-accent underline-offset-4 hover:underline">
              expandiax.com/settings
            </Link>
            ).
          </li>
          <li>
            Optional: tap <Strong>Export my data</Strong> first if you want to keep a copy.
          </li>
          <li>
            Scroll to <Strong>Danger zone</Strong>, tap <Strong>Delete my account</Strong> and confirm.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="By email (if you can't sign in)">
        <p>
          Email <Mail address={company.privacyEmail} /> from the address you signed up with, with the subject
          &ldquo;Delete my account&rdquo; and your username. We may ask you to confirm it&rsquo;s you, and we&rsquo;ll
          delete the account within 30 days (usually much sooner) and let you know when it&rsquo;s done.
        </p>
      </LegalSection>

      <LegalSection title="Delete only some of your data">
        <p>You don&rsquo;t have to delete your account to remove things. Everything you add can be deleted on its own, straight away:</p>
        <LegalList>
          <li>
            <Strong>A photo or video:</Strong> open the trip or event, tap <Strong>Edit</Strong>, and remove it.
          </li>
          <li>
            <Strong>A country and its trips:</Strong> open it in <Strong>My World</Strong> and tap{" "}
            <Strong>Remove [country] from my map</Strong>.
          </li>
          <li>
            <Strong>An event:</Strong> open it, tap <Strong>Edit</Strong>, then <Strong>Delete</Strong>.
          </li>
          <li>
            <Strong>A comment, question or answer:</Strong> tap <Strong>Delete</Strong> under it.
          </li>
          <li>
            <Strong>Your profile photo, bio or dream places:</Strong> change or remove them in <Strong>Settings</Strong>{" "}
            and on the place&rsquo;s page.
          </li>
        </LegalList>
        <p>
          Can&rsquo;t find something, or want us to delete a particular kind of data for you? Email{" "}
          <Mail address={company.privacyEmail} /> from the address you signed up with and tell us what to remove - we&rsquo;ll
          do it within 30 days and let you know.
        </p>
      </LegalSection>

      <LegalSection title="What gets deleted">
        <LegalList>
          <li>
            <Strong>Deleted immediately:</Strong> your profile, countries, trips, events, photos, videos, notes,
            comments, questions and answers about places, likes, follows, blocks, notifications and device tokens.
          </li>
          <li>
            <Strong>Kept for a limited time:</Strong> copies in backups are overwritten within 30 days. Reports about
            content are kept for up to 12 months.
          </li>
        </LegalList>
        <p>
          More detail is in our{" "}
          <Link href="/privacy" className="text-accent underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
