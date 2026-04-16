/**
 * Minimal markdown → HTML for in-app preview. Not exhaustive.
 * Handles: headings, paragraphs, fenced code, inline code, bold, italic,
 * unordered + ordered lists, blockquotes, links, hr, simple tables.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|\W)\*([^*]+)\*(\W|$)/g, "$1<em>$2</em>$3");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(`<pre class="md-pre"><code class="md-code-block${lang ? ` lang-${escapeHtml(lang)}` : ""}">${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // Headings
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level} class="md-h md-h${level}">${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      out.push('<hr class="md-hr" />');
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote class="md-blockquote">${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // Tables (must have a header row + separator row)
    if (/^\|.*\|$/.test(line.trim()) && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      const header = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
        rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim()));
        i++;
      }
      const ths = header.map((h) => `<th>${inline(h)}</th>`).join("");
      const trs = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("");
      out.push(`<table class="md-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`);
      continue;
    }

    // Unordered list
    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*+]\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ul class="md-list">${items.join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      out.push(`<ol class="md-list">${items.join("")}</ol>`);
      continue;
    }

    // Paragraph (gather until blank line)
    if (line.trim() === "") {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|---+$|>|\d+\.\s|[-*+]\s|```|\|.*\|$)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p class="md-p">${inline(buf.join(" "))}</p>`);
  }

  return out.join("\n");
}
