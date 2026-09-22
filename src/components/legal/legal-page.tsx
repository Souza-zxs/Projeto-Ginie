// Peças reutilizadas pelas páginas jurídicas públicas (/privacidade, /termos):
// mesmo cabeçalho, rodapé, índice lateral e estilo de seção numerada.
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const legalLinkClass =
  "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export type LegalSectionMeta = { id: string; title: string };

/** Marca dado que ainda precisa ser preenchido/confirmado antes da publicação. */
export function Pendente({ children = "a definir" }: { children?: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[0.85em] font-medium text-foreground">
      {children}
    </span>
  );
}

export function LegalSection({
  id,
  number,
  title,
  children
}: {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t py-10 first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-4">
        <span aria-hidden className="font-display text-3xl font-semibold leading-none text-primary">
          {String(number).padStart(2, "0")}
        </span>
        <h2 className="font-display text-2xl font-semibold leading-snug text-foreground">{title}</h2>
      </div>
      <div className="mt-5 space-y-4 text-[15px] leading-7 text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-primary">
        {children}
      </div>
    </section>
  );
}

export function LegalSummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid border-t first:border-t-0 sm:grid-cols-[13rem_1fr]">
      <dt className="bg-muted px-4 py-3 text-sm font-semibold text-foreground">{label}</dt>
      <dd className="px-4 py-3 text-sm leading-6 text-foreground">{children}</dd>
    </div>
  );
}

export function LegalHeader() {
  return (
    <header className="border-b bg-card print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/login" aria-label="DAR+ Serviços | Formação — ir para o acesso à plataforma">
          <Image
            src="/brand/logo-fill.png"
            alt="DAR+ Serviços | Formação"
            width={168}
            height={70}
            priority
            className="h-auto w-[120px]"
          />
        </Link>
        <Link href="/login" className={`${legalLinkClass} inline-flex min-h-11 items-center text-sm`}>
          Acesso à plataforma
        </Link>
      </div>
    </header>
  );
}

export function LegalFooter({ docName, lastUpdate }: { docName: string; lastUpdate: string }) {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-foreground/70 sm:flex-row sm:justify-between">
        <span>Horizon LTDA · {docName} · Versão 1.0</span>
        <span>Atualizada em {lastUpdate}</span>
      </div>
    </footer>
  );
}

export function LegalTableOfContents({
  sections,
  className = ""
}: {
  sections: LegalSectionMeta[];
  className?: string;
}) {
  return (
    <ol className={className}>
      {sections.map((section, index) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm leading-5 text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span aria-hidden className="w-5 shrink-0 font-display text-foreground/60">
              {String(index + 1).padStart(2, "0")}
            </span>
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Índice recolhível no celular / fixo no desktop, já com o wrapper de layout. */
export function LegalSidebar({ sections }: { sections: LegalSectionMeta[] }) {
  return (
    <aside className="print:hidden lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto">
      <details className="rounded-lg border bg-card lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-foreground">
          Nesta página
        </summary>
        <LegalTableOfContents sections={sections} className="border-t px-2 py-2" />
      </details>
      <nav aria-label="Nesta página" className="hidden lg:block">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
          Nesta página
        </p>
        <LegalTableOfContents sections={sections} />
      </nav>
    </aside>
  );
}

export function LegalPageHeading({
  eyebrow,
  title,
  emphasis,
  lead,
  lastUpdate
}: {
  eyebrow: string;
  title: string;
  /** Trecho do título em destaque (itálico), ex.: "Privacidade" em "Política de Privacidade". */
  emphasis: string;
  lead: ReactNode;
  lastUpdate: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">{eyebrow}</p>
      <h1 className="mt-3 font-display text-[2.4rem] font-semibold leading-[1.1] text-foreground sm:text-5xl">
        {title} <em className="italic">{emphasis}</em>
      </h1>
      <span aria-hidden className="mt-5 block h-[3px] w-12 rounded-full bg-primary" />
      <p className="mt-6 text-base leading-7 text-foreground">{lead}</p>
      <p className="mt-3 text-sm text-foreground/70">Última atualização: {lastUpdate} · Versão 1.0</p>
    </div>
  );
}
