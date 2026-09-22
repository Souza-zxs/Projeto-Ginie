import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-16">
      {/* Glow assimétrico + trama de pontos: textura de marca sem cair no gradiente roxo/azul genérico */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "hsl(var(--primary))" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[38vw] opacity-[0.5] lg:block"
        style={{
          backgroundImage: "radial-gradient(hsl(var(--primary) / 0.35) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(to left, black, transparent 85%)"
        }}
      />

      <section className="relative w-full max-w-md motion-safe:animate-fade-up">
        <Image
          src="/brand/logo-fill.png"
          alt="DAR+ Serviços | Formação"
          width={168}
          height={70}
          priority
          className="mx-auto h-auto w-[168px]"
        />

        <div className="mt-10 mb-9 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Acesso à plataforma
          </p>
          <h1 className="mt-3 font-display text-[2.1rem] leading-[1.15] text-slate-950">
            Bem-vindo <em className="italic text-primary">de volta</em>
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-12 rounded-full bg-primary" />
          <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
            Entre para gerenciar campanhas, conversas, leads e equipe.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-7 shadow-soft">
          <LoginForm redirectTo={params.redirectTo} />
        </div>

        <p className="mt-6 text-center text-sm text-foreground/70">
          Ao entrar, você concorda com os{" "}
          <Link
            href="/termos"
            className="whitespace-nowrap font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Termos de Uso
          </Link>{" "}
          e com a{" "}
          <Link
            href="/privacidade"
            className="whitespace-nowrap font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Política de Privacidade
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
