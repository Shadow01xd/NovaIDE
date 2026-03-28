// src/renderer/main.js
import { state }               from './state.js'
import { createEditor }        from './components/editor.js'
import { createTabs }          from './components/tabs.js'
import { createSidebar }       from './components/sidebar-new.js'
import { createAIAgent }       from './components/ai-agent.js'
import { createTerminalPanel } from './components/terminal.js'
import { createStatusBar }     from './components/statusbar.js'
import { createExtensionsPanel } from './components/ExtensionsPanel.js'
import { DragAndDropManager }  from './components/drag-drop.js'
import { themeManager }        from './components/ThemeManager.js'
import { iconThemeManager }   from './components/IconThemeManager.js'
import { SnippetManager }     from './components/SnippetManager.js'
import { createThemeSelectorPopup } from './components/ThemeSelectorPopup.js'
import { createPreviewUrlPopup } from './components/PreviewUrlPopup.js'
import { createHistoryTimeline } from './components/history-timeline.js'
import { historyManager } from './utils/history-manager.js'
import './styles/history-timeline.css'
import './styles/terminal-new.css'

// Cargar settings guardados
const savedSettings = await window.api.getSettings()
if (savedSettings?.settings) Object.assign(state.settings, savedSettings.settings)
if (savedSettings?.aiModel)  state.aiModel = savedSettings.aiModel
if (savedSettings?.sidebarWidth) state.sidebarWidth = savedSettings.sidebarWidth
if (savedSettings?.aiPanelWidth) state.aiPanelWidth = savedSettings.aiPanelWidth
if (savedSettings?.terminalHeight) state.terminalHeight = savedSettings.terminalHeight

const STACKED_AI_BREAKPOINT = 1100
const MOBILE_BREAKPOINT = 768

// ── Layout HTML ──────────────────────────────────────────────────────────────
document.getElementById('app').innerHTML = buildLayout()

function buildLayout() {
  return `
    <div class="ide" id="ide">
      <div class="ide-sidebar" id="sidebar"></div>
      <div class="resize-handle" id="resize-sidebar"></div>
      <div class="ide-main" id="ide-main">
        <div class="ide-tabs" id="tabs"></div>
        <div class="ide-editor-wrap" id="editor-wrap">
          <div class="ide-editor" id="editor"></div>
          <div class="ide-welcome" id="welcome">${buildWelcome()}</div>
        </div>
        <div class="ide-terminal" id="terminal" style="display:none">
          <div class="resize-handle-vertical" id="resize-terminal"></div>
        </div>
      </div>
      <div class="resize-handle" id="resize-ai"></div>
      <div class="ide-ai" id="ai-panel"></div>
    </div>
    <div class="ide-statusbar" id="statusbar"></div>
  `
}

function buildWelcome() {
  // Nota: no uses backticks dentro de este string — usa entidades HTML si hace falta
  return `
    <div class="welcome-inner">
      <div class="welcome-logo">⚛</div>
      <h1 class="welcome-title">NVCode</h1>
      <p class="welcome-sub">The Next Generation AI IDE</p>
      <div class="welcome-actions">
        <button class="welcome-btn" id="wb-open">&#128193; Abrir carpeta</button>
        <button class="welcome-btn" id="wb-new">&#128196; Nuevo archivo</button>
      </div>
      <div class="welcome-shortcuts">
        <div class="ws-row"><kbd>Ctrl+L</kbd><span>Enviar c&#243;digo al chat IA</span></div>
        <div class="ws-row"><kbd>Ctrl+K</kbd><span>Edici&#243;n inline con IA</span></div>
        <div class="ws-row"><kbd>Ctrl+Ñ</kbd><span>Abrir terminal</span></div>
        <div class="ws-row"><kbd>Ctrl+Shift+F</kbd><span>Buscar en archivos</span></div>
        <div class="ws-row"><kbd>Ctrl+W</kbd><span>Cerrar tab</span></div>
      </div>
    </div>
  `
}

// ── Inicializar sistema de temas e iconos ────────────────────────────────────
await themeManager.init()
await iconThemeManager.init()

// ── Inicializar componentes ──────────────────────────────────────────────────
const sidebarElement = document.getElementById('sidebar')
createSidebar(sidebarElement, state)

// Crear popup de temas (accesible desde barra de estado)
const themePopup = createThemeSelectorPopup(themeManager)

createTabs(document.getElementById('tabs'), state)
const editor = await createEditor(document.getElementById('editor'), state, themeManager)
window.__editorInstance = editor

// Snippets
const snippetManager = new SnippetManager(window.monaco)
await snippetManager.init()
window.__snippetManager = snippetManager

createAIAgent(document.getElementById('ai-panel'), state)
createStatusBar(document.getElementById('statusbar'), state)
const previewUrlPopup = createPreviewUrlPopup(state)
createHistoryTimeline(document.getElementById('ide-main'), state)

// ── Drag and Drop Manager ────────────────────────────────────────────────────
new DragAndDropManager(state)

function getVisibleSidebarWidth() {
  const sidebarEl = document.getElementById('sidebar')
  if (!sidebarEl || sidebarEl.style.display === 'none') return 0
  return sidebarEl.offsetWidth || state.sidebarWidth || 0
}

function getMaxAiPanelWidth() {
  if (window.innerWidth <= STACKED_AI_BREAKPOINT) {
    return Math.max(0, window.innerWidth - 20)
  }

  const ideW = document.getElementById('ide')?.offsetWidth || window.innerWidth
  const sideW = getVisibleSidebarWidth()
  return Math.max(260, Math.min(560, ideW - sideW - 350 - 12))
}

function applyResponsivePanelSizing() {
  const sidebarEl = document.getElementById('sidebar')
  const aiPanelEl = document.getElementById('ai-panel')
  const terminalEl = document.getElementById('terminal')

  if (!sidebarEl || !aiPanelEl || !terminalEl) return

  if (window.innerWidth <= MOBILE_BREAKPOINT) {
    sidebarEl.style.width = '100%'
  } else {
    sidebarEl.style.width = state.sidebarWidth + 'px'
  }

  const maxAiWidth = getMaxAiPanelWidth()
  const minAiWidth = window.innerWidth <= STACKED_AI_BREAKPOINT ? 0 : 260
  const safeAiWidth = Math.max(minAiWidth, Math.min(state.aiPanelWidth, maxAiWidth))
  aiPanelEl.style.width = safeAiWidth + 'px'
  terminalEl.style.height = state.terminalHeight + 'px'
}

// ── Aplicar anchos guardados ───────────────────────────────────────────────────
applyResponsivePanelSizing()

// ── Aplicar estado inicial de paneles ───────────────────────────────────────────
document.getElementById('ai-panel').style.display = state.aiPanelOpen ? 'flex' : 'none'
document.getElementById('resize-ai').style.display = state.aiPanelOpen ? 'block' : 'none'
document.getElementById('terminal').style.display = state.terminalOpen ? 'flex' : 'none'

// ── Terminal (lazy — solo se crea al abrir) ──────────────────────────────────
let terminalCreated = false
function toggleTerminal() {
  state.terminalOpen = !state.terminalOpen
  const termEl = document.getElementById('terminal')
  termEl.style.display = state.terminalOpen ? 'flex' : 'none'
  if (state.terminalOpen && !terminalCreated) {
    terminalCreated = true
    createTerminalPanel(termEl, state)
  }
}

state.on('panelToggle', ({ panel, open }) => {
  if (panel === 'terminal') {
    document.getElementById('terminal').style.display = open ? 'flex' : 'none'
    state.terminalOpen = open
  }
})

async function ensureLiveServerRunning() {
  if (state.liveServerRunning && state.liveServerUrl) return true
  if (state.liveServerRunning && !state.liveServerUrl) {
    state.liveServerUrl = `http://localhost:${state.liveServerPort || 5500}`
    return true
  }

  const root = state.currentFolder || (state.currentFile ? await window.api.pathDirname(state.currentFile) : null)
  if (!root) return false

  try {
    const result = await window.api.liveServerStart(root, 5500)
    state.liveServerRunning = true
    state.liveServerUrl = result.url || `http://localhost:${result.port}`
    state.liveServerPort = result.port
    state.emit('liveServerChanged', { running: true, url: state.liveServerUrl, port: result.port })
    return true
  } catch (e) {
    state.liveServerRunning = false
    state.liveServerUrl = null
    console.error('[Preview] liveServerStart failed:', e)
    return false
  }
}

async function openPreviewWindow() {
  const ok = await ensureLiveServerRunning()
  if (!ok) {
    console.error('[Preview] No se pudo iniciar el servidor de preview.')
    return
  }
  
  const base = state.liveServerUrl || `http://localhost:${state.liveServerPort || 5500}`
  const f = state.currentFile
  const filename = f ? f.replace(/\\/g, '/').split('/').pop() : ''
  const url = filename ? `${base}/${filename}` : `${base}/`
  await window.api.previewWindowOpen(url)
}

state.on('previewRequested', async () => {
  try { await openPreviewWindow() } catch {}
})

// Listener para recarga del preview cuando el watcher detecta cambios
window.api.onPreviewReload(() => {
  window.api.previewWindowReload()
})

// ── Panel IA ─────────────────────────────────────────────────────────────────
function toggleAI() {
  const aiEl    = document.getElementById('ai-panel')
  const resizeEl = document.getElementById('resize-ai')
  
  if (!aiEl || !resizeEl) return
  
  state.aiPanelOpen = !state.aiPanelOpen
  aiEl.style.display    = state.aiPanelOpen ? 'flex' : 'none'
  resizeEl.style.display = state.aiPanelOpen ? 'block' : 'none'
}

function closeAI() {
  const aiEl    = document.getElementById('ai-panel')
  const resizeEl = document.getElementById('resize-ai')
  
  if (!aiEl || !resizeEl) return
  
  state.aiPanelOpen = false
  aiEl.style.display    = 'none'
  resizeEl.style.display = 'none'
}

// ── Sidebar/Explorador ───────────────────────────────────────────────────────
function toggleExplorer() {
  const sidebar = document.getElementById('sidebar')
  const resizeHandle = document.getElementById('resize-sidebar')
  const isVisible = sidebar.style.display !== 'none'
  
  if (isVisible) {
    // Minimizar sidebar
    sidebar.style.display = 'none'
    resizeHandle.style.display = 'none'
    // Guardar el ancho actual antes de ocultar
    if (!state.sidebarWidthBeforeHide) {
      state.sidebarWidthBeforeHide = sidebar.offsetWidth || state.sidebarWidth
    }
  } else {
    // Mostrar sidebar
    sidebar.style.display = 'flex'
    resizeHandle.style.display = 'block'
    // Restaurar el ancho guardado o usar el valor por defecto
    const width = state.sidebarWidthBeforeHide || state.sidebarWidth || 250
    sidebar.style.width = width + 'px'
    state.sidebarWidthBeforeHide = null
  }
}

function closeExplorer() {
  const sidebar = document.getElementById('sidebar')
  const resizeHandle = document.getElementById('resize-sidebar')
  
  // Cerrar sidebar (solo ocultar, no toggle)
  sidebar.style.display = 'none'
  resizeHandle.style.display = 'none'
  
  // Guardar el ancho actual antes de ocultar
  if (!state.sidebarWidthBeforeHide) {
    state.sidebarWidthBeforeHide = sidebar.offsetWidth || state.sidebarWidth
  }
}

// ── Welcome screen ────────────────────────────────────────────────────────────
state.on('fileOpened', () => {
  document.getElementById('welcome').style.display = 'none'
  document.getElementById('editor').style.display  = 'block'
})
state.on('editorClear', () => {
  if (state.openTabs.length === 0) {
    document.getElementById('welcome').style.display = 'flex'
    document.getElementById('editor').style.display  = 'none'
  }
})

document.getElementById('wb-open')?.addEventListener('click', async () => {
  const folder = await window.api.openFolder()
  if (folder) {
    state.currentFolder = folder
    state.emit('projectFolderChanged', folder)
    state.emit('refreshTree')
  }
})
document.getElementById('wb-new')?.addEventListener('click', () => {
  if (!state.currentFolder) {
    alert('Abre una carpeta primero (Ctrl+Shift+O)')
    return
  }
  const name = prompt('Nombre del archivo:')
  if (!name) return
  const p = state.currentFolder + '\\' + name
  window.api.createFile(p).then(() => state.openFile(p, ''))
})

// ── Menú nativo ───────────────────────────────────────────────────────────────
window.api.onMenu(async (event) => {
  switch (event) {
    case 'openFolder': {
      const folder = await window.api.openFolder()
      if (folder) { 
        state.currentFolder = folder; 
        state.emit('projectFolderChanged', folder);
        state.emit('refreshTree');
        window.api.sendProjectRoot(folder);
      }
      break
    }
    case 'newFile': {
      if (!state.currentFolder) { alert('Abre una carpeta primero'); return }
      const name = prompt('Nombre del archivo:')
      if (!name) return
      const p = state.currentFolder + '\\' + name
      await window.api.createFile(p)
      state.openFile(p, '')
      break
    }
    case 'save': {
      if (!state.currentFile || !state.editorInstance) return
      const content = state.editorInstance.getValue()
      await window.api.saveFile(state.currentFile, content)
      state.markSaved(state.currentFile, content)
      break
    }
    case 'saveAs': {
      if (!state.editorInstance) return
      const p = await window.api.saveAs(state.currentFile || 'sin-titulo.txt')
      if (!p) return
      const content = state.editorInstance.getValue()
      await window.api.saveFile(p, content)
      state.openFile(p, content)
      break
    }
    case 'toggleTerminal':   toggleTerminal(); break
    case 'toggleAI':         toggleAI();       break
    case 'closeAI':          closeAI();        break
    case 'toggleExplorer':   toggleExplorer();  break
    case 'closeExplorer':    closeExplorer();   break
    case 'toggleSearch':
      document.querySelector('[data-panel="search"]')?.click(); break
    case 'toggleExtensions':
      document.querySelector('[data-panel="extensions"]')?.click(); break
    case 'cycleTheme':
      themeManager.cycleTheme(); break
    case 'openThemeSelector':
      themeSelector?.open(); break
    case 'undo':
      state.emit('editorUndo'); break
    case 'redo':
      state.emit('editorRedo'); break
  }
})

// ── Historial: Salto de estado ────────────────────────────────────────────────
state.on('historyJump', ({ index }) => {
  const currentState = historyManager.jumpTo(state.currentFile, index)
  if (currentState && state.editorInstance) {
    // Aplicar el estado al editor (misma lógica que undo/redo)
    const ed = state.editorInstance
    const model = ed.getModel()
    if (model) {
      ed.executeEdits('history-jump', [{
        range: model.getFullModelRange(),
        text: currentState.content,
        forceMoveMarkers: true
      }])
      if (currentState.cursor) ed.setPosition(currentState.cursor)
      if (currentState.selection) ed.setSelection(currentState.selection)
      ed.revealPositionInCenter(currentState.cursor || { lineNumber: 1, column: 1 })
    }
  }
})

// ── Atajos globales ───────────────────────────────────────────────────────────
document.addEventListener('keydown', async (e) => {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return

  if (e.altKey && e.key === 'I')                  { e.preventDefault(); toggleAI(); return }
  if (e.shiftKey && e.key === 'L')                { e.preventDefault(); toggleAI(); return }
  
  const isTermKey = ['`', 'ñ', 'Ñ', ']', ';', '}'].includes(e.key) || ['Backquote', 'Semicolon', 'BracketRight'].includes(e.code);
  if (isTermKey) { e.preventDefault(); toggleTerminal(); return }
  
  if (e.key === 'b' && !e.shiftKey && !e.altKey) { e.preventDefault(); toggleExplorer(); return }
  if (e.shiftKey && e.key === 'B')                { e.preventDefault(); closeExplorer(); return }
  if (e.shiftKey && e.key === 'E')                { e.preventDefault(); document.querySelector('[data-panel="explorer"]')?.click(); return }
  if (e.shiftKey && e.key === 'F')                { e.preventDefault(); document.querySelector('[data-panel="search"]')?.click(); return }
  if (e.shiftKey && e.key === 'X')                { e.preventDefault(); document.querySelector('[data-panel="extensions"]')?.click(); return }
  
  if (e.key === 'F5' && !e.shiftKey && !e.altKey) { e.preventDefault(); openPreviewWindow(); return }
  
  // Nuevo atajo: Ctrl+Alt+F5 para proyectos Node (con popup de URL)
  if (e.key === 'F5' && e.altKey && !e.shiftKey) {
    e.preventDefault()
    previewUrlPopup.show((url) => {
      window.api.previewWindowOpen(url)
    })
    return
  }

  if (e.key === 's' && !e.shiftKey) {
    if (!state.currentFile || !state.editorInstance) return
    e.preventDefault()
    const content = state.editorInstance.getValue()
    await window.api.saveFile(state.currentFile, content)
    state.markSaved(state.currentFile, content)
    return
  }
  
  // Atajos para temas (Ctrl+K Ctrl+T)
  if (e.key === 'k') {
    e.preventDefault()
    setTimeout(() => {
      document.addEventListener('keydown', function handler(t) {
        if (t.ctrlKey && t.key === 't') {
          t.preventDefault()
          t.stopPropagation()
          themeManager.cycleTheme()
          document.removeEventListener('keydown', handler)
        }
      })
    }, 50)
    return
  }
})

// ── Resize handle del sidebar ───────────────────────────────────────────────────
const resizeSidebar = document.getElementById('resize-sidebar')
let resizingSidebar = false, startXSidebar = 0, startWSidebar = 0

function resetGlobalInteractionState() {
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.body.classList.remove('is-resizing-ai')
}

function stopAllResizing() {
  resizingSidebar = false
  resizingAI = false
  resizingTerminal = false
  resetGlobalInteractionState()
}

resizeSidebar.addEventListener('mousedown', (e) => {
  resizingSidebar = true
  startXSidebar   = e.clientX
  startWSidebar   = document.getElementById('sidebar').offsetWidth
  document.body.style.cursor    = 'ew-resize'
  document.body.style.userSelect = 'none'
})

document.addEventListener('mousemove', (e) => {
  if (!resizingSidebar) return
  const newW = Math.max(150, Math.min(600, startWSidebar + (e.clientX - startXSidebar)))
  document.getElementById('sidebar').style.width = newW + 'px'
  state.sidebarWidth = newW
})

document.addEventListener('mouseup', () => {
  if (!resizingSidebar) return
  stopAllResizing()
})

// ── Resize handle del panel IA ────────────────────────────────────────────────
const resizeAI = document.getElementById('resize-ai')
let resizingAI = false, startXAI = 0, startWAI = 0
let aiResizeFrame = null
let pendingAIWidth = null

function applyAIWidth(newW) {
  document.getElementById('ai-panel').style.width = newW + 'px'
  state.aiPanelWidth = newW
}

resizeAI.addEventListener('mousedown', (e) => {
  resizingAI = true
  startXAI   = e.clientX
  startWAI   = document.getElementById('ai-panel').offsetWidth
  document.body.classList.add('is-resizing-ai')
  document.body.style.cursor    = 'ew-resize'
  document.body.style.userSelect = 'none'
})

document.addEventListener('mousemove', (e) => {
  if (!resizingAI) return
  const ideW = document.getElementById('ide')?.offsetWidth || window.innerWidth
  const sideW = document.getElementById('sidebar')?.offsetWidth || 260
  const maxAI = Math.max(260, ideW - sideW - 350 - 12) // keep at least 350px for editor
  const newW = Math.max(260, Math.min(maxAI, startWAI + (startXAI - e.clientX)))
  pendingAIWidth = newW

  if (aiResizeFrame) return
  aiResizeFrame = window.requestAnimationFrame(() => {
    aiResizeFrame = null
    if (pendingAIWidth != null) applyAIWidth(pendingAIWidth)
  })
})

document.addEventListener('mouseup', () => {
  if (!resizingAI) return
  if (aiResizeFrame) {
    window.cancelAnimationFrame(aiResizeFrame)
    aiResizeFrame = null
  }
  if (pendingAIWidth != null) {
    applyAIWidth(pendingAIWidth)
    pendingAIWidth = null
  }
  stopAllResizing()
})

// ── Resize handle de la terminal ─────────────────────────────────────────────────
const resizeTerminal = document.getElementById('resize-terminal')
let resizingTerminal = false, startYTerminal = 0, startHTerminal = 0

resizeTerminal.addEventListener('mousedown', (e) => {
  resizingTerminal = true
  startYTerminal   = e.clientY
  startHTerminal   = document.getElementById('terminal').offsetHeight
  document.body.style.cursor    = 'ns-resize'
  document.body.style.userSelect = 'none'
  e.preventDefault()
})

document.addEventListener('mousemove', (e) => {
  if (!resizingTerminal) return
  const newH = Math.max(120, Math.min(400, startHTerminal + (startYTerminal - e.clientY)))
  document.getElementById('terminal').style.height = newH + 'px'
  state.terminalHeight = newH
})

document.addEventListener('mouseup', () => {
  if (!resizingTerminal) return
  stopAllResizing()
})

window.addEventListener('resize', () => {
  applyResponsivePanelSizing()
})

// Si se pierde el foco de la ventana o cambia visibilidad durante un resize,
// el mouseup puede no dispararse y dejar el UI en un estado roto.
window.addEventListener('blur', () => {
  if (resizingSidebar || resizingAI || resizingTerminal) stopAllResizing()
  else resetGlobalInteractionState()
})

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAllResizing()
})

// Escape: recuperar foco al editor cuando el foco se haya quedado en body/html.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
  const ae = document.activeElement
  if (ae === document.body || ae === document.documentElement || !ae) {
    if (state.editorInstance) state.editorInstance.focus()
  }
})

// ── Persistir settings ────────────────────────────────────────────────────────
window.addEventListener('beforeunload', () => {
  window.api.setSettings({ 
    settings: state.settings, 
    aiModel: state.aiModel,
    sidebarWidth: state.sidebarWidth,
    aiPanelWidth: state.aiPanelWidth,
    terminalHeight: state.terminalHeight,
    // El tema se guarda automáticamente en localStorage por ThemeManager
  })
})

// ── Configurar listeners de tema del sistema ───────────────────────────────────────
themeManager.setupSystemThemeListener()
themeManager.setupKeyboardShortcuts()

// ── Exponer ThemeManager globalmente para acceso desde otros componentes ─────────────
window.__themeManager = themeManager
window.__iconThemeManager = iconThemeManager
window.__snippetManager = snippetManager
