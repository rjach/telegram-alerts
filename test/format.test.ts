import { describe, expect, it } from 'vitest';
import { composeMessage, labelFor, renderFields, renderMoney, renderValue } from '../src/format.js';

describe('labelFor', () => {
  it('humanizes camelCase and snake_case keys', () => {
    expect(labelFor('email')).toBe('Email');
    expect(labelFor('endsAt')).toBe('Ends at');
    expect(labelFor('stripe_customer_id')).toBe('Stripe customer id');
  });
});

describe('renderValue', () => {
  it('drops empty values', () => {
    expect(renderValue(null)).toBeNull();
    expect(renderValue(undefined)).toBeNull();
    expect(renderValue('   ')).toBeNull();
    expect(renderValue(new Date('nope'))).toBeNull();
  });
  it('renders booleans, numbers and dates', () => {
    expect(renderValue(true)).toBe('yes');
    expect(renderValue(0)).toBe('0');
    expect(renderValue(new Date('2026-09-07T00:00:00Z'))).toBe('2026-09-07T00:00:00.000Z');
  });
});

describe('renderMoney', () => {
  it('joins amount and upper-cased currency', () => {
    expect(renderMoney(14.99, 'usd')).toBe('14.99 USD');
    expect(renderMoney('9', null)).toBe('9');
    expect(renderMoney(null, 'usd')).toBeNull();
  });
});

describe('composeMessage', () => {
  it('uses the PRODUCT - Headline shape and skips empty fields', () => {
    expect(composeMessage('Dingcut', 'New signup', { name: 'Ada', email: '', plan: null })).toBe(
      'Dingcut - New signup\nName: Ada',
    );
  });
  it('caps the text at the Telegram limit', () => {
    const text = composeMessage('P', 'H', { note: 'x'.repeat(5000) });
    expect(text.length).toBe(4096);
    expect(text.endsWith('…')).toBe(true);
  });
  it('keeps field order', () => {
    expect(renderFields({ b: 1, a: 2 })).toEqual(['B: 1', 'A: 2']);
  });
});
