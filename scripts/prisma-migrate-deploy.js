const { spawn } = require('node:child_process');

const MAX_ATTEMPTS = Number(process.env.PRISMA_MIGRATE_DEPLOY_ATTEMPTS ?? 4);
const RETRY_DELAYS_MS = [5000, 10000, 20000];

function runMigrateDeploy() {
  return new Promise((resolve) => {
    const child = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      env: process.env,
      shell: process.platform === 'win32',
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      output += chunk.toString();
    });
    child.on('close', (code) => resolve({ code, output }));
  });
}

function isRetryableMigrationError(output) {
  return (
    output.includes('P1002') ||
    output.includes('Timed out trying to acquire a postgres advisory lock')
  );
}

async function main() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    console.log(`Prisma migrate deploy attempt ${attempt}/${MAX_ATTEMPTS}`);
    const result = await runMigrateDeploy();

    if (result.code === 0) return;

    if (!isRetryableMigrationError(result.output) || attempt === MAX_ATTEMPTS) {
      process.exit(result.code ?? 1);
    }

    const delay = RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)];
    console.log(`Migration lock timed out. Retrying in ${delay / 1000}s...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
