/* ============================================
   Export Utilities
   - Word (.docx) для сценариев
   - CSV для контент-плана
   ============================================ */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, ShadingType, Table, TableRow, TableCell, WidthType, PageBreak } from 'docx';
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

  const children: (Paragraph | Table)[] = [];

  // ==========================
  // COVER PAGE
  // ==========================
  children.push(
    new Paragraph({
      spacing: { before: 2000, after: 400 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'КОНТЕНТ-СТРАТЕГІЯ ТА СЦЕНАРІЇ',
          size: 64,
          bold: true,
          color: '1a1a2e',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 3000 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Сгенеровано за допомогою Content Factory',
          size: 28,
          color: '6366F1', // Primary color
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: new Date().toLocaleDateString('uk-UA'),
          size: 24,
          color: '888888',
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // ==========================
  // SCRIPTS
  // ==========================
  scripts.forEach((script, index) => {
    // ЗАГОЛОВОК СЦЕНАРИЯ
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: `Сценарій ${index + 1}: `, color: '6366F1', size: 32, bold: true }),
          new TextRun({ text: script.topicTitle, color: '1a1a2e', size: 32, bold: true }),
        ],
      })
    );

    // ТАБЛИЦА С КОНТЕНТОМ
    const tableRows = [];

    // ХУК
    if (script.hook) {
      tableRows.push(createTableRow('ХУК (2-3 сек)', script.hook, 'F0F0FF'));
    }
    // ВИЗУАЛ
    if (script.visuals) {
      tableRows.push(createTableRow('В КАДРІ', script.visuals, 'FFFFFF'));
    }
    // ТЕКСТ / СЦЕНАРИЙ
    if (script.body) {
      tableRows.push(createTableRow('ТЕКСТ РОЛИКУ', script.body, 'F8F9FA'));
    }
    // CTA
    if (script.cta) {
      tableRows.push(createTableRow('CTA (ДІЯ)', script.cta, 'FFFFFF'));
    }

    const scriptTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
      },
      rows: tableRows,
    });

    children.push(scriptTable);

    // МЕТАДАННЫЕ
    const metaParts = [];
    if (script.music) metaParts.push(`🎵 Музика: ${script.music}`);
    if (script.duration) metaParts.push(`⏱ Хронометраж: ${script.duration}`);
    
    if (metaParts.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 400 },
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

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Контент_стратегія_${new Date().toISOString().slice(0,10)}.docx`);
}

// Helper для создания строк таблицы с отступами и шрифтами
function createTableRow(label: string, content: string, bgColor: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.SOLID, color: bgColor },
        margins: { top: 200, bottom: 200, left: 200, right: 200 },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: label, bold: true, color: '1a1a2e', size: 20 })
            ]
          })
        ]
      }),
      new TableCell({
        width: { size: 75, type: WidthType.PERCENTAGE },
        margins: { top: 200, bottom: 200, left: 200, right: 200 },
        children: [
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({ text: content, size: 22 })
            ]
          })
        ]
      })
    ]
  });
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

