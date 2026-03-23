// src/renderer/state.js
export const state = {
  // Editor
  currentFile: null,
  currentFolder: null,
  openTabs: [],          // [{ path, content, saved, model }]
  editorInstance: null,
  monacoRef: null,

  // UI panels
  sidebarPanel: 'explorer', // 'explorer' | 'search' | 'extensions'
  terminalOpen: false,
  aiPanelOpen: true,
  terminalHeight: 220,
  
  // Panel sizes
  sidebarWidth: 260,
  aiPanelWidth: 340,

  // AI
  aiModel: 'deepseek-coder',
  aiHistory: [],         // historial de conversación
  aiPendingCode: null,   // { code, lang, file }

  // Settings
  settings: {
    fontSize: 14,
    fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
    tabSize: 2,
    wordWrap: 'on',
    minimap: true,
    theme: 'myide-dark',
  },

  _listeners: {},
  on(event, fn) {
    ;(this._listeners[event] ??= []).push(fn)
    return () => this.off(event, fn)
  },
  off(event, fn) {
    this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn)
  },
  emit(event, data) {
    ;(this._listeners[event] || []).forEach(fn => fn(data))
  },

  // ── Tab management ──────────────────────────────────────────────────────
  openFile(filePath, content) {
    const exists = this.openTabs.find(t => t.path === filePath)
    if (!exists) {
      this.openTabs.push({ path: filePath, content, saved: true, model: null })
    }
    this.currentFile = filePath
    this.emit('fileOpened', { filePath, content })
    this.emit('tabsChanged', this.openTabs)
  },

  closeTab(filePath) {
    const idx = this.openTabs.findIndex(t => t.path === filePath)
    this.openTabs.splice(idx, 1)
    if (this.currentFile === filePath) {
      this.currentFile = this.openTabs[Math.max(0, idx - 1)]?.path || null
      if (this.currentFile) {
        const tab = this.openTabs.find(t => t.path === this.currentFile)
        this.emit('fileOpened', { filePath: this.currentFile, content: tab.content })
      } else {
        this.emit('editorClear')
      }
    }
    this.emit('tabsChanged', this.openTabs)
  },

  markDirty(filePath) {
    const tab = this.openTabs.find(t => t.path === filePath)
    if (tab && tab.saved) { tab.saved = false; this.emit('tabsChanged', this.openTabs) }
  },

  markSaved(filePath, content) {
    const tab = this.openTabs.find(t => t.path === filePath)
    if (tab) { tab.saved = true; tab.content = content; this.emit('tabsChanged', this.openTabs) }
  },

  getTab(filePath) {
    return this.openTabs.find(t => t.path === filePath)
  },
}
