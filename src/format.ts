import type { ExtraFields, FieldValue } from './types.js';

const SEPARATOR = ' - ';
const TELEGRAM_MAX_TEXT = 4096;

/**
 * Turns a camelCase or snake_case key into a label: `endsAt` -> `Ends at`,
 * `stripe_id` -> `Stripe id`.
 */
export function labelFor(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** Renders one value, or `null` when there is nothing worth printing. */
export function renderValue(value: FieldValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return String(value);
}

/** `14.99` + `usd` -> `14.99 USD`. Either part may be missing. */
export function renderMoney(
  amount: number | string | null | undefined,
  currency: FieldValue,
): string | null {
  const amountText = renderValue(amount);
  if (amountText === null) return null;
  const currencyText = renderValue(currency);
  return currencyText ? `${amountText} ${currencyText.toUpperCase()}` : amountText;
}

/** `Label: value` per non-empty field, in the order given. */
export function renderFields(fields: ExtraFields): string[] {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const rendered = renderValue(value);
    if (rendered !== null) lines.push(`${labelFor(key)}: ${rendered}`);
  }
  return lines;
}

/**
 * The message shape every alert uses:
 *
 *     PRODUCT - Headline
 *     Label: value
 *     Label: value
 */
export function composeMessage(
  product: string,
  headline: string,
  fields: ExtraFields = {},
): string {
  const text = [`${product}${SEPARATOR}${headline}`, ...renderFields(fields)].join('\n');
  return text.length > TELEGRAM_MAX_TEXT ? `${text.slice(0, TELEGRAM_MAX_TEXT - 1)}…` : text;
}
