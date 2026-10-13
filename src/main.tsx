// language: TypeScript, file: frontend/src/main.tsx
// Вход приложения: подключаем стили и монтируем App.
// StrictMode включён намеренно — он вылавливает двойные побочные эффекты.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/app.css';

const container = document.getElementById('root');
if (!container) throw new Error('Не найден контейнер #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
