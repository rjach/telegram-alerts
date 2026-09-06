export const ENV_BOT_TOKEN = 'TELEGRAM_BOT_TOKEN';
export const ENV_CHAT_ID = 'TELEGRAM_CHAT_ID';

function readEnv(name: string): string | undefined {
  const value = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  return value && value.trim() !== '' ? value.trim() : undefined;
}

export function resolveBotToken(explicit: string | undefined): string | undefined {
  return explicit && explicit.trim() !== '' ? explicit.trim() : readEnv(ENV_BOT_TOKEN);
}

/** Explicit option wins; otherwise the env var. Both accept a comma-separated list. */
export function resolveChatIds(explicit: string | string[] | undefined): string[] {
  const raw = Array.isArray(explicit) ? explicit : [explicit ?? readEnv(ENV_CHAT_ID) ?? ''];
  return raw
    .flatMap((part) => part.split(','))
    .map((part) => part.trim())
    .filter((part) => part !== '');
}
