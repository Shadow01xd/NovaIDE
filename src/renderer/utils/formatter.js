// src/renderer/utils/formatter.js
/**
 * Sistema de formateo propio básico para JS, HTML y CSS.
 */

export async function formatCode(code, languageId) {
  switch (languageId) {
    case 'javascript':
    case 'typescript':
      return formatJS(code)
    case 'html':
      return formatHTML(code)
    case 'css':
      return formatCSS(code)
    default:
      return code // No soportado
  }
}

function formatJS(code) {
  // Simple beautifier logic: indentation and spacing
  let indent = 0
  const lines = code.split('\n')
  return lines.map(line => {
    line = line.trim()
    if (line.endsWith('}') || line.startsWith('}')) indent = Math.max(0, indent - 1)
    const formatted = '  '.repeat(indent) + line
    if (line.endsWith('{') || line.startsWith('{')) indent++
    return formatted
  }).join('\n')
}

function formatHTML(code) {
  let indent = 0
  const lines = code.replace(/>\s*</g, '>\n<').split('\n')
  return lines.map(line => {
    line = line.trim()
    if (line.startsWith('</')) indent = Math.max(0, indent - 1)
    const formatted = '  '.repeat(indent) + line
    if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') && !line.includes('</')) {
      // Evitar incrementar para tags autoconclusivos o de una sola línea
      const tag = line.match(/^<([a-zA-Z0-9]+)/)?.[1]
      const selfClosing = ['img', 'br', 'hr', 'input', 'link', 'meta'].includes(tag)
      if (!selfClosing) indent++
    }
    return formatted
  }).join('\n')
}

function formatCSS(code) {
  let indent = 0
  const lines = code.split('\n').flatMap(l => l.split(/({|}|;)/)).filter(l => l.trim())
  return lines.map(line => {
    line = line.trim()
    if (line === '}') indent = Math.max(0, indent - 1)
    const formatted = '  '.repeat(indent) + line
    if (line === '{') indent++
    return formatted
  }).join('\n').replace(/;\n/g, ';\n').replace(/{\n/g, ' {\n')
}
