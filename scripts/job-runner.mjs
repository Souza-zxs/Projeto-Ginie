// Runner de jobs: chama /api/jobs/process a cada poucos segundos.
// Roda na VPS (a Vercel é serverless e não fica ligada): node scripts/job-runner.mjs
// Variáveis: APP_URL (URL pública do app), CRON_SECRET (o mesmo da Vercel),
// JOB_RUNNER_INTERVAL_MS (opcional, padrão 5000).

const appUrl = process.env.APP_URL?.replace(/\/$/, "");
const secret = process.env.CRON_SECRET;
const intervalMs = Number(process.env.JOB_RUNNER_INTERVAL_MS ?? 5000);

if (!appUrl || !secret) {
  console.error("Defina APP_URL e CRON_SECRET antes de iniciar o runner.");
  process.exit(1);
}

async function tick() {
  try {
    const response = await fetch(`${appUrl}/api/jobs/process`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(60_000)
    });

    if (!response.ok) {
      console.error(`${new Date().toISOString()} HTTP ${response.status}`);
      return;
    }

    const { processed } = await response.json();

    if (processed > 0) {
      console.log(`${new Date().toISOString()} jobs processados: ${processed}`);
    }
  } catch (error) {
    console.error(`${new Date().toISOString()} falha ao chamar o app:`, error.message);
  }
}

while (true) {
  await tick();
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
