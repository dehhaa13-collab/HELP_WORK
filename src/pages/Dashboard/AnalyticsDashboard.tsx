/* ============================================
   Analytics Dashboard v2 — Аналитика по всем клиентам
   Финансы, воронка, статусы, фильтр по периоду
   ============================================ */

import { useState, useMemo } from 'react';
import type { Client } from '../../types';
import { PIPELINE_STAGES } from '../../types';
import { computeClientStage } from '../../utils/computeStage';
import { exportFinanceSummaryCSV } from '../../utils/exportUtils';
import './Analytics.css';

interface Props {
  clients: Client[];
}

interface FinanceData {
  received: number;
  totalAgreed: number;
  expenses: { id: string; name: string; amount: number; date?: string }[];
  payments?: { id: string; amount: number; date: string; note: string }[];
  teamCosts?: { id: string; type: string; label: string; quantity: number; unitPrice: number; date: string; note: string }[];
}

const fmt = (n: number) => n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const FUNNEL_COLORS = [
  '#6366F1', '#818CF8', '#7C3AED', '#A78BFA',
  '#8B5CF6', '#C084FC', '#E879F9', '#F472B6',
  '#FB923C', '#FACC15', '#4ADE80',
];

// === Period presets ===
type PeriodKey = 'all' | 'month' | 'quarter' | 'year' | 'custom';

interface PeriodRange {
  from: string; // YYYY-MM-DD
  to: string;
}

function getPeriodRange(key: PeriodKey, customFrom?: string, customTo?: string): PeriodRange | null {
  if (key === 'all') return null;
  if (key === 'custom') {
    return { from: customFrom || '', to: customTo || '' };
  }
  const now = new Date();
  const to = now.toISOString().split('T')[0];
  let from: Date;
  if (key === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (key === 'quarter') {
    from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  } else {
    // year
    from = new Date(now.getFullYear(), 0, 1);
  }
  return { from: from.toISOString().split('T')[0], to };
}

function isInPeriod(dateStr: string | undefined, range: PeriodRange | null): boolean {
  if (!range) return true; // "all" — no filter
  if (!dateStr) return true; // no date on item — include by default
  if (range.from && dateStr < range.from) return false;
  if (range.to && dateStr > range.to) return false;
  return true;
}

// Period label
function getPeriodLabel(key: PeriodKey, range: PeriodRange | null): string {
  if (key === 'all' || !range) return 'За всё время';
  const fmtDate = (d: string) => {
    try {
      return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };
  if (key === 'month') return 'Текущий месяц';
  if (key === 'quarter') return 'Квартал (3 мес.)';
  if (key === 'year') return 'Текущий год';
  return `${fmtDate(range.from)} — ${fmtDate(range.to)}`;
}

export function AnalyticsDashboard({ clients }: Props) {
  // === Period filter state ===
  const [periodKey, setPeriodKey] = useState<PeriodKey>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const periodRange = useMemo(
    () => getPeriodRange(periodKey, customFrom, customTo),
    [periodKey, customFrom, customTo]
  );

  // === Aggregate all data ===
  const analytics = useMemo(() => {
    let totalReceived = 0;
    let totalAgreed = 0;
    let totalExpenses = 0;
    let totalTeamCosts = 0;
    const stageCounts: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};
    const clientFinances: {
      name: string;
      instagram: string;
      received: number;
      agreed: number;
      expenses: number;
      teamCosts: number;
      profit: number;
      remaining: number;
      isArchived: boolean;
    }[] = [];

    // Active / archived counts
    let activeCount = 0;
    let archivedCount = 0;

    // Initialize stage counts
    PIPELINE_STAGES.forEach(s => { stageCounts[s.key] = 0; });

    // Count stages
    clients.forEach(client => {
      const isArchived = !!client.workspaceData?.[`hw_archived_${client.id}`];
      if (isArchived) { archivedCount++; } else { activeCount++; }

      const stage = computeClientStage(client.id, client.workspaceData);
      if (!isArchived) {
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      }

      // Read finance data from workspaceData
      const finKey = `hw_finance_${client.id}`;
      const finData: FinanceData = client.workspaceData?.[finKey] || { received: 0, totalAgreed: 0, expenses: [] };

      // Filter payments by period
      const filteredPayments = (finData.payments || []).filter(p => isInPeriod(p.date, periodRange));
      const paymentsSum = filteredPayments.reduce((s, p) => s + (p.amount || 0), 0);

      // If there are payments, use filtered sum. If old-style received with no payments, use received only when period is "all"
      const hasPayments = (finData.payments || []).length > 0;
      const clientReceived = hasPayments ? paymentsSum : (periodRange === null ? (finData.received || 0) : 0);

      // Filter expenses by period
      const filteredExpenses = (finData.expenses || []).filter(e => isInPeriod(e.date, periodRange));
      const clientExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);

      // Filter team costs by period
      const filteredTeamCosts = (finData.teamCosts || []).filter(t => isInPeriod(t.date, periodRange));
      const clientTeamCosts = filteredTeamCosts.reduce((s, t) => s + ((t.quantity || 0) * (t.unitPrice || 0)), 0);

      totalReceived += clientReceived;
      totalAgreed += finData.totalAgreed || 0;
      totalExpenses += clientExpenses;
      totalTeamCosts += clientTeamCosts;

      // Category breakdown — include both expenses and teamCosts (filtered)
      filteredExpenses.forEach(e => {
        if (e.name && e.amount) {
          expensesByCategory[e.name] = (expensesByCategory[e.name] || 0) + e.amount;
        }
      });
      filteredTeamCosts.forEach(t => {
        const total = (t.quantity || 0) * (t.unitPrice || 0);
        if (t.label && total > 0) {
          expensesByCategory[t.label] = (expensesByCategory[t.label] || 0) + total;
        }
      });

      clientFinances.push({
        name: client.name,
        instagram: client.instagram,
        received: clientReceived,
        agreed: finData.totalAgreed || 0,
        expenses: clientExpenses,
        teamCosts: clientTeamCosts,
        profit: clientReceived - clientExpenses - clientTeamCosts,
        remaining: (finData.totalAgreed || 0) - clientReceived,
        isArchived,
      });
    });

    const allExpenses = totalExpenses + totalTeamCosts;
    const totalProfit = totalReceived - allExpenses;
    const totalRemaining = totalAgreed - totalReceived;

    // New clients this month
    const now = new Date();
    const thisMonth = clients.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    // Clients created in period
    const clientsInPeriod = periodRange
      ? clients.filter(c => {
          const d = new Date(c.createdAt).toISOString().split('T')[0];
          return isInPeriod(d, periodRange);
        })
      : clients;

    // Average client value
    const clientsWithRevenue = clientFinances.filter(c => c.received > 0);
    const avgClientValue = clientsWithRevenue.length > 0
      ? clientsWithRevenue.reduce((s, c) => s + c.received, 0) / clientsWithRevenue.length
      : 0;

    // Expense breakdown sorted desc
    const expenseBreakdown = Object.entries(expensesByCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Top profitable clients
    const topProfitable = [...clientFinances]
      .filter(c => c.received > 0 || c.expenses > 0 || c.teamCosts > 0)
      .sort((a, b) => b.profit - a.profit);

    return {
      totalReceived,
      totalAgreed,
      totalExpenses: allExpenses,
      totalTeamCosts,
      totalProfit,
      totalRemaining,
      stageCounts,
      clientFinances,
      expenseBreakdown,
      newClientsCount: thisMonth.length,
      activeCount,
      archivedCount,
      clientsInPeriodCount: clientsInPeriod.length,
      avgClientValue,
      topProfitable,
    };
  }, [clients, periodRange]);

  const maxStageCount = Math.max(1, ...Object.values(analytics.stageCounts));

  // Days since start
  const getDaysAgo = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Сегодня';
    if (diff === 1) return '1 день';
    if (diff < 5) return `${diff} дня`;
    return `${diff} дней`;
  };

  return (
    <div className="analytics-page">
      <div className="analytics-header-row">
        <div>
          <h2 className="analytics-page-title">📊 Аналитика</h2>
          <p className="analytics-page-subtitle">
            {getPeriodLabel(periodKey, periodRange)} • {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* === Period Selector === */}
      <div className="analytics-period-bar">
        <span className="analytics-period-label">Период:</span>
        <div className="analytics-period-pills">
          {([
            { key: 'all', label: 'Всё время' },
            { key: 'month', label: 'Месяц' },
            { key: 'quarter', label: 'Квартал' },
            { key: 'year', label: 'Год' },
            { key: 'custom', label: 'Свой' },
          ] as { key: PeriodKey; label: string }[]).map(p => (
            <button
              key={p.key}
              className={`analytics-period-pill ${periodKey === p.key ? 'analytics-period-pill-active' : ''}`}
              onClick={() => setPeriodKey(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodKey === 'custom' && (
          <div className="analytics-period-custom">
            <input
              type="date"
              className="input analytics-period-date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              placeholder="С"
            />
            <span className="analytics-period-dash">—</span>
            <input
              type="date"
              className="input analytics-period-date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              placeholder="По"
            />
          </div>
        )}
      </div>

      {/* === KPI Cards (6 cards — 2 rows of 3) === */}
      <div className="analytics-kpi-row">
        <div className="analytics-kpi card">
          <div className="card-body">
            <span className="analytics-kpi-emoji">👥</span>
            <span className="analytics-kpi-value">{analytics.activeCount}</span>
            <span className="analytics-kpi-label">Активных клиентов</span>
            {analytics.archivedCount > 0 && (
              <span className="analytics-kpi-sub">🗃️ {analytics.archivedCount} завершённых</span>
            )}
            {analytics.newClientsCount > 0 && (
              <span className="analytics-kpi-sub" style={{ color: 'var(--color-success)' }}>
                +{analytics.newClientsCount} в этом месяце
              </span>
            )}
          </div>
        </div>
        <div className="analytics-kpi card">
          <div className="card-body">
            <span className="analytics-kpi-emoji">💰</span>
            <span className="analytics-kpi-value" style={{ color: 'var(--color-success)' }}>
              {fmt(analytics.totalReceived)} ₴
            </span>
            <span className="analytics-kpi-label">Получено</span>
            {analytics.totalRemaining > 0 && (
              <span className="analytics-kpi-sub">
                Ожидаем ещё {fmt(analytics.totalRemaining)} ₴
              </span>
            )}
          </div>
        </div>
        <div className="analytics-kpi card">
          <div className="card-body">
            <span className="analytics-kpi-emoji">📤</span>
            <span className="analytics-kpi-value" style={{ color: 'var(--color-danger)' }}>
              {fmt(analytics.totalExpenses)} ₴
            </span>
            <span className="analytics-kpi-label">Все расходы</span>
            <span className="analytics-kpi-sub">
              👥 {fmt(analytics.totalTeamCosts)} команда / 📊 {fmt(analytics.totalExpenses - analytics.totalTeamCosts)} прочие
            </span>
          </div>
        </div>
        <div className="analytics-kpi card">
          <div className="card-body">
            <span className="analytics-kpi-emoji">{analytics.totalProfit >= 0 ? '📈' : '📉'}</span>
            <span className="analytics-kpi-value" style={{ color: analytics.totalProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {analytics.totalProfit >= 0 ? '+' : ''}{fmt(analytics.totalProfit)} ₴
            </span>
            <span className="analytics-kpi-label">Чистая прибыль</span>
            {analytics.totalReceived > 0 && (
              <span className="analytics-kpi-sub">
                Маржа: {Math.round((analytics.totalProfit / analytics.totalReceived) * 100)}%
              </span>
            )}
          </div>
        </div>
        <div className="analytics-kpi card">
          <div className="card-body">
            <span className="analytics-kpi-emoji">💎</span>
            <span className="analytics-kpi-value" style={{ color: 'var(--color-primary)' }}>
              {fmt(Math.round(analytics.avgClientValue))} ₴
            </span>
            <span className="analytics-kpi-label">Средний чек</span>
            <span className="analytics-kpi-sub">
              {analytics.topProfitable.filter(c => c.received > 0).length} клиентов с оплатой
            </span>
          </div>
        </div>
        <div className="analytics-kpi card">
          <div className="card-body">
            <span className="analytics-kpi-emoji">📋</span>
            <span className="analytics-kpi-value" style={{ color: 'var(--color-primary)' }}>
              {fmt(analytics.totalAgreed)} ₴
            </span>
            <span className="analytics-kpi-label">По договорам</span>
            {analytics.totalAgreed > 0 && analytics.totalReceived > 0 && (
              <span className="analytics-kpi-sub">
                Оплачено {Math.round((analytics.totalReceived / analytics.totalAgreed) * 100)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* === Two Column: Funnel + Expenses === */}
      <div className="analytics-two-col">
        {/* Funnel */}
        <div className="analytics-section">
          <h3 className="analytics-section-title">📊 Воронка по этапам</h3>
          <div className="card">
            <div className="card-body">
              <div className="analytics-funnel">
                {PIPELINE_STAGES.map((stage, i) => {
                  const count = analytics.stageCounts[stage.key] || 0;
                  const pct = (count / maxStageCount) * 100;
                  return (
                    <div key={stage.key} className="analytics-funnel-row">
                      <span className="analytics-funnel-label">
                        {stage.emoji} {stage.label}
                      </span>
                      <div className="analytics-funnel-bar-track">
                        <div
                          className="analytics-funnel-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="analytics-funnel-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="analytics-section">
          <h3 className="analytics-section-title">💸 Расходы по категориям</h3>
          <div className="card">
            <div className="card-body">
              {analytics.expenseBreakdown.length > 0 ? (
                <div className="analytics-expense-list">
                  {analytics.expenseBreakdown.map((item) => {
                    const pct = analytics.totalExpenses > 0 ? (item.amount / analytics.totalExpenses) * 100 : 0;
                    return (
                      <div key={item.name} className="analytics-expense-item">
                        <div className="analytics-expense-info">
                          <span className="analytics-expense-name">{item.name}</span>
                          <span className="analytics-expense-pct">{Math.round(pct)}%</span>
                        </div>
                        <div className="analytics-expense-bar-track">
                          <div className="analytics-expense-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="analytics-expense-value">{fmt(item.amount)} ₴</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', padding: 'var(--space-6) 0' }}>
                  Нет данных по расходам. Заполните расходы во вкладке «Финансы» каждого клиента.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* === Top Clients === */}
      {analytics.topProfitable.length > 0 && (
        <div className="analytics-section">
          <h3 className="analytics-section-title">🏆 Топ клиентов по прибыли</h3>
          <div className="analytics-top-clients">
            {analytics.topProfitable.slice(0, 5).map((cf, i) => (
              <div key={cf.instagram} className="analytics-top-client card">
                <div className="card-body">
                  <span className="analytics-top-rank">{i + 1}</span>
                  <div className="analytics-top-info">
                    <span className="analytics-top-name">{cf.name}</span>
                    <span className="analytics-top-instagram">{cf.instagram}</span>
                  </div>
                  <div className="analytics-top-numbers">
                    <span className={cf.profit >= 0 ? 'finance-value-positive' : 'finance-value-negative'}>
                      {cf.profit >= 0 ? '+' : ''}{fmt(cf.profit)} ₴
                    </span>
                    <span className="analytics-top-received">
                      из {fmt(cf.received)} ₴
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === Finance Table === */}
      <div className="analytics-section">
        <div className="analytics-section-header">
          <h3 className="analytics-section-title">💵 Финансы по клиентам</h3>
          <button
            className="analytics-export-btn"
            onClick={() => exportFinanceSummaryCSV(analytics.clientFinances)}
            title="Скачать CSV"
          >
            📥 Экспорт CSV
          </button>
        </div>
        <div className="card">
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table className="analytics-finance-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>По договору</th>
                  <th>Получено</th>
                  <th>Остаток</th>
                  <th>Команда</th>
                  <th>Расходы</th>
                  <th>Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {analytics.clientFinances
                  .filter(cf => cf.received > 0 || cf.expenses > 0 || cf.teamCosts > 0 || cf.agreed > 0)
                  .map((cf) => (
                  <tr key={cf.instagram} className={cf.isArchived ? 'analytics-row-archived' : ''}>
                    <td>
                      <span className="finance-client-name">{cf.name}</span>
                      {cf.isArchived && <span className="analytics-archived-badge">🗃️</span>}
                      <br />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{cf.instagram}</span>
                    </td>
                    <td>{cf.agreed > 0 ? `${fmt(cf.agreed)} ₴` : '—'}</td>
                    <td className={cf.received > 0 ? 'finance-positive' : ''}>{cf.received > 0 ? `${fmt(cf.received)} ₴` : '—'}</td>
                    <td className={cf.remaining > 0 ? 'finance-warning' : cf.remaining === 0 && cf.agreed > 0 ? 'finance-positive' : ''}>
                      {cf.agreed > 0 ? (cf.remaining > 0 ? `${fmt(cf.remaining)} ₴` : '✅') : '—'}
                    </td>
                    <td className={cf.teamCosts > 0 ? 'finance-negative' : ''}>{cf.teamCosts > 0 ? `${fmt(cf.teamCosts)} ₴` : '—'}</td>
                    <td className={cf.expenses > 0 ? 'finance-negative' : ''}>{cf.expenses > 0 ? `${fmt(cf.expenses)} ₴` : '—'}</td>
                    <td className={cf.profit >= 0 ? 'finance-positive' : 'finance-negative'}>
                      {cf.received > 0 || cf.expenses > 0 || cf.teamCosts > 0 ? `${cf.profit >= 0 ? '+' : ''}${fmt(cf.profit)} ₴` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {analytics.clientFinances.some(c => c.received > 0 || c.expenses > 0 || c.teamCosts > 0) && (
                <tfoot>
                  <tr>
                    <td><b>Итого</b></td>
                    <td>{fmt(analytics.totalAgreed)} ₴</td>
                    <td className="finance-positive">{fmt(analytics.totalReceived)} ₴</td>
                    <td className={analytics.totalRemaining > 0 ? 'finance-warning' : 'finance-positive'}>
                      {analytics.totalRemaining > 0 ? `${fmt(analytics.totalRemaining)} ₴` : '✅'}
                    </td>
                    <td className="finance-negative">{fmt(analytics.totalTeamCosts)} ₴</td>
                    <td className="finance-negative">{fmt(analytics.totalExpenses - analytics.totalTeamCosts)} ₴</td>
                    <td className={analytics.totalProfit >= 0 ? 'finance-positive' : 'finance-negative'}>
                      {analytics.totalProfit >= 0 ? '+' : ''}{fmt(analytics.totalProfit)} ₴
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* === Client Timeline === */}
      <div className="analytics-section">
        <h3 className="analytics-section-title">🗓️ Клиенты — когда начали работу</h3>
        <div className="card">
          <div className="card-body">
            <div className="analytics-timeline">
              {clients
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map(client => {
                  const isArchived = !!client.workspaceData?.[`hw_archived_${client.id}`];
                  const stage = computeClientStage(client.id, client.workspaceData);
                  const stageInfo = PIPELINE_STAGES.find(s => s.key === stage);
                  return (
                    <div key={client.id} className={`analytics-timeline-row ${isArchived ? 'analytics-row-archived' : ''}`}>
                      <span className="analytics-timeline-name">
                        {client.name} {isArchived && <span className="analytics-archived-badge">🗃️</span>}
                      </span>
                      <span className="analytics-timeline-date">
                        {new Date(client.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="analytics-timeline-stage">
                        <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                          {stageInfo?.emoji} {stageInfo?.label}
                        </span>
                      </span>
                      <span className="analytics-timeline-duration">
                        {getDaysAgo(client.createdAt)} назад
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
