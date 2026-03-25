/**
 * src/renderer/utils/markdown.js
 * Centralized markdown rendering logic for NVCode.
 * Correctly handles HTML escaping and prevents double-escaping.
 */

/**
 * Safely escapes HTML special characters.
 * @param {string} s - The string to escape.
 * @returns {string} - The escaped string.
 */
export function escapeHtml(s) {
  if (typeof s !== 'string') return s;
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Renders basic markdown into HTML.
 * Handles code blocks separately to avoid double-escaping.
 * @param {string} text - The markdown text to render.
 * @returns {string} - The rendered HTML.
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // Split into parts to handle code blocks differently
  const parts = text.split(/(```[\s\S]*?```)/g);

  return parts.map(part => {
    if (part.startsWith('```')) {
      // It's a code block
      return part.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        const cleanCode = code.trim();
        const highlighted = (window.hljs)
          ? window.hljs.highlightAuto(cleanCode, lang ? [lang] : undefined).value
          : escapeHtml(cleanCode);

        return `<div class="ai-code-block">
          <div class="ai-code-header">
            <span class="ai-code-lang">${lang || 'code'}</span>
            <div class="ai-code-actions"></div>
          </div>
          <div class="ai-code-body"><pre><code class="language-${lang || 'plaintext'}">${highlighted}</code></pre></div>
        </div>`;
      });
    } else {
      // Regular text
      const trimmedPart = part.trim();
      if (!trimmedPart) return '';

      let escaped = escapeHtml(trimmedPart);

      let content = escaped
        .replace(/&lt;thought&gt;([\s\S]*?)&lt;\/thought&gt;/g, '<div class="ai-thought-block"><div class="ai-thought-header">🧠 Razonamiento</div><div class="ai-thought-content">$1</div></div>')
        .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
        .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
        .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
        .replace(/^[-*]\s(.+)$/gm, '<li>$1</li>')
        // Group consecutive <li> into <ul>
        .replace(/(<li>[\s\S]*?<\/li>(?:\s*<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

      // Clean up extra <br> inside <ul>
      content = content.replace(/<ul>([\s\S]*?)<\/ul>/g, (_, inner) => `<ul>${inner.replace(/<br>/g, '')}</ul>`);

      // Wrap in <p> if it's just raw text (doesn't start with block element)
      if (!content.startsWith('<h') && !content.startsWith('<ul') && !content.startsWith('<div')) {
        return `<p>${content}</p>`;
      }
      return content;
    }
  }).join('');
}
