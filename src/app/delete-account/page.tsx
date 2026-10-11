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
        You can delete your ExpandiaX account and everything in it at any time. There are two ways to do it.
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

      <LegalSection title="What gets deleted">
        <LegalList>
          <li>
            <Strong>Deleted immediately:</Strong> your profile, countries, trips, events, photos, videos, notes,
            comments, likes, follows, blocks, notifications and device tokens.
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
