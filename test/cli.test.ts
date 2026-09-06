import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDotenv } from '../src/dotenv.js';
import { parseArgs } from '../src/cli.js';

describe('parseArgs', () => {
  it('defaults to setup and reads flags in both styles', () => {
    expect(parseArgs([])).toEqual({ command: 'setup', text: [], flags: {} });
    expect(parseArgs(['test', 'hello', 'there', '--product', 'X', '--chat=7'])).toEqual({
      command: 'test',
      text: ['hello', 'there'],
      flags: { product: 'X', chat: '7' },
    });
  });
});

describe('loadDotenv', () => {
  it('reads quoted and unquoted values without overriding existing ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ta-'));
    const file = join(dir, '.env');
    writeFileSync(file, '# comment\nA="quoted value"\nB=plain # trailing\nexport C=1\nD=\n');
    const env: NodeJS.ProcessEnv = { B: 'keep' };
    loadDotenv(file, env);
    expect(env).toEqual({ A: 'quoted value', B: 'keep', C: '1', D: '' });
  });

  it('ignores a missing file', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(() => loadDotenv('/nonexistent/.env', env)).not.toThrow();
  });
});
