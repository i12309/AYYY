/* OBERON: dependency-free Markdown preview. All source HTML is treated as text. */
(function (root) {
  'use strict';

  const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const linesOf = value => String(value == null ? '' : value).replace(/\r\n?/g, '\n').split('\n');
  const fenceOf = line => line.match(/^ {0,3}(`{3,}|~{3,})([^`]*)$/);
  const headingOf = line => line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/);
  const listOf = line => line.match(/^( *)([-+*]|\d+[.)])[ \t]+(.*)$/);
  const isRule = line => /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line);
  const isTableDivider = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const splitRow = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));

  function bareInline(value) {
    return String(value).replace(/\[\[([^\]]+)\]\]/g, (_, v) => v.split('|').pop())
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/`([^`]+)`/g, '$1')
      .replace(/[*_~]/g, '').replace(/\\([\\`*{}\[\]()#+.!_>~-])/g, '$1').trim();
  }

  function headings(value) {
    const result = [], seen = new Map();
    let fence = null;
    const source = linesOf(value);
    source.forEach((line, index) => {
      const f = fenceOf(line);
      if (f) {
        if (!fence) fence = { char: f[1][0], length: f[1].length };
        else if (f[1][0] === fence.char && f[1].length >= fence.length && !f[2].trim()) fence = null;
        return;
      }
      if (fence) return;
      const match = headingOf(line);
      if (!match) return;
      const label = bareInline(match[2]);
      const base = 'section-' + (label.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '') || 'note');
      const count = (seen.get(base) || 0) + 1;
      seen.set(base, count);
      result.push({ level: match[1].length, text: label, id: base + (count > 1 ? '-' + count : ''), line: index });
    });
    return result;
  }

  function safeURL(raw) {
    let url = raw.trim().replace(/^<|>$/g, '');
    // Character references and control characters must never create a hidden scheme.
    if (!url || /[\x00-\x20\x7f<>"'\\]/.test(url) || /&(?:#\w+|[a-z]+);/i.test(url)) return null;
    if (/^https?:\/\//i.test(url) || /^mailto:[^\s@]+@[^\s@]+/i.test(url)) return { kind: 'external', value: url };
    if (/^#[\p{L}\p{N}_-]+$/u.test(url)) return { kind: 'anchor', value: url };
    if (!/^[/]|^[a-z][a-z\d+.-]*:/i.test(url) && /\.md(?:#[^\s]*)?$/i.test(url)) {
      try { url = decodeURIComponent(url); } catch (_) { /* Keep literal malformed encoding. */ }
      return { kind: 'wiki', value: url.replace(/\.md(?=#|$)/i, '').replace(/^\.\//, '') };
    }
    return null;
  }

  function inline(value, options, depth) {
    const source = String(value), out = [];
    depth = depth || 0;
    if (depth > 6) return escapeHTML(source);
    let index = 0;
    while (index < source.length) {
      const remaining = source.slice(index);
      let m;
      if ((m = remaining.match(/^\\([\\`*{}\[\]()#+.!_>~|-])/))) {
        out.push(escapeHTML(m[1])); index += m[0].length; continue;
      }
      if (source[index] === '`') {
        const ticks = remaining.match(/^`+/)[0], end = source.indexOf(ticks, index + ticks.length);
        if (end >= 0) {
          const code = source.slice(index + ticks.length, end).replace(/\n/g, ' ');
          out.push('<code>' + escapeHTML(code) + '</code>'); index = end + ticks.length; continue;
        }
      }
      if ((m = remaining.match(/^\[\[([^\]\n]+)\]\]/))) {
        const split = m[1].indexOf('|');
        const target = (split >= 0 ? m[1].slice(0, split) : m[1]).trim();
        const label = split >= 0 ? m[1].slice(split + 1).trim() : target;
        if (target) out.push('<a class="wiki-link" href="#" data-wiki="' + escapeHTML(target) + '">' + escapeHTML(label) + '</a>');
        else out.push(escapeHTML(m[0]));
        index += m[0].length; continue;
      }
      if ((m = remaining.match(/^(!?)\[([^\]\n]*)\]\((<[^>\n]+>|[^)\s]+)(?:\s+["']([^"']*)["'])?\)/))) {
        const destination = safeURL(m[3]), label = inline(m[2], options, depth + 1);
        if (destination && m[1] !== '!') {
          const title = m[4] ? ' title="' + escapeHTML(m[4]) + '"' : '';
          if (destination.kind === 'wiki') out.push('<a href="#" class="wiki-link" data-wiki="' + escapeHTML(destination.value) + '"' + title + '>' + label + '</a>');
          else if (destination.kind === 'anchor') out.push('<a href="' + escapeHTML(destination.value) + '"' + title + '>' + label + '</a>');
          else out.push('<a href="' + escapeHTML(destination.value) + '" target="_blank" rel="noopener noreferrer"' + title + '>' + label + '</a>');
        } else if (m[1] === '!') {
          // Do not load untrusted remote images in a private notes preview.
          out.push('<span class="md-image-placeholder">' + escapeHTML(m[2] || 'Изображение') + '</span>');
        } else out.push(label);
        index += m[0].length; continue;
      }
      if ((m = remaining.match(/^(\*\*|__)(?=\S)([\s\S]*?\S)\1/))) {
        out.push('<strong>' + inline(m[2], options, depth + 1) + '</strong>'); index += m[0].length; continue;
      }
      if ((m = remaining.match(/^~~(?=\S)([\s\S]*?\S)~~/))) {
        out.push('<del>' + inline(m[1], options, depth + 1) + '</del>'); index += m[0].length; continue;
      }
      if ((source[index] === '*' || (source[index] === '_' && !/[\p{L}\p{N}]/u.test(source[index - 1] || ''))) &&
          (m = remaining.match(/^(\*|_)(?=\S)([^\n]*?\S)\1/))) {
        out.push('<em>' + inline(m[2], options, depth + 1) + '</em>'); index += m[0].length; continue;
      }
      if (options.tags !== false && (index === 0 || /[\s(]/.test(source[index - 1])) &&
          (m = remaining.match(/^#([\p{L}\p{N}][\p{L}\p{N}_/-]*)/u))) {
        out.push('<a href="#" class="md-tag" data-tag="' + escapeHTML(m[1]) + '">#' + escapeHTML(m[1]) + '</a>');
        index += m[0].length; continue;
      }
      if ((m = remaining.match(/^ {2,}\n/))) { out.push('<br>'); index += m[0].length; continue; }
      out.push(escapeHTML(source[index])); index++;
    }
    return out.join('');
  }

  function render(value, options) {
    options = options || {};
    const source = linesOf(value);
    const headingMap = new Map(headings(value).map(h => [h.line, h]));
    const raw = source.map((text, line) => ({ text, line }));

    function blocks(rows) {
      const output = [];
      let index = 0;

      function renderList(start, baseIndent) {
        const first = listOf(rows[start].text), ordered = /^\d/.test(first[2]);
        const type = ordered ? 'ol' : 'ul', items = [];
        const startAttr = ordered && parseInt(first[2], 10) !== 1 ? ' start="' + parseInt(first[2], 10) + '"' : '';
        let cursor = start, anyTask = false;
        while (cursor < rows.length) {
          const found = listOf(rows[cursor].text);
          if (!found || found[1].length !== baseIndent || /^\d/.test(found[2]) !== ordered || isRule(rows[cursor].text)) break;
          const row = rows[cursor], task = found[3].match(/^\[([ xX])\][ \t]+(.*)$/);
          anyTask = anyTask || !!task;
          let content = task ? '<label class="md-task-label"><input class="md-task-checkbox task-checkbox" type="checkbox" data-line="' + row.line + '"' + (task[1].toLowerCase() === 'x' ? ' checked' : '') + ' aria-label="' + escapeHTML(bareInline(task[2])) + '"><span>' + inline(task[2], options) + '</span></label>' : inline(found[3], options);
          cursor++;
          while (cursor < rows.length) {
            const nested = listOf(rows[cursor].text);
            if (nested && nested[1].length > baseIndent && !isRule(rows[cursor].text)) {
              const child = renderList(cursor, nested[1].length); content += child.html; cursor = child.next;
            } else if (!nested && rows[cursor].text.trim() && /^ +/.test(rows[cursor].text) && rows[cursor].text.match(/^ */)[0].length > baseIndent) {
              content += '\n' + inline(rows[cursor].text.trim(), options); cursor++;
            } else break;
          }
          items.push('<li' + (task ? ' class="task-list-item' + (task[1].toLowerCase() === 'x' ? ' is-checked' : '') + '"' : '') + '>' + content + '</li>');
          if (cursor < rows.length && !rows[cursor].text.trim() && cursor + 1 < rows.length) {
            const after = listOf(rows[cursor + 1].text);
            if (after && after[1].length === baseIndent && /^\d/.test(after[2]) === ordered) cursor++;
          }
        }
        return { html: '<' + type + startAttr + (anyTask ? ' class="task-list"' : '') + '>' + items.join('') + '</' + type + '>', next: cursor };
      }

      while (index < rows.length) {
        const row = rows[index], text = row.text;
        if (!text.trim()) { index++; continue; }
        const fence = fenceOf(text);
        if (fence) {
          const code = []; index++;
          while (index < rows.length) {
            const end = fenceOf(rows[index].text);
            if (end && end[1][0] === fence[1][0] && end[1].length >= fence[1].length && !end[2].trim()) { index++; break; }
            code.push(rows[index].text); index++;
          }
          const language = fence[2].trim().split(/\s/)[0].replace(/[^a-zA-Z0-9_+#.-]/g, '').slice(0, 30);
          output.push('<pre' + (language ? ' data-language="' + escapeHTML(language) + '"' : '') + '><code' + (language ? ' class="language-' + escapeHTML(language) + '"' : '') + '>' + escapeHTML(code.join('\n')) + '</code></pre>');
          continue;
        }
        const heading = headingOf(text);
        if (heading) {
          const level = heading[1].length, h = headingMap.get(row.line);
          output.push('<h' + level + (h ? ' id="' + escapeHTML(h.id) + '"' : '') + '>' + inline(heading[2], options) + '</h' + level + '>'); index++; continue;
        }
        if (isRule(text)) { output.push('<hr>'); index++; continue; }
        if (/^ {0,3}>/.test(text)) {
          const quoteRows = [];
          while (index < rows.length && /^ {0,3}>/.test(rows[index].text)) {
            quoteRows.push({ text: rows[index].text.replace(/^ {0,3}>[ \t]?/, ''), line: rows[index].line }); index++;
          }
          const callout = quoteRows[0].text.match(/^\[!(note|tip|info|warning|important|success|quote)\][+-]?(?:\s+(.*))?$/i);
          if (callout) {
            const kind = callout[1].toLowerCase(), names = { note: 'Заметка', tip: 'Совет', info: 'К сведению', warning: 'Внимание', important: 'Важно', success: 'Готово', quote: 'Цитата' };
            output.push('<aside class="callout md-callout callout-' + kind + '"><div class="callout-title">' + inline(callout[2] || names[kind], options) + '</div>' + blocks(quoteRows.slice(1)) + '</aside>');
          } else output.push('<blockquote>' + blocks(quoteRows) + '</blockquote>');
          continue;
        }
        const list = listOf(text);
        if (list) { const result = renderList(index, list[1].length); output.push(result.html); index = result.next; continue; }
        if (index + 1 < rows.length && text.includes('|') && isTableDivider(rows[index + 1].text)) {
          const header = splitRow(text), columns = splitRow(rows[index + 1].text);
          const aligns = columns.map(cell => /^:.*:$/.test(cell) ? 'center' : /:$/.test(cell) ? 'right' : 'left');
          const cells = (values, tag) => header.map((_, c) => '<' + tag + ' style="text-align:' + (aligns[c] || 'left') + '">' + inline(values[c] || '', options) + '</' + tag + '>').join('');
          const body = []; index += 2;
          while (index < rows.length && rows[index].text.trim() && rows[index].text.includes('|')) {
            body.push('<tr>' + cells(splitRow(rows[index].text), 'td') + '</tr>'); index++;
          }
          output.push('<div class="md-table-wrap"><table><thead><tr>' + cells(header, 'th') + '</tr></thead><tbody>' + body.join('') + '</tbody></table></div>'); continue;
        }
        const paragraph = [text]; index++;
        while (index < rows.length && rows[index].text.trim()) {
          const next = rows[index].text;
          if (fenceOf(next) || headingOf(next) || isRule(next) || /^ {0,3}>/.test(next) || listOf(next) ||
              (index + 1 < rows.length && next.includes('|') && isTableDivider(rows[index + 1].text))) break;
          paragraph.push(next); index++;
        }
        output.push('<p>' + inline(paragraph.join('\n'), options) + '</p>');
      }
      return output.join('\n');
    }
    return blocks(raw);
  }

  /**
   * Rewrite note destinations without modifying link labels, aliases, titles,
   * line endings, or code. Callback receives (target, 'wiki' | 'markdown').
   * Wiki targets omit their alias; Markdown targets retain the .md extension.
   * A null/undefined result keeps the exact original source.
   */
  function rewriteLinks(value, callback) {
    const source = String(value == null ? '' : value);
    if (typeof callback !== 'function') return source;

    function rewriteInline(text) {
      const output = [];
      let index = 0;
      while (index < text.length) {
        const rest = text.slice(index);
        let match;
        if (text[index] === '\\') { output.push(text.slice(index, index + 2)); index += 2; continue; }
        if (text[index] === '`') {
          const ticks = rest.match(/^`+/)[0];
          const closing = /`+/g; closing.lastIndex = index + ticks.length;
          let end;
          while ((end = closing.exec(text)) && end[0].length !== ticks.length) { /* Find an exact delimiter. */ }
          if (end) { output.push(text.slice(index, end.index + ticks.length)); index = end.index + ticks.length; continue; }
          output.push(ticks); index += ticks.length; continue;
        }
        if ((match = rest.match(/^\[\[([^\]\r\n]+)\]\]/))) {
          const pipe = match[1].indexOf('|');
          const original = pipe >= 0 ? match[1].slice(0, pipe) : match[1];
          const target = original.trim();
          const replacement = target ? callback(target, 'wiki') : null;
          output.push(replacement == null || replacement === target ? match[0] : '[[' + String(replacement) + (pipe >= 0 ? match[1].slice(pipe) : '') + ']]');
          index += match[0].length; continue;
        }
        if ((match = rest.match(/^(!?)\[([^\]\r\n]*)\]\((<[^>\r\n]+>|[^)\s]+)(?:\s+["']([^"']*)["'])?\)/))) {
          const destination = safeURL(match[3]);
          const original = match[3].replace(/^<|>$/g, '');
          const replacement = match[1] !== '!' && destination?.kind === 'wiki' ? callback(original, 'markdown') : null;
          if (replacement == null || replacement === original) output.push(match[0]);
          else {
            // Keep existing percent escapes; encode only characters that would
            // terminate or alter a Markdown destination.
            const target = String(replacement).replace(/[\s()<>"'\\]/g, c => /[()']/.test(c) ? '%' + c.charCodeAt(0).toString(16).toUpperCase() : encodeURIComponent(c));
            const wrapped = match[3].startsWith('<') ? '<' + target + '>' : target;
            const offset = match[1].length + match[2].length + 3;
            output.push(match[0].slice(0, offset) + wrapped + match[0].slice(offset + match[3].length));
          }
          index += match[0].length; continue;
        }
        output.push(text[index]); index++;
      }
      return output.join('');
    }

    let fence = null, pending = '';
    const output = [];
    const flush = () => { if (pending) { output.push(rewriteInline(pending)); pending = ''; } };
    const rows = source.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g) || [];
    for (const row of rows) {
      if (!row) continue;
      const line = row.replace(/[\r\n]+$/, '').replace(/^(?: {0,3}>[ \t]?)+/, '');
      const current = fenceOf(line);
      if (fence) {
        output.push(row);
        if (current && current[1][0] === fence.char && current[1].length >= fence.length && !current[2].trim()) fence = null;
      } else if (current) {
        flush(); fence = { char: current[1][0], length: current[1].length }; output.push(row);
      } else pending += row;
    }
    flush();
    return output.join('');
  }

  function wikiLinks(value) {
    const targets = new Set();
    rewriteLinks(value, (target, kind) => {
      const normalized = kind === 'markdown' ? safeURL(target)?.value : target;
      if (normalized) targets.add(normalized);
    });
    return Array.from(targets);
  }

  function plainText(value) {
    return linesOf(value).filter(line => !fenceOf(line)).map(line => bareInline(line)
      .replace(/^#{1,6}\s+/, '').replace(/^>\s?/, '').replace(/^[-+*]\s+(?:\[[ xX]\]\s+)?/, '')
      .replace(/^\d+[.)]\s+/, '').replace(/^\[!(?:note|tip|info|warning|important|success|quote)\]/i, '')
    ).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  root.OberonMarkdown = Object.freeze({ render, headings, wikiLinks, plainText, rewriteLinks });
})(typeof window !== 'undefined' ? window : globalThis);
