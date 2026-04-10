import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'cmd.exe' : 'npm';
const npmRegistry = 'https://registry.npmjs.org/';

const services = [
  {
    name: 'backend',
    cwd: resolve(rootDir, 'backend'),
    args: ['start'],
    nodeModules: resolve(rootDir, 'backend', 'node_modules'),
    installCheck: resolve(rootDir, 'backend', 'node_modules', 'express', 'package.json'),
    lockFile: resolve(rootDir, 'backend', 'package-lock.json'),
    envExample: resolve(rootDir, 'backend', '.env.example'),
    envFile: resolve(rootDir, 'backend', '.env')
  },
  {
    name: 'frontend',
    cwd: resolve(rootDir, 'frontend'),
    args: ['run', 'dev'],
    nodeModules: resolve(rootDir, 'frontend', 'node_modules'),
    installCheck: resolve(rootDir, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'),
    lockFile: resolve(rootDir, 'frontend', 'package-lock.json'),
    envExample: resolve(rootDir, 'frontend', '.env.example'),
    envFile: resolve(rootDir, 'frontend', '.env')
  }
];

const runningChildren = [];
let shuttingDown = false;

function buildCommandArgs(args) {
  if (isWindows) {
    return ['/d', '/s', '/c', 'npm.cmd', ...args];
  }

  return args;
}

function runNpmCommand(args, cwd) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(npmCommand, buildCommandArgs(args), {
      cwd,
      env: {
        ...process.env,
        NPM_CONFIG_REGISTRY: npmRegistry
      },
      stdio: 'inherit',
      shell: false,
      windowsHide: false
    });

    child.on('error', (error) => {
      rejectCommand(error);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolveCommand();
        return;
      }

      rejectCommand(new Error(`comando npm ${args.join(' ')} terminato con codice ${code}`));
    });
  });
}

function ensureEnvFile(service) {
  if (!service.envExample || !service.envFile) {
    return;
  }

  if (!existsSync(service.envFile) && existsSync(service.envExample)) {
    copyFileSync(service.envExample, service.envFile);
    console.log(`[${service.name}] creato automaticamente ${service.envFile} da .env.example`);
  }
}

async function ensureServiceReady(service) {
  if (!existsSync(service.cwd)) {
    throw new Error(`[${service.name}] cartella non trovata: ${service.cwd}`);
  }

  ensureEnvFile(service);

  if (!existsSync(service.nodeModules) || !existsSync(service.installCheck)) {
    const installCommand = existsSync(service.lockFile)
      ? ['ci', '--no-audit', '--no-fund']
      : ['install', '--no-audit', '--no-fund'];

    console.log(
      `[${service.name}] dipendenze mancanti: eseguo npm ${installCommand.join(' ')}...`
    );

    try {
      await runNpmCommand(installCommand, service.cwd);
    } catch (error) {
      if (installCommand[0] === 'ci') {
        console.log(`[${service.name}] npm ci non riuscito, provo npm install come fallback...`);
        await runNpmCommand(['install', '--no-audit', '--no-fund'], service.cwd);
        return;
      }

      throw error;
    }
  }
}

function killChild(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      windowsHide: true
    });
    return;
  }

  child.kill('SIGTERM');
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of runningChildren) {
    killChild(child);
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 250);
}

async function main() {
  for (const service of services) {
    await ensureServiceReady(service);
  }

  for (const service of services) {
    const child = spawn(npmCommand, buildCommandArgs(service.args), {
      cwd: service.cwd,
      stdio: 'inherit',
      shell: false,
      windowsHide: false
    });

    runningChildren.push(child);

    child.on('error', (error) => {
      console.error(`[${service.name}] errore di avvio: ${error.message}`);
      shutdown(1);
    });

    child.on('exit', (code) => {
      if (shuttingDown) {
        return;
      }

      if (code !== 0) {
        console.error(`[${service.name}] terminato con codice ${code}.`);
        shutdown(code || 1);
        return;
      }

      console.error(`[${service.name}] terminato inaspettatamente.`);
      shutdown(0);
    });
  }

  console.log('Analisi NBA: backend e frontend avviati con un solo comando.');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
