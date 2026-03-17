import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

let fixesInstalled = false;

export function installWindowsViteFixes() {
  if (fixesInstalled || process.platform !== 'win32') {
    return;
  }

  fixesInstalled = true;

  const originalExec = childProcess.exec;
  childProcess.exec = function patchedExec(command, ...args) {
    if (typeof command === 'string' && command.trim().toLowerCase() === 'net use') {
      const callback = args.find((value) => typeof value === 'function');
      if (callback) {
        queueMicrotask(() => callback(null, '', ''));
      }
      return { kill() {}, pid: 0 };
    }

    return originalExec.call(this, command, ...args);
  };

  syncBuiltinESMExports();
}

export function printWindowsSpawnGuidance(error) {
  const message = String(error?.message ?? error ?? '');
  if (!message.includes('spawn EPERM')) {
    return;
  }

  console.error('');
  console.error('Windows blocked a child process that Vite needs for the build.');
  console.error('Run `npm run repair:windows` once in the frontend folder, then retry `npm run build`.');
  console.error('If the issue remains, reinstall dependencies in a normal writable folder and avoid protected/synced paths.');
  console.error('');
}
