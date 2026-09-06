import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Guards the 0.1.0 bug where the bin ran nothing when invoked through a symlink. */
describe('dist/cli.js', () => {
  it.skipIf(!existsSync('dist/cli.js'))(
    'prints help when invoked through a differently named path',
    () => {
      const out = execFileSync(process.execPath, ['dist/cli.js', '--help'], { encoding: 'utf8' });
      expect(out).toContain('telegram-alerts <command>');
    },
  );
});
