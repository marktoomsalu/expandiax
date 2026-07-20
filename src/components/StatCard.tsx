import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("card px-5 py-6", className)}>
      <p className="eyebrow">{label}</p>
      <p className="stat-number mt-3">{value}</p>
      {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}
    </div>
  );
}
