/* ============================================
   Analytics Dashboard — Аналитика по всем клиентам
   Финансы, воронка, статусы, активность
   ============================================ */

import { useMemo } from 'react';
import type { Client } from '../../types';
import { PIPELINE_STAGES } from '../../types';
import { computeClientStage } from '../../utils/computeStage';
import './Analytics.css';

interface Props {
  clients: Client[];
}

interface FinanceData {
  received: number;
  totalAgreed: number;
  expenses: { id: string; name: string; amount: number }[];
}

const fmt = (n: number) => n.toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const FUNNEL_COLORS = [
  '#6366F1', '#818CF8', '#7C3AED', '#A78BFA',
  '#8B5CF6', '#C084FC', '#E879F9', '#F472B6',
  '#FB923C', '#FACC15', '#4ADE80',
];

export function AnalyticsDashboard({ clients }: Props) {
  // === Aggregate all data ===
  const analytics = useMemo(() => {
    let totalReceived = 0;
    let totalAgreed = 0;
    let totalExpenses = 0;
    const stageCounts: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};
    const clientFinances: {
      name: string;
      instagram: string;
      received: number;
      agreed: number;
      expenses: number;
      profit: number;
      remaining: number;
    }[] = [];

    // Initialize stage counts
    PIPELINE_STAGES.forEach(s => { stageCounts[s.key] = 0; });

    // Count stages
    clients.forEach(client => {
      const stage = computeClientStage(client.id, client.workspaceData);
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;

      // Read finance data from workspaceData
      const finKey = `hw_finance_${client.id}`;
      const finData: FinanceData = client.workspaceData?.[finKey] || { received: 0, totalAgreed: 0, expenses: [] };
      
      const clientExpenses = (finData.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
      
      totalReceived += finData.received || 0;
      totalAgreed += finData.totalAgreed || 0;
      totalExpenses += clientExpenses;

      // Category breakdown
      (finData.expenses || []).forEach(e => {
        if (e.name && e.amount) {
          expensesByCategory[e.name] = (expensesByCategory[e.name] || 0) + e.amount;
        }
      });

      clientFinances.push({
        name: client.name,
        instagram: client.instagram,
        received: finData.received || 0,
        agreed: finData.totalAgreed || 0,
        expenses: clientExpenses,
        profit: (finData.received || 0) - clientExpenses,
        remaining: (finData.totalAgreed || 0) - (finData.received || 0),
      });
    });

    const totalProfit = totalReceived - totalExpenses;
    const totalRemaining = totalAgreed - totalReceived;

    // New clients this month
    const now = new Date();
    const thisMonth = clients.filter(c => {
      const d = new Date(c.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    // Expense breakdown sorted desc
    const expenseBreakdown = Object.entries(expensesByCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      totalReceived,
      totalAgreed,
      totalExpenses,
      totalProfit,
      totalRemaining,
      stageCounts,
      clientFinances,
      expenseBreakdown,
      newClientsCount: thisMonth.length,
    };
  }, [clients]);

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
      <div>
        <h2 className="analytics-page-title">📊 Аналитика</h2>
        <p className="analytics-page-subtitle">
          Сводка по всем клиентам • {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* === KPI Cards === */}
      <div className="analytics-kpi-row">
        <div className="analytics-kpi card">
          <div className="card-body">
            <span className="analytics-kpi-emoji">👥</span>
            <span className="analytics-kpi-value">{clients.length}</span>
            <span className="analytics-kpi-label">Всего клиентов</span>
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
            <span className="analytics-kpi-label">Расходы</span>
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
      </div>

      {/* === Two Column: Funnel + Finance === */}
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
                  {analytics.expenseBreakdown.map((item) => (
                    <div key={item.name} className="analytics-expense-item">
                      <span className="analytics-expense-name">{item.name}</span>
                      <span className="analytics-expense-value">{fmt(item.amount)} ₴</span>
                    </div>
                  ))}
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

      {/* === Finance Table === */}
      <div className="analytics-section">
        <h3 className="analytics-section-title">💵 Финансы по клиентам</h3>
        <div className="card">
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <table className="analytics-finance-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>По договору</th>
                  <th>Получено</th>
                  <th>Остаток</th>
                  <th>Расходы</th>
                  <th>Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {analytics.clientFinances.map((cf) => (
                  <tr key={cf.instagram}>
                    <td>
                      <span className="finance-client-name">{cf.name}</span>
                      <br />
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{cf.instagram}</span>
                    </td>
                    <td>{cf.agreed > 0 ? `${fmt(cf.agreed)} ₴` : '—'}</td>
                    <td className={cf.received > 0 ? 'finance-positive' : ''}>{cf.received > 0 ? `${fmt(cf.received)} ₴` : '—'}</td>
                    <td className={cf.remaining > 0 ? 'finance-warning' : cf.remaining === 0 && cf.agreed > 0 ? 'finance-positive' : ''}>
                      {cf.agreed > 0 ? (cf.remaining > 0 ? `${fmt(cf.remaining)} ₴` : '✅') : '—'}
                    </td>
                    <td className={cf.expenses > 0 ? 'finance-negative' : ''}>{cf.expenses > 0 ? `${fmt(cf.expenses)} ₴` : '—'}</td>
                    <td className={cf.profit >= 0 ? 'finance-positive' : 'finance-negative'}>
                      {cf.received > 0 || cf.expenses > 0 ? `${cf.profit >= 0 ? '+' : ''}${fmt(cf.profit)} ₴` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              {analytics.clientFinances.some(c => c.received > 0 || c.expenses > 0) && (
                <tfoot>
                  <tr>
                    <td><b>Итого</b></td>
                    <td>{fmt(analytics.totalAgreed)} ₴</td>
                    <td className="finance-positive">{fmt(analytics.totalReceived)} ₴</td>
                    <td className={analytics.totalRemaining > 0 ? 'finance-warning' : 'finance-positive'}>
                      {analytics.totalRemaining > 0 ? `${fmt(analytics.totalRemaining)} ₴` : '✅'}
                    </td>
                    <td className="finance-negative">{fmt(analytics.totalExpenses)} ₴</td>
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
                  const stage = computeClientStage(client.id, client.workspaceData);
                  const stageInfo = PIPELINE_STAGES.find(s => s.key === stage);
                  return (
                    <div key={client.id} className="analytics-timeline-row">
                      <span className="analytics-timeline-name">{client.name}</span>
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
