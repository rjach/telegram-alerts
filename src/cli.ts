import { createTelegramAlerts } from './client.js';
import { loadDotenv } from './dotenv.js';
import { ENV_BOT_TOKEN, ENV_CHAT_ID, resolveBotToken, resolveChatIds } from './env.js';

const USAGE = `telegram-alerts <command> [options]

Commands
  setup          Find your chat id (after you message the bot) and send a test alert
  chat-id        Print the chat ids that have messaged the bot
  test [text]    Send a test alert (or the given text) to TELEGRAM_CHAT_ID

Options
  --product <name>   Message prefix. Default: "Telegram alerts"
  --token <token>    Bot token. Default: $${ENV_BOT_TOKEN} (also read from ./.env)
  --chat <id>        Chat id. Default: $${ENV_CHAT_ID} (also read from ./.env)
  --env <path>       .env file to read. Default: ./.env
  -h, --help         Show this help
`;

type Args = { command: string; text: string[]; flags: Record<string, string | true> };

export function parseArgs(argv: string[]): Args {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '-h' || arg === '--help') flags.help = true;
    else if (arg.startsWith('--')) {
      const [key, inline] = arg.slice(2).split('=', 2);
      const next = argv[i + 1];
      if (inline !== undefined) flags[key!] = inline;
      else if (next !== undefined && !next.startsWith('--')) {
        flags[key!] = next;
        i++;
      } else flags[key!] = true;
    } else positional.push(arg);
  }
  const [command = 'setup', ...text] = positional;
  return { command, text, flags };
}

type Chat = {
  id: number | string;
  type: string;
  username?: string;
  title?: string;
  first_name?: string;
};

async function discoverChats(token: string): Promise<Chat[]> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const json = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: Array<Record<string, { chat?: Chat }>>;
  };
  if (!json.ok) throw new Error(json.description ?? `getUpdates failed with HTTP ${res.status}`);
  const chats = new Map<string, Chat>();
  for (const update of json.result ?? []) {
    const chat = update.message?.chat ?? update.channel_post?.chat ?? update.my_chat_member?.chat;
    if (chat) chats.set(String(chat.id), chat);
  }
  return [...chats.values()];
}

function describeChat(chat: Chat): string {
  const who = chat.username ? `@${chat.username}` : (chat.title ?? chat.first_name ?? '');
  return `${chat.id}\t${chat.type}${who ? `\t${who}` : ''}`;
}

export async function main(argv = process.argv.slice(2), env = process.env): Promise<number> {
  const { command, text, flags } = parseArgs(argv);
  if (flags.help || command === 'help') {
    console.log(USAGE);
    return 0;
  }
  loadDotenv(typeof flags.env === 'string' ? flags.env : '.env', env);

  const token = resolveBotToken(typeof flags.token === 'string' ? flags.token : undefined);
  if (!token) {
    console.error(
      `No bot token. Create one with @BotFather, then set ${ENV_BOT_TOKEN} or pass --token.`,
    );
    return 1;
  }
  const product = typeof flags.product === 'string' ? flags.product : 'Telegram alerts';
  let chatIds = resolveChatIds(typeof flags.chat === 'string' ? flags.chat : undefined);

  if (command === 'chat-id' || (command === 'setup' && chatIds.length === 0)) {
    let chats: Chat[];
    try {
      chats = await discoverChats(token);
    } catch (err) {
      console.error(`Could not read updates: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
    if (chats.length === 0) {
      console.error(
        'No chats yet. Open Telegram, send your bot any message (or add it to a group), then run this again.',
      );
      return 1;
    }
    console.log('chat id\ttype\twho');
    for (const chat of chats) console.log(describeChat(chat));
    chatIds = [String(chats[0]!.id)];
    console.log(`\nAdd to your environment:\n${ENV_CHAT_ID}=${chatIds[0]}\n`);
    if (command === 'chat-id') return 0;
  }

  if (chatIds.length === 0) {
    console.error(`No chat id. Run \`telegram-alerts chat-id\` or set ${ENV_CHAT_ID}.`);
    return 1;
  }

  const alerts = createTelegramAlerts({ product, botToken: token, chatId: chatIds });
  const result = text.length > 0 ? await alerts.send(text.join(' ')) : await alerts.test();
  if (!result.ok) {
    console.error(
      `Send failed (${result.reason}${result.status ? ` ${result.status}` : ''}): ${result.error ?? ''}`,
    );
    return 1;
  }
  console.log(`Sent to chat ${chatIds.join(', ')}.`);
  return 0;
}

const invokedDirectly =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  /cli\.(js|ts|cjs|mjs)$/.test(process.argv[1]);
if (invokedDirectly) {
  main().then((code) => process.exit(code));
}
