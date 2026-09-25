import { company } from "@/lib/company";
import { LEGAL_UPDATED_LABEL } from "@/lib/legal";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-3xl md:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-muted">Last updated {LEGAL_UPDATED_LABEL}.</p>
      <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-xl text-ink">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}

export function Mail({ address }: { address: string }) {
  return (
    <a href={`mailto:${address}`} className="text-accent underline-offset-4 hover:underline">
      {address}
    </a>
  );
}

export function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-4 hover:underline">
      {children}
    </a>
  );
}

/** The operator's identity, showing only the details that have been filled in. */
export function CompanyDetails() {
  return (
    <p>
      <Strong>{company.legalName}</Strong>, a company registered in {company.country}
      {company.registryCode && <>, registry code {company.registryCode}</>}
      {company.address && <>, {company.address}</>}
      {company.vatNumber && <>, VAT number {company.vatNumber}</>}.
    </p>
  );
}
