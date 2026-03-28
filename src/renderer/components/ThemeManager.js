// src/renderer/components/ThemeManager.js
// Gestor central de temas para NVCode

/**
 * Clase ThemeManager - Gestiona los temas de la interfaz y Monaco Editor
 * 
 * Responsabilidades:
 * - Definir y registrar temas en Monaco Editor
 * - Aplicar temas a la UI mediante CSS variables
 * - Persistir selección en localStorage
 * - Detección de tema del sistema operativo
 */
export class ThemeManager {
  constructor() {
    // Definición de los temas disponibles
    this.themes = {
      dark: {
        id: 'dark',
        name: 'Tema Oscuro',
        icon: '🌙',
        description: 'Tema oscuro clásico para desarrolladores',
        monacoTheme: 'nvcode-dark',
        isDefault: true
      },
      light: {
        id: 'light',
        name: 'Tema Claro',
        icon: '☀️',
        description: 'Tema claro para trabajo diurno',
        monacoTheme: 'nvcode-light',
        isDefault: false
      },
      'high-contrast': {
        id: 'high-contrast',
        name: 'Alto Contraste',
        icon: '⚡',
        description: 'Alto contraste para accesibilidad',
        monacoTheme: 'nvcode-high-contrast',
        isDefault: false
      }
    }

    // Estado actual
    this.currentTheme = null
    this.monacoReady = false
    this.listeners = new Set()

    // Claves para localStorage
    this.STORAGE_KEY = 'nvcode-theme'
    this.SYSTEM_DETECTION_KEY = 'nvcode-system-theme-enabled'

    // Inicialización diferida
    this.initPromise = null
  }

  /**
   * Inicialización asíncrona del gestor de temas
   */
  async init() {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._doInit()
    return this.initPromise
  }

  async refreshExtensions() {
    await this._loadExtensionThemes();
  }

  async _doInit() {
    try {
      // Esperar a que Monaco esté disponible
      await this._waitForMonaco()

      // Registrar temas en Monaco
      this._registerMonacoThemes()

      // Cargar tema guardado o detectar del sistema
      await this._loadSavedTheme()

      // Cargar temas de extensiones
      await this._loadExtensionThemes()

      // Aplicar tema inicial
      this.applyTheme(this.currentTheme)

      console.log(`ThemeManager inicializado con tema: ${this.currentTheme}`)
    } catch (error) {
      console.error('Error al inicializar ThemeManager:', error)
      // Fallback a tema oscuro
      this.currentTheme = 'dark'
      this.applyTheme('dark')
    }
  }

  /**
   * Espera a que Monaco Editor esté disponible
   */
  async _waitForMonaco() {
    if (window.monaco) {
      this.monacoReady = true
      return
    }

    return new Promise((resolve) => {
      const checkMonaco = () => {
        if (window.monaco) {
          this.monacoReady = true
          resolve()
        } else {
          setTimeout(checkMonaco, 100)
        }
      }
      checkMonaco()
    })
  }

  /**
   * Registra los tres temas en Monaco Editor
   */
  _registerMonacoThemes() {
    if (!this.monacoReady) {
      console.warn('Monaco no está disponible para registrar temas')
      return
    }

    const monaco = window.monaco

    // Tema Oscuro
    monaco.editor.defineTheme('nvcode-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6e7681', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: 'f2cc60' },
        { token: 'type', foreground: 'ffa657' },
        { token: 'function', foreground: 'd2a8ff' },
        { token: 'variable', foreground: 'e6edf3' },
        { token: 'class', foreground: 'ffa657' },
        { token: 'decorator', foreground: 'f97583' },
        { token: 'identifier', foreground: 'e6edf3' },
        { token: 'regexp', foreground: '7ee787' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#cccccc',
        'editor.lineHighlightBackground': '#2d2d30',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#cccccc',
        'editorCursor.foreground': '#aeafad',
        'editor.selectionBackground': '#264f78',
        'editor.inactiveSelectionBackground': '#3a3d41',
        'editorWhitespace.foreground': '#404040',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
        'editor.findMatchBackground': '#515c6a',
        'editor.findMatchHighlightBackground': '#ea5c0055',
        'editorHoverHighlightBackground': '#264f7844',
        'editor.lineHighlightBorder': '#282828',
        'editorWidget.background': '#252526',
        'editorWidget.border': '#3e3e42',
        'editorSuggestWidget.background': '#252526',
        'editorSuggestWidget.border': '#3e3e42',
        'editorSuggestWidget.selectedBackground': '#094771',
        'quickInput.background': '#252526',
        'quickInput.foreground': '#cccccc',
        'quickInputList.focusBackground': '#062f4a',
        'quickInputList.focusForeground': '#cccccc',
        'minimap.background': '#1e1e1e',
        'minimap.selectionHighlight': '#264f78',
        'minimap.errorHighlight': '#f48771',
        'minimap.warningHighlight': '#ffcc02',
        'minimap.infoHighlight': '#75beff',
        'problemsErrorIcon.foreground': '#f48771',
        'problemsWarningIcon.foreground': '#ffcc02',
        'problemsInfoIcon.foreground': '#75beff',
      }
    })

    // Tema Claro
    monaco.editor.defineTheme('nvcode-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0000ff' },
        { token: 'string', foreground: 'a31515' },
        { token: 'number', foreground: '098658' },
        { token: 'type', foreground: '267f99' },
        { token: 'function', foreground: '795e26' },
        { token: 'variable', foreground: '001080' },
        { token: 'class', foreground: '267f99' },
        { token: 'decorator', foreground: 'af00db' },
        { token: 'identifier', foreground: '001080' },
        { token: 'regexp', foreground: '0451a5' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#333333',
        'editor.lineHighlightBackground': '#f0f0f0',
        'editorLineNumber.foreground': '#237893',
        'editorLineNumber.activeForeground': '#333333',
        'editorCursor.foreground': '#000000',
        'editor.selectionBackground': '#add6ff',
        'editor.inactiveSelectionBackground': '#e5ebf1',
        'editorWhitespace.foreground': '#d4d4d4',
        'editorIndentGuide.background': '#d4d4d4',
        'editorIndentGuide.activeBackground': '#939393',
        'editor.findMatchBackground': '#a8d5ff',
        'editor.findMatchHighlightBackground': '#ea5c0055',
        'editorHoverHighlightBackground': '#add6ff44',
        'editor.lineHighlightBorder': '#eeeeee',
        'editorWidget.background': '#f3f3f3',
        'editorWidget.border': '#d4d4d4',
        'editorSuggestWidget.background': '#f3f3f3',
        'editorSuggestWidget.border': '#d4d4d4',
        'editorSuggestWidget.selectedBackground': '#d6ebff',
        'quickInput.background': '#f3f3f3',
        'quickInput.foreground': '#333333',
        'quickInputList.focusBackground': '#cce5ff',
        'quickInputList.focusForeground': '#333333',
        'minimap.background': '#ffffff',
        'minimap.selectionHighlight': '#add6ff',
        'minimap.errorHighlight': '#ff0000',
        'minimap.warningHighlight': '#ff8c00',
        'minimap.infoHighlight': '#0066cc',
        'problemsErrorIcon.foreground': '#ff0000',
        'problemsWarningIcon.foreground': '#ff8c00',
        'problemsInfoIcon.foreground': '#0066cc',
      }
    })

    // Tema Alto Contraste
    monaco.editor.defineTheme('nvcode-high-contrast', {
      base: 'hc-black',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '7ca668', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569cd6' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'variable', foreground: '9cdcfe' },
        { token: 'class', foreground: '4ec9b0' },
        { token: 'decorator', foreground: 'c586c0' },
        { token: 'identifier', foreground: '9cdcfe' },
        { token: 'regexp', foreground: 'd16969' },
      ],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#ffff00',
        'editor.lineHighlightBackground': '#333333',
        'editorLineNumber.foreground': '#ffffff',
        'editorLineNumber.activeForeground': '#ffff00',
        'editorCursor.foreground': '#ffffff',
        'editor.selectionBackground': '#1e90ff',
        'editor.inactiveSelectionBackground': '#333333',
        'editorWhitespace.foreground': '#666666',
        'editorIndentGuide.background': '#666666',
        'editorIndentGuide.activeBackground': '#ffffff',
        'editor.findMatchBackground': '#1e90ff',
        'editor.findMatchHighlightBackground': '#ff00ff55',
        'editorHoverHighlightBackground': '#1e90ff44',
        'editor.lineHighlightBorder': '#ffffff',
        'editorWidget.background': '#000000',
        'editorWidget.border': '#ffffff',
        'editorSuggestWidget.background': '#000000',
        'editorSuggestWidget.border': '#ffffff',
        'editorSuggestWidget.selectedBackground': '#1e90ff',
        'quickInput.background': '#000000',
        'quickInput.foreground': '#ffff00',
        'quickInputList.focusBackground': '#1e90ff',
        'quickInputList.focusForeground': '#000000',
        'minimap.background': '#000000',
        'minimap.selectionHighlight': '#1e90ff',
        'minimap.errorHighlight': '#ff0000',
        'minimap.warningHighlight': '#ffff00',
        'minimap.infoHighlight': '#00ffff',
        'problemsErrorIcon.foreground': '#ff0000',
        'problemsWarningIcon.foreground': '#ffff00',
        'problemsInfoIcon.foreground': '#00ffff',
      }
    })

    console.log('Temas de Monaco registrados correctamente')
  }

  /**
   * Carga el tema guardado o detecta el del sistema
   */
  async _loadSavedTheme() {
    try {
      // Intentar cargar desde localStorage
      const savedTheme = localStorage.getItem(this.STORAGE_KEY)

      if (savedTheme && this.themes[savedTheme]) {
        this.currentTheme = savedTheme
        return
      }

      // Detectar tema del sistema si no hay tema guardado
      const systemTheme = this._detectSystemTheme()
      this.currentTheme = systemTheme

      // Guardar tema detectado
      this._saveTheme(systemTheme)
    } catch (error) {
      console.error('Error al cargar tema guardado:', error)
      this.currentTheme = 'dark' // Fallback
    }
  }

  /**
   * Detecta el tema del sistema operativo
   */
  _detectSystemTheme() {
    try {
      // Verificar preferencia del sistema
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light'
      }

      // Verificar si hay modo alto contraste
      if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
        return 'high-contrast'
      }

      return 'dark' // Default
    } catch (error) {
      console.warn('No se pudo detectar tema del sistema:', error)
      return 'dark'
    }
  }

  /**
   * Aplica un tema a toda la interfaz
   */
  applyTheme(themeId) {
    if (!this.themes[themeId]) {
      console.error(`Tema no válido: ${themeId}`)
      return false
    }

    try {
      // Aplicar tema a la UI mediante data-theme
      this._applyUITheme(themeId)

      // Aplicar tema a Monaco si está disponible
      if (this.monacoReady) {
        this._applyMonacoTheme(themeId)
      }

      // Actualizar estado
      this.currentTheme = themeId

      // Guardar en localStorage
      this._saveTheme(themeId)

      // Notificar a listeners
      this._notifyListeners(themeId)

      console.log(`Tema aplicado: ${themeId}`)
      return true
    } catch (error) {
      console.error(`Error al aplicar tema ${themeId}:`, error)
      return false
    }
  }

  /**
   * Aplica tema a la UI mediante CSS variables
   */
  _applyUITheme(themeId) {
    // Remover tema anterior
    document.documentElement.removeAttribute('data-theme')

    // Aplicar nuevo tema
    document.documentElement.setAttribute('data-theme', themeId)

    // Si es un tema de extensión, aplicar colores dinámicos
    const theme = this.themes[themeId]
    if (theme && theme.isExtension && theme.originalData && theme.originalData.colors) {
      this._applyExtensionUIColors(theme.originalData.colors)
    } else {
      // Limpiar colores dinámicos si volvemos a un tema interno
      this._clearExtensionUIColors()
    }

    // Forzar reflow para asegurar aplicación inmediata
    document.documentElement.offsetHeight
  }

  _applyExtensionUIColors(colors) {
    console.log('[ThemeManager] Applying extension UI colors:', colors)
    let styleEl = document.getElementById('dynamic-theme-vars')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'dynamic-theme-vars'
      document.head.appendChild(styleEl)
    }

    const mapping = {
      // Editor core
      '--editor-bg': colors['editor.background'],
      '--editor-fg': colors['editor.foreground'],
      '--editor-line-highlight': colors['editor.lineHighlightBackground'],
      '--editor-selection': colors['editor.selectionBackground'],
      
      // UI backgrounds
      '--ui-bg': colors['sideBar.background'] || colors['editorWidget.background'] || colors['activityBar.background'] || colors['editor.background'],
      '--ui-bg-secondary': colors['list.hoverBackground'] || colors['editorGroupHeader.tabsBackground'] || colors['sideBarSectionHeader.background'],
      '--ui-bg-tertiary': colors['list.activeSelectionBackground'] || colors['activityBar.activeBackground'] || colors['button.hoverBackground'],
      
      // Borders
      '--ui-border': colors['sideBar.border'] || colors['editorGroup.border'] || colors['panel.border'] || colors['widget.border'] || colors['border'] || 'rgba(128, 128, 128, 0.35)',
      '--ui-border-hover': colors['focusBorder'] || colors['button.background'],
      
      // Text
      '--text-primary': colors['foreground'] || colors['editor.foreground'] || '#cccccc',
      '--text-secondary': colors['descriptionForeground'] || colors['sideBar.foreground'] || '#999999',
      '--text-tertiary': colors['disabledForeground'] || '#666666',
      
      // Accent
      '--accent': colors['activityBarBadge.background'] || colors['button.background'] || colors['progressBar.background'] || '#007acc',
      '--accent-hover': colors['button.hoverBackground'] || '#1e8acc',
      
      // Specific panels
      '--sidebar-bg': colors['sideBar.background'] || colors['editorWidget.background'] || colors['editor.background'],
      '--tab-bg': colors['tab.inactiveBackground'] || colors['editorGroupHeader.tabsBackground'],
      '--tab-active': colors['tab.activeBackground'] || colors['editor.background'],
      '--terminal-bg': colors['terminal.background'] || colors['editor.background'],
      '--terminal-fg': colors['terminal.foreground'] || colors['editor.foreground'],
      '--ai-bg': colors['editorWidget.background'] || colors['sideBar.background'] || colors['editor.background'],
      '--ai-border': colors['sideBar.border'] || colors['editorGroup.border'] || 'rgba(128, 128, 128, 0.35)',
    }

    let css = ':root, [data-theme] {\n'
    let count = 0
    for (const [variable, value] of Object.entries(mapping)) {
      if (value) {
        css += `  ${variable}: ${value} !important;\n`
        count++
      }
    }
    css += '}'

    console.log(`[ThemeManager] Injected ${count} CSS variables:`, css)
    styleEl.textContent = css
  }

  _clearExtensionUIColors() {
    const styleEl = document.getElementById('dynamic-theme-vars')
    if (styleEl) {
      styleEl.textContent = ''
    }
  }

  /**
   * Aplica tema a Monaco Editor
   */
  _applyMonacoTheme(themeId) {
    if (!this.monacoReady) {
      console.warn('Monaco no está disponible para aplicar tema')
      return
    }

    const theme = this.themes[themeId]
    const monaco = window.monaco

    // Aplicar tema a todas las instancias del editor
    monaco.editor.setTheme(theme.monacoTheme)
  }

  /**
   * Guarda tema en localStorage
   */
  _saveTheme(themeId) {
    try {
      localStorage.setItem(this.STORAGE_KEY, themeId)
    } catch (error) {
      console.error('Error al guardar tema:', error)
    }
  }

  /**
   * Notifica a todos los listeners del cambio de tema
   */
  _notifyListeners(themeId) {
    this.listeners.forEach(callback => {
      try {
        callback(themeId, this.themes[themeId])
      } catch (error) {
        console.error('Error en listener de tema:', error)
      }
    })
  }

  /**
   * Obtiene lista de temas disponibles
   */
  getThemes() {
    return Object.values(this.themes)
  }

  /**
   * Obtiene tema actual
   */
  getCurrentTheme() {
    return this.currentTheme ? this.themes[this.currentTheme] : null
  }

  /**
   * Agrega listener para cambios de tema
   */
  addThemeChangeListener(callback) {
    this.listeners.add(callback)

    // Retornar función para remover listener
    return () => {
      this.listeners.delete(callback)
    }
  }

  /**
   * Remueve listener de cambios de tema
   */
  removeThemeChangeListener(callback) {
    this.listeners.delete(callback)
  }

  /**
   * Cicla al siguiente tema
   */
  cycleTheme() {
    const themeIds = Object.keys(this.themes)
    const currentIndex = themeIds.indexOf(this.currentTheme)
    const nextIndex = (currentIndex + 1) % themeIds.length
    const nextTheme = themeIds[nextIndex]

    this.applyTheme(nextTheme)
    return nextTheme
  }

  /**
   * Carga temas desde las extensiones instaladas
   */
  async _loadExtensionThemes() {
    try {
      const contributions = await window.api.getExtensionContributions();
      if (!contributions || !contributions.themes) return;

      for (const themeInfo of contributions.themes) {
        try {
          const themeData = await window.api.readExtensionFile(themeInfo.path);
          this._registerExtensionTheme(themeInfo, themeData);
        } catch (e) {
          console.error(`Error loading extension theme ${themeInfo.label}:`, e);
        }
      }
    } catch (error) {
      console.error('Error fetching extension contributions:', error);
    } finally {
      document.dispatchEvent(new CustomEvent('themes:updated'));
    }
  }

  _registerExtensionTheme(info, data) {
    const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const themeId = `ext-${slugify(info.extensionId)}-${slugify(info.label)}`;
    
    // Evitar duplicados
    if (this.themes[themeId]) return;

    const monacoThemeName = `monaco-${themeId}`;
    const monacoTheme = this._mapVSCodeToMonaco(data);
    
    // Registrar en Monaco
    if (this.monacoReady) {
        window.monaco.editor.defineTheme(monacoThemeName, monacoTheme);
    }

    this.themes[themeId] = {
      id: themeId,
      name: info.label,
      icon: '🎨',
      description: `Extension theme by ${info.publisher}`,
      monacoTheme: monacoThemeName,
      isExtension: true,
      originalData: data
    };
    
    // Si este era el tema guardado, lo aplicamos de nuevo ahora que está registrado
    const savedTheme = localStorage.getItem(this.STORAGE_KEY);
    if (savedTheme === themeId) {
        this.applyTheme(themeId);
    }
  }

  _mapVSCodeToMonaco(vsData) {
    const base = vsData.type === 'light' ? 'vs' : (vsData.type === 'hc' ? 'hc-black' : 'vs-dark');
    
    const rules = [];
    if (vsData.tokenColors && Array.isArray(vsData.tokenColors)) {
      vsData.tokenColors.forEach(tc => {
        const scopes = Array.isArray(tc.scope) ? tc.scope : [tc.scope];
        const settings = tc.settings;
        if (!settings) return;

        scopes.forEach(scope => {
          if (!scope) return;
          rules.push({
            token: this._mapScopeToToken(scope),
            foreground: settings.foreground,
            background: settings.background,
            fontStyle: settings.fontStyle
          });
        });
      });
    }

    return {
      base: base,
      inherit: true,
      rules: rules,
      colors: vsData.colors || {}
    };
  }

  _mapScopeToToken(scope) {
    // Mapeo básico de scopes de TextMate a tokens de Monaco
    if (scope.includes('comment')) return 'comment';
    if (scope.includes('string')) return 'string';
    if (scope.includes('keyword')) return 'keyword';
    if (scope.includes('number')) return 'number';
    if (scope.includes('type')) return 'type';
    if (scope.includes('function')) return 'function';
    if (scope.includes('variable')) return 'variable';
    if (scope.includes('constant')) return 'variable';
    if (scope.includes('class')) return 'type';
    if (scope.includes('interface')) return 'type';
    if (scope.includes('punctuation')) return 'delimiter';
    return '';
  }

  /**
   * Obtiene tema del sistema actual
   */
  getSystemTheme() {
    return this._detectSystemTheme()
  }

  /**
   * Verifica si el tema actual coincide con el del sistema
   */
  isUsingSystemTheme() {
    return this.currentTheme === this._detectSystemTheme()
  }

  /**
   * Configura atajos de teclado para cambiar tema
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      // Ctrl+K Ctrl+T: Ciclar temas
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault()
        setTimeout(() => {
          document.addEventListener('keydown', function handler(e) {
            if (e.ctrlKey && e.key === 't') {
              e.preventDefault()
              e.stopPropagation()
              this.cycleTheme()
              document.removeEventListener('keydown', handler)
            }
          })
        }, 50)
      }
    })
  }

  /**
   * Configura listener para cambios en tema del sistema
   */
  setupSystemThemeListener() {
    if (!window.matchMedia) return

    // Listener para cambios en preferencia de color
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: light)')
    colorSchemeQuery.addEventListener('change', (e) => {
      // Solo aplicar automáticamente si el usuario no ha seleccionado explícitamente
      const hasUserPreference = localStorage.getItem(this.STORAGE_KEY)
      if (!hasUserPreference) {
        const systemTheme = e.matches ? 'light' : 'dark'
        this.applyTheme(systemTheme)
      }
    })

    // Listener para cambios en contraste
    const contrastQuery = window.matchMedia('(prefers-contrast: high)')
    contrastQuery.addEventListener('change', (e) => {
      const hasUserPreference = localStorage.getItem(this.STORAGE_KEY)
      if (!hasUserPreference && e.matches) {
        this.applyTheme('high-contrast')
      }
    })
  }
}

// Exportar instancia singleton por defecto
export const themeManager = new ThemeManager()
