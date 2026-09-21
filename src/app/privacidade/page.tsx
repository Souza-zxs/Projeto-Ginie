import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Política de Privacidade | DAR+ Serviços | Formação",
  description:
    "Como a Horizon LTDA trata os dados pessoais de quem conversa com a DAR+ Serviços | Formação pelo WhatsApp."
};

const LAST_UPDATE = "21/09/2026";

const sections = [
  { id: "quem-somos", title: "Quem somos e qual é o nosso papel" },
  { id: "dados-coletados", title: "Quais dados coletamos" },
  { id: "finalidades", title: "Para que usamos os dados" },
  { id: "inteligencia-artificial", title: "Atendimento com inteligência artificial" },
  { id: "compartilhamento", title: "Com quem compartilhamos" },
  { id: "transferencia-internacional", title: "Transferência internacional" },
  { id: "retencao", title: "Por quanto tempo guardamos" },
  { id: "direitos", title: "Seus direitos" },
  { id: "exclusao", title: "Como pedir a exclusão dos seus dados" },
  { id: "seguranca", title: "Segurança" },
  { id: "cookies", title: "Cookies" },
  { id: "menores", title: "Crianças e adolescentes" },
  { id: "alteracoes", title: "Alterações desta política" },
  { id: "contato", title: "Contato e autoridades" }
];

/** Marca dado que ainda precisa ser preenchido/confirmado antes da publicação. */
function Pendente({ children = "a definir" }: { children?: ReactNode }) {
  return (
    <span className="whitespace-nowrap rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[0.85em] font-medium text-foreground">
      {children}
    </span>
  );
}

function Section({
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

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid border-t first:border-t-0 sm:grid-cols-[13rem_1fr]">
      <dt className="bg-muted px-4 py-3 text-sm font-semibold text-foreground">{label}</dt>
      <dd className="px-4 py-3 text-sm leading-6 text-foreground">{children}</dd>
    </div>
  );
}

const linkClass =
  "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-4 hover:decoration-foreground focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
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
          <Link href="/login" className={`${linkClass} inline-flex min-h-11 items-center text-sm`}>
            Acesso à plataforma
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-14 lg:pt-20">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
            Documento legal
          </p>
          <h1 className="mt-3 font-display text-[2.4rem] font-semibold leading-[1.1] text-foreground sm:text-5xl">
            Política de <em className="italic">Privacidade</em>
          </h1>
          <span aria-hidden className="mt-5 block h-[3px] w-12 rounded-full bg-primary" />
          <p className="mt-6 text-base leading-7 text-foreground">
            Explicamos aqui, sem rodeios, quais dados pessoais tratamos quando você conversa com a
            DAR+ Serviços | Formação pelo WhatsApp, por que fazemos isso e como você controla essas
            informações.
          </p>
          <p className="mt-3 text-sm text-foreground/70">
            Última atualização: {LAST_UPDATE} · Versão 1.0
          </p>
        </div>

        <dl className="mt-10 max-w-3xl overflow-hidden rounded-lg border bg-card">
          <SummaryRow label="Responsável pelos dados">Horizon LTDA</SummaryRow>
          <SummaryRow label="CNPJ">
            <Pendente />
          </SummaryRow>
          <SummaryRow label="Sede">
            João Pessoa/PB, Brasil · endereço completo <Pendente />
          </SummaryRow>
          <SummaryRow label="Contato de privacidade">
            <Pendente>e-mail a definir</Pendente>
          </SummaryRow>
          <SummaryRow label="Encarregado (DPO)">
            <Pendente />
          </SummaryRow>
          <SummaryRow label="Leis aplicáveis">
            LGPD (Lei nº 13.709/2018, Brasil) e RGPD (Regulamento (UE) 2016/679, União Europeia)
          </SummaryRow>
        </dl>

        <div className="mt-14 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          <aside className="print:hidden lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto">
            <details className="rounded-lg border bg-card lg:hidden">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-foreground">
                Nesta página
              </summary>
              <TableOfContents className="border-t px-2 py-2" />
            </details>
            <nav aria-label="Nesta página" className="hidden lg:block">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
                Nesta página
              </p>
              <TableOfContents />
            </nav>
          </aside>

          <article className="max-w-[44rem]">
            <Section id="quem-somos" number={1} title="Quem somos e qual é o nosso papel">
              <p>
                A plataforma da DAR+ Serviços | Formação é operada pela <strong>Horizon LTDA</strong>{" "}
                (&ldquo;Horizon&rdquo;, &ldquo;nós&rdquo;), agência de soluções web com sede em João
                Pessoa/PB. Para os dados descritos nesta política, a Horizon atua como{" "}
                <strong>responsável pelo tratamento</strong> (controladora, na LGPD).
              </p>
              <p>
                Esta política vale para qualquer pessoa que troque mensagens pelo WhatsApp com os
                números atendidos pela plataforma e para os usuários que acessam o painel interno.
              </p>
            </Section>

            <Section id="dados-coletados" number={2} title="Quais dados coletamos">
              <p>Coletamos apenas o necessário para atender você:</p>
              <ul>
                <li>
                  <strong>Identificação e contato:</strong> nome (quando você informa) e número de
                  telefone do WhatsApp.
                </li>
                <li>
                  <strong>Conteúdo das conversas:</strong> as mensagens de texto e os arquivos que você
                  enviar (imagens, áudios, documentos), com data e hora.
                </li>
                <li>
                  <strong>Informações de qualificação:</strong> o que você nos conta sobre o que
                  procura, como serviço ou formação de interesse, região, orçamento, urgência e se
                  deseja uma visita.
                </li>
                <li>
                  <strong>Dados técnicos de atendimento:</strong> registros de envio e entrega das
                  mensagens e do andamento do seu atendimento.
                </li>
                <li>
                  <strong>Usuários do painel:</strong> e-mail, nome e função de quem acessa a
                  plataforma pela equipe.
                </li>
              </ul>
              <p>
                Não pedimos dados sensíveis (saúde, religião, origem racial, biometria e similares).
                Se você os enviar por conta própria, eles serão tratados com o mesmo cuidado, mas
                pedimos que evite fazê-lo.
              </p>
            </Section>

            <Section id="finalidades" number={3} title="Para que usamos os dados">
              <ul>
                <li>
                  <strong>Responder e conduzir o seu atendimento</strong> — execução do serviço ou de
                  diligências que você solicitou (LGPD, art. 7º, V; RGPD, art. 6º, 1, b).
                </li>
                <li>
                  <strong>Agendar visitas e enviar lembretes</strong> ligados ao seu atendimento (mesma
                  base).
                </li>
                <li>
                  <strong>Enviar comunicações de campanha e acompanhamento</strong> quando você as
                  aceitou ou quando há interesse legítimo compatível com o seu contato inicial (LGPD,
                  art. 7º, IX; RGPD, art. 6º, 1, f). Você pode pedir a qualquer momento que paremos.
                </li>
                <li>
                  <strong>Cumprir obrigações legais e proteger direitos</strong> em caso de disputa
                  (LGPD, art. 7º, II e VI; RGPD, art. 6º, 1, c).
                </li>
                <li>
                  <strong>Manter a segurança e melhorar o atendimento</strong>, com dados agregados
                  sempre que possível.
                </li>
              </ul>
              <p>Não vendemos os seus dados nem os usamos para publicidade de terceiros.</p>
            </Section>

            <Section
              id="inteligencia-artificial"
              number={4}
              title="Atendimento com inteligência artificial"
            >
              <p>
                Parte das respostas é gerada por um assistente de inteligência artificial, que lê a
                conversa para responder, qualificar o seu interesse e, quando faz sentido, sugerir uma
                visita. Uma pessoa da equipe pode assumir a conversa a qualquer momento, e você pode
                pedir para falar com um humano.
              </p>
              <p>
                O assistente não toma decisões com efeito jurídico sobre você nem concede ou nega
                serviços de forma automática. Você pode pedir a revisão de qualquer decisão tomada
                com base em tratamento automatizado (LGPD, art. 20).
              </p>
              <p>
                O modelo que gera as respostas é executado em infraestrutura operada pela Horizon,
                sem envio do conteúdo das conversas a um provedor de IA de terceiros.{" "}
                <Pendente>confirmar antes de publicar</Pendente>
              </p>
            </Section>

            <Section id="compartilhamento" number={5} title="Com quem compartilhamos">
              <p>
                Usamos prestadores que tratam dados em nosso nome e sob as nossas instruções
                (operadores/subcontratantes):
              </p>
              <ul>
                <li>
                  <strong>Meta Platforms (WhatsApp Business Platform):</strong> envio e recebimento
                  das mensagens pelo WhatsApp.
                </li>
                <li>
                  <strong>Uazapi:</strong> canal complementar de mensagens pelo WhatsApp.
                </li>
                <li>
                  <strong>Supabase:</strong> banco de dados, autenticação e armazenamento de
                  arquivos.
                </li>
                <li>
                  <strong>Vercel:</strong> hospedagem da aplicação.
                </li>
              </ul>
              <p>
                Dentro da nossa equipe e da equipe do serviço que atende você, o acesso é limitado a
                quem precisa dele para o atendimento. Também podemos compartilhar dados quando a lei
                ou uma autoridade competente exigir.
              </p>
            </Section>

            <Section
              id="transferencia-internacional"
              number={6}
              title="Transferência internacional"
            >
              <p>
                Os prestadores acima podem processar dados fora do país onde você está, inclusive
                fora do Brasil e do Espaço Econômico Europeu. Nesses casos, adotamos as garantias
                previstas em lei, como cláusulas contratuais padrão e prestadores com compromissos
                reconhecidos de proteção de dados (LGPD, arts. 33 a 36; RGPD, arts. 44 a 49).
              </p>
              <p>
                Região de armazenamento do banco de dados: <Pendente />
              </p>
            </Section>

            <Section id="retencao" number={7} title="Por quanto tempo guardamos">
              <p>
                Guardamos os dados enquanto durar o seu atendimento e pelo tempo necessário para
                cumprir obrigações legais ou exercer direitos em eventual disputa. Depois disso, os
                dados são eliminados ou anonimizados.
              </p>
              <p>
                Prazo de retenção das conversas e dos dados de contato: <Pendente />
              </p>
            </Section>

            <Section id="direitos" number={8} title="Seus direitos">
              <p>Você pode, a qualquer momento e sem custo:</p>
              <ul>
                <li>saber se tratamos dados seus e ter acesso a eles;</li>
                <li>corrigir dados incompletos, inexatos ou desatualizados;</li>
                <li>pedir a eliminação dos dados, a anonimização ou o bloqueio dos desnecessários;</li>
                <li>receber os seus dados em formato estruturado (portabilidade);</li>
                <li>
                  opor-se ao tratamento baseado em interesse legítimo e pedir a limitação do
                  tratamento;
                </li>
                <li>retirar um consentimento que tenha dado, sem prejuízo do que já foi feito;</li>
                <li>saber com quem compartilhamos os seus dados;</li>
                <li>pedir a revisão de decisões tomadas de forma automatizada.</li>
              </ul>
              <p>
                Para exercer qualquer direito, use o contato indicado na seção{" "}
                <a href="#contato" className={linkClass}>
                  Contato e autoridades
                </a>
                . Respondemos em até 15 dias, conforme a LGPD (art. 19, II), e no máximo em um mês,
                conforme o RGPD (art. 12, 3). Podemos pedir informações para confirmar que o pedido
                vem de você.
              </p>
            </Section>

            <Section id="exclusao" number={9} title="Como pedir a exclusão dos seus dados">
              <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-foreground">
                <li>
                  Envie uma mensagem para o contato de privacidade informando o número de telefone do
                  WhatsApp usado nas conversas e o pedido &ldquo;Excluir meus dados&rdquo;.
                </li>
                <li>
                  Confirmaremos a sua identidade, por exemplo respondendo pelo próprio número de
                  WhatsApp.
                </li>
                <li>
                  Eliminaremos as conversas, os dados de contato e as informações de qualificação
                  ligados ao seu número e avisaremos quando terminar, nos prazos da seção anterior.
                </li>
              </ol>
              <p>
                Alguns dados podem ser mantidos pelo tempo que a lei exigir ou para defesa em
                processos, e nesse caso explicaremos qual e por quê.
              </p>
            </Section>

            <Section id="seguranca" number={10} title="Segurança">
              <p>
                Usamos conexões criptografadas (HTTPS), controle de acesso por organização e por
                função, chaves de acesso guardadas apenas no servidor e registro das operações
                relevantes. Nenhum sistema é totalmente imune a falhas; se houver incidente que possa
                gerar risco relevante a você, comunicaremos você e a autoridade competente nos termos
                da lei.
              </p>
            </Section>

            <Section id="cookies" number={11} title="Cookies">
              <p>
                Esta página não usa cookies de publicidade nem de análise de comportamento. O painel
                interno usa apenas cookies estritamente necessários para manter o login da equipe.
              </p>
            </Section>

            <Section id="menores" number={12} title="Crianças e adolescentes">
              <p>
                Nossos serviços não são direcionados a menores de 18 anos. Se você acredita que uma
                criança ou adolescente nos enviou dados sem autorização de quem responde por ele,
                fale com a gente para que possamos eliminá-los.
              </p>
            </Section>

            <Section id="alteracoes" number={13} title="Alterações desta política">
              <p>
                Podemos atualizar esta política para refletir mudanças na lei ou no serviço. A data
                da última revisão fica no topo desta página, e mudanças relevantes serão comunicadas
                por um canal adequado.
              </p>
            </Section>

            <Section id="contato" number={14} title="Contato e autoridades">
              <p>
                Dúvidas, pedidos e reclamações sobre privacidade: <Pendente>e-mail a definir</Pendente>
                .
              </p>
              <p>
                Você também pode reclamar à autoridade de proteção de dados do seu país: no Brasil, a{" "}
                <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>; em Portugal, a{" "}
                <strong>Comissão Nacional de Proteção de Dados (CNPD)</strong>.
              </p>
            </Section>
          </article>
        </div>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-foreground/70 sm:flex-row sm:justify-between">
          <span>Horizon LTDA · Política de Privacidade · Versão 1.0</span>
          <span>Atualizada em {LAST_UPDATE}</span>
        </div>
      </footer>
    </div>
  );
}

function TableOfContents({ className = "" }: { className?: string }) {
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
