// language: TypeScript, file: frontend/src/components/OperatorModal.tsx
// Выбор оператора и кода до выпуска, как в референсе.
//
// Два связанных экрана:
//   «Оператор» — пять брендов страны плюс вариант «Любой» без доплаты;
//   «Коды»      — коды выбранного оператора: с какого именно начнётся номер.
//
// Свой оператор стоит дороже (ECONOMY.operatorSurcharge), но шансы не меняет:
// игрок платит только за право выбрать, а не за лучший результат.

import { ECONOMY, brandedOperators } from '@ciferki/shared';
import type { Country } from '@ciferki/shared';
import { Modal } from './Modal';
import { Flag } from './Flag';
import type { Game } from '../hooks/useGame';

interface OperatorModalProps {
  game: Game;
  country: Country | null;
  onClose: () => void;
  /** Переход к выбору страны: без страны оператора не выбрать */
  onOpenCountries: () => void;
  /** Открыть коды выбранного оператора */
  onOpenCodes: () => void;
}

export function OperatorModal({
  game,
  country,
  onClose,
  onOpenCountries,
  onOpenCodes,
}: OperatorModalProps) {
  const { selectedOperator } = game.state;
  const surcharge = `${Math.round(ECONOMY.operatorSurcharge * 100)} %`;

  if (!country) {
    return (
      <Modal title="Оператор" onClose={onClose}>
        <div className="operator-empty">
          <div className="operator-empty__title">Сначала выберите страну</div>
          <div className="operator-empty__hint">
            У каждой страны свои операторы и свои коды, поэтому выбрать бренд можно
            только внутри региона.
          </div>
          <button className="choose-btn" onClick={onOpenCountries}>
            <span>Выбрать страну</span>
          </button>
        </div>
      </Modal>
    );
  }

  const operators = brandedOperators(country.id);

  return (
    <Modal
      title="Оператор"
      subtitle={`${country.name}: свой оператор — цена +${surcharge}, шансы те же`}
      onClose={onClose}
      footer={
        <div className="action-note">
          {selectedOperator
            ? `Выпуск подорожает на ${surcharge}. Категория номера от этого не зависит.`
            : 'Оператор определится сам по коду номера — без доплаты.'}
        </div>
      }
    >
      <div className="operator-grid">
        <button
          className={`operator-tile ${selectedOperator === null ? 'operator-tile--picked' : ''}`}
          onClick={() => {
            game.chooseOperator(null);
            onClose();
          }}
        >
          <span className="operator-tile__badge operator-tile__badge--any">🎲</span>
          <span className="operator-tile__name">Любой</span>
          <span className="operator-tile__hint">без доплаты</span>
        </button>

        {operators.map((operator) => (
          <button
            key={operator.id}
            className={`operator-tile ${
              selectedOperator === operator.id ? 'operator-tile--picked' : ''
            }`}
            onClick={() => {
              game.chooseOperator(operator.id);
              onOpenCodes();
            }}
          >
            <span className="operator-tile__badge" style={{ background: operator.color }}>
              {operator.badge}
            </span>
            <span className="operator-tile__name">{operator.name}</span>
            <span className="operator-tile__hint">{operator.codes.length} кодов</span>
          </button>
        ))}

        <button className="operator-tile operator-tile--link" onClick={onOpenCountries}>
          <Flag countryId={country.id} size={26} />
          <span className="operator-tile__name">Страна</span>
          <span className="operator-tile__hint">сменить</span>
        </button>
      </div>
    </Modal>
  );
}

interface CodeModalProps {
  game: Game;
  country: Country | null;
  onClose: () => void;
  /** Вернуться к списку операторов */
  onOpenOperators: () => void;
}

export function CodeModal({ game, country, onClose, onOpenOperators }: CodeModalProps) {
  const { selectedOperator, selectedCode } = game.state;
  const operator = country
    ? brandedOperators(country.id).find((item) => item.id === selectedOperator) ?? null
    : null;

  if (!country || !operator) {
    return (
      <Modal title="Код" onClose={onClose}>
        <div className="operator-empty">
          <div className="operator-empty__title">Оператор не выбран</div>
          <div className="operator-empty__hint">
            Сначала выберите оператора — коды принадлежат ему.
          </div>
          <button className="choose-btn" onClick={onOpenOperators}>
            <span>Выбрать оператора</span>
          </button>
        </div>
      </Modal>
    );
  }

  const prefix = country.code;

  return (
    <Modal
      title={operator.name}
      subtitle={`Номер начнётся с ${prefix} и выбранного кода`}
      onClose={onClose}
      footer={
        <button className="link-row" style={{ width: '100%' }} onClick={onOpenOperators}>
          ‹ Другой оператор
        </button>
      }
    >
      <div className="operator-grid">
        <button
          className={`code-tile ${selectedCode === null ? 'code-tile--picked' : ''}`}
          onClick={() => {
            game.chooseCode(null);
            onClose();
          }}
        >
          <span className="code-tile__any">🎲</span>
          <span className="code-tile__label">Любой код</span>
          <span className="code-tile__sample">{operator.name}</span>
        </button>

        {operator.codes.map((code) => (
          <button
            key={code}
            className={`code-tile ${selectedCode === code ? 'code-tile--picked' : ''}`}
            onClick={() => {
              game.chooseCode(code);
              onClose();
            }}
          >
            <span className="code-tile__code">{code}</span>
            <span className="code-tile__sample">
              {prefix} {code}
            </span>
          </button>
        ))}

        <button className="code-tile code-tile--link" onClick={onOpenOperators}>
          <span className="operator-tile__badge" style={{ background: operator.color }}>
            {operator.badge}
          </span>
          <span className="code-tile__label">Оператор</span>
          <span className="code-tile__sample">сменить</span>
        </button>
      </div>
    </Modal>
  );
}

/** Что показать в селекторе на главном: «Любой», бренд или конкретный код. */
export function describeOperatorChoice(game: Game): string {
  const { selectedOperator, selectedCode, selectedCountry } = game.state;
  if (!selectedCountry || !selectedOperator) return 'Любой';
  const operators = brandedOperators(selectedCountry);
  const operator = operators.find((item) => item.id === selectedOperator);
  if (!operator) return 'Любой';
  return selectedCode ? `${operator.name} · ${selectedCode}` : operator.name;
}

/** Надбавка к цене выпуска, если выбран свой оператор. */
export function operatorSurchargeLabel(game: Game): string | null {
  if (!game.state.selectedOperator) return null;
  return `+${Math.round(ECONOMY.operatorSurcharge * 100)} % за оператора`;
}
