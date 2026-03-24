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
  const lang = LANG_MAP[ext] || 'plaintext'
  
  // Para archivos JSX/TSX, asegurarse de que se use el modo correcto
  if (ext === 'jsx' || ext === 'tsx') {
    return lang // 'javascript' o 'typescript'
  }
  
  return lang
}

// Decoraciones de la IA (líneas añadidas/modificadas)
let aiDecorations = []

// Referencia al ThemeManager
let themeManager = null

export async function createEditor(container, state, themeMgr = null) {
  await window.monacoReady
  const monaco = window.monaco
  state.monacoRef = monaco
  
  // Guardar referencia al ThemeManager
  themeManager = themeMgr

  // ── Configuración de TypeScript/JavaScript con JSX ───────────────────────────
  setupTypeScriptAndJSX(monaco)

  // ── Configuración del Editor ────────────────────────────────────────────────
  // Los temas se gestionan a través de ThemeManager
  // No definimos temas aquí para evitar conflictos

  // Determinar tema inicial
  const initialTheme = themeManager ? themeManager.themes[themeManager.currentTheme]?.monacoTheme : 'vs-dark'
  
  const editor = monaco.editor.create(container, {
    value: '',
    language: 'plaintext',
    theme: initialTheme,
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
    inlineSuggest: { 
      enabled: true,
      showToolbar: 'always',
      keepOnBlur: true,
      showOnHover: true
    },
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
  
  // Guardar instancia global para acceso desde otros componentes
  window.__editorInstance = editor

  // ── Configurar colores para Ghost Text ─────────────────────────────────────
  // Asegurar que el ghost text sea visible
  monaco.editor.defineTheme('ghost-text-theme', {
    base: initialTheme === 'vs-dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.inlineSuggest.foreground': '#888888',
      'editor.inlineSuggest.background': '#2d2d30',
      'editorGhostText.foreground': '#888888',
      'editorGhostText.background': '#2d2d30',
    }
  })
  
  // Aplicar el tema si es dark
  if (initialTheme === 'vs-dark') {
    monaco.editor.setTheme('ghost-text-theme')
  }

  // ── Proveedor de autocompletado con IA ────────────────────────────────
  registerInlineGhostProviders(monaco, state)

  // ── Comandos de prueba para Ghost Text ────────────────────────────────────
  // Trigger manual con Ctrl+Shift+I para debug
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI, () => {
    console.log('[DEBUG] Manual ghost text trigger')
    editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
  })

  // Autocompletado automático como Cursor/Windsurf - MÁS AGRESIVO
  let triggerTimer = null
  let currentRequest = null

  editor.onDidChangeModelContent((e) => {
    if (state.currentFile) state.markDirty(state.currentFile)

    console.log('[editor] Content changed:', e.changes.length, 'changes')
    
    // Activar para CUALQUIER typing - ultra permisivo
    const isTyping = e.changes?.some(ch => 
      ch.text && ch.rangeLength === 0 && ch.text.length <= 20
    )

    console.log('[editor] Is typing:', isTyping)

    if (!isTyping) return

    // Cancelar petición anterior si existe
    if (currentRequest) {
      currentRequest.cancelled = true
      currentRequest = null
    }

    clearTimeout(triggerTimer)
    triggerTimer = setTimeout(() => {
      console.log('[editor] Triggering inline completion...')
      editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
    }, 200) // Reducido a 200ms para más rapidez
  })

  // Aceptar ghost text con Tab
  editor.addCommand(monaco.KeyCode.Tab, () => {
    editor.trigger('keyboard', 'editor.action.inlineSuggest.commit', {})
  })

  // Trigger manual con Ctrl+Espacio (opcional)
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
    editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
  })

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

    setTimeout(() => {
      editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
    }, 100)
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
  
  // ── Integración con ThemeManager ────────────────────────────────────────
  if (themeManager) {
    // Escuchar cambios de tema
    themeManager.addThemeChangeListener((themeId, theme) => {
      if (monaco && editor) {
        try {
          monaco.editor.setTheme(theme.monacoTheme)
        } catch (error) {
          console.warn('Error al aplicar tema de Monaco:', error)
          // Fallback a tema por defecto
          monaco.editor.setTheme('vs-dark')
        }
      }
    })
    
    // Aplicar tema actual si ya está cargado
    if (themeManager.currentTheme && themeManager.monacoReady) {
      const currentTheme = themeManager.themes[themeManager.currentTheme]
      if (currentTheme) {
        monaco.editor.setTheme(currentTheme.monacoTheme)
      }
    }
  }

  return editor
}

// ── Funciones de utilidad para gestión de temas ─────────────────────────────

/**
 * Aplica un tema de Monaco al editor
 * @param {Object} editor - Instancia del editor Monaco
 * @param {string} themeId - ID del tema a aplicar
 */
export function applyEditorTheme(editor, themeId) {
  if (!editor || !window.monaco) return
  
  try {
    // Si hay ThemeManager, usarlo
    if (themeManager && themeManager.themes[themeId]) {
      const theme = themeManager.themes[themeId]
      window.monaco.editor.setTheme(theme.monacoTheme)
    } else {
      // Fallback a temas básicos de Monaco
      const fallbackThemes = {
        'dark': 'vs-dark',
        'light': 'vs',
        'high-contrast': 'hc-black'
      }
      window.monaco.editor.setTheme(fallbackThemes[themeId] || 'vs-dark')
    }
  } catch (error) {
    console.error('Error aplicando tema al editor:', error)
  }
}

/**
 * Obtiene el tema actual del editor
 * @param {Object} editor - Instancia del editor Monaco
 * @returns {string} ID del tema actual
 */
export function getCurrentEditorTheme(editor) {
  if (!editor || !window.monaco) return 'dark'
  
  try {
    // Si hay ThemeManager, obtener tema actual
    if (themeManager) {
      return themeManager.currentTheme || 'dark'
    }
    
    // Intentar obtener desde Monaco (no siempre disponible)
    const theme = window.monaco.editor.getTheme()
    return theme || 'dark'
  } catch (error) {
    console.warn('Error obteniendo tema del editor:', error)
    return 'dark'
  }
}

/**
 * Establece el ThemeManager para el editor
 * @param {Object} themeMgr - Instancia de ThemeManager
 */
export function setThemeManager(themeMgr) {
  themeManager = themeMgr
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

// ── Configuración de TypeScript/JavaScript con JSX ─────────────────────────────
function setupTypeScriptAndJSX(monaco) {
  // Configuración de TypeScript compiler options
  const tsCompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    allowJs: true,
    checkJs: false,
    strict: true,
    noImplicitAny: false, // Reducir errores para mejor experiencia
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    isolatedModules: true,
    declaration: false,
    sourceMap: true,
  }

  // Aplicar configuración a TypeScript y JavaScript
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    ...tsCompilerOptions,
    allowJs: true,
    checkJs: false,
  })

  // Agregar tipos de React como extraLibs
  const reactTypes = {
    // React types básicos
    'react.d.ts': `
      declare namespace React {
        interface FunctionComponent<P = {}> {
          (props: P): JSX.Element | null;
          displayName?: string;
        }
        
        interface ComponentClass<P = {}> {
          new (props: P): Component<P>;
          displayName?: string;
        }
        
        interface Component<P = {}> {
          setState<K extends keyof P>(state: ((prevState: Readonly<P>, props: Readonly<P>) => (Pick<P, K> | P | null)) | (Pick<P, K> | P | null), callback?: () => void): void;
          forceUpdate(callback?: () => void): void;
          readonly props: Readonly<P>;
          state: Readonly<P>;
          context: any;
          refs: { [key: string]: ReactInstance };
        }
        
        interface ReactInstance {
          render(): ReactNode;
        }
        
        type ReactNode = ReactElement | string | number | ReactFragment | ReactPortal | boolean | null | undefined;
        
        interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
          type: T;
          props: P;
          key: Key | null;
        }
        
        interface ReactFragment {
          key?: Key | null;
        }
        
        interface ReactPortal {
          key: Key | null;
          children: ReactNode;
        }
        
        type Key = string | number;
        
        interface Attributes {
          key?: Key;
        }
        
        interface DOMAttributes<T> {
          children?: ReactNode;
        }
        
        interface IntrinsicAttributes extends Attributes { }
        interface IntrinsicClassAttributes<T> extends Attributes { }
        
        interface IntrinsicElements {
          [elemName: string]: DOMAttributes<any> & IntrinsicAttributes;
        }
        
        type JSXElementConstructor<P = {}> = 
          | ((props: P) => ReactElement | null)
          | (new (props: P) => Component<P>);
        
        namespace JSX {
          interface IntrinsicAttributes extends Attributes { }
          interface IntrinsicClassAttributes<T> extends Attributes { }
          interface IntrinsicElements {
            [elemName: string]: DOMAttributes<any> & IntrinsicAttributes;
          }
          interface ElementAttributesProperty { props: {}; }
          interface ElementChildrenAttribute { children: {}; }
        }
      }
      
      declare const React: {
        createElement<P extends {}>(
          type: string | FunctionComponent<P> | ComponentClass<P>,
          props?: Attributes & P,
          ...children: ReactNode[]
        ): ReactElement<P>;
        Fragment: ReactFragment;
        Component: ComponentConstructor;
        FunctionComponent: FunctionComponentConstructor;
      };
      
      type ComponentConstructor = new <P = {}>(props: P) => Component<P>;
      type FunctionComponentConstructor = <P = {}>(props: P) => ReactElement<P> | null;
      
      export = React;
    `,
    
    // React DOM types
    'react-dom.d.ts': `
      declare namespace ReactDOM {
        function render(element: React.ReactNode, container: Element): void;
        function hydrate(element: React.ReactNode, container: Element): void;
        function createPortal(children: React.ReactNode, container: Element): React.ReactPortal;
      }
      
      declare const ReactDOM: typeof ReactDOM;
      export = ReactDOM;
    `,
    
    // Global types
    'global.d.ts': `
      declare global {
        namespace JSX {
          interface IntrinsicElements {
            div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
            span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
            button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
            input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
            form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
            a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
            img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
            p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
            h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
            ol: React.DetailedHTMLProps<React.HTMLAttributes<HTMLOListElement>, HTMLOListElement>;
            li: React.DetailedHTMLProps<React.HTMLAttributes<HTMLLIElement>, HTMLLIElement>;
            table: React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
            tr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>;
            td: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
            th: React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
            section: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            nav: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            main: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            header: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            footer: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            article: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            aside: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
          }
        }
      }
      
      export {};
    `
  }

  // Agregar los tipos de React al workspace
  Object.entries(reactTypes).forEach(([filename, content]) => {
    const uri = monaco.Uri.parse(`file:///node_modules/@types/${filename}`)
    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, uri.toString())
    monaco.languages.typescript.javascriptDefaults.addExtraLib(content, uri.toString())
  })

  // Configurar diagnóstico para ignorar ciertos errores comunes
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    // Ignorar errores específicos que son comunes en desarrollo
    diagnosticCodesToIgnore: [
      2307, // Cannot find module
      2304, // Cannot find name
      1378, // '...' cannot be called
      1375, // 'await' expressions are only allowed
      7016, // Could not find a declaration file
    ]
  })

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [
      2307, // Cannot find module
      2304, // Cannot find name
      1378, // '...' cannot be called
      1375, // 'await' expressions are only allowed
      7016, // Could not find a declaration file
    ]
  })

  console.log('✅ TypeScript/JavaScript con JSX configurado correctamente')
}

// ── INLINE COMPLETION PROVIDERS (Ghost Text IA) ────────────────────────────
function registerInlineGhostProviders(monaco, state) {
  console.log('[Ghost Text] Registering aggressive inline providers...')
  
  // === INLINE COMPLETION PROVIDER (Ghost Text IA) ===
  const inlineLanguages = [
    'plaintext', 'javascript', 'typescript', 'python', 'go', 'java', 'php',
    'csharp', 'cpp', 'html', 'css', 'json', 'markdown',
    'shell', 'sql', 'yaml', 'rust', 'javascriptreact', 'typescriptreact'
  ]

  let currentRequest = null
  let lastPosition = null
  let lastSuggestion = ''
  let debounceTimer = null

  for (const lang of inlineLanguages) {
    monaco.languages.registerInlineCompletionsProvider(lang, {
      provideInlineCompletions: async (model, position, context, token) => {
        try {
          // Evitar peticiones duplicadas para la misma posición
          if (lastPosition && 
              lastPosition.lineNumber === position.lineNumber && 
              lastPosition.column === position.column) {
            if (lastSuggestion) {
              return {
                items: [{
                  insertText: lastSuggestion,
                  range: new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column
                  ),
                  command: {
                    id: 'editor.action.inlineSuggest.commit',
                    title: 'Accept'
                  },
                  isInlineCompletion: true,
                  kind: monaco.languages.CompletionItemKind.Text,
                  detail: 'AI Suggestion (cached)'
                }],
                dispose() {},
              }
            }
          }

          console.log('[Ghost Text] === AGGRESSIVE AI INLINE COMPLETION ===')
          console.log('[Ghost Text] Language:', model.getLanguageId())
          
          const line = model.getLineContent(position.lineNumber)
          const beforeCursor = line.slice(0, position.column - 1)
          
          console.log('[Ghost Text] Before cursor:', JSON.stringify(beforeCursor))

          // CONDICIONES MÁS PERMISIVAS - Activar con casi cualquier typing
          const shouldTrigger = 
            beforeCursor.trim().length >= 1 && // Mínimo 1 caracter
            !beforeCursor.includes('//') && // No en comentarios
            !beforeCursor.includes('*') && // No en comentarios de bloque
            !isInString(model, position) && // No en strings
            !beforeCursor.match(/^[\s\t]*$/) // No solo whitespace

          if (!shouldTrigger) {
            console.log('[Ghost Text] Should not trigger, skipping')
            return { items: [], dispose() {} }
          }

          // Cancelar petición anterior
          if (currentRequest) {
            currentRequest.cancelled = true
            currentRequest = null
          }

          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }

          // Debounce más corto para mayor agresividad
          return new Promise((resolve) => {
            debounceTimer = setTimeout(async () => {
              try {
                if (token.isCancellationRequested) {
                  resolve({ items: [], dispose() {} })
                  return
                }

                const totalText = model.getValue()
                const offset = model.getOffsetAt(position)

                // Contexto ampliado para mejor IA
                const contextSize = 4000 // Aumentado
                const prefix = totalText.slice(Math.max(0, offset - contextSize), offset)
                const suffix = totalText.slice(offset, Math.min(totalText.length, offset + 800))

                const language = model.getLanguageId()
                const filePath = state.currentFile || ''

                // Contexto extendido - más líneas
                const currentLineNum = position.lineNumber
                const startLine = Math.max(1, currentLineNum - 25) // Aumentado
                const endLine = Math.min(model.getLineCount(), currentLineNum + 15) // Aumentado
                
                let extendedContext = ''
                for (let i = startLine; i <= endLine; i++) {
                  const lineContent = model.getLineContent(i)
                  extendedContext += lineContent + '\n'
                }

                // Obtener API key
                let apiKey = ''
                const aiModel = state.aiModel || 'deepseek-chat'
                if (aiModel.includes('deepseek')) {
                  apiKey = localStorage.getItem('ide_deepseek_api_key') || ''
                } else if (aiModel.includes('llama') || aiModel.includes('groq')) {
                  apiKey = localStorage.getItem('ide_groq_api_key') || ''
                }

                if (!apiKey) {
                  console.log('[Ghost Text] No API key, skipping')
                  resolve({ items: [], dispose() {} })
                  return
                }

                // Crear objeto de petición
                const requestObj = { cancelled: false }
                currentRequest = requestObj

                console.log('[Ghost Text] Calling AI with extended context...')

                const suggestion = await withTimeout(
                  window.api.aiInlineComplete({
                    model: aiModel,
                    prefix,
                    suffix,
                    extendedContext,
                    language,
                    filePath,
                    currentLine: currentLineNum,
                    beforeCursor,
                    apiKey,
                  }),
                  15000 // 15 segundos para respuestas largas de IA
                )

                // Verificar si la petición fue cancelada
                if (requestObj.cancelled) {
                  console.log('[Ghost Text] Request cancelled')
                  resolve({ items: [], dispose() {} })
                  return
                }

                if (currentRequest === requestObj) {
                  currentRequest = null
                }

                if (token.isCancellationRequested) {
                  console.log('[Ghost Text] Token cancelled')
                  resolve({ items: [], dispose() {} })
                  return
                }

                console.log('[Ghost Text] AI suggestion received:', suggestion?.substring(0, 150))

                if (!suggestion || suggestion.trim().length === 0) {
                  console.log('[Ghost Text] No suggestion, returning empty')
                  resolve({ items: [], dispose() {} })
                  return
                }

                // Validación más permisiva
                if (suggestion.length > 1000) {
                  console.log('[Ghost Text] Suggestion too long, truncating')
                  // Truncar en lugar de rechazar
                  const truncated = suggestion.substring(0, 1000)
                  lastPosition = { ...position }
                  lastSuggestion = truncated
                  
                  resolve({
                    items: [{
                      insertText: truncated,
                      range: new monaco.Range(
                        position.lineNumber,
                        position.column,
                        position.lineNumber,
                        position.column
                      ),
                      command: {
                        id: 'editor.action.inlineSuggest.commit',
                        title: 'Accept'
                      },
                      isInlineCompletion: true,
                      kind: monaco.languages.CompletionItemKind.Text,
                      detail: 'AI Suggestion (truncated)'
                    }],
                    dispose() {},
                  })
                  return
                }

                // Sanitización mejorada
                const cleaned = sanitizeInlineCompletion(suggestion, beforeCursor, language)
                if (!cleaned || cleaned.trim().length === 0) {
                  console.log('[Ghost Text] Sanitization returned empty')
                  resolve({ items: [], dispose() {} })
                  return
                }

                // Guardar para caché
                lastPosition = { ...position }
                lastSuggestion = cleaned

                console.log('[Ghost Text] Final suggestion:', cleaned.substring(0, 100))

                resolve({
                  items: [{
                    insertText: cleaned,
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    ),
                    command: {
                      id: 'editor.action.inlineSuggest.commit',
                      title: 'Accept'
                    },
                    isInlineCompletion: true,
                    kind: monaco.languages.CompletionItemKind.Text,
                    detail: 'AI Suggestion'
                  }],
                  dispose() {},
                })

              } catch (err) {
                console.error('[Ghost Text] Error:', err)
                resolve({ items: [], dispose() {} })
              }
            }, 150) // Reducido a 150ms para mayor agresividad
          })

        } catch (err) {
          console.error('[Ghost Text] Provider error:', err)
          return { items: [], dispose() {} }
        }
      },
      
      freeInlineCompletions() {
        // Limpiar caché cuando se liberan completions
        lastPosition = null
        lastSuggestion = ''
      },
    })
  }
}

function sanitizeInlineCompletion(suggestion, prefix = '') {
  if (!suggestion) return ''

  console.log('[editor] sanitizeInlineCompletion input:', suggestion.substring(0, 100))

  // Limpiar sugerencia pero PRESERVAR saltos de línea para HTML
  let cleaned = suggestion
    .replace(/^```[\w-]*\n?/gm, '')
    .replace(/```$/gm, '')
    .replace(/^`+|`+$/g, '')
    .trimEnd()

  // Si es HTML, preservar estructura y saltos de línea
  if (cleaned.includes('<!DOCTYPE') || cleaned.includes('<html')) {
    console.log('[editor] HTML detected, preserving structure')
    cleaned = cleaned
      .replace(/>\s+</g, '>\n<') // Asegurar saltos entre etiquetas
      .replace(/([>])\s+/g, '$1\n') // Saltos después de cierre
      .replace(/\s+([<])/g, '\n$1') // Saltos antes de apertura
      .replace(/\n\s*\n/g, '\n') // Reducir múltiples saltos
      .trim()
  } else {
    // Para código normal, limpiar pero mantener saltos de línea lógicos
    cleaned = cleaned
      .replace(/[ \t]+/g, ' ')
      .replace(/^[ \t]+/gm, '')
      .replace(/[ \t]+$/gm, '')
      .trim()
  }

  // Evitar duplicar el prefijo
  if (prefix.endsWith(cleaned.substring(0, 50))) {
    return ''
  }

  console.log('[editor] sanitizeInlineCompletion output:', cleaned.substring(0, 100))
  return cleaned
}

// Función helper para detectar si estamos en un string
function isInString(model, position) {
  const line = model.getLineContent(position.lineNumber)
  const beforeCursor = line.slice(0, position.column - 1)
  
  let inString = false
  let stringChar = null
  let escaped = false
  
  for (let i = 0; i < beforeCursor.length; i++) {
    const char = beforeCursor[i]
    
    if (escaped) {
      escaped = false
      continue
    }
    
    if (char === '\\') {
      escaped = true
      continue
    }
    
    if ((char === '"' || char === "'") && !escaped) {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
        stringChar = null
      }
    }
  }
  
  return inString
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise
      .then(v => {
        clearTimeout(t)
        resolve(v)
      })
      .catch(err => {
        clearTimeout(t)
        reject(err)
      })
  })
}
