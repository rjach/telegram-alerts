# Contributing

Thanks for helping. This is a small package with a narrow job: get a founder a Telegram message without ever breaking the app that sends it. Changes that keep that promise are welcome.

## Ground rules

- **Never throw from a send path.** Every failure becomes a `{ ok: false }` result. Tests must cover any new failure mode.
- **No runtime dependencies.** Node 18+ `fetch` is the only transport.
- **Message format is public API.** `PRODUCT - Headline` then `Label: value` lines. Changing it, or the order of known fields, is a breaking change.
- **Keep it small.** Provider-specific helpers belong in the README as examples, not in the package, unless they need no dependency (like `authEvents()`).

## Workflow

```bash
git clone https://github.com/rojan-labs/telegram-alerts
cd telegram-alerts
npm ci
npm test            # vitest
npm run typecheck
npm run lint
npm run build       # tsup -> dist/
```

1. Open an issue first for anything beyond a small fix, so we agree on the API before you write it.
2. Branch from `main`: `feat/...`, `fix/...`, `docs/...`, `chore/...`.
3. Commits and PR titles follow [Conventional Commits](https://www.conventionalcommits.org): `feat: add refund alert`, `fix!: rename interval field`.
4. Add or update tests in `test/`. Add a line under "Unreleased" in `CHANGELOG.md`. Update the README for public changes.
5. Open a PR. CI runs typecheck, lint, tests, build, and a packaging check on Node 18, 20, and 22. All must pass before merge.

## Releasing (maintainers)

```bash
# move the Unreleased section in CHANGELOG.md under the new version first
npm version patch|minor|major
git push --follow-tags
```

Create a GitHub release from the tag. The publish workflow publishes to npm with provenance. Manual `npm publish` from a logged-in machine also works; `prepublishOnly` runs every check first.
