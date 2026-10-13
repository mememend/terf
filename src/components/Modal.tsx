// language: TypeScript, file: frontend/src/components/Modal.tsx
// Оболочка модальных окон: затемнение фона, выезд снизу, заголовок с подзаголовком.

import type { ReactNode } from 'react';
import { IconClose } from './Icons';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, subtitle, onClose, children, footer }: ModalProps) {
  return (
    <div className="modal" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal__panel" onClick={(event) => event.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Закрыть">
          <IconClose size={16} />
        </button>

        <div className="modal__grabber" />

        <div className="modal__head">
          <div className="modal__title">{title}</div>
          {subtitle && <div className="modal__sub">{subtitle}</div>}
        </div>

        <div className="modal__body">{children}</div>

        {footer && <div className="modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
