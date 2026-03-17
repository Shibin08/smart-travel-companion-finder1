import { installWindowsViteFixes } from './vite-windows-fixes.mjs';

installWindowsViteFixes();

const cliArgs = process.argv.slice(2);
if (!cliArgs.includes('--configLoader')) {
  cliArgs.push('--configLoader', 'native');
}

process.argv = ['node', 'vite', ...cliArgs];
await import(new URL('../node_modules/vite/bin/vite.js', import.meta.url).href);
