import { main } from './cli.js';

// Bin entry. Kept separate from cli.ts so the CLI logic stays importable in tests
// and so this runs no matter how npm names the symlink in node_modules/.bin.
main().then((code) => process.exit(code));
