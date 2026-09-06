import { readFileSync } from 'node:fs';

/**
 * Minimal `.env` loader for the CLI only, so `npx @rojan404/telegram-alerts setup` works from a
 * project directory without another dependency. Existing process.env values win.
 */
export function loadDotenv(path = '.env', env: NodeJS.ProcessEnv = process.env): void {
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const raw of contents.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line
      .slice(0, eq)
      .trim()
      .replace(/^export\s+/, '');
    let value = line.slice(eq + 1).trim();
    const quoted = value.match(/^(["'])(.*)\1$/);
    if (quoted) value = quoted[2] ?? '';
    else value = value.replace(/\s+#.*$/, '');
    if (!(key in env)) env[key] = value;
  }
}
