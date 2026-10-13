// language: TypeScript, file: bot/src/setup.ts
// Разовая настройка бота при старте: список команд и кнопка меню.
// Кнопка меню — постоянный вход в Mini App у поля ввода, независимо от истории чата.

import type { BotCommand, TelegramApi } from './api.ts';
import type { BotEnv } from './env.ts';
import { webappLink } from './env.ts';

export const COMMANDS: BotCommand[] = [
  { command: 'play', description: 'Открыть игру' },
  { command: 'chances', description: 'Шансы выпадения по тарифам' },
  { command: 'rules', description: 'Как считаются очки и цена' },
  { command: 'profile', description: 'Профиль: уровень, баланс, коллекция' },
  { command: 'share', description: 'Ссылка для друзей' },
  { command: 'help', description: 'Что умеет бот' },
];

export interface SetupResult {
  commands: boolean;
  menuButton: boolean;
  username: string | null;
  warnings: string[];
}

export async function configureBot(api: TelegramApi, env: BotEnv): Promise<SetupResult> {
  const warnings: string[] = [];

  const me = await api.getMe();
  if (!me.is_bot) warnings.push('getMe вернул не бота — проверь токен');

  const commands = await api.setMyCommands(COMMANDS);
  const menuButton = await api.setChatMenuButton({
    type: 'web_app',
    text: env.webappTitle.slice(0, 64),
    web_app: { url: webappLink(env) },
  });

  // Имя нужно для ссылок вида t.me/<имя>, но его отсутствие не критично.
  const username = me.username ?? env.botUsername ?? null;
  if (!username) {
    warnings.push('у бота нет username — команда /share не сможет собрать ссылку');
  }

  return { commands, menuButton, username, warnings };
}
