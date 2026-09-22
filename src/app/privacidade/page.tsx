import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalFooter,
  LegalHeader,
  LegalPageHeading,
  LegalSection,
  LegalSidebar,
  LegalSummaryRow,
  legalLinkClass
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Política de Privacidade | DAR+ Serviços | Formação",
  description:
    "Como a Horizon LTDA trata os dados pessoais de quem conversa com a DAR+ Serviços | Formação pelo WhatsApp."
};

const LAST_UPDATE = "21/09/2026";
const COMPANY_CNPJ = "64.150.131/0001-38";
const PRIVACY_EMAIL = "horizontecnologiaa@gmail.com";

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

function PrivacyEmail() {
  return (
    <a href={`mailto:${PRIVACY_EMAIL}`} className={legalLinkClass}>
      {PRIVACY_EMAIL}
    </a>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <LegalHeader />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-14 lg:pt-20">
        <LegalPageHeading
          eyebrow="Documento legal"
          title="Política de"
          emphasis="Privacidade"
          lastUpdate={LAST_UPDATE}
          lead={
            <>
              Explicamos aqui, sem rodeios, quais dados pessoais tratamos quando você conversa com a
              DAR+ Serviços | Formação pelo WhatsApp, por que fazemos isso e como você controla essas
              informações.
            </>
          }
        />

        <dl className="mt-10 max-w-3xl overflow-hidden rounded-lg border bg-card">
          <LegalSummaryRow label="Responsável pelos dados">Horizon LTDA</LegalSummaryRow>
          <LegalSummaryRow label="CNPJ">{COMPANY_CNPJ}</LegalSummaryRow>
          <LegalSummaryRow label="Sede">Rua Bananeiras, 361, Manaíra, João Pessoa/PB, Brasil</LegalSummaryRow>
          <LegalSummaryRow label="Contato de privacidade">
            <PrivacyEmail />
          </LegalSummaryRow>
          <LegalSummaryRow label="Encarregado (DPO)">
            Daniel Lucas, pelo mesmo e-mail de contato
          </LegalSummaryRow>
          <LegalSummaryRow label="Leis aplicáveis">
            LGPD (Lei nº 13.709/2018, Brasil) e RGPD (Regulamento (UE) 2016/679, União Europeia)
          </LegalSummaryRow>
        </dl>

        <div className="mt-14 grid gap-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
          <LegalSidebar sections={sections} />

          <article className="max-w-[44rem]">
            <LegalSection id="quem-somos" number={1} title="Quem somos e qual é o nosso papel">
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
            </LegalSection>

            <LegalSection id="dados-coletados" number={2} title="Quais dados coletamos">
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
            </LegalSection>

            <LegalSection id="finalidades" number={3} title="Para que usamos os dados">
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
            </LegalSection>

            <LegalSection
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
                sem envio do conteúdo das conversas a um provedor de IA de terceiros.
              </p>
            </LegalSection>

            <LegalSection id="compartilhamento" number={5} title="Com quem compartilhamos">
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
            </LegalSection>

            <LegalSection
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
              <p>Região de armazenamento do banco de dados: América do Sul (São Paulo).</p>
            </LegalSection>

            <LegalSection id="retencao" number={7} title="Por quanto tempo guardamos">
              <p>
                Guardamos os dados enquanto durar o seu atendimento e pelo tempo necessário para
                cumprir obrigações legais ou exercer direitos em eventual disputa. Depois disso, os
                dados são eliminados ou anonimizados.
              </p>
              <p>
                Prazo de retenção das conversas e dos dados de contato: até 5 anos após o
                encerramento do seu atendimento, tempo alinhado ao que pode ser necessário para
                defesa em eventual disputa comercial. Depois disso, eliminamos ou anonimizamos.
              </p>
            </LegalSection>

            <LegalSection id="direitos" number={8} title="Seus direitos">
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
                <a href="#contato" className={legalLinkClass}>
                  Contato e autoridades
                </a>
                . Respondemos em até 15 dias, conforme a LGPD (art. 19, II), e no máximo em um mês,
                conforme o RGPD (art. 12, 3). Podemos pedir informações para confirmar que o pedido
                vem de você.
              </p>
            </LegalSection>

            <LegalSection id="exclusao" number={9} title="Como pedir a exclusão dos seus dados">
              <p>
                Você pode pedir a exclusão dos seus dados a qualquer momento, pelo WhatsApp ou por
                e-mail. O passo a passo completo, com prazo de resposta e o que é excluído, está
                numa página própria:{" "}
                <Link href="/exclusao-dados" className={legalLinkClass}>
                  Exclusão de Dados
                </Link>
                .
              </p>
            </LegalSection>

            <LegalSection id="seguranca" number={10} title="Segurança">
              <p>
                Usamos conexões criptografadas (HTTPS), controle de acesso por organização e por
                função, chaves de acesso guardadas apenas no servidor e registro das operações
                relevantes. Nenhum sistema é totalmente imune a falhas; se houver incidente que possa
                gerar risco relevante a você, comunicaremos você e a autoridade competente nos termos
                da lei.
              </p>
            </LegalSection>

            <LegalSection id="cookies" number={11} title="Cookies">
              <p>
                Esta página não usa cookies de publicidade nem de análise de comportamento. O painel
                interno usa apenas cookies estritamente necessários para manter o login da equipe.
              </p>
            </LegalSection>

            <LegalSection id="menores" number={12} title="Crianças e adolescentes">
              <p>
                Nossos serviços não são direcionados a menores de 18 anos. Se você acredita que uma
                criança ou adolescente nos enviou dados sem autorização de quem responde por ele,
                fale com a gente para que possamos eliminá-los.
              </p>
            </LegalSection>

            <LegalSection id="alteracoes" number={13} title="Alterações desta política">
              <p>
                Podemos atualizar esta política para refletir mudanças na lei ou no serviço. A data
                da última revisão fica no topo desta página, e mudanças relevantes serão comunicadas
                por um canal adequado.
              </p>
            </LegalSection>

            <LegalSection id="contato" number={14} title="Contato e autoridades">
              <p>
                Dúvidas, pedidos e reclamações sobre privacidade: <PrivacyEmail />.
              </p>
              <p>
                Você também pode reclamar à autoridade de proteção de dados do seu país: no Brasil, a{" "}
                <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>; em Portugal, a{" "}
                <strong>Comissão Nacional de Proteção de Dados (CNPD)</strong>.
              </p>
            </LegalSection>
          </article>
        </div>
      </main>

      <LegalFooter docName="Política de Privacidade" lastUpdate={LAST_UPDATE} />
    </div>
  );
}
