import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

function runSpawn(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', rejectRun);
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }

      rejectRun(
        new Error(
          `Command failed: ${command} ${args.join(' ')}${stderr ? `\n${stderr.trim()}` : ''}`,
        ),
      );
    });
  });
}

if (process.platform !== 'win32') {
  console.log('windows-build-doctor only applies to Windows.');
  process.exit(0);
}

const esbuildBinary = resolve('node_modules', '@esbuild', 'win32-x64', 'esbuild.exe');
if (!existsSync(esbuildBinary)) {
  console.error(`Missing esbuild binary: ${esbuildBinary}`);
  process.exit(1);
}

try {
  const cmdResult = await runSpawn('cmd.exe', ['/c', 'echo', 'ok']);
  const esbuildResult = await runSpawn(esbuildBinary, ['--version']);

  console.log(`cmd.exe spawn: ${cmdResult.stdout.trim()}`);
  console.log(`esbuild spawn: ${esbuildResult.stdout.trim()}`);
  console.log('Node child-process execution looks healthy for Vite builds.');
} catch (error) {
  console.error('Node child-process execution is blocked on this machine.');
  console.error('Run `npm run repair:windows` first.');
  console.error('If it still fails, reinstall dependencies or move the project out of protected/synced folders.');
  console.error(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
}
