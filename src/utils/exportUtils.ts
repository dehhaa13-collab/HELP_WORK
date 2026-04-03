/* ============================================
   Export Utilities
   Генерация PDF (через HTML) и CSV из данных проекта
   ============================================ */

interface ScriptItem {
  id: number;
  topicTitle: string;
  hook?: string;
  visuals?: string;
  body?: string;
  cta?: string;
  music?: string;
  duration?: string;
}

interface Slot {
  id: number;
  format: 'reels' | 'post' | 'carousel' | null;
}

interface TargetItem {
  id: number;
  name: string;
}

const FORMAT_LABELS: Record<string, string> = {
  reels: '🎬 Reels',
  post: '🖼️ Пост',
  carousel: '📑 Карусель',
};

/**
 * Экспорт сценариев в красивый PDF (через print-окно)
 */
export function exportScriptsToPDF(
  scripts: ScriptItem[],
  clientNiche: string,
  clientName?: string
) {
  if (scripts.length === 0) return;

  const date = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const scriptsHtml = scripts.map((s, i) => `
    <div class="script-block">
      <div class="script-num">${i + 1}</div>
      <h2>${s.topicTitle}</h2>
      ${s.hook ? `<div class="field"><span class="label">🎣 Хук:</span><p>${escapeHtml(s.hook)}</p></div>` : ''}
      ${s.visuals ? `<div class="field"><span class="label">🎬 Видеоряд:</span><p>${escapeHtml(s.visuals)}</p></div>` : ''}
      ${s.body ? `<div class="field"><span class="label">🗣 Сценарий:</span><p>${escapeHtml(s.body)}</p></div>` : ''}
      ${s.cta ? `<div class="field"><span class="label">🎯 CTA:</span><p>${escapeHtml(s.cta)}</p></div>` : ''}
      <div class="meta">
        <span>🎵 ${s.music || 'Тренд'}</span>
        <span>⏱ ${s.duration || '~15 сек'}</span>
      </div>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Сценарии — ${clientName || clientNiche}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .header h1 { font-size: 24px; color: #1a1a2e; margin-bottom: 4px; }
    .header .sub { font-size: 14px; color: #64748b; }
    .header .niche { font-size: 13px; color: #94a3b8; margin-top: 4px; }
    .script-block { margin-bottom: 30px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; position: relative; page-break-inside: avoid; }
    .script-num { position: absolute; top: -12px; left: 20px; background: #4f46e5; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
    .script-block h2 { font-size: 16px; color: #4f46e5; margin-bottom: 16px; padding-left: 4px; }
    .field { margin-bottom: 12px; }
    .label { font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .field p { margin-top: 4px; font-size: 14px; }
    .meta { display: flex; gap: 20px; margin-top: 16px; padding-top: 12px; border-top: 1px dashed #e2e8f0; font-size: 13px; color: #94a3b8; }
    @media print {
      body { padding: 20px; }
      .script-block { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📝 Сценарии для ${escapeHtml(clientName || 'клиента')}</h1>
    <div class="sub">${date} • ${scripts.length} сценариев</div>
    ${clientNiche ? `<div class="niche">Ниша: ${escapeHtml(clientNiche)}</div>` : ''}
  </div>
  ${scriptsHtml}
</body>
</html>`;

  openPrintWindow(html);
}

/**
 * Экспорт контент-плана в CSV (темы + форматы + названия)
 */
export function exportContentPlanCSV(
  slots: Slot[],
  targetItems: TargetItem[],
  topics: { id: number; title: string; selected: boolean }[],
  clientName?: string
) {
  const selectedTopics = topics.filter(t => t.selected);
  
  const rows: string[][] = [
    ['#', 'Формат', 'Название публикации', 'Тема сценария', 'Статус']
  ];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const target = targetItems.find(t => t.id === slot.id);
    const topic = selectedTopics[i]; // Map topics to slots sequentially
    
    rows.push([
      String(slot.id),
      slot.format ? FORMAT_LABELS[slot.format] || slot.format : '—',
      target?.name || `Публикация #${slot.id}`,
      topic?.title || '—',
      '⏳ Ожидает'
    ]);
  }

  const csvContent = rows.map(row => 
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `content-plan${clientName ? '-' + clientName : ''}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Экспорт контент-плана в красивый PDF
 */
export function exportContentPlanPDF(
  slots: Slot[],
  targetItems: TargetItem[],
  topics: { id: number; title: string; selected: boolean }[],
  clientName?: string
) {
  const selectedTopics = topics.filter(t => t.selected);
  const date = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  const tableRows = slots.map((slot, i) => {
    const target = targetItems.find(t => t.id === slot.id);
    const topic = selectedTopics[i];
    const formatLabel = slot.format ? FORMAT_LABELS[slot.format] || slot.format : '—';
    
    return `<tr>
      <td class="num">${slot.id}</td>
      <td>${formatLabel}</td>
      <td>${escapeHtml(target?.name || `Публикация #${slot.id}`)}</td>
      <td>${escapeHtml(topic?.title || '—')}</td>
    </tr>`;
  }).join('');

  const stats = {
    reels: slots.filter(s => s.format === 'reels').length,
    post: slots.filter(s => s.format === 'post').length,
    carousel: slots.filter(s => s.format === 'carousel').length,
  };

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Контент-план — ${clientName || 'Клиент'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header .sub { font-size: 13px; color: #64748b; }
    .stats { display: flex; justify-content: center; gap: 24px; margin-bottom: 30px; }
    .stat { text-align: center; padding: 12px 20px; border: 1px solid #e2e8f0; border-radius: 10px; }
    .stat-val { font-size: 24px; font-weight: 700; }
    .stat-lbl { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding: 10px 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .num { font-weight: 700; color: #94a3b8; width: 40px; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 Контент-план</h1>
    <div class="sub">${escapeHtml(clientName || 'Клиент')} • ${date} • ${slots.length} публикаций</div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-val">${stats.reels}</div><div class="stat-lbl">🎬 Reels</div></div>
    <div class="stat"><div class="stat-val">${stats.post}</div><div class="stat-lbl">🖼️ Посты</div></div>
    <div class="stat"><div class="stat-val">${stats.carousel}</div><div class="stat-lbl">📑 Карусели</div></div>
    <div class="stat"><div class="stat-val">${slots.length}</div><div class="stat-lbl">Всего</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Формат</th><th>Название</th><th>Тема сценария</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

  openPrintWindow(html);
}

// --- Helpers ---

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

function openPrintWindow(html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  // Small delay for styles to load before triggering print
  setTimeout(() => win.print(), 400);
}
