import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConcertForm } from "@/components/ConcertForm";
import { MediaUploader } from "@/components/MediaUploader";
import { DeleteConcertButton } from "@/components/DeleteConcertButton";
import type { ConcertFull } from "@/lib/types";

export const metadata = { title: "Edit concert" };

export default async function EditConcertPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { created?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase
      .from("concerts")
      .select("*, concert_media!concert_media_concert_id_fkey(*)")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const concert = data as ConcertFull | null;
  if (!concert) notFound();

  const images = concert.concert_media.filter((m) => m.media_type === "image");
  const videos = concert.concert_media.filter((m) => m.media_type === "video");

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/concerts" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Concerts
      </Link>

      {searchParams.created && (
        <p role="status" className="mt-6 rounded-lg border border-accent/40 bg-accent-soft/50 px-4 py-3 text-sm">
          Concert added. Now give it a face — upload photos and videos below.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Edit</p>
          <h1 className="mt-1 text-3xl md:text-4xl">{concert.artist_name}</h1>
        </div>
        {profile && concert.is_public && (
          <Link
            href={`/u/${profile.username}/concerts/${concert.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-accent underline-offset-4 hover:underline"
          >
            View public page <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <div className="mt-8">
        <ConcertForm concert={concert} />
      </div>

      <div className="mt-12 space-y-10 border-t border-line pt-8">
        <MediaUploader
          userId={user.id}
          scope="concerts"
          parentId={concert.id}
          table="concert_media"
          fkColumn="concert_id"
          kind="image"
          max={5}
          items={images}
          coverId={concert.cover_media_id}
          coverTable="concerts"
          label="Photos"
        />
        <MediaUploader
          userId={user.id}
          scope="concerts"
          parentId={concert.id}
          table="concert_media"
          fkColumn="concert_id"
          kind="video"
          max={3}
          items={videos}
          captions
          label="Videos"
        />
      </div>

      <div className="mt-12 border-t border-line pt-6">
        <DeleteConcertButton concertId={concert.id} mediaPaths={concert.concert_media.map((m) => m.storage_path)} />
      </div>
    </div>
  );
}
