import { redirect } from "next/navigation";

export default function ConcertRedirect({ params }: { params: { id: string } }) {
  redirect(`/concerts/${params.id}/edit`);
}
