import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalFooter,
  LegalHeader,
  LegalPageHeading,
  LegalSection,
  LegalSummaryRow,
  legalLinkClass
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Exclusão de Dados | DAR+ Serviços | Formação",
  description:
    "Como pedir a exclusão dos seus dados pessoais tratados pela DAR+ Serviços | Formação (Horizon LTDA) em conversas de WhatsApp."
};

const LAST_UPDATE = "22/09/2026";
const COMPANY_CNPJ = "64.150.131/0001-38";
const CONTACT_EMAIL = "horizontecnologiaa@gmail.com";
const CONTACT_WHATSAPP_NOTE =
  "o número de WhatsApp em que você conversou com a DAR+ Serviços | Formação";

function ContactEmail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className={legalLinkClass}>
      {CONTACT_EMAIL}
    </a>
  );
}

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-background">
      <LegalHeader />

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-14 lg:pt-20">
        <LegalPageHeading
          eyebrow="Documento legal"
          title="Exclusão de"
          emphasis="Dados"
          lastUpdate={LAST_UPDATE}
          lead={
            <>
              Se você conversou pelo WhatsApp com a DAR+ Serviços | Formação e quer que
              apaguemos os seus dados pessoais, esta página explica exatamente como pedir e o
              que acontece depois.
            </>
          }
        />

        <dl className="mt-10 max-w-3xl overflow-hidden rounded-lg border bg-card">
          <LegalSummaryRow label="Responsável pelos dados">Horizon LTDA</LegalSummaryRow>
          <LegalSummaryRow label="CNPJ">{COMPANY_CNPJ}</LegalSummaryRow>
          <LegalSummaryRow label="Sede">Rua Bananeiras, 361, Manaíra, João Pessoa/PB, Brasil</LegalSummaryRow>
          <LegalSummaryRow label="Contato">
            <ContactEmail />
          </LegalSummaryRow>
          <LegalSummaryRow label="Encarregado (DPO)">
            Daniel Lucas, pelo mesmo e-mail de contato
          </LegalSummaryRow>
        </dl>

        <div className="mt-14 max-w-[44rem]">
          <LegalSection id="como-pedir" number={1} title="Como pedir a exclusão">
            <p>Você tem duas formas de pedir, e pode usar a que for mais fácil:</p>
            <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-foreground">
              <li>
                <strong>Pelo próprio WhatsApp:</strong> mande a mensagem &ldquo;Excluir meus
                dados&rdquo; para o mesmo número em que você conversou com a DAR+ Serviços |
                Formação.
              </li>
              <li>
                <strong>Por e-mail:</strong> escreva para <ContactEmail /> informando{" "}
                {CONTACT_WHATSAPP_NOTE} e o pedido de exclusão dos seus dados.
              </li>
            </ol>
          </LegalSection>

          <LegalSection id="confirmacao" number={2} title="Como confirmamos que é você">
            <p>
              Para não apagar os dados de outra pessoa por engano, confirmamos o pedido pelo
              mesmo canal usado para pedir — por exemplo, respondendo pelo próprio número de
              WhatsApp que enviou a mensagem, ou por e-mail de confirmação.
            </p>
          </LegalSection>

          <LegalSection id="o-que-e-excluido" number={3} title="O que é excluído">
            <p>Depois de confirmado o seu pedido, apagamos:</p>
            <ul>
              <li>O conteúdo das conversas (mensagens de texto e arquivos enviados);</li>
              <li>Os dados de contato ligados ao seu número (nome, telefone);</li>
              <li>
                As informações de qualificação registradas sobre você (interesse, região,
                orçamento, urgência e afins).
              </li>
            </ul>
            <p>
              Alguns dados podem ser mantidos por tempo determinado quando a lei exigir ou para
              defesa em eventual processo — nesse caso, explicamos qual dado e por quê, na
              resposta ao seu pedido.
            </p>
          </LegalSection>

          <LegalSection id="prazo" number={4} title="Prazo de resposta">
            <p>
              Respondemos ao seu pedido em até 15 dias, conforme a LGPD (Lei nº 13.709/2018,
              art. 19, II), e no máximo em um mês, conforme o RGPD (Regulamento (UE) 2016/679,
              art. 12, 3), quando aplicável.
            </p>
          </LegalSection>

          <LegalSection id="mais-informacoes" number={5} title="Mais informações">
            <p>
              Esta página trata só do pedido de exclusão. Para entender quais dados coletamos,
              por que os usamos e quais são os seus outros direitos, veja a{" "}
              <Link href="/privacidade" className={legalLinkClass}>
                Política de Privacidade
              </Link>
              .
            </p>
          </LegalSection>
        </div>
      </main>

      <LegalFooter docName="Exclusão de Dados" lastUpdate={LAST_UPDATE} />
    </div>
  );
}
