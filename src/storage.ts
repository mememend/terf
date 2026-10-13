// language: TypeScript, file: frontend/src/storage.ts
// Локальное сохранение состояния. На этапе прототипа игра живёт здесь,
// дальше тот же объект GameState уезжает в PostgreSQL — схема уже совпадает.

import { SCHEMA_VERSION, createInitialState } from '@ciferki/shared';
import type { GameState } from '@ciferki/shared';

const STORAGE_KEY = 'ciferki.state';
const BACKUP_KEY = 'ciferki.state.backup';

function isUsable(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GameState>;
  return (
    state.schema === SCHEMA_VERSION &&
    typeof state.player === 'object' &&
    state.player !== null &&
    Array.isArray(state.numbers) &&
    Array.isArray(state.ledger)
  );
}

export function loadState(player?: { id?: string; name?: string; avatarUrl?: string | null }): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isUsable(parsed)) {
        // Имя и аватар всегда берём из Telegram — их нельзя подделать в localStorage.
        return {
          ...parsed,
          player: {
            ...parsed.player,
            name: player?.name ?? parsed.player.name,
            avatarUrl: player?.avatarUrl ?? parsed.player.avatarUrl,
          },
        };
      }
      // Схема устарела — сохраняем копию и начинаем заново.
      localStorage.setItem(BACKUP_KEY, raw);
    }
  } catch {
    // Повреждённое хранилище не должно ронять игру.
  }
  return createInitialState({
    name: player?.name,
    avatarUrl: player?.avatarUrl ?? null,
  });
}

export function saveState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Переполнение хранилища не критично — состояние останется в памяти.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ничего не делаем.
  }
}
