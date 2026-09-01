/**
 * Builds the printable LOI as HTML - PRD 7.4, "output a branded PDF".
 *
 * expo-print turns HTML into a PDF using the platform's own print engine, so
 * this is the document. Two constraints shape it:
 *
 *   1. It has to render with no network. A letter generated in a driveway on
 *      one bar cannot wait on a webfont, so the type stack is system fonts
 *      only. The brand comes through in the layout and the accent rule, not in
 *      a font that might not arrive.
 *   2. It has to survive a page break. Letters run past one page when terms are
 *      long, so the signature block and the non-binding paragraph are kept
 *      whole rather than split across pages.
 */
import { palette } from '@/theme/tokens';

import { renderTemplate, type MergeContext, type RenderResult } from './mergeFields';

export type LoiDocument = RenderResult & {
  /** Full HTML document, ready for expo-print or a browser. */
  html: string;
  /** Suggested filename, without an extension. */
  filename: string;
};

/** Escapes text before it goes anywhere near markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Turns the merged plain text into markup.
 *
 * Line breaks inside a block are meaningful and are preserved: an address block
 * and a signature block are lists of short lines, not prose, and joining them
 * produces "Francisco Caballero Jr. Acquisitions Manager Deo Volente LLC" on
 * one line. Templates therefore keep each paragraph on a single source line and
 * break only where a break belongs.
 *
 * A block whose lines all read as `Label: value` is the terms list, and gets
 * rendered as rows rather than prose, because a term an agent has to hunt for
 * inside a paragraph is a term that gets missed.
 */
function toBody(text: string): string {
  const blocks = text.split(/\n\s*\n/);

  return blocks
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) return '';

      const isTerm = (line: string) => /^[A-Z][^:]{2,40}:\s/.test(line);

      if (lines.length >= 2 && lines.every(isTerm)) {
        const rows = lines
          .map((line) => {
            const match = line.match(/^([^:]+):\s*(.*)$/);
            if (!match) return `<div class="term-note">${escapeHtml(line)}</div>`;
            return `<div class="term"><span class="term-label">${escapeHtml(
              match[1],
            )}</span><span class="term-value">${escapeHtml(match[2])}</span></div>`;
          })
          .join('');
        return `<div class="terms">${rows}</div>`;
      }

      const isSignature = lines.length >= 2 && lines.every((line) => line.length < 60);
      const rendered = lines.map(escapeHtml).join('<br />');
      return `<p${isSignature ? ' class="block"' : ''}>${rendered}</p>`;
    })
    .filter(Boolean)
    .join('\n');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function buildLoiDocument(template: string, context: MergeContext): LoiDocument {
  const rendered = renderTemplate(template, context);
  const { org, deal } = context;

  const letterhead = org.logo_url
    ? `<img class="logo" src="${escapeHtml(org.logo_url)}" alt="${escapeHtml(
        org.name ?? '',
      )}" />`
    : `<div class="wordmark">${escapeHtml(org.name ?? '')}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Letter of Intent - ${escapeHtml(deal.address ?? '')}</title>
<style>
  @page { size: letter; margin: 0.9in 0.85in; }

  :root {
    --accent: ${palette.emerald600};
    --ink: ${palette.slate900};
    --muted: ${palette.slate600};
    --rule: ${palette.slate200};
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    color: var(--ink);
    background: #ffffff;
    /* System stack only: the document must render with no network. */
    font-family: "Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif;
    font-size: 11.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  header {
    border-bottom: 2.5px solid var(--accent);
    padding-bottom: 12px;
    margin-bottom: 26px;
  }

  .wordmark {
    font-size: 19pt;
    font-weight: 700;
    letter-spacing: -0.4px;
    color: var(--accent);
  }

  .logo { max-height: 54px; max-width: 240px; }

  p { margin: 0 0 12px; }

  .terms {
    margin: 16px 0 18px;
    border-left: 2.5px solid var(--accent);
    padding-left: 14px;
    /* Keep the offer together; a term stranded on its own page gets missed. */
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .term {
    display: flex;
    gap: 10px;
    padding: 3px 0;
    align-items: baseline;
  }

  .term-label {
    flex: 0 0 40%;
    color: var(--muted);
    font-size: 10.5pt;
  }

  .term-value { flex: 1; font-weight: 600; }

  .term-note { padding: 3px 0; }

  /* Address and signature blocks: short lines that must stay on their own
     lines, and must not be split across a page. */
  p.block { break-inside: avoid; page-break-inside: avoid; }

  footer {
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid var(--rule);
    color: var(--muted);
    font-size: 8.5pt;
    break-inside: avoid;
    page-break-inside: avoid;
  }
</style>
</head>
<body>
<header>${letterhead}</header>
<main>
${toBody(rendered.text)}
</main>
<footer>
  This letter of intent is non-binding and does not create a contract. Figures
  are estimates and are not an appraisal.
</footer>
</body>
</html>`;

  return {
    ...rendered,
    html,
    filename: `LOI-${slugify(deal.address ?? 'property')}`,
  };
}
