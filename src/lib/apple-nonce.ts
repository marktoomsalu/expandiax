// Native Sign in with Apple needs a random nonce, SHA-256-hashed before
// being sent to Apple's authorize call — but Supabase's signInWithIdToken
// needs the *raw* nonce back, to verify against the identity token's nonce
// claim itself. Swapping these fails verification with no useful error, so
// it's isolated here rather than inlined in the button component.
export function generateRawNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
