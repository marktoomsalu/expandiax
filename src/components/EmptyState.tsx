import Link from "next/link";

type Props = {
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  children?: React.ReactNode;
};

export function EmptyState({ title, body, actionLabel, actionHref, children }: Props) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <h2 className="font-serif text-2xl md:text-3xl">{title}</h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-7">
        {actionLabel && actionHref ? (
          <Link href={actionHref} className="btn-accent">{actionLabel}</Link>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
