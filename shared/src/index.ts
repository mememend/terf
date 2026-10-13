// language: TypeScript, file: shared/src/index.ts
// Общее ядро игры. Один и тот же код исполняют клиент и сервер:
// одни правила генерации, одни очки узоров, одна арифметика цены.
// Ничего из этого модуля не обращается к DOM — импорт безопасен на сервере.

export * from './types';
export * from './config';
export * from './operators';
export * from './anonymous';
export * from './roulette';
export * from './tasks';
export * from './promo';
export * from './overrides';
export * from './rng';
export * from './patterns';
export * from './generator';
export * from './quests';
export * from './engine';
