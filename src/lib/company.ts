// Who operates ExpandiaX — shown on the Terms and Privacy pages. Estonian and
// EU rules expect the operator's identity to be easy to find. Anything left
// null is simply not shown, so nothing here can leak a placeholder to the
// site; fill these in when you have them.
export const company = {
  legalName: "ExpandiaX OÜ",
  country: "Estonia",
  registryCode: "17332947" as string | null, // Estonian commercial register code
  address: "Akadeemia tee 3, Mustamäe, 12616 Tallinn, Harju county" as string | null, // registered address
  vatNumber: null as string | null, // EU VAT number, once registered
  // Where the database and file storage run (Supabase dashboard → Settings → Infrastructure).
  dataRegion: "Ireland (EU)" as string | null,
  // One shared address for everything for now — swap in role addresses
  // (support@, privacy@, legal@) once those mailboxes exist.
  supportEmail: "team@expandiax.com",
  privacyEmail: "team@expandiax.com",
  legalEmail: "team@expandiax.com",
};
