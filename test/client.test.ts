import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTelegramAlerts } from '../src/client.js';

type FetchMock = ReturnType<typeof vi.fn>;

function okFetch(): FetchMock {
  return vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => '' });
}

function requestBody(fetchMock: FetchMock, call = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[call]![1] as RequestInit;
  return JSON.parse(String(init.body));
}

beforeEach(() => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createTelegramAlerts', () => {
  it('requires a product name', () => {
    // @ts-expect-error runtime guard for JS callers
    expect(() => createTelegramAlerts({})).toThrow(/product/);
  });

  it('is disabled and a no-op without configuration', async () => {
    const fetchMock = okFetch();
    const alerts = createTelegramAlerts({ product: 'P', fetch: fetchMock, logger: false });
    expect(alerts.enabled).toBe(false);
    await expect(alerts.signup({ email: 'a@b.c' })).resolves.toEqual({
      ok: false,
      reason: 'unconfigured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the token and chat id from the environment at send time', async () => {
    const fetchMock = okFetch();
    const alerts = createTelegramAlerts({ product: 'Dingcut', fetch: fetchMock });
    process.env.TELEGRAM_BOT_TOKEN = 'tok';
    process.env.TELEGRAM_CHAT_ID = '42';
    expect(alerts.enabled).toBe(true);
    await expect(alerts.signup({ name: 'Ada', email: 'ada@example.com' })).resolves.toEqual({
      ok: true,
      chatId: '42',
    });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.telegram.org/bottok/sendMessage');
    expect(requestBody(fetchMock)).toMatchObject({
      chat_id: '42',
      text: 'Dingcut - New signup\nName: Ada\nEmail: ada@example.com',
      disable_notification: false,
    });
  });

  it('fans out to every chat id in a comma-separated list', async () => {
    const fetchMock = okFetch();
    const alerts = createTelegramAlerts({
      product: 'P',
      botToken: 't',
      chatId: '1, 2',
      fetch: fetchMock,
    });
    await alerts.send('hi');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBody(fetchMock, 1).chat_id).toBe('2');
  });

  it('formats subscription amounts with currency and passes extra fields through', () => {
    const alerts = createTelegramAlerts({ product: 'LocalReach' });
    expect(
      alerts.format.subscription({
        email: 'a@b.c',
        plan: 'Pro',
        interval: 'annual',
        amount: 14.99,
        currency: 'usd',
        licenseId: '9',
      }),
    ).toBe(
      'LocalReach - New subscription\nEmail: a@b.c\nPlan: Pro\nInterval: annual\nAmount: 14.99 USD\nLicense id: 9',
    );
  });

  it('formats payments and cancellations', () => {
    const alerts = createTelegramAlerts({ product: 'P' });
    expect(
      alerts.format.payment({ email: 'a@b.c', amount: 5, currency: 'eur', reference: 'in_1' }),
    ).toBe('P - Payment received\nEmail: a@b.c\nAmount: 5 EUR\nReference: in_1');
    expect(
      alerts.format.cancellation({ email: 'a@b.c', plan: 'Pro', reason: 'too expensive' }),
    ).toBe('P - Subscription cancelled\nEmail: a@b.c\nPlan: Pro\nReason: too expensive');
  });

  it('reports HTTP failures without throwing and calls onError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 401, text: async () => 'Unauthorized' });
    const onError = vi.fn();
    const alerts = createTelegramAlerts({
      product: 'P',
      botToken: 't',
      chatId: '1',
      fetch: fetchMock,
      logger: false,
      onError,
    });
    const result = await alerts.send('hi');
    expect(result).toEqual({
      ok: false,
      reason: 'http',
      chatId: '1',
      status: 401,
      error: 'Unauthorized',
    });
    expect(onError).toHaveBeenCalledWith(result);
  });

  it('reports network errors and logs them', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    const logger = { error: vi.fn() };
    const alerts = createTelegramAlerts({
      product: 'P',
      botToken: 't',
      chatId: '1',
      fetch: fetchMock,
      logger,
    });
    await expect(alerts.send('hi')).resolves.toMatchObject({
      ok: false,
      reason: 'network',
      error: 'offline',
    });
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('times out slow requests', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    const alerts = createTelegramAlerts({
      product: 'P',
      botToken: 't',
      chatId: '1',
      fetch: fetchMock,
      logger: false,
      timeoutMs: 10,
    });
    await expect(alerts.send('hi')).resolves.toMatchObject({ ok: false, reason: 'timeout' });
  });

  it('survives an onError handler that throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    const alerts = createTelegramAlerts({
      product: 'P',
      botToken: 't',
      chatId: '1',
      fetch: fetchMock,
      logger: false,
      onError: () => {
        throw new Error('boom');
      },
    });
    await expect(alerts.send('hi')).resolves.toMatchObject({ ok: false });
  });

  it('exposes Auth.js events that send the signup alert', async () => {
    const fetchMock = okFetch();
    const alerts = createTelegramAlerts({
      product: 'P',
      botToken: 't',
      chatId: '1',
      fetch: fetchMock,
    });
    await alerts.authEvents().createUser({ user: { name: 'Ada', email: 'ada@example.com' } });
    expect(requestBody(fetchMock).text).toBe('P - New signup\nName: Ada\nEmail: ada@example.com');
  });

  it('sends silent notifications when asked', async () => {
    const fetchMock = okFetch();
    const alerts = createTelegramAlerts({
      product: 'P',
      botToken: 't',
      chatId: '1',
      fetch: fetchMock,
      silent: true,
    });
    await alerts.send('hi');
    expect(requestBody(fetchMock).disable_notification).toBe(true);
  });
});
