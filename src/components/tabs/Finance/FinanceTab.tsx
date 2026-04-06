/* ============================================
   Вкладка: Финансы
   Учёт оплат, остатков и расходов по клиенту
   ============================================ */

import { usePersistedState } from '../../../utils/usePersistedState';
import './FinanceTab.css';

interface Props {
  clientId: string;
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

interface FinanceData {
  received: number;      // Сколько получили от клиента
  totalAgreed: number;   // Общая сумма по договору
  expenses: ExpenseItem[];
}

const DEFAULT_FINANCE: FinanceData = {
  received: 0,
  totalAgreed: 0,
  expenses: [],
};

const EXPENSE_PRESETS = [
  'Анализ страницы',
  'Создание сценариев',
  'Монтаж видео',
  'Обложки / Дизайн',
  'Таргетированная реклама',
  'Съёмка / Контент',
  'Непредвиденные расходы',
];

const formatMoney = (n: number) => {
  return n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export function FinanceTab({ clientId }: Props) {
  const [finance, setFinance] = usePersistedState<FinanceData>(
    `hw_finance_${clientId}`,
    DEFAULT_FINANCE
  );

  const totalExpenses = finance.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const remaining = finance.totalAgreed - finance.received;
  const profit = finance.received - totalExpenses;
  const profitPercent = finance.received > 0 ? Math.min(100, Math.max(0, (profit / finance.received) * 100)) : 0;

  const updateField = (field: 'received' | 'totalAgreed', value: string) => {
    const num = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
    setFinance(prev => ({ ...prev, [field]: num }));
  };

  const addExpense = (name: string = '') => {
    const newExpense: ExpenseItem = {
      id: crypto.randomUUID(),
      name,
      amount: 0,
    };
    setFinance(prev => ({
      ...prev,
      expenses: [...prev.expenses, newExpense],
    }));
  };

  const updateExpense = (id: string, patch: Partial<ExpenseItem>) => {
    setFinance(prev => ({
      ...prev,
      expenses: prev.expenses.map(e =>
        e.id === id ? { ...e, ...patch } : e
      ),
    }));
  };

  const removeExpense = (id: string) => {
    setFinance(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id),
    }));
  };

  // Какие пресеты ещё не добавлены
  const usedNames = new Set(finance.expenses.map(e => e.name));
  const availablePresets = EXPENSE_PRESETS.filter(p => !usedNames.has(p));

  return (
    <div className="finance-tab">
      {/* === Summary Cards === */}
      <div className="finance-summary">
        <div className="finance-summary-card card">
          <div className="card-body">
            <span className="finance-summary-emoji">💰</span>
            <span className={`finance-summary-value finance-value-positive`}>
              {formatMoney(finance.received)} ₴
            </span>
            <span className="finance-summary-label">Получено</span>
          </div>
        </div>
        <div className="finance-summary-card card">
          <div className="card-body">
            <span className="finance-summary-emoji">📤</span>
            <span className={`finance-summary-value finance-value-negative`}>
              {formatMoney(totalExpenses)} ₴
            </span>
            <span className="finance-summary-label">Расходы</span>
          </div>
        </div>
        <div className="finance-summary-card card">
          <div className="card-body">
            <span className="finance-summary-emoji">{profit >= 0 ? '📈' : '📉'}</span>
            <span className={`finance-summary-value ${profit >= 0 ? 'finance-value-positive' : 'finance-value-negative'}`}>
              {profit >= 0 ? '+' : ''}{formatMoney(profit)} ₴
            </span>
            <span className="finance-summary-label">Прибыль</span>
          </div>
        </div>
      </div>

      {/* Profit Bar */}
      {finance.received > 0 && (
        <div className="finance-profit-bar">
          <div className="finance-profit-track">
            <div
              className="finance-profit-fill"
              style={{
                width: `${profitPercent}%`,
                background: profit >= 0
                  ? 'linear-gradient(90deg, var(--color-success), #34d399)'
                  : 'linear-gradient(90deg, var(--color-danger), #f87171)',
              }}
            />
          </div>
          <div className="finance-profit-label">
            <span>Расходы: {formatMoney(totalExpenses)} ₴</span>
            <span>Маржинальность: {Math.round(profitPercent)}%</span>
          </div>
        </div>
      )}

      {/* === Income === */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">💵 Оплата от клиента</h3>
          <p className="ai-section-desc">
            Укажите общую сумму по договору и сколько уже получено.
          </p>

          <div className="finance-income-grid">
            <div className="finance-field">
              <label className="finance-field-label">Сумма по договору</label>
              <div className="finance-input-wrapper">
                <span className="finance-currency">₴</span>
                <input
                  type="text"
                  className="input"
                  placeholder="0"
                  value={finance.totalAgreed || ''}
                  onChange={(e) => updateField('totalAgreed', e.target.value)}
                />
              </div>
              <span className="finance-field-hint">Полная стоимость пакета услуг</span>
            </div>

            <div className="finance-field">
              <label className="finance-field-label">Получено</label>
              <div className="finance-input-wrapper">
                <span className="finance-currency">₴</span>
                <input
                  type="text"
                  className="input"
                  placeholder="0"
                  value={finance.received || ''}
                  onChange={(e) => updateField('received', e.target.value)}
                />
              </div>
              <span className="finance-field-hint">
                {remaining > 0 && (
                  <>Остаток: <b style={{ color: 'var(--color-warning, #EAB308)' }}>{formatMoney(remaining)} ₴</b></>
                )}
                {remaining === 0 && finance.totalAgreed > 0 && (
                  <b style={{ color: 'var(--color-success)' }}>✅ Оплачено полностью</b>
                )}
                {remaining < 0 && (
                  <b style={{ color: 'var(--color-success)' }}>+{formatMoney(Math.abs(remaining))} ₴ переплата</b>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* === Expenses === */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">📊 Расходы на клиента</h3>
          <p className="ai-section-desc">
            Добавьте статьи расходов вручную или из шаблонов.
          </p>

          <div className="finance-expenses-list">
            {finance.expenses.map((expense) => (
              <div key={expense.id} className="finance-expense-row">
                <input
                  type="text"
                  className="input"
                  placeholder="Название расхода"
                  value={expense.name}
                  onChange={(e) => updateExpense(expense.id, { name: e.target.value })}
                />
                <div className="finance-input-wrapper">
                  <span className="finance-currency">₴</span>
                  <input
                    type="text"
                    className="input"
                    placeholder="0"
                    value={expense.amount || ''}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0;
                      updateExpense(expense.id, { amount: num });
                    }}
                  />
                </div>
                <button
                  className="finance-remove-btn"
                  onClick={() => removeExpense(expense.id)}
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            ))}

            {finance.expenses.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-4) 0' }}>
                Пока нет расходов. Добавьте из шаблонов ниже или создайте свой.
              </p>
            )}
          </div>

          {/* Presets */}
          {availablePresets.length > 0 && (
            <div className="finance-presets">
              {availablePresets.map((preset) => (
                <button
                  key={preset}
                  className="finance-preset-btn"
                  onClick={() => addExpense(preset)}
                >
                  + {preset}
                </button>
              ))}
            </div>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => addExpense('')}
            style={{ marginTop: 'var(--space-3)' }}
          >
            + Добавить расход
          </button>

          {/* Total */}
          {finance.expenses.length > 0 && (
            <div className="finance-expense-total">
              <span>Итого расходов:</span>
              <span className="finance-expense-total-value">
                {formatMoney(totalExpenses)} ₴
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
