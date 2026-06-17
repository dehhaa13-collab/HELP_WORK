/* ============================================
   Вкладка: Финансы (v2)
   Учёт оплат, расходов на команду, прочих расходов
   ============================================ */

import { useState } from 'react';
import { usePersistedState } from '../../../utils/usePersistedState';
import { exportClientFinanceCSV } from '../../../utils/exportUtils';
import { useClients } from '../../../hooks/useClients';
import './FinanceTab.css';

interface Props {
  clientId: string;
}

// === Типы данных ===

interface PaymentEntry {
  id: string;
  amount: number;
  date: string;       // "YYYY-MM-DD"
  note: string;
}

interface TeamCostEntry {
  id: string;
  type: string;       // Ключ из TEAM_COST_PRESETS
  label: string;      // Человеческое название
  quantity: number;
  unitPrice: number;
  date: string;
  note: string;
}

interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
  date: string;
}

interface FinanceData {
  received: number;
  totalAgreed: number;
  expenses: ExpenseItem[];
  payments: PaymentEntry[];
  teamCosts: TeamCostEntry[];
}

const DEFAULT_FINANCE: FinanceData = {
  received: 0,
  totalAgreed: 0,
  expenses: [],
  payments: [],
  teamCosts: [],
};

// === Пресеты ===

const TEAM_COST_PRESETS = [
  { type: 'video_editing',    label: '🎬 Монтаж видео (Богдан)',   defaultPrice: 350  },
  { type: 'producer',         label: '👨‍💼 Продюсер',                defaultPrice: 2000 },
  { type: 'cover_design',     label: '🎨 Создание обложек',        defaultPrice: 0    },
  { type: 'acquisition',      label: '📢 Стоимость привлечения',   defaultPrice: 0    },
];

const EXPENSE_PRESETS = [
  'Анализ страницы',
  'Таргетированная реклама',
  'Непредвиденные расходы',
];

const formatMoney = (n: number) =>
  n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const today = () => new Date().toISOString().split('T')[0];


type SortDir = 'newest' | 'oldest';

function sortByDate<T extends { date: string }>(arr: T[], dir: SortDir): T[] {
  return [...arr].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return dir === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });
}

// === Компонент ===

export function FinanceTab({ clientId }: Props) {
  const { data: clients } = useClients();
  const [finance, setFinance] = usePersistedState<FinanceData>(
    `hw_finance_${clientId}`,
    DEFAULT_FINANCE
  );

  const [sortDir, setSortDir] = useState<SortDir>('newest');

  // === Расчёты ===
  const totalPayments = (finance.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
  const effectiveReceived = (finance.payments || []).length > 0 ? totalPayments : finance.received;
  const totalTeamCosts = (finance.teamCosts || []).reduce((s, t) => s + ((t.quantity || 0) * (t.unitPrice || 0)), 0);
  const totalExpenses = (finance.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const allCosts = totalTeamCosts + totalExpenses;
  const remaining = finance.totalAgreed - effectiveReceived;
  const profit = effectiveReceived - allCosts;
  const profitPercent = effectiveReceived > 0 ? Math.min(100, Math.max(0, (profit / effectiveReceived) * 100)) : 0;

  // === Оплаты ===
  const addPayment = () => {
    const p: PaymentEntry = { id: crypto.randomUUID(), amount: 0, date: today(), note: '' };
    setFinance(prev => ({
      ...prev,
      payments: [...(prev.payments || []), p],
    }));
  };

  const updatePayment = (id: string, patch: Partial<PaymentEntry>) => {
    setFinance(prev => ({
      ...prev,
      payments: (prev.payments || []).map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  };

  const removePayment = (id: string) => {
    setFinance(prev => ({
      ...prev,
      payments: (prev.payments || []).filter(p => p.id !== id),
    }));
  };

  // === Команда ===
  const addTeamCost = (preset?: typeof TEAM_COST_PRESETS[number]) => {
    const t: TeamCostEntry = {
      id: crypto.randomUUID(),
      type: preset?.type || 'other',
      label: preset?.label || '📦 Другое',
      quantity: 1,
      unitPrice: preset?.defaultPrice || 0,
      date: today(),
      note: '',
    };
    setFinance(prev => ({
      ...prev,
      teamCosts: [...(prev.teamCosts || []), t],
    }));
  };

  const updateTeamCost = (id: string, patch: Partial<TeamCostEntry>) => {
    setFinance(prev => ({
      ...prev,
      teamCosts: (prev.teamCosts || []).map(t => t.id === id ? { ...t, ...patch } : t),
    }));
  };

  const removeTeamCost = (id: string) => {
    setFinance(prev => ({
      ...prev,
      teamCosts: (prev.teamCosts || []).filter(t => t.id !== id),
    }));
  };

  // === Расходы ===
  const addExpense = (name: string = '') => {
    const e: ExpenseItem = { id: crypto.randomUUID(), name, amount: 0, date: today() };
    setFinance(prev => ({
      ...prev,
      expenses: [...(prev.expenses || []), e],
    }));
  };

  const updateExpense = (id: string, patch: Partial<ExpenseItem>) => {
    setFinance(prev => ({
      ...prev,
      expenses: (prev.expenses || []).map(e => e.id === id ? { ...e, ...patch } : e),
    }));
  };

  const removeExpense = (id: string) => {
    setFinance(prev => ({
      ...prev,
      expenses: (prev.expenses || []).filter(e => e.id !== id),
    }));
  };

  const updateField = (field: 'totalAgreed', value: string) => {
    const num = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
    setFinance(prev => ({ ...prev, [field]: num }));
  };

  // Пресеты для расходов
  const usedExpenseNames = new Set((finance.expenses || []).map(e => e.name));
  const availableExpensePresets = EXPENSE_PRESETS.filter(p => !usedExpenseNames.has(p));

  // Сортировка
  const sortedPayments = sortByDate(finance.payments || [], sortDir);
  const sortedTeamCosts = sortByDate(finance.teamCosts || [], sortDir);
  const sortedExpenses = sortByDate(finance.expenses || [], sortDir);

  return (
    <div className="finance-tab">
      {/* === Summary Cards === */}
      <div className="finance-summary">
        <div className="finance-summary-card card">
          <div className="card-body">
            <span className="finance-summary-emoji">💰</span>
            <span className={`finance-summary-value finance-value-positive`}>
              {formatMoney(effectiveReceived)} ₴
            </span>
            <span className="finance-summary-label">Получено</span>
          </div>
        </div>
        <div className="finance-summary-card card">
          <div className="card-body">
            <span className="finance-summary-emoji">📤</span>
            <span className={`finance-summary-value finance-value-negative`}>
              {formatMoney(allCosts)} ₴
            </span>
            <span className="finance-summary-label">Все расходы</span>
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
      {effectiveReceived > 0 && (
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
            <span>Команда: {formatMoney(totalTeamCosts)} ₴ / Прочие: {formatMoney(totalExpenses)} ₴</span>
            <span>Маржинальность: {Math.round(profitPercent)}%</span>
          </div>
        </div>
      )}

      {/* === Sort Control === */}
      <div className="finance-sort-bar">
        <span className="finance-sort-label">Сортировка по дате:</span>
        <button
          className={`finance-sort-btn ${sortDir === 'newest' ? 'finance-sort-btn-active' : ''}`}
          onClick={() => setSortDir('newest')}
        >
          ↓ Новые
        </button>
        <button
          className={`finance-sort-btn ${sortDir === 'oldest' ? 'finance-sort-btn-active' : ''}`}
          onClick={() => setSortDir('oldest')}
        >
          ↑ Старые
        </button>
      </div>

      {/* ==========================================
          СЕКЦИЯ 1: Оплаты от клиента
          ========================================== */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">💵 Оплата от клиента</h3>

          {/* Сумма по договору */}
          <div className="finance-agreed-row">
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
            {remaining > 0 && effectiveReceived > 0 && (
              <span className="finance-field-hint" style={{ color: 'var(--color-warning, #EAB308)' }}>
                Остаток: <b>{formatMoney(remaining)} ₴</b>
              </span>
            )}
            {remaining <= 0 && finance.totalAgreed > 0 && effectiveReceived > 0 && (
              <span className="finance-field-hint" style={{ color: 'var(--color-success)' }}>
                ✅ Оплачено полностью
              </span>
            )}
          </div>

          {/* Таблица оплат */}
          <div className="finance-subsection-divider" />
          <div className="finance-subsection-label">💸 Фактически полученные оплаты</div>
          <p className="finance-subsection-desc">Реальные поступления от клиента — предоплаты, доплаты, траншы.</p>
          <div className="finance-table-section">
            <div className="finance-table-header finance-payment-header">
              <span>Дата</span>
              <span>Сумма</span>
              <span>Заметка</span>
              <span></span>
            </div>
            {sortedPayments.map(p => (
              <div key={p.id} className="finance-table-row finance-payment-row">
                <input
                  type="date"
                  className="input finance-date-input"
                  value={p.date}
                  onChange={e => updatePayment(p.id, { date: e.target.value })}
                />
                <div className="finance-input-wrapper">
                  <span className="finance-currency">₴</span>
                  <input
                    type="text"
                    className="input"
                    placeholder="0"
                    value={p.amount || ''}
                    onChange={e => {
                      const num = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0;
                      updatePayment(p.id, { amount: num });
                    }}
                  />
                </div>
                <input
                  type="text"
                  className="input"
                  placeholder="Предоплата, доплата..."
                  value={p.note}
                  onChange={e => updatePayment(p.id, { note: e.target.value })}
                />
                <button className="finance-remove-btn" onClick={() => removePayment(p.id)} title="Удалить">✕</button>
              </div>
            ))}
            {(finance.payments || []).length === 0 && (
              <p className="finance-empty-hint">Нет оплат. Добавьте первую.</p>
            )}
          </div>

          <div className="finance-actions-row">
            <button className="btn btn-secondary btn-sm" onClick={addPayment}>
              + Добавить оплату
            </button>
            {(finance.payments || []).length > 0 && (
              <span className="finance-inline-total">
                Итого получено: <b className="finance-value-positive">{formatMoney(totalPayments)} ₴</b>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================
          СЕКЦИЯ 2: Расходы на внутреннюю команду
          ========================================== */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">👥 Расходы на внутреннюю команду</h3>
          <p className="ai-section-desc">
            Монтаж, продюсер, обложки и другие внутренние расходы.
          </p>

          <div className="finance-table-section">
            <div className="finance-table-header finance-team-header">
              <span>Статья</span>
              <span>Кол-во</span>
              <span>Ставка</span>
              <span>Итого</span>
              <span>Дата</span>
              <span></span>
            </div>
            {sortedTeamCosts.map(t => {
              const lineTotal = (t.quantity || 0) * (t.unitPrice || 0);
              return (
                <div key={t.id} className="finance-table-row finance-team-row">
                  <span className="finance-team-label">{t.label}</span>
                  <input
                    type="number"
                    className="input finance-num-input"
                    min="0"
                    value={t.quantity || ''}
                    onChange={e => updateTeamCost(t.id, { quantity: parseInt(e.target.value) || 0 })}
                  />
                  <div className="finance-input-wrapper">
                    <span className="finance-currency">₴</span>
                    <input
                      type="text"
                      className="input"
                      placeholder="0"
                      value={t.unitPrice || ''}
                      onChange={e => {
                        const num = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0;
                        updateTeamCost(t.id, { unitPrice: num });
                      }}
                    />
                  </div>
                  <span className="finance-team-total">{formatMoney(lineTotal)} ₴</span>
                  <input
                    type="date"
                    className="input finance-date-input"
                    value={t.date}
                    onChange={e => updateTeamCost(t.id, { date: e.target.value })}
                  />
                  <button className="finance-remove-btn" onClick={() => removeTeamCost(t.id)} title="Удалить">✕</button>
                </div>
              );
            })}
            {(finance.teamCosts || []).length === 0 && (
              <p className="finance-empty-hint">Добавьте расходы на команду из шаблонов ниже.</p>
            )}
          </div>

          {/* Team Presets */}
          <div className="finance-presets">
            {TEAM_COST_PRESETS.map(preset => (
              <button
                key={preset.type}
                className="finance-preset-btn"
                onClick={() => addTeamCost(preset)}
              >
                + {preset.label}{preset.defaultPrice > 0 ? ` (${formatMoney(preset.defaultPrice)} ₴)` : ''}
              </button>
            ))}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => addTeamCost()}
            style={{ marginTop: 'var(--space-3)' }}
          >
            + Другой расход на команду
          </button>

          {(finance.teamCosts || []).length > 0 && (
            <div className="finance-expense-total">
              <span>Итого на команду:</span>
              <span className="finance-expense-total-value">{formatMoney(totalTeamCosts)} ₴</span>
            </div>
          )}
        </div>
      </div>

      {/* ==========================================
          СЕКЦИЯ 3: Прочие расходы
          ========================================== */}
      <div className="card">
        <div className="card-body">
          <h3 className="ai-section-title">📊 Прочие расходы</h3>
          <p className="ai-section-desc">
            Реклама, анализ, непредвиденные расходы и другое.
          </p>

          <div className="finance-table-section">
            <div className="finance-table-header finance-expense-header">
              <span>Название</span>
              <span>Сумма</span>
              <span>Дата</span>
              <span></span>
            </div>
            {sortedExpenses.map(expense => (
              <div key={expense.id} className="finance-table-row finance-expense-row-v2">
                <input
                  type="text"
                  className="input"
                  placeholder="Название расхода"
                  value={expense.name}
                  onChange={e => updateExpense(expense.id, { name: e.target.value })}
                />
                <div className="finance-input-wrapper">
                  <span className="finance-currency">₴</span>
                  <input
                    type="text"
                    className="input"
                    placeholder="0"
                    value={expense.amount || ''}
                    onChange={e => {
                      const num = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0;
                      updateExpense(expense.id, { amount: num });
                    }}
                  />
                </div>
                <input
                  type="date"
                  className="input finance-date-input"
                  value={expense.date || ''}
                  onChange={e => updateExpense(expense.id, { date: e.target.value })}
                />
                <button className="finance-remove-btn" onClick={() => removeExpense(expense.id)} title="Удалить">✕</button>
              </div>
            ))}
            {(finance.expenses || []).length === 0 && (
              <p className="finance-empty-hint">Нет расходов. Добавьте из шаблонов или создайте свой.</p>
            )}
          </div>

          {/* Expense Presets */}
          {availableExpensePresets.length > 0 && (
            <div className="finance-presets">
              {availableExpensePresets.map(preset => (
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

          {(finance.expenses || []).length > 0 && (
            <div className="finance-expense-total">
              <span>Итого прочих:</span>
              <span className="finance-expense-total-value">{formatMoney(totalExpenses)} ₴</span>
            </div>
          )}
        </div>
      </div>

      {/* === Общая сводка === */}
      {(allCosts > 0 || effectiveReceived > 0) && (
        <div className="card finance-grand-summary">
          <div className="card-body">
            <h3 className="ai-section-title">📋 Итоговая сводка</h3>
            <div className="finance-summary-table">
              <div className="finance-summary-row">
                <span>💰 Получено от клиента</span>
                <span className="finance-value-positive">{formatMoney(effectiveReceived)} ₴</span>
              </div>
              <div className="finance-summary-row">
                <span>👥 Расходы на команду</span>
                <span className="finance-value-negative">−{formatMoney(totalTeamCosts)} ₴</span>
              </div>
              <div className="finance-summary-row">
                <span>📊 Прочие расходы</span>
                <span className="finance-value-negative">−{formatMoney(totalExpenses)} ₴</span>
              </div>
              <div className="finance-summary-row finance-summary-row-total">
                <span>{profit >= 0 ? '📈' : '📉'} Чистая прибыль</span>
                <span className={profit >= 0 ? 'finance-value-positive' : 'finance-value-negative'}>
                  {profit >= 0 ? '+' : ''}{formatMoney(profit)} ₴
                </span>
              </div>
            </div>
            <button
              className="analytics-export-btn"
              style={{ marginTop: 'var(--space-4)' }}
              onClick={() => {
                const clientData = (clients || []).find(c => c.id === clientId);
                const name = clientData?.name || 'Клиент';
                exportClientFinanceCSV(name, finance.payments, finance.teamCosts, finance.expenses);
              }}
            >
              📥 Экспорт финансов CSV
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
