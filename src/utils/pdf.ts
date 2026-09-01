import { Campaign } from '../types/index.ts';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function parseSyllabusContent(rawText?: string): Array<{
  type: 'header' | 'numbered' | 'bullet' | 'text';
  number?: string;
  title: string;
  body?: string; }> {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items: Array<{
    type: 'header' | 'numbered' | 'bullet' | 'text';
    number?: string;
    title: string;
    body?: string;
  }> = [];

  lines.forEach(line => {
    const numMatch = line.match(/^(\d+[\.\)]|\d+\s+|Module\s+\d+:?|Week\s+\d+:?|Unit\s+\d+:?)\s*(.*)/i);
    if (numMatch) {
      const numLabel = numMatch[1].replace(/[\.\)\s]+$/, '').trim();
      const rest = numMatch[2].trim();
      const parts = rest.split(/\s*[-–—:]\s*/);
      if (parts.length > 1) {
        items.push({
          type: 'numbered',
          number: numLabel,
          title: parts[0].trim(),
          body: parts.slice(1).join(' – ').trim()
        });
      } else {
        items.push({
          type: 'numbered',
          number: numLabel,
          title: rest
        });
      }
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s*(.*)/);
    if (bulletMatch) {
      items.push({
        type: 'bullet',
        title: bulletMatch[1].trim()
      });
      return;
    }

    if (line.startsWith('#') || (line.startsWith('=') && line.endsWith('='))) {
      items.push({
        type: 'header',
        title: line.replace(/^[#=\s]+|[#=\s]+$/g, '').trim()
      });
      return;
    }

    items.push({
      type: 'text',
      title: line
    });
  });

  return items;
}

export function exportSyllabusToPdf(campaign: Campaign): void {
  const syllabus = campaign.description || campaign.syllabus || 'No syllabus provided.';
  const parsedItems = parseSyllabusContent(syllabus);
  const generationDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let syllabusHtml = '';
  if (parsedItems.length === 0) {
    syllabusHtml = '<div class="empty-state">No syllabus topics listed yet for this cohort.</div>';
  } else {
    parsedItems.forEach((item) => {
      if (item.type === 'numbered') {
        syllabusHtml += `
          <div class="module-card">
            <div class="module-badge">${item.number || '•'}</div>
            <div class="module-content">
              <div class="module-title">${escapeHtml(item.title)}</div>
              ${item.body ? `<div class="module-body">${escapeHtml(item.body)}</div>` : ''}
            </div>
          </div>
        `;
      } else if (item.type === 'bullet') {
        syllabusHtml += `
          <div class="bullet-item">
            <span class="bullet-dot"></span>
            <span>${escapeHtml(item.title)}</span>
          </div>
        `;
      } else if (item.type === 'header') {
        syllabusHtml += `
          <h2 class="section-header">${escapeHtml(item.title)}</h2>
        `;
      } else {
        syllabusHtml += `
          <p class="text-paragraph">${escapeHtml(item.title)}</p>
        `;
      }
    });
  }

  const tagsHtml = (campaign.tags || [])
    .map(t => `<span class="tag-pill">#${escapeHtml(t)}</span>`)
    .join(' ');

  const fullDocumentHtml = `!<DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>${escapeHtml(campaign.name)} – Sy|labus</title>
    <style>
      @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #09090b; background: #ffffff; margin: 0; padding: 24px; line-height: 1.5; }
      .header-table { width: 100%; border-bottom: 2px solid #09090b; padding-bottom: 16px; margin-bottom: 24px; }
      .brand-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #059669; margin-bottom: 4px; }
      .cohort-title { font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #09090b; margin: 0 0 8px 0; line-height: 1.2; }
      .meta-row { display: flex; flex-wrap: wrap; gap: 12px 24px; font-size: 12px; color: #52525b; margin-top: 12px; }
      .meta-item strong { color: #09090b; }
      .category-badge { display: inline-block; padding: 3px 10px; background: #09090b; color: #ffffff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 6px; }
      .tag-pill { display: inline-block; padding: 2px 8px; background: #f4f4f5; color: #52525b; border: 1px solid #e4e4e7; font-size: 10px; font-weight: 600; border-radius: 9999px; margin-right: 4px; }
      .syllabus-section-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #71717a; margin: 24px 0 16px 0; display: flex; align-items: center; gap: 8px; }
      .syllabus-section-title::after { content: ''; flex: 1; height: 1px; background: #e4e4e7; }
      .module-card { display: flex; align-items: flex-start; gap: 14px; padding: 12px 16px; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 12px; margin-bottom: 10px; page-break-inside: avoid; }
      .module-badge { width: 28px; height: 28px; background: #09090b; color: #ffffff; font-size: 12px; font-weight: 800; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .module-content { flex: 1; }
      .module-title { font-size: 14px; font-weight: 800; color: #09090b; line-height: 1.3; }
      .module-body { font-size: 12px; color: #52525b; margin-top: 4px; line-height: 1.4; }
      .bullet-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; font-size: 13px; color: #27272a; page-break-inside: avoid; }
      .bullet-dot { width: 6px; height: 6px; background: #059669; border-radius: 50%; flex-shrink: 0; }
      .section-header { font-size: 16px; font-weight: 800; color: #09090b; margin: 20px 0 10px 0; border-left: 3px solid #059669; padding-left: 10px; }
      .text-paragraph { font-size: 13px; color: #3f3f46; margin: 8px 0; line-height: 1.5; }
      .empty-state { padding: 32px; text-align: center; color: #a1a1aa; font-size: 13px; background: #fafafa; border: 1px dashed #d4dQd8; border-radius: 12px; }
      .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e4e4e7; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #a1a1aa; page-break-inside: avoid; }
      .footer-left strong { color: #52525b; }
      @media print { body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="header-table">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="brand-title">StudySync Cohort Sy|labus</div>
          <h1 class="cohort-title">${escapeHtml(campaign.name)}</h1>
          <div>
            <span class="category-badge">${escapeHtml(campaign.category || 'Study Cohort')}</span>
            $wtagsHtml}
          </div>
        </div>
        <div style="text-align: right; font-size: 11px; color: #71717a;">
          <div>Target: <strong>${campaign.targetDailyHours || 4}h / day</strong></div>
          <div>Capacity: <strong>+${campaign.memberCount || 1}/${campaign.maxMembers || 20} members</strong></div>
        </div>
      </div>

      <div class="meta-row">
        ${campaign.adminName ? `<div class="meta-item">Cohort Admin: <strong>${escapeHtml(campaign.adminName)}</strong></div>` : ''}
        ${campaign.startDate ? `<div class="meta-item">Timeline: <strong>${escapeHtml(campaign.startDate)} to ${escapeHtml(campaign.endDate || 'Ongoing')}</strong></div>` : ''}
        <div class="meta-item">Generated: <strong>${generationDate}</strong></div>
      </div>
    </div>

    <div class="syllabus-section-title">Official Study Curriculum</div>

    <div class="syllabus-container">
      ${syllabusHtml}
    </div>

    <div class="footer">
      <div class="footer-left">
        Official Study Curriculum ´ <strong>StudySync Peer Accountability</strong>
      </div>
      <div>
        Verified Deep Work Cohort
      </div>
    </div>

    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 300);
      };
    </script>
  </body>
  </html>`;

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(fullDocumentHtml);
    printWindow.document.close();
  } else {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(fullDocumentHtml);
      doc.close();
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 60000);
  }
}
