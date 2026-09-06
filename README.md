# @rojan-labs/telegram-alerts

Telegram alerts for SaaS founders. One message on your phone for every signup, subscription, payment or cancellation. Zero dependencies, ESM + CJS, typed, and it never throws: a Telegram outage can never break a sign-in or a billing webhook.

```
Dingcut - New subscription
Name: Ada Lovelace
Email: ada@example.com
Plan: Pro
Interval: annual
Amount: 14.99 USD
```

## Install

```bash
npm install @rojan-labs/telegram-alerts
```

Node 18+ (uses the built-in `fetch`).

## Setup (2 minutes)

1. In Telegram, open **@BotFather**, send `/newbot`, copy the token.
2. Send your new bot any message (or add it to a group you want alerts in).
3. Find the chat id and send a test:

   ```bash
   TELEGRAM_BOT_TOKEN=123:abc npx @rojan-labs/telegram-alerts setup --product "Dingcut"
   ```

   It prints the chat id and sends `Dingcut - Test alert`.

4. Set both variables in your app (Vercel, `.env`, etc.):

   ```
   TELEGRAM_BOT_TOKEN=123:abc
   TELEGRAM_CHAT_ID=987654321
   ```

The CLI also reads `./.env`, so from a project directory `npx @rojan-labs/telegram-alerts setup` is enough.

## Usage

Create one client per product and export it:

```ts
// lib/alerts.ts
import { createTelegramAlerts } from '@rojan-labs/telegram-alerts';

export const alerts = createTelegramAlerts({ product: 'Dingcut' });
// botToken and chatId default to TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID, read at send time.
```

Then call it wherever the event happens:

```ts
await alerts.signup({ name: user.name, email: user.email, provider: 'google' });

await alerts.subscription({
  email,
  plan: 'Pro',
  interval: 'annual',
  amount: 14.99,
  currency: 'usd',
});

await alerts.payment({ email, amount: 14.99, currency: 'usd', reference: invoice.id });

await alerts.cancellation({ email, plan: 'Pro', reason: 'too expensive', endsAt: periodEnd });

// Anything else
await alerts.event('Refund issued', { email, amount: '14.99 USD' });

// Raw text
await alerts.send('Dingcut - deploy finished');
```

Every method resolves to a `SendResult`:

```ts
{ ok: true, chatId: '987654321' }
{ ok: false, reason: 'unconfigured' | 'timeout' | 'http' | 'network', status?, error? }
```

Unconfigured (no token or chat id) is a silent no-op, so the same code ships to dev, preview and production. Every other failure is logged and returned; nothing throws.

### Fields

Known fields render first in a fixed order, then any extra keys you pass, in insertion order. Empty values (`null`, `undefined`, `''`) are skipped, so you never see `Email: -`. Keys are humanized: `licenseId` becomes `License id`. Booleans render as `yes`/`no`, dates as ISO strings.

`amount` is in major units. Stripe gives cents, so pass `amount_total / 100`.

### Auth.js / NextAuth

`createUser` fires once per account (unlike `signIn`, which fires on every visit), so it is the right signup hook:

```ts
import NextAuth from 'next-auth';
import { alerts } from '@/lib/alerts';

export const { handlers, auth } = NextAuth({
  // ...
  events: {
    ...alerts.authEvents(),
    // or combine with your own:
    // async createUser({ user }) { await createWorkspace(user); await alerts.signup(user); },
  },
});
```

### Stripe webhook

```ts
case 'checkout.session.completed': {
  const s = event.data.object;
  await alerts.subscription({
    email: s.customer_details?.email,
    plan: s.metadata?.plan,
    amount: (s.amount_total ?? 0) / 100,
    currency: s.currency,
    reference: s.subscription,
  });
  break;
}
case 'customer.subscription.deleted': {
  const sub = event.data.object;
  await alerts.cancellation({ plan: sub.items.data[0]?.price.nickname, endsAt: new Date(sub.ended_at! * 1000) });
  break;
}
```

### Freemius

Alert only when the entitlement row is new, since the checkout redirect and the webhook both deliver the same license:

```ts
const existing = await prisma.entitlement.findUnique({ where: { licenseId } });
await prisma.entitlement.upsert(/* ... */);
if (!existing && purchase.isActive) {
  await alerts.subscription({
    email: purchase.email,
    plan: 'Pro',
    interval: purchase.billingCycle,
    amount: purchase.initialAmount,
    currency: purchase.currency,
    licenseId,
  });
}
```

### Dedupe

The package has no storage, so it cannot know whether it already told you about a purchase. Gate the call on your own "is this new" check, as in the Freemius example.

### Serverless

`await` the call. Fire-and-forget promises can be killed when a Vercel or Lambda function returns. The default 5s timeout bounds the cost.

## Options

```ts
createTelegramAlerts({
  product: 'Dingcut', // required, message prefix
  botToken: '...', // default: process.env.TELEGRAM_BOT_TOKEN
  chatId: '1,2' | ['1', '2'], // default: process.env.TELEGRAM_CHAT_ID; several ids fan out
  timeoutMs: 5000,
  silent: false, // Telegram disable_notification
  logger: console | false, // where failures are logged
  onError: (result) => {}, // metrics hook, called after logging
  fetch: customFetch, // for tests or proxies
  apiBase: 'https://api.telegram.org',
});
```

`alerts.enabled` tells you whether a token and chat id currently resolve. `alerts.format.*` are the pure formatters, useful for previews and tests.

## CLI

```
telegram-alerts setup   [--product X] [--token T] [--chat C] [--env path]
telegram-alerts chat-id
telegram-alerts test [text...]
```

## Publishing (maintainers)

```bash
npm version patch|minor|major   # bumps, tags
git push --follow-tags
npm publish                     # prepublishOnly runs typecheck, lint, tests, build
```

Or publish a GitHub release; `.github/workflows/publish.yml` publishes with provenance using the `NPM_TOKEN` secret.

## License

MIT
