#!/usr/bin/env node
/**
 * CLI-обёртка над vite для сборочных команд.
 *
 * Зачем: vite CLI отвергает неизвестные опции (CACError: Unknown option),
 * поэтому `vite build --webp` падает раньше загрузки конфига. Обёртка
 * вынимает свои ключи, выставляет их через env и запускает vite с чистыми
 * аргументами.
 *
 * Поддерживаемые формы запуска --webp:
 *   npm run build --webp       — npm съедает флаг сам → npm_config_webp=true
 *                                (env-детект в vite.config.js)
 *   npm run build -- --webp    → флаг приходит сюда → VITEVERST_WEBP=true
 *   build.bat --webp           → bat пробрасывает %* → как вторая форма
 *
 * Все остальные аргументы пробрасываются в vite как есть.
 */

import { spawnSync } from 'child_process';

const args = process.argv.slice(2);

// Вынимаем свои ключи, остальное — vite
const hasWebp = args.includes('--webp');
const viteArgs = args.filter((a) => a !== '--webp');

const env = { ...process.env };
if (hasWebp) env.VITEVERST_WEBP = 'true';

const result = spawnSync(`vite ${viteArgs.join(' ')}`, {
  stdio: 'inherit',
  shell: true, // Windows: vite — это .cmd
  env
});

process.exit(result.status ?? 1);
