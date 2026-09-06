import { composeMessage, renderMoney } from './format.js';
import { resolveBotToken, resolveChatIds } from './env.js';
import type {
  CancellationFields,
  ExtraFields,
  Logger,
  PaymentFields,
  SendResult,
  SignupFields,
  SubscriptionFields,
  TelegramAlertsOptions,
} from './types.js';

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_API_BASE = 'https://api.telegram.org';

export const HEADLINES = {
  signup: 'New signup',
  subscription: 'New subscription',
  payment: 'Payment received',
  cancellation: 'Subscription cancelled',
  test: 'Test alert',
} as const;

type Failure = Extract<SendResult, { ok: false }>;

/** Auth.js / NextAuth `events.createUser` payload, typed structurally to avoid a dependency. */
export interface AuthUserEvent {
  user: { name?: string | null; email?: string | null; id?: string | null };
}

export interface TelegramAlerts {
  /** True when a bot token and at least one chat id resolve right now. */
  readonly enabled: boolean;
  /** Raw send. Plain text; Telegram markup is not interpreted. */
  send(text: string): Promise<SendResult>;
  /** Any headline with any fields: `event('Refund issued', { email, amount })`. */
  event(headline: string, fields?: ExtraFields): Promise<SendResult>;
  signup(fields: SignupFields): Promise<SendResult>;
  subscription(fields: SubscriptionFields): Promise<SendResult>;
  payment(fields: PaymentFields): Promise<SendResult>;
  cancellation(fields: CancellationFields): Promise<SendResult>;
  test(): Promise<SendResult>;
  /** Pure formatters, for previews and tests. */
  readonly format: {
    event(headline: string, fields?: ExtraFields): string;
    signup(fields: SignupFields): string;
    subscription(fields: SubscriptionFields): string;
    payment(fields: PaymentFields): string;
    cancellation(fields: CancellationFields): string;
  };
  /**
   * Drop-in Auth.js events: `NextAuth({ events: alerts.authEvents() })`. Uses
   * `createUser`, which fires once per account, not on every sign-in.
   */
  authEvents(): { createUser(message: AuthUserEvent): Promise<void> };
}

function moneyFields<T extends SubscriptionFields>(fields: T): ExtraFields {
  const { name, email, plan, interval, amount, currency, ...rest } = fields;
  return { name, email, plan, interval, amount: renderMoney(amount, currency), ...rest };
}

function signupFields(fields: SignupFields): ExtraFields {
  const { name, email, provider, ...rest } = fields;
  return { name, email, provider, ...rest };
}

function cancellationFields(fields: CancellationFields): ExtraFields {
  const { name, email, plan, reason, endsAt, ...rest } = fields;
  return { name, email, plan, reason, endsAt, ...rest };
}

function paymentFields(fields: PaymentFields): ExtraFields {
  const { reference, ...rest } = fields;
  return { ...moneyFields(rest), reference };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Builds a client bound to one product. Sending never throws and never rejects: every
 * failure is logged, handed to `onError`, and returned as `{ ok: false }`. Unconfigured
 * (no token or chat id) is a silent no-op so the same code ships to every environment.
 */
export function createTelegramAlerts(options: TelegramAlertsOptions): TelegramAlerts {
  if (!options || typeof options.product !== 'string' || options.product.trim() === '') {
    throw new TypeError('createTelegramAlerts: `product` is required (used as the message prefix)');
  }
  const product = options.product.trim();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const apiBase = (options.apiBase ?? DEFAULT_API_BASE).replace(/\/+$/, '');
  const logger: Logger | null = options.logger === false ? null : (options.logger ?? console);

  function fail(failure: Failure): Failure {
    logger?.error(
      `[telegram-alerts] ${failure.reason}${failure.status ? ` ${failure.status}` : ''}${failure.error ? `: ${failure.error}` : ''}`,
    );
    try {
      options.onError?.(failure);
    } catch (err) {
      logger?.error(`[telegram-alerts] onError threw: ${describe(err)}`);
    }
    return failure;
  }

  async function sendToChat(token: string, chatId: string, text: string): Promise<SendResult> {
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      return fail({
        ok: false,
        reason: 'network',
        chatId,
        error: 'fetch is not available in this runtime',
      });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${apiBase}/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          disable_notification: options.silent === true,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return fail({
          ok: false,
          reason: 'http',
          chatId,
          status: res.status,
          error: body.slice(0, 300),
        });
      }
      return { ok: true, chatId };
    } catch (err) {
      const reason = controller.signal.aborted ? 'timeout' : 'network';
      return fail({ ok: false, reason, chatId, error: describe(err) });
    } finally {
      clearTimeout(timer);
    }
  }

  async function send(text: string): Promise<SendResult> {
    try {
      const token = resolveBotToken(options.botToken);
      const chatIds = resolveChatIds(options.chatId);
      if (!token || chatIds.length === 0) return { ok: false, reason: 'unconfigured' };
      const results = await Promise.all(chatIds.map((chatId) => sendToChat(token, chatId, text)));
      return results.find((r) => !r.ok) ?? results[0]!;
    } catch (err) {
      // Belt and braces: nothing above should throw, but a caller must never pay for it.
      return fail({ ok: false, reason: 'network', error: describe(err) });
    }
  }

  const format: TelegramAlerts['format'] = {
    event: (headline, fields = {}) => composeMessage(product, headline, fields),
    signup: (fields) => composeMessage(product, HEADLINES.signup, signupFields(fields)),
    subscription: (fields) => composeMessage(product, HEADLINES.subscription, moneyFields(fields)),
    payment: (fields) => composeMessage(product, HEADLINES.payment, paymentFields(fields)),
    cancellation: (fields) =>
      composeMessage(product, HEADLINES.cancellation, cancellationFields(fields)),
  };

  const alerts: TelegramAlerts = {
    get enabled() {
      return (
        Boolean(resolveBotToken(options.botToken)) && resolveChatIds(options.chatId).length > 0
      );
    },
    send,
    event: (headline, fields) => send(format.event(headline, fields)),
    signup: (fields) => send(format.signup(fields)),
    subscription: (fields) => send(format.subscription(fields)),
    payment: (fields) => send(format.payment(fields)),
    cancellation: (fields) => send(format.cancellation(fields)),
    test: () =>
      send(composeMessage(product, HEADLINES.test, { status: 'Telegram alerts are wired up' })),
    format,
    authEvents: () => ({
      async createUser({ user }: AuthUserEvent) {
        await alerts.signup({ name: user.name, email: user.email });
      },
    }),
  };
  return alerts;
}
