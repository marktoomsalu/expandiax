import { loadInviter } from "@/lib/inviteCard";
import { inviteImage } from "@/lib/inviteImage";

export const dynamic = "force-dynamic";

/** The picture under expandiax.com/join/<username> in WhatsApp and other chats: "An invitation from Mark". */
export async function GET(_req: Request, { params }: { params: { username: string } }) {
  return inviteImage(await loadInviter(params.username).catch(() => null));
}
