/** A field value that can be rendered on one `Label: value` line. */
export type FieldValue = string | number | boolean | Date | null | undefined;

/** Free-form extra fields. Rendered after the known fields, in insertion order. */
export type ExtraFields = Record<string, FieldValue>;

export interface SignupFields extends ExtraFields {
  name?: FieldValue;
  email?: FieldValue;
  /** Where the account came from: "google", "github", "magic-link", "invite"... */
  provider?: FieldValue;
}

export interface SubscriptionFields extends ExtraFields {
  name?: FieldValue;
  email?: FieldValue;
  plan?: FieldValue;
  /** "monthly", "annual", "one-off"... */
  interval?: FieldValue;
  /** Major units (14.99), not cents. Divide Stripe amounts by 100. */
  amount?: number | string | null | undefined;
  /** ISO code, any case. Rendered upper-case after the amount. */
  currency?: FieldValue;
}

export interface PaymentFields extends SubscriptionFields {
  /** Provider reference: Stripe invoice id, Freemius license id... */
  reference?: FieldValue;
}

export interface CancellationFields extends ExtraFields {
  name?: FieldValue;
  email?: FieldValue;
  plan?: FieldValue;
  reason?: FieldValue;
  /** When access actually ends. */
  endsAt?: FieldValue;
}

export type SendFailureReason = 'unconfigured' | 'timeout' | 'http' | 'network';

export type SendResult =
  | { ok: true; chatId: string }
  | { ok: false; reason: SendFailureReason; chatId?: string; status?: number; error?: string };

export interface Logger {
  error: (message: string, ...rest: unknown[]) => void;
}

export interface TelegramAlertsOptions {
  /** Prefix of every message: `Dingcut - New signup`. */
  product: string;
  /** Defaults to `process.env.TELEGRAM_BOT_TOKEN`, read at send time. */
  botToken?: string | undefined;
  /**
   * Defaults to `process.env.TELEGRAM_CHAT_ID`, read at send time. Accepts a list, or a
   * comma-separated string, to fan out to several chats.
   */
  chatId?: string | string[] | undefined;
  /** Abort the HTTP call after this long. Default 5000. */
  timeoutMs?: number | undefined;
  /** Telegram "silent" delivery (no sound on the phone). Default false. */
  silent?: boolean | undefined;
  /** Where failures go. `false` disables logging. Default `console`. */
  logger?: Logger | false | undefined;
  /** Called with every failed result, after logging. Handy for metrics. */
  onError?: ((result: Extract<SendResult, { ok: false }>) => void) | undefined;
  /** Injected for tests or custom transports. Default `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch | undefined;
  /** Default `https://api.telegram.org`. */
  apiBase?: string | undefined;
}
