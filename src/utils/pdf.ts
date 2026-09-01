import { Campaign } from '../types/index.ts';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getSyllabusHeadline(rawText?: string): string {
  if (!rawText || !rawText.trim()) return 'Peer Accountability Cohort';

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'Peer Accountability Cohort';

  // 1. Look for a section header (e.g. "#DSA :-", "# DSA", "== Machine Learning ==")
  const headerLine = lines.find(l => l.startsWith('#') || (l.startsWith('=') && l.endsWith('=')));
  if (headerLine) {
    const cleanHeader = headerLine.replace(/^[#=\s]+|[#=\s:\-]+$/g, '').trim();
    if (cleanHeader) return cleanHeader;
  }

  // 2. Or take the first non-empty line and strip leading markdown/numbers/symbols
  const firstLine = lines[0];
  const cleanFirst = firstLine
    .replace(/^(\d+[\.\)]|\d+\s+|Module\s+\d+:?|Week\s+\d+:?|Unit\s+\d+:?|[-*•#=])\s*/i, '')
    .split(/\s*[-–—:]\s*/)[0]
    .trim();

  if (cleanFirst) {
    return cleanFirst.length > 50 ? cleanFirst.slice(0, 47) + '...' : cleanFirst;
  }

  return 'Peer Accountability Cohort';
}

export function resolveItemLink(title: string, explicitLink?: string): string | undefined {
  if (explicitLink && explicitLink.trim()) {
    return explicitLink.trim();
  }

  const cleanTitle = title
    .replace(/(?:\(|\[)?(?:LC|LeetCode)\s*#?\d+(?:\)|\])?/gi, '')
    .replace(/^[-*•\d\.\s:]+/, '')
    .trim();

  // If there's an LC match (e.g. LC 412, (LC 412), LeetCode 191)
  const lcMatch = title.match(/(?:\(|\[)?(?:LC|LeetCode)\s*#?(\d+)(?:\)|\])?/i);
  if (lcMatch || /(?:LC\s*\d+|LeetCode|\(LC\s*\d+\))/i.test(title)) {
    if (cleanTitle) {
      const slug = cleanTitle
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      if (slug) {
        return `https://leetcode.com/problems/${slug}/`;
      }
    }
    if (lcMatch) {
      return `https://leetcode.com/problemset/?search=${lcMatch[1]}`;
    }
  }

  // Common algorithm / data structure problem names
  const commonProblemPattern = /^(?:Two Sum|Fizz Buzz|Reverse Integer|Palindrome Number|Valid Parentheses|Merge Two Sorted Lists|Best Time to Buy and Sell Stock|Valid Anagram|Binary Search|Maximum Subarray|Climbing Stairs|Contains Duplicate|Longest Substring|Container With Most Water|3Sum|Subsets|Combination Sum|Word Search|Course Schedule|Coin Change|House Robber|Trapping Rain Water|Word Ladder|Median of Two Sorted Arrays|Largest Perimeter Triangle|Number of 1 Bits)/i;
  
  if (commonProblemPattern.test(cleanTitle || title)) {
    const target = cleanTitle || title;
    const slug = target
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `https://leetcode.com/problems/${slug}/`;
  }

  return undefined;
}

export function parseSyllabusContent(rawText?: string): Array<{
  type: 'header' | 'numbered' | 'bullet' | 'text';
  number?: string;
  title: string;
  body?: string;
  link?: string;
}> {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const items: Array<{
    type: 'header' | 'numbered' | 'bullet' | 'text';
    number?: string;
    title: string;
    body?: string;
    link?: string;
  }> = [];

  lines.forEach(line => {
    let rawLink: string | undefined = undefined;
    let cleanLine = line;

    // 1. Standard Markdown link: [Title](https://...)
    const mdLinkMatch = cleanLine.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/);
    if (mdLinkMatch) {
      rawLink = mdLinkMatch[2].trim();
      cleanLine = cleanLine.replace(mdLinkMatch[0], mdLinkMatch[1]).trim();
    }

    // 2. Bracketed or parenthesized URL: [https://...] or (https://...)
    if (!rawLink) {
      const bracketMatch = cleanLine.match(/[\[\(](https?:\/\/[^\s\]\)]+)[\]\)]/);
      if (bracketMatch) {
        rawLink = bracketMatch[1].trim();
        cleanLine = cleanLine.replace(/[\[\(]https?:\/\/[^\s\]\)]+[\]\)]/g, '').trim();
      }
    }

    // 3. Raw URL: https://...
    if (!rawLink) {
      const rawUrlMatch = cleanLine.match(/(https?:\/\/[^\s]+)/);
      if (rawUrlMatch) {
        rawLink = rawUrlMatch[1].trim();
        cleanLine = cleanLine.replace(/[-–—:]?\s*https?:\/\/[^\s]+/g, '').trim();
      }
    }

    // Clean up any lingering enclosing brackets
    cleanLine = cleanLine.replace(/^\[([^\]]+)\]$/, '$1').trim();

    if (cleanLine.startsWith('#') || (cleanLine.startsWith('=') && cleanLine.endsWith('='))) {
      items.push({
        type: 'header',
        title: cleanLine.replace(/^[#=\s]+|[#=\s:-]+$/g, '').trim()
      });
      return;
    }

    const numMatch = cleanLine.match(/^(?:##\s*|)(\d+[\.\)]|\d+\s+|Module\s+\d+:?|Week\s+\d+:?|Unit\s+\d+:?)\s*(.*)/i);
    if (numMatch) {
      const numLabel = numMatch[1].replace(/[\.\)\s]+$/, '').trim();
      let rest = numMatch[2].trim();
      rest = rest.replace(/^\[([^\]]+)\]$/, '$1').trim();

      const parts = rest.split(/\s*[-–—:]\s*/);
      if (parts.length > 1) {
        const itemTitle = parts[0].trim();
        items.push({
          type: 'numbered',
          number: numLabel,
          title: itemTitle,
          body: parts.slice(1).join(' – ').trim(),
          link: resolveItemLink(itemTitle, rawLink)
        });
      } else {
        items.push({
          type: 'numbered',
          number: numLabel,
          title: rest,
          link: resolveItemLink(rest, rawLink)
        });
      }
      return;
    }

    const bulletMatch = cleanLine.match(/^[-*•]\s*(.*)/);
    if (bulletMatch) {
      let bulletTitle = bulletMatch[1].trim();
      bulletTitle = bulletTitle.replace(/^\[([^\]]+)\]$/, '$1').trim();
      items.push({
        type: 'bullet',
        title: bulletTitle,
        link: resolveItemLink(bulletTitle, rawLink)
      });
      return;
    }

    const textTitle = cleanLine.replace(/^\[([^\]]+)\]$/, '$1').trim();
    items.push({
      type: 'text',
      title: textTitle,
      link: resolveItemLink(textTitle, rawLink)
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
              <div class="module-title">
                ${escapeHtml(item.title)}
                ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" style="margin-left: 8px; font-size: 11px; color: #059669; text-decoration: none; font-weight: bold;">[Link ↗]</a>` : ''}
              </div>
              ${item.body ? `<div class="module-body">${escapeHtml(item.body)}</div>` : ''}
            </div>
          </div>
        `;
      } else if (item.type === 'bullet') {
        syllabusHtml += `
          <div class="bullet-item">
            <span class="bullet-dot"></span>
            <span>${escapeHtml(item.title)}</span>
            ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" style="margin-left: 8px; font-size: 11px; color: #059669; text-decoration: none; font-weight: bold;">[Link ↗]</a>` : ''}
          </div>
        `;
      } else if (item.type === 'header') {
        syllabusHtml += `
          <h2 class="section-header">${escapeHtml(item.title)}</h2>
        `;
      } else {
        syllabusHtml += `
          <p class="text-paragraph">
            ${escapeHtml(item.title)}
            ${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" style="margin-left: 8px; font-size: 11px; color: #059669; text-decoration: none; font-weight: bold;">[Link ↗]</a>` : ''}
          </p>
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
