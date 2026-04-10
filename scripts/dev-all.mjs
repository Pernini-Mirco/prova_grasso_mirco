import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'cmd.exe' : 'npm';

const services = [
  {
    name: 'backend',
    cwd: resolve(rootDir, 'backend'),
    args: ['start'],
    nodeModules: resolve(rootDir, 'backend', 'node_modules')
  },
  {
    name: 'frontend',
    cwd: resolve(rootDir, 'frontend'),
    args: ['run', 'dev'],
    nodeModules: resolve(rootDir, 'frontend', 'node_modules')
  }
];

for (const service of services) {
  if (!existsSync(service.cwd)) {
    console.error(`[${service.name}] cartella non trovata: ${service.cwd}`);
    process.exit(1);
  }

  if (!existsSync(service.nodeModules)) {
    console.error(
      `[${service.name}] dipendenze mancanti. Esegui prima "npm install" dentro ${service.name}.`
    );
    process.exit(1);
  }
}

const runningChildren = [];
let shuttingDown = false;

function buildCommandArgs(args) {
  if (isWindows) {
    return ['/d', '/s', '/c', 'npm.cmd', ...args];
  }

  return args;
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

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Analisi NBA: backend e frontend avviati con un solo comando.');
