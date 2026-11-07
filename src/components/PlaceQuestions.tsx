"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MessagesSquare, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tapSuccess } from "@/lib/haptics";
import { formatRelative } from "@/lib/utils";
import { ReportButton } from "./ReportButton";

export type QAAuthor = { username: string; display_name: string; avatar_url: string | null };
export type QAAnswer = { id: string; user_id: string; body: string; created_at: string; author: QAAuthor | null };
export type QAQuestion = { id: string; user_id: string; body: string; created_at: string; author: QAAuthor | null; answers: QAAnswer[] };
export type QAViewer = QAAuthor & { id: string };

function Face({ a, size = 32 }: { a: QAAuthor | null; size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-serif text-sm text-accent"
      style={{ width: size, height: size }}
    >
      {a?.avatar_url ? <Image src={a.avatar_url} alt="" fill sizes={`${size}px`} className="object-cover" /> : (a?.display_name ?? "?").charAt(0)}
    </span>
  );
}

function Byline({ a, been, at }: { a: QAAuthor | null; been: boolean; at: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
      {a ? (
        <Link href={`/u/${a.username}`} className="font-medium text-ink hover:text-accent">
          {a.display_name}
        </Link>
      ) : (
        <span className="font-medium text-ink">A member</span>
      )}
      {been && (
        <span className="inline-flex items-center gap-0.5 text-accent">
          <BadgeCheck size={12} aria-hidden /> Has been
        </span>
      )}
      <span>· {formatRelative(at)}</span>
    </p>
  );
}

/**
 * "Ask someone who's been": questions about a country, answered by members
 * who've been there (marked "Has been"). Asking notifies the people you
 * follow who've been; answers notify whoever asked.
 */
export function PlaceQuestions({
  countryCode,
  countryName,
  viewer,
  initial,
  beenIds,
}: {
  countryCode: string;
  countryName: string;
  viewer: QAViewer | null;
  initial: QAQuestion[];
  beenIds: string[];
}) {
  const supabase = createClient();
  const been = new Set(beenIds);
  const [questions, setQuestions] = useState(initial);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const placeUrl = `/explore/country/${countryCode.toLowerCase()}`;
  const me = viewer ? { username: viewer.username, display_name: viewer.display_name, avatar_url: viewer.avatar_url } : null;

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!viewer || body.length < 3) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.from("place_questions").insert({ country_code: countryCode, body }).select("id, created_at").single();
    setBusy(false);
    if (err || !data) {
      setError("Couldn't post your question. Try again.");
      return;
    }
    tapSuccess();
    setDraft("");
    setQuestions((qs) => [{ id: data.id, user_id: viewer.id, body, created_at: data.created_at, author: me, answers: [] }, ...qs]);
  }

  async function answer(questionId: string) {
    const body = reply.trim();
    if (!viewer || !body) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.from("place_answers").insert({ question_id: questionId, body }).select("id, created_at").single();
    setBusy(false);
    if (err || !data) {
      setError("Couldn't post your answer. Try again.");
      return;
    }
    tapSuccess();
    setReply("");
    setReplyTo(null);
    setQuestions((qs) =>
      qs.map((q) => (q.id === questionId ? { ...q, answers: [...q.answers, { id: data.id, user_id: viewer.id, body, created_at: data.created_at, author: me }] } : q))
    );
  }

  async function remove(table: "place_questions" | "place_answers", id: string) {
    const { error: err } = await supabase.from(table).delete().eq("id", id);
    if (err) {
      setError("Couldn't delete that. Try again.");
      return;
    }
    setQuestions((qs) =>
      table === "place_questions" ? qs.filter((q) => q.id !== id) : qs.map((q) => ({ ...q, answers: q.answers.filter((a) => a.id !== id) }))
    );
  }

  return (
    <section id="ask" className="mt-12 scroll-mt-24" aria-labelledby="ask-h">
      <h2 id="ask-h" className="flex items-center gap-2 text-2xl">
        <MessagesSquare size={20} className="text-accent" aria-hidden /> Ask someone who&rsquo;s been
      </h2>
      <p className="mt-1 text-sm text-muted">Where to stay, what to skip, the best time to go - answered by members who&rsquo;ve been to {countryName}.</p>

      {viewer ? (
        <form onSubmit={ask} className="mt-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={`What do you want to know about ${countryName}?`}
            className="field min-h-20 resize-y"
            aria-label={`Your question about ${countryName}`}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">Visible to all members. People you follow who&rsquo;ve been here get a notification.</p>
            <button type="submit" disabled={busy || draft.trim().length < 3} className="btn-accent shrink-0 !py-2 text-sm">
              Ask
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-card border border-line bg-surface px-4 py-3 text-sm">
          <Link href={`/sign-up`} className="font-medium text-accent hover:underline">
            Join ExpandiaX
          </Link>{" "}
          to ask people who&rsquo;ve been to {countryName}.
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-800 dark:text-red-400">{error}</p>}

      {questions.length > 0 && (
        <ul className="mt-6 space-y-4">
          {questions.map((q) => (
            <li key={q.id} id={`q-${q.id}`} className="card scroll-mt-24 p-4">
              <div className="flex gap-3">
                <Face a={q.author} />
                <div className="min-w-0 flex-1">
                  <Byline a={q.author} been={been.has(q.user_id)} at={q.created_at} />
                  <p className="mt-1 whitespace-pre-line font-serif text-lg leading-snug">{q.body}</p>
                </div>
              </div>

              {q.answers.length > 0 && (
                <ul className="mt-3 space-y-3 border-l-2 border-accent/30 pl-4">
                  {q.answers.map((a) => (
                    <li key={a.id} className="flex gap-2.5">
                      <Face a={a.author} size={26} />
                      <div className="min-w-0 flex-1">
                        <Byline a={a.author} been={been.has(a.user_id)} at={a.created_at} />
                        <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed">{a.body}</p>
                        <div className="mt-1">
                          {viewer?.id === a.user_id ? (
                            <button type="button" onClick={() => remove("place_answers", a.id)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-700">
                              <Trash2 size={12} aria-hidden /> Delete
                            </button>
                          ) : (
                            viewer && <ReportButton targetType="answer" targetId={a.id} targetUrl={`${placeUrl}#q-${q.id}`} />
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {viewer && (
                <div className="mt-3">
                  {replyTo === q.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void answer(q.id);
                      }}
                    >
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        maxLength={1000}
                        rows={2}
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        placeholder="Share what you know…"
                        className="field min-h-16 resize-y"
                        aria-label="Your answer"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" onClick={() => setReplyTo(null)} className="btn-ghost !py-1.5 text-sm">
                          Cancel
                        </button>
                        <button type="submit" disabled={busy || !reply.trim()} className="btn-accent !py-1.5 text-sm">
                          Answer
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(q.id);
                          setReply("");
                        }}
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        {been.has(viewer.id) ? "Answer - you've been here" : "Answer"}
                      </button>
                      {viewer.id === q.user_id ? (
                        <button type="button" onClick={() => remove("place_questions", q.id)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-700">
                          <Trash2 size={12} aria-hidden /> Delete
                        </button>
                      ) : (
                        <ReportButton targetType="question" targetId={q.id} targetUrl={`${placeUrl}#q-${q.id}`} />
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
