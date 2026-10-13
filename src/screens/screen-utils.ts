// language: TypeScript, file: frontend/src/screens/screen-utils.ts
// Общее для экранов: что нужно почти каждому — игра и заголовок с шапкой.

import type { Game } from '../hooks/useGame';

export interface ScreenProps {
  game: Game;
  onBack: () => void;
}

/**
 * Свойства шапки. Вынесено из общего файла экранов, чтобы новые экраны
 * не тянули за собой весь список разделов меню.
 */
export function headerProps(game: Game, onBack: () => void) {
  return {
    level: game.state.player.level,
    levelProgress: game.levelProgress,
    balance: game.state.player.balance,
    avatarUrl: game.state.player.avatarUrl,
    name: game.state.player.name,
    onBack,
  };
}
