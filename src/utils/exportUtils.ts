/* ============================================
   Export Utilities
   - Word (.docx) для сценариев
   - CSV для контент-плана
   ============================================ */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';
import { saveAs } from 'file-saver';

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
  reels: 'Reels',
  post: 'Пост',
  carousel: 'Карусель',
};

export async function exportScriptsToWord(scripts: ScriptItem[]) {
  if (scripts.length === 0) return;

  const children: Paragraph[] = [];

  // ==========================
  // COVER PAGE
  // ==========================
  children.push(
    new Paragraph({
      spacing: { before: 3000, after: 400 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'СЦЕНАРИИ',
          size: 56,
          bold: true,
          color: '1a1a2e',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Content Factory',
          size: 28,
          color: '6366F1',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 200 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Всего сценариев: ${scripts.length}`,
          size: 24,
          color: '888888',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('ru-RU'),
          size: 24,
          color: '888888',
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ==========================
  // SCRIPTS — простые абзацы (без таблиц!)
  // ==========================
  scripts.forEach((script, index) => {
    // Разделитель между сценариями
    if (index > 0) {
      children.push(
        new Paragraph({ spacing: { before: 400, after: 200 }, children: [
          new TextRun({ text: '─'.repeat(50), color: 'CCCCCC', size: 20 }),
        ]}),
      );
    }

    // ЗАГОЛОВОК
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 300, after: 200 },
        children: [
          new TextRun({ text: `Сценарий ${index + 1}: `, color: '6366F1', size: 28, bold: true }),
          new TextRun({ text: script.topicTitle, color: '1a1a2e', size: 28, bold: true }),
        ],
      })
    );

    // ХУК
    if (script.hook) {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({ text: '🎯 ХУК: ', bold: true, size: 22, color: '6366F1' }),
            new TextRun({ text: script.hook, size: 22, color: '333333' }),
          ],
        })
      );
    }

    // ВИЗУАЛ
    if (script.visuals) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 80 },
          children: [
            new TextRun({ text: '🎬 В КАДРЕ: ', bold: true, size: 22, color: '6366F1' }),
            new TextRun({ text: script.visuals, size: 22, color: '333333' }),
          ],
        })
      );
    }

    // ТЕКСТ / СЦЕНАРИЙ
    if (script.body) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 80 },
          children: [
            new TextRun({ text: '📝 ТЕКСТ: ', bold: true, size: 22, color: '6366F1' }),
          ],
        }),
        new Paragraph({
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({ text: script.body, size: 22, color: '333333' }),
          ],
        })
      );
    }

    // CTA
    if (script.cta) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 80 },
          children: [
            new TextRun({ text: '📣 CTA: ', bold: true, size: 22, color: '6366F1' }),
            new TextRun({ text: script.cta, size: 22, color: '333333' }),
          ],
        })
      );
    }

    // МЕТАДАННЫЕ
    const metaParts: string[] = [];
    if (script.music) metaParts.push(`🎵 Музыка: ${script.music}`);
    if (script.duration) metaParts.push(`⏱ Хронометраж: ${script.duration}`);
    
    if (metaParts.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 200 },
          children: [
            new TextRun({
              text: metaParts.join('   |   '),
              size: 20,
              color: '888888',
              italics: true,
            })
          ],
        })
      );
    }
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22, color: '333333' },
        },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } },
      },
      children,
    }],
  });

  const rawBlob = await Packer.toBlob(doc);
  const arrayBuf = await rawBlob.arrayBuffer();
  const blob = new Blob([arrayBuf], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Сценарии_${new Date().toISOString().slice(0,10)}.docx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// =======================================
// CSV EXPORT — Контент-план
// =======================================

export function exportContentPlanCSV(
  slots: Slot[],
  targetItems: TargetItem[],
  topics: { id: number; title: string; selected: boolean }[],
) {
  const selectedTopics = topics.filter(t => t.selected);
  
  const rows: string[][] = [
    ['#', 'Формат', 'Название публикации', 'Тема сценария', 'Статус']
  ];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const target = targetItems.find(t => t.id === slot.id);
    const topic = selectedTopics[i];
    
    rows.push([
      String(slot.id),
      slot.format ? FORMAT_LABELS[slot.format] || slot.format : '—',
      target?.name || `Публикация #${slot.id}`,
      topic?.title || '—',
      'Ожидает'
    ]);
  }

  const csvContent = rows.map(row => 
    row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
  ).join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `Контент-план.csv`);
}

