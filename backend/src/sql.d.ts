// language: TypeScript, file: backend/src/sql.d.ts
// Схема подключается как текст и вшивается в бандл сборщиком.
// Так на неё нет файловой зависимости во время выполнения: сервер не упадёт,
// если рядом с собранным файлом не окажется schema.sql.

declare module '*.sql' {
  const content: string;
  export default content;
}
