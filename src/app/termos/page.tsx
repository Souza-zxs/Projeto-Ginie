import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalFooter,
  LegalHeader,
  LegalPageHeading,
  LegalSection,
  LegalSidebar,
  LegalSummaryRow,
  Pendente,
  legalLinkClass
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Termos de Uso | DAR+ Serviços | Formação",
  description:
    "Regras de uso da plataforma DAR+ Serviços | Formação, operada pela Horizon LTDA, para quem cria conta e gerencia atendimento, campanhas e CRM."
};

const LAST_UPDATE = "22/09/2026";
const COMPANY_CNPJ = "64.150.131/0001-38";
const CONTACT_EMAIL = "horizontecnologiaa@gmail.com";

const sections = [
  { id: "aceitacao", title: "Aceitação destes termos" },
  { id: "quem-somos", title: "Quem somos" },
  { id: "o-servico", title: "O que é a plataforma" },
  { id: "conta", title: "Conta e acesso" },
  { id: "planos", title: "Planos e pagamento" },
  { id: "uso-aceitavel", title: "Uso aceitável e canais de mensagem" },
  { id: "conteudo-do-cliente", title: "Dados e conteúdo inseridos por você" },
  { id: "inteligencia-artificial", title: "Uso de inteligência artificial" },
  { id: "propriedade-intelectual", title: "Propriedade intelectual" },
  { id: "disponibilidade", title: "Disponibilidade e suporte" },
  { id: "responsabilidade", title: "Limitação de responsabilidade" },
  { id: "suspensao", title: "Suspensão e encerramento" },
  { id: "alteracoes", title: "Alterações destes termos" },
  { id: "lei-e-foro", title: "Lei aplicável e foro" },
  { id: "contato", title: "Contato" }
];

function ContactEmail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={legalLinkClass}>
      {CONTACT_EMAIL}
    </a>
  );
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      <LegalHeader />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-14 lg:pt-20">
        <LegalPageHeading
          eyebrow="Documento legal"
          title="Termos de"
          emphasis="Uso"
          lastUpdate={LAST_UPDATE}
          lead={
            <>
              Estas são as regras para usar a plataforma DAR+ Serviços | Formação: o que você pode
              fazer, do que você é responsável e o que a Horizon garante e não garante.
            </>
          }
        />

        <dl className="mt-10 max-w-3xl overflow-hidden rounded-lg border bg-card">
          <LegalSummaryRow label="Fornecedora da plataforma">Horizon LTDA</LegalSummaryRow>
          <LegalSummaryRow label="CNPJ">{COMPANY_CNPJ}</LegalSummaryRow>
          <LegalSummaryRow label="Sede">Rua Bananeiras, 361, Manaíra, João Pessoa/PB, Brasil</LegalSummaryRow>
          <LegalSummaryRow label="Contato">
            <ContactEmail />
          </LegalSummaryRow>
          <LegalSummaryRow label="Documento relacionado">
            <Link href="/privacidade" className={legalLinkClass}>
              Política de Privacidade
            </Link>
          </LegalSummaryRow>
          <LegalSummaryRow label="Lei aplicável">
            Leis da República Federativa do Brasil <Pendente>confirmar com o jurídico</Pendente>
          </LegalSummaryRow>
        </dl>

        <div className="mt-14 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          <LegalSidebar sections={sections} />

          <article className="max-w-[44rem]">
            <LegalSection id="aceitacao" number={1} title="Aceitação destes termos">
              <p>
                Ao criar uma conta ou usar a plataforma DAR+ Serviços | Formação (&ldquo;plataforma&rdquo;),
                você concorda com estes Termos de Uso e com a{" "}
                <Link href="/privacidade" className={legalLinkClass}>
                  Política de Privacidade
                </Link>
                . Se você está aceitando em nome de uma empresa, declara ter poderes para isso, e
                &ldquo;você&rdquo;, nestes termos, se refere a essa empresa.
              </p>
              <p>Se você não concorda com algum ponto, não utilize a plataforma.</p>
            </LegalSection>

            <LegalSection id="quem-somos" number={2} title="Quem somos">
              <p>
                A plataforma é desenvolvida e operada pela <strong>Horizon LTDA</strong>{" "}
                (&ldquo;Horizon&rdquo;, &ldquo;nós&rdquo;), agência de soluções web com sede em João
                Pessoa/PB. A Horizon fornece o software; quem contrata e usa a plataforma para atender
                seus próprios clientes e leads é o &ldquo;cliente&rdquo; ou &ldquo;você&rdquo;.
              </p>
            </LegalSection>

            <LegalSection id="o-servico" number={3} title="O que é a plataforma">
              <p>A plataforma permite, entre outras funções:</p>
              <ul>
                <li>Atender leads e clientes pelo WhatsApp, com apoio de um agente de inteligência artificial;</li>
                <li>Criar e disparar campanhas de mensagens;</li>
                <li>Acompanhar conversas numa caixa de entrada (Inbox);</li>
                <li>Organizar leads num CRM em formato Kanban;</li>
                <li>Cadastrar equipe e regras de atendimento e follow-up;</li>
                <li>Integrar com o WhatsApp Business Platform (Meta) e, opcionalmente, outros canais.</li>
              </ul>
              <p>
                Podemos adicionar, alterar ou remover funções ao longo do tempo, para manter a
                plataforma segura, atualizada e em conformidade com regras de terceiros (como as
                políticas do WhatsApp).
              </p>
            </LegalSection>

            <LegalSection id="conta" number={4} title="Conta e acesso">
              <ul>
                <li>Você é responsável por manter a confidencialidade das credenciais de acesso da sua equipe;</li>
                <li>Você é responsável por tudo que acontecer na sua conta, inclusive ações de pessoas que você convidou;</li>
                <li>Avise-nos imediatamente se suspeitar de acesso não autorizado;</li>
                <li>
                  Não usaremos as informações da sua conta para fins alheios à prestação do serviço, conforme a{" "}
                  <Link href="/privacidade" className={legalLinkClass}>
                    Política de Privacidade
                  </Link>
                  .
                </li>
              </ul>
            </LegalSection>

            <LegalSection id="planos" number={5} title="Planos e pagamento">
              <p>
                O plano contratado, o valor, a forma e a periodicidade de cobrança são os informados
                na proposta comercial ou contrato firmado entre você e a Horizon. Em caso de
                divergência entre estes termos e o que foi comercialmente acordado, prevalece o que
                está na proposta ou contrato assinado.
              </p>
              <p>
                Você pode cancelar o plano quando quiser, avisando a Horizon pelo contato indicado na
                seção{" "}
                <a href="#contato" className={legalLinkClass}>
                  Contato
                </a>
                . O cancelamento encerra as cobranças futuras, mas não gera reembolso do período já
                pago e em curso no momento do pedido.
              </p>
              <p>
                Custos de serviços de terceiros necessários ao funcionamento da plataforma (como a
                API do WhatsApp Business, provedores de mensageria ou infraestrutura de nuvem) podem
                ser cobrados à parte, conforme informado previamente.
              </p>
            </LegalSection>

            <LegalSection id="uso-aceitavel" number={6} title="Uso aceitável e canais de mensagem">
              <p>Ao usar a plataforma para enviar mensagens, você se compromete a:</p>
              <ul>
                <li>
                  <strong>Só mandar mensagem para quem já tem relação com você</strong> ou deu
                  consentimento para ser contatado, respeitando a LGPD, o RGPD (quando aplicável) e as
                  políticas do WhatsApp Business;
                </li>
                <li>Não usar a plataforma para spam, phishing, conteúdo enganoso, ilegal ou que viole direitos de terceiros;</li>
                <li>Não tentar contornar limites técnicos, de segurança ou de uso impostos pela plataforma ou pela Meta;</li>
                <li>Manter os dados de contatos importados atualizados e obtidos de forma lícita.</li>
              </ul>
              <p>
                <strong>Você é o único responsável</strong> pelo conteúdo das campanhas e mensagens
                enviadas pela sua conta e pelas consequências de um eventual bloqueio, banimento ou
                penalidade aplicada pela Meta/WhatsApp ao seu número em razão desse uso. A Horizon
                pode suspender o envio de campanhas que identifique como abusivas, para proteger a
                reputação do número e da plataforma como um todo.
              </p>
            </LegalSection>

            <LegalSection id="conteudo-do-cliente" number={7} title="Dados e conteúdo inseridos por você">
              <p>
                Os dados de leads, contatos, conversas e materiais que você cadastra na plataforma
                continuam sendo seus. A Horizon os trata como <strong>operadora</strong>, seguindo suas
                instruções e a{" "}
                <Link href="/privacidade" className={legalLinkClass}>
                  Política de Privacidade
                </Link>
                , e não os utiliza para finalidade própria alheia à prestação do serviço.
              </p>
              <p>
                Você garante ter base legal para coletar e processar os dados pessoais que insere na
                plataforma, inclusive o consentimento dos seus próprios leads e clientes, quando
                exigido por lei.
              </p>
            </LegalSection>

            <LegalSection id="inteligencia-artificial" number={8} title="Uso de inteligência artificial">
              <p>
                O agente de inteligência artificial ajuda a responder e qualificar leads, mas pode
                cometer erros, entender mal uma mensagem ou fornecer uma resposta incompleta. A
                Horizon não garante que as respostas geradas por IA sejam sempre precisas, atualizadas
                ou adequadas a cada situação.
              </p>
              <p>
                Você é responsável por revisar as configurações do agente (prompt, regras de
                qualificação, materiais) e por supervisionar o atendimento, especialmente em decisões
                comerciais importantes. A plataforma permite que uma pessoa da sua equipe assuma
                qualquer conversa a qualquer momento.
              </p>
            </LegalSection>

            <LegalSection id="propriedade-intelectual" number={9} title="Propriedade intelectual">
              <p>
                O software, o design, as marcas e a tecnologia da plataforma pertencem à Horizon (ou
                a seus licenciantes) e são protegidos por lei. Estes termos não transferem nenhuma
                propriedade a você, apenas o direito de uso da plataforma enquanto durar o contrato.
              </p>
              <p>
                Você não pode copiar, modificar, fazer engenharia reversa ou redistribuir a
                plataforma, nem usar as marcas da Horizon sem autorização por escrito.
              </p>
            </LegalSection>

            <LegalSection id="disponibilidade" number={10} title="Disponibilidade e suporte">
              <p>
                A Horizon envida esforços para manter a plataforma disponível, mas não garante
                operação ininterrupta. Podem ocorrer interrupções para manutenção, atualização ou por
                fatores fora do nosso controle, incluindo indisponibilidade de serviços de terceiros
                (Meta/WhatsApp, provedores de nuvem, provedores de IA).
              </p>
              <p>
                Não há, por ora, um nível de serviço (SLA) formal com percentual de disponibilidade
                garantido: a Horizon trabalha em regime de melhor esforço para manter a plataforma no
                ar e corrigir problemas com agilidade. O suporte é prestado pelo contato indicado na
                seção{" "}
                <a href="#contato" className={legalLinkClass}>
                  Contato
                </a>
                , em dias úteis.
              </p>
            </LegalSection>

            <LegalSection id="responsabilidade" number={11} title="Limitação de responsabilidade">
              <p>
                Na máxima extensão permitida em lei, a Horizon não se responsabiliza por danos
                indiretos, lucros cessantes ou perda de dados decorrentes do uso da plataforma, de
                falhas de serviços de terceiros (como o WhatsApp Business Platform) ou de conteúdo
                gerado pelo agente de inteligência artificial.
              </p>
              <p>
                Nada nestes termos exclui responsabilidade que não possa ser legalmente limitada,
                como em casos de dolo ou culpa grave. <Pendente>revisar com o jurídico</Pendente>
              </p>
            </LegalSection>

            <LegalSection id="suspensao" number={12} title="Suspensão e encerramento">
              <p>
                Podemos suspender ou encerrar o acesso à plataforma em caso de descumprimento destes
                termos, uso que coloque em risco a segurança ou a reputação da plataforma, ou
                inadimplência, mediante aviso prévio quando possível.
              </p>
              <p>
                Você pode encerrar o uso da plataforma a qualquer momento, respeitando as condições de
                cancelamento do plano contratado. Ao encerrar, seus dados são tratados conforme a{" "}
                <Link href="/privacidade" className={legalLinkClass}>
                  Política de Privacidade
                </Link>
                .
              </p>
            </LegalSection>

            <LegalSection id="alteracoes" number={13} title="Alterações destes termos">
              <p>
                Podemos atualizar estes termos para refletir mudanças na plataforma, na lei ou nas
                políticas de parceiros como a Meta. A data da última revisão fica no topo desta
                página, e mudanças relevantes serão comunicadas por um canal adequado antes de
                entrarem em vigor.
              </p>
            </LegalSection>

            <LegalSection id="lei-e-foro" number={14} title="Lei aplicável e foro">
              <p>
                Estes termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca de João
                Pessoa/PB para dirimir qualquer controvérsia decorrente deste documento, com renúncia a
                qualquer outro, por mais privilegiado que seja.{" "}
                <Pendente>confirmar com o jurídico, considerando clientes fora do Brasil</Pendente>
              </p>
            </LegalSection>

            <LegalSection id="contato" number={15} title="Contato">
              <p>
                Dúvidas sobre estes termos: <ContactEmail />.
              </p>
            </LegalSection>
          </article>
        </div>
      </main>

      <LegalFooter docName="Termos de Uso" lastUpdate={LAST_UPDATE} />
    </div>
  );
}
