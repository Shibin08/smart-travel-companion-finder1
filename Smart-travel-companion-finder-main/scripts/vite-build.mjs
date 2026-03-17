import { resolve } from 'node:path';

import { installWindowsViteFixes, printWindowsSpawnGuidance } from './vite-windows-fixes.mjs';

installWindowsViteFixes();

try {
  const { build } = await import('vite');
  await build({
    configFile: resolve('vite.config.ts'),
    configLoader: 'native',
  });
} catch (error) {
  printWindowsSpawnGuidance(error);
  console.error(error instanceof Error && error.stack ? error.stack : String(error));
  process.exit(1);
}
