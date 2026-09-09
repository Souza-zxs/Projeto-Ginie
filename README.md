# DAR+ Serviços | Formação — Atendimento, Campanhas e Agentes de IA

SaaS para a DAR+ atender leads de serviços e cursos de formação por WhatsApp com agentes de IA (ChatGPT), disparar campanhas, acompanhar conversas em Inbox e controlar um CRM interno.

Este projeto é uma cópia adaptada do CRM imobiliário original (`crm-imobiliario`), reaproveitando toda a base de agentes de IA + WhatsApp + CRM, com terminologia e prompts ajustados para serviços/formação em vez de imóveis. Veja [Herança e adaptações](#herança-e-adaptações-do-projeto-original) para o que mudou e o que ficou igual por baixo do capô.

Nenhuma credencial real está neste repositório. Configure tudo pelo `.env.local`, pela Vercel ou pelas telas internas do sistema (inclusive marca/logo, em `Configurações > Organização`).

## O Que Tem No Sistema

- Login com Supabase Auth.
- Dashboard operacional com métricas de contatos, mensagens, respostas, campanhas, jobs e agentes.
- Campanhas outbound por Meta WhatsApp Cloud API ou Uazapi.
- Importação de contatos por CSV/XLSX, lista colada ou reaproveitamento de contatos antigos sem envio.
- Normalização de telefone para `55DDDNUMERO` (ajuste para o formato de Portugal/Angola/Moçambique se necessário — ver nota abaixo).
- Inbox com conversas, mídias, resposta manual, status da IA e contexto do lead.
- Agentes de IA configuráveis pelo front-end, usando **ChatGPT (OpenAI)** como LLM.
- Marca DAR+ (logo laranja/cinza) aplicada como padrão do produto, com white-label ainda disponível por organização.
- CRM interno em Kanban.
- Cadastro de equipe técnica e regras de follow-up.
- Webhooks para Meta e Uazapi.
- White-label: nome, logo e cor primária configuráveis em `Configurações > Organização`.

## Stack

- Next.js App Router + TypeScript + TailwindCSS
- Supabase (Auth, Postgres, Storage)
- OpenAI API (ChatGPT) — agente de qualificação de leads
- Meta WhatsApp Cloud API
- Uazapi (canal secundário, para notificar a equipe interna)
- QStash/Upstash para filas
- Vercel

## Estrutura Principal

```txt
src/app/(auth)/login              Login
src/app/(app)/dashboard           Dashboard
src/app/(app)/campaigns           Campanhas
src/app/(app)/campaigns/new       Criação guiada de campanha
src/app/(app)/inbox               Inbox de atendimento
src/app/(app)/crm                 CRM interno
src/app/(app)/brokers             Equipe (rota mantida como /brokers)
src/app/(app)/settings/agents     Agentes de IA
src/app/(app)/settings/organization  Marca (nome, logo, cor)
src/app/(app)/settings/whatsapp   Instâncias WhatsApp/Uazapi
src/agents/lead-agent.ts          Cérebro do agente (ChatGPT + qualificação de leads)
src/app/api/webhooks/meta         Webhook Meta
src/app/api/webhooks/uazapi       Webhook Uazapi
src/app/api/jobs/process          Processador de jobs
supabase/migrations               Schema do banco
```

## Como Rodar Localmente

1. Instale dependências:

```bash
npm install
```

2. Crie o arquivo local de ambiente:

```bash
cp .env.example .env.local
```

3. Preencha as variáveis obrigatórias no `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
APP_URL=http://localhost:3000
```

4. Crie um **projeto Supabase novo e próprio** para a Paisagens Serenas (não reaproveite o do crm-imobiliario original) e aplique todas as migrations em `supabase/migrations`, na ordem, pelo SQL editor do Supabase ou via `supabase db push`.

5. Rode o projeto:

```bash
npm run dev
```

6. Acesse `http://localhost:3000/login`, crie sua conta e vá em `Configurações > Organização` para subir o logo, escolher a cor e confirmar o nome "DAR+ Serviços | Formação".

## Configuração Do Supabase

O sistema usa RLS por `organization_id`. Depois do primeiro login, o próprio sistema cria a organização e o perfil automaticamente (`bootstrap_current_user_organization`).

Tabelas principais: `organizations`, `profiles`, `campaigns`, `contacts`, `conversations`, `messages`, `leads`, `brokers`, `broker_assignments`, `followup_rules`, `scheduled_jobs`, `integrations`, `ai_agents`, `whatsapp_instances`.

Alguns nomes de tabela/coluna ainda carregam vocabulário do projeto original (`brokers`, `hauzapp_corretor_id`, `property_description`) — foram mantidos de propósito para não arriscar quebrar queries e RLS numa adaptação rápida. A interface e os prompts da IA já falam a língua de serviços/formação (ver seção abaixo); o schema por baixo é o mesmo.

## Primeiro Uso Pelo Cliente

1. Criar conta/login.
2. Abrir `Configurações > Organização` e configurar nome, logo e cor.
3. Abrir `Configurações > Agentes IA` e criar um agente de atendimento (já vem com prompt e exemplos voltados para serviços e formação).
4. Abrir `Configurações > WhatsApp` e conectar o número Meta oficial.
5. (Opcional) Cadastrar equipe em `Equipe` e configurar Uazapi se quiser notificar internamente quando um lead for qualificado.
6. Abrir `Campanhas > Nova campanha` para disparos outbound.
7. Acompanhar respostas na Inbox e o funil no CRM.

## Agentes De IA

Em `Configurações > Agentes IA`, configure nome, prompt do sistema, saudação, regras de humanização, frases proibidas, exemplos de conversa e critérios de qualificação. O agente usa o modelo OpenAI configurado (`gpt-5-mini` por padrão) para responder no WhatsApp e classificar o lead automaticamente (interesse, região, orçamento, urgência, intenção — novo serviço, contrato recorrente, formação ou indefinido — e se quer visita técnica).

Se `OPENAI_API_KEY` não estiver configurada, o sistema usa um fallback heurístico simples (regex) para não travar o atendimento — mas a qualidade da conversa cai bastante. Configure a chave da OpenAI antes de ir para produção.

## CRM Interno

Etapas usadas no produto: Novo, Em atendimento IA, Interessado, Qualificando, Qualificado, Enviado a equipe, Em atendimento com a equipe, Sem resposta, Perdido, Ganho.

## Herança e Adaptações Do Projeto Original

Este projeto nasceu como uma cópia de `crm-imobiliario` (CRM para imobiliárias). O que foi adaptado:

- **Prompt e schema do agente de IA** (`src/agents/lead-agent.ts`): system prompt padrão, regras de cadência e o campo `intention` (antes `compra/aluguel/investimento`, agora `novo_servico/contrato_recorrente/formacao/indefinido`) reescritos para serviços/formação.
- **Textos de interface**: nav, títulos de página, labels de formulário e placeholders de exemplo em toda a área de Agentes IA, Equipe, CRM, Inbox, Dashboard e Campanhas.
- **Marca**: nome padrão "DAR+ Serviços | Formação", logo (`public/brand/logo-fill.png`, `public/brand/logo-white.png`, favicon recortado do símbolo "+" em `public/brand/favicon.png`), cor primária laranja (`#ED7018`) e branding via `Configurações > Organização` (recurso white-label que já existia no projeto original, permite outra organização sobrescrever isso).

O que **não** foi adaptado, por decisão consciente (baixo risco vs. baixo retorno numa adaptação rápida — revisite se fizer sentido para o negócio):

- **Nomes de tabela/coluna no Supabase** (`brokers`, `broker_assignments`, `hauzapp_corretor_id`, `property_description` etc.) continuam com nomenclatura do projeto original. Renomear isso é um refactor maior e mais arriscado do que vale a pena só por vocabulário — o sistema funciona normalmente por baixo desses nomes.
- **Integração HauzApp e webhook Canal Pro**: são ferramentas de portal imobiliário (sincronização de imóveis/leads) que a DAR+ provavelmente não usa. O código e os botões (`Sincronizar HauzApp`, campo `ID HauzApp` em Equipe) ficaram no sistema, mas são opcionais — ignore-os se não fizer sentido para o negócio. Se quiser, dá pra remover depois.
- **Mensagens internas em `src/services/broker-sla/workflow.ts` e `src/services/hauzapp/workflow.ts`**: templates de WhatsApp enviados internamente para a equipe (cobrança de follow-up, escalonamento) ainda mencionam "corretor" em alguns pontos. Não afeta o que o cliente final vê — só a equipe interna. Ajuste se incomodar.
- **Automações n8n** (`n8n-mcp-main/` no projeto original): não foram copiadas para este projeto. O fluxo principal (agente de IA + WhatsApp) funciona inteiramente pelas rotas do Next.js (`/api/webhooks/meta`, `/api/webhooks/uazapi`), sem depender de n8n. Se precisar de automações externas no futuro, isso pode ser adicionado separadamente.
- **Normalização de telefone**: o sistema formata números como `55DDDNUMERO` (padrão Brasil). Se a DAR+ atender outro país (Portugal, Angola, etc.), ajuste a normalização em `src/services/*` antes de ir para produção.

## Variáveis De Ambiente

Use `.env.example` como referência. Nunca suba `.env.local`, `.env` ou qualquer arquivo com segredo real.

Principais grupos:

- Supabase: URL, anon/publishable key e service role.
- OpenAI: `OPENAI_API_KEY` (obrigatória para o agente funcionar de verdade).
- Meta: verify token, app secret, access token e phone number ID.
- Uazapi: base URL, token e instâncias cadastradas pelo sistema.
- HauzApp: opcional — só preencha se for usar essa integração.
- QStash: URLs e chaves para filas.

## Checklist De Segurança

- Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend.
- Nunca commit `.env.local`.
- Use service role apenas no servidor/API.
- Confirme RLS ativo no Supabase (já vem configurado nas migrations).
- Revise logs antes de publicar tokens em prints.

## Comandos Úteis

```bash
npm run lint
npm run typecheck
npm run build
npm run dev
```

## Licença

Defina a licença conforme o uso desejado do projeto.
