/* ============================================
   Export Utilities
   - Word (.docx) для сценариев
   - CSV для контент-плана
   ============================================ */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType } from 'docx';
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

// =======================================
// WORD EXPORT — Сценарии
// =======================================

/**
 * Генерирует .docx файл с темами и сценариями.
 * Чисто и минималистично: тема → хук → сценарий → CTA
 */
export async function exportScriptsToWord(scripts: ScriptItem[]) {
  if (scripts.length === 0) return;

  const children: Paragraph[] = [];

  scripts.forEach((script, index) => {
    // Разделитель между сценариями (кроме первого)
    if (index > 0) {
      children.push(
        new Paragraph({ spacing: { before: 200 } }),
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 1 }
          },
          spacing: { after: 300 },
        })
      );
    }

    // Номер + Тема
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 100, after: 120 },
        children: [
          new TextRun({
            text: `${index + 1}. `,
            color: '999999',
            size: 28,
          }),
          new TextRun({
            text: script.topicTitle,
            bold: true,
            size: 28,
            color: '1a1a2e',
          }),
        ],
      })
    );

    // Хук
    if (script.hook) {
      children.push(
        createLabel('Хук'),
        createBodyText(script.hook),
      );
    }

    // Видеоряд
    if (script.visuals) {
      children.push(
        createLabel('Видеоряд'),
        createBodyText(script.visuals),
      );
    }

    // Сценарий (основной текст)
    if (script.body) {
      children.push(
        createLabel('Сценарий'),
        createBodyText(script.body),
      );
    }

    // CTA
    if (script.cta) {
      children.push(
        createLabel('Призыв к действию'),
        createBodyText(script.cta),
      );
    }

    // Метаданные (звук + время) — серым мелким текстом
    const metaParts: string[] = [];
    if (script.music) metaParts.push(`Звук: ${script.music}`);
    if (script.duration) metaParts.push(`Хронометраж: ${script.duration}`);
    if (metaParts.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 160, after: 40 },
          children: [
            new TextRun({
              text: metaParts.join('  •  '),
              size: 18,
              color: '999999',
              italics: true,
            }),
          ],
        })
      );
    }
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Сценарии.docx`);
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

// =======================================
// Helpers
// =======================================

function createLabel(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 40 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 18,
        color: '6366F1',
        allCaps: true,
      }),
    ],
  });
}

function createBodyText(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    alignment: AlignmentType.JUSTIFIED,
    shading: { type: ShadingType.SOLID, color: 'F8F9FA' },
    children: [
      new TextRun({
        text,
        size: 22,
        color: '333333',
      }),
    ],
  });
}
