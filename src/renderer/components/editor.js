// src/renderer/components/editor.js
// Monaco Editor — autocompletado, diff IA, múltiples modelos por tab

const LANG_MAP = {
  js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript',
  py:'python', rb:'ruby', go:'go', rs:'rust', cpp:'cpp', c:'cpp', cs:'csharp',
  html:'html', css:'css', scss:'scss', less:'less',
  json:'json', jsonc:'json', md:'markdown', yaml:'yaml', yml:'yaml',
  sh:'shell', bash:'shell', zsh:'shell', ps1:'powershell',
  sql:'sql', graphql:'graphql', dockerfile:'dockerfile',
  java:'java', kt:'kotlin', swift:'swift', php:'php',
  vue:'html', svelte:'html', astro:'html',
}

export function getLang(filePath) {
  if (!filePath) return 'plaintext'
  const ext = filePath.split('.').pop()?.toLowerCase()
  return LANG_MAP[ext] || 'plaintext'
}

// Decoraciones de la IA (líneas añadidas/modificadas)
let aiDecorations = []

export async function createEditor(container, state) {
  await window.monacoReady
  const monaco = window.monaco
  state.monacoRef = monaco

  // ── Tema oscuro ────────────────────────────────────────────────────────
  monaco.editor.defineTheme('myide-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment',   foreground: '6e7681', fontStyle: 'italic' },
      { token: 'keyword',   foreground: 'ff7b72' },
      { token: 'string',    foreground: 'a5d6ff' },
      { token: 'number',    foreground: 'f2cc60' },
      { token: 'type',      foreground: 'ffa657' },
      { token: 'function',  foreground: 'd2a8ff' },
      { token: 'variable',  foreground: 'e6edf3' },
      { token: 'class',     foreground: 'ffa657' },
      { token: 'decorator', foreground: 'f97583' },
    ],
    colors: {
      'editor.background':               '#0d1117',
      'editor.foreground':               '#e6edf3',
      'editor.lineHighlightBackground':  '#161b22',
      'editorLineNumber.foreground':     '#3d444d',
      'editorLineNumber.activeForeground':'#e6edf3',
      'editorCursor.foreground':         '#58a6ff',
      'editor.selectionBackground':      '#1f6feb55',
      'editor.wordHighlightBackground':  '#1f6feb33',
      'editorBracketMatch.background':   '#17375e',
      'editorBracketMatch.border':       '#58a6ff',
      'scrollbarSlider.background':      '#30363d66',
      'scrollbarSlider.hoverBackground': '#30363d99',
      'editorGutter.background':         '#0d1117',
      'editorWidget.background':         '#161b22',
      'editorSuggestWidget.background':  '#161b22',
      'editorSuggestWidget.border':      '#30363d',
      'editorSuggestWidget.selectedBackground': '#1f6feb44',
      // Colores IA diff
      'diffEditor.insertedTextBackground': '#2ea04326',
      'diffEditor.removedTextBackground':  '#f8514926',
    },
  })

  const editor = monaco.editor.create(container, {
    value: '',
    language: 'plaintext',
    theme: 'myide-dark',
    fontSize: state.settings.fontSize,
    fontFamily: state.settings.fontFamily,
    fontLigatures: true,
    minimap: { enabled: state.settings.minimap, scale: 1 },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: state.settings.tabSize,
    insertSpaces: true,
    wordWrap: state.settings.wordWrap,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'all',
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    suggest: {
      showStatusBar: true,
      preview: true,
      previewMode: 'subwordSmart',
      insertMode: 'replace',
    },
    quickSuggestions: { other: true, comments: true, strings: true },
    parameterHints: { enabled: true },
    formatOnPaste: true,
    formatOnType: false,
    renderWhitespace: 'selection',
    occurrencesHighlight: 'multiFile',
    inlineSuggest: { enabled: true },
    'semanticHighlighting.enabled': true,
    padding: { top: 12, bottom: 12 },
    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    hover: { enabled: true, delay: 300 },
    contextmenu: true,
    multiCursorModifier: 'alt',
    snippetSuggestions: 'top',
    tabCompletion: 'on',
  })

  state.editorInstance = editor

  // ── Proveedor de autocompletado con IA ────────────────────────────────
  // Se activa con Ctrl+Space cuando hay contexto suficiente
  monaco.languages.registerCompletionItemProvider('*', {
    triggerCharacters: ['.', '(', ' '],
    provideCompletionItems: async (model, position) => {
      // Solo si hay suficiente contexto (evita spam de requests)
      const lineContent = model.getLineContent(position.lineNumber)
      if (lineContent.trim().length < 3) return { suggestions: [] }

      // Completados estándar de Monaco ya están activos; esto añade IA inline
      return { suggestions: [] }  // El inline suggest se maneja por separado
    },
  })

  // ── Guardar ───────────────────────────────────────────────────────────
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
    if (!state.currentFile) return
    const content = editor.getValue()
    await window.api.saveFile(state.currentFile, content)
    state.markSaved(state.currentFile, content)
    state.emit('fileSaved', state.currentFile)
  })

  // ── Selección → AI (Ctrl+L) ───────────────────────────────────────────
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
    const sel  = editor.getSelection()
    const text = editor.getModel()?.getValueInRange(sel) || ''
    const lang = getLang(state.currentFile)
    state.aiPendingCode = text.trim() ? { code: text, lang, file: state.currentFile, selection: sel } : null
    state.emit('sendToAI', state.aiPendingCode)
    state.aiPanelOpen = true
    state.emit('panelToggle', { panel: 'ai', open: true })
  })

  // ── Inline AI suggest (Ctrl+K) — pide sugerencia de la IA ────────────
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    const sel  = editor.getSelection()
    const code = editor.getModel()?.getValueInRange(sel) || ''
    state.emit('aiInlineRequest', {
      code,
      file: state.currentFile,
      selection: sel,
      fullCode: editor.getValue(),
    })
  })

  // ── Abrir archivo ─────────────────────────────────────────────────────
  state.on('fileOpened', ({ filePath, content }) => {
    const lang = getLang(filePath)
    const uri  = monaco.Uri.parse('inmemory:///' + filePath.replace(/\\/g, '/'))
    let model  = monaco.editor.getModel(uri)
    if (!model) {
      model = monaco.editor.createModel(content, lang, uri)
    } else {
      if (model.getValue() !== content) model.setValue(content)
      monaco.editor.setModelLanguage(model, lang)
    }
    editor.setModel(model)
    // Restaurar posición del cursor si existía
    const tab = state.getTab(filePath)
    if (tab?.cursorPos) editor.setPosition(tab.cursorPos)
    editor.focus()
    // Limpiar decoraciones IA al cambiar de archivo
    clearAIDecorations()
  })

  state.on('editorClear', () => {
    editor.setModel(monaco.editor.createModel('', 'plaintext'))
    clearAIDecorations()
  })

  editor.onDidChangeModelContent(() => {
    if (state.currentFile) state.markDirty(state.currentFile)
  })

  // Guardar posición del cursor al cambiar de tab
  editor.onDidChangeCursorPosition(e => {
    const tab = state.getTab(state.currentFile)
    if (tab) tab.cursorPos = e.position
  })

  // ── Aplicar edición de la IA con decoraciones de color ───────────────
  state.on('aiApplyEdit', ({ newCode, selection }) => {
    applyAIEdit(editor, monaco, newCode, selection)
  })

  // ── Actualizar settings ───────────────────────────────────────────────
  state.on('settingsChanged', (s) => {
    editor.updateOptions({
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      tabSize: s.tabSize,
      wordWrap: s.wordWrap,
      minimap: { enabled: s.minimap },
    })
  })

  return editor
}

// ── Aplicar edición IA con highlight de cambios ────────────────────────────
export function applyAIEdit(editor, monaco, newCode, selection) {
  clearAIDecorations()

  const model = editor.getModel()
  if (!model) return

  let range, oldLines

  if (selection && !isSelectionEmpty(selection)) {
    // Reemplazar solo la selección
    range = new monaco.Range(
      selection.startLineNumber, selection.startColumn,
      selection.endLineNumber,   selection.endColumn
    )
    oldLines = selection.endLineNumber - selection.startLineNumber
  } else {
    // Reemplazar todo el archivo
    const lineCount = model.getLineCount()
    range = new monaco.Range(1, 1, lineCount, model.getLineMaxColumn(lineCount))
    oldLines = lineCount
  }

  // Aplicar edición
  editor.executeEdits('ai-edit', [{ range, text: newCode }])

  // Calcular rango de las líneas nuevas para decorar
  const startLine = range.startLineNumber
  const newLines  = newCode.split('\n').length
  const endLine   = startLine + newLines - 1

  // Decorar líneas modificadas por la IA (verde translúcido)
  const decorations = []
  for (let i = startLine; i <= endLine; i++) {
    decorations.push({
      range: new monaco.Range(i, 1, i, 1),
      options: {
        isWholeLine: true,
        className: 'ai-added-line',
        glyphMarginClassName: 'ai-glyph',
        overviewRuler: { color: '#2ea043aa', position: monaco.editor.OverviewRulerLane.Left },
      },
    })
  }

  aiDecorations = editor.deltaDecorations([], decorations)

  // Auto-limpiar las decoraciones después de 8 segundos
  setTimeout(() => clearAIDecorations(editor), 8000)
}

function clearAIDecorations(editorInst) {
  const ed = editorInst || window.__editorInstance
  if (ed && aiDecorations.length) {
    ed.deltaDecorations(aiDecorations, [])
    aiDecorations = []
  }
}

function isSelectionEmpty(sel) {
  return sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn
}
