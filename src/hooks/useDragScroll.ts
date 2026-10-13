// language: TypeScript, file: frontend/src/hooks/useDragScroll.ts
// Перетаскивание лент мышью.
//
// Браузер прокручивает overflow-контейнер колесом и пальцем, но НЕ мышью:
// на компьютере ленту нельзя сдвинуть, потянув за карточку — именно на это
// жаловались при игре. Хук добавляет перетаскивание указателем.
//
// На телефоне жест не перехватывается: там прокрутка нативная и плавнее,
// поэтому события касания пропускаем, а работаем только с мышью и пером.

import { useEffect, useRef } from 'react';

/** Сколько пикселей нужно пройти, чтобы считать это перетаскиванием, а не кликом. */
const DRAG_THRESHOLD = 4;

export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    const onPointerDown = (event: PointerEvent) => {
      // Палец не трогаем: браузер прокручивает сам, и лучше нас.
      if (event.pointerType === 'touch') return;
      // Правой кнопкой не тащим — там контекстное меню.
      if (event.button !== 0) return;

      dragging = true;
      moved = false;
      startX = event.clientX;
      startScroll = element.scrollLeft;
      // Класс перетаскивания здесь НЕ ставим: он отключает события у детей,
      // и обычное нажатие на кнопку перестало бы доходить до неё.
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const delta = event.clientX - startX;

      if (Math.abs(delta) > DRAG_THRESHOLD) {
        if (!moved) {
          moved = true;
          // Помечаем ленту тянущейся только когда жест действительно начался.
          element.classList.add('is-dragging');
        }
        // Захватываем указатель после порога: иначе обычный клик
        // по карточке перестал бы доходить до кнопки.
        if (!element.hasPointerCapture(event.pointerId)) {
          element.setPointerCapture(event.pointerId);
        }
      }
      if (moved) element.scrollLeft = startScroll - delta;
    };

    const finish = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      element.classList.remove('is-dragging');
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }
    };

    /**
     * После перетаскивания клик по карточке не должен выбирать тариф:
     * игрок тянул ленту, а не нажимал. Гасим ровно один клик.
     */
    const onClick = (event: MouseEvent) => {
      if (!moved) return;
      moved = false;
      event.preventDefault();
      event.stopPropagation();
    };

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', finish);
    element.addEventListener('pointercancel', finish);
    element.addEventListener('click', onClick, true);

    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', finish);
      element.removeEventListener('pointercancel', finish);
      element.removeEventListener('click', onClick, true);
    };
  }, []);

  return ref;
}
