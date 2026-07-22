import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EventForm } from "@/components/EventForm";

export const metadata = { title: "Add event" };

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link href="/events" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Events
      </Link>
      <p className="eyebrow mt-6">New entry</p>
      <h1 className="mt-2 text-3xl md:text-4xl">A moment worth keeping.</h1>
      <p className="mt-2 text-sm text-muted">Save the event first — photos and videos come right after.</p>
      <div className="mt-8">
        <EventForm />
      </div>
    </div>
  );
}
