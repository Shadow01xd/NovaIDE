// src/renderer/components/sidebar-new.js
/**
 * Nuevo sidebar con FileManager integrado
 * Reemplaza al sidebar.js original
 */
import { FileManager } from './file-manager.js'
import { ExtensionStore } from './extensions-store.js'

export function createSidebar(container, state) {
  let fileManager = null
  let extStoreInstance = null
  let searchPanel = null
  
  // Renderizar estructura del sidebar
  container.innerHTML = `
    <div class="sidebar-icons">
      <button class="sidebar-icon-btn active" data-panel="explorer" title="Explorador (Ctrl+Shift+E)">
        <svg viewBox="0 0 16 16" fill="currentColor" width="22" height="22">
          <path d="M1.5 1h5.563l4 4H14.5A1.5 1.5 0 0 1 16 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-11A1.5 1.5 0 0 1 1.5 1zM1 2.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5H6.5l-4-4H1.5a.5.5 0 0 0-.5.5z"/>
        </svg>
      </button>
      <button class="sidebar-icon-btn" data-panel="search" title="Buscar (Ctrl+Shift+F)">
        <svg viewBox="0 0 16 16" fill="currentColor" width="22" height="22">
          <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
        </svg>
      </button>
      <button class="sidebar-icon-btn" data-panel="extensions" title="Extensiones (Ctrl+Shift+X)">
        <svg viewBox="0 0 16 16" fill="currentColor" width="22" height="22">
          <path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.366A2.519 2.519 0 0 1 13 4.5z"/>
        </svg>
      </button>
    </div>

    <!-- Panel: Explorador (con FileManager) -->
    <div class="sidebar-panel" id="panel-explorer">
      <div class="fm-container" id="fm-container"></div>
    </div>

    <!-- Panel: Búsqueda -->
    <div class="sidebar-panel" id="panel-search" style="display:none">
      <div class="sidebar-header">
        <span>BUSCAR EN ARCHIVOS</span>
      </div>
      <div class="search-panel">
        <input type="text" id="search-query" class="search-input" placeholder="Buscar…"/>
        <input type="text" id="search-replace" class="search-input" placeholder="Reemplazar…" style="margin-top:6px"/>
        <div class="search-opts">
          <label><input type="checkbox" id="search-case"/> Aa</label>
          <label><input type="checkbox" id="search-regex"/> .*</label>
          <label><input type="checkbox" id="search-word"/> W</label>
        </div>
        <div id="search-results" class="search-results"></div>
      </div>
    </div>

    <!-- Panel: Extensiones -->
    <div class="sidebar-panel" id="panel-extensions" style="display:none">
      <div class="sidebar-header">
        <span>EXTENSIONES</span>
      </div>
      <div id="ext-store-host" style="flex:1;overflow:hidden;display:flex;flex-direction:column;height:100%"></div>
    </div>
  `

  // ── Función central de switch de paneles ──────────────────────────────
  function switchPanel(panelId) {
    // Actualizar botones activos
    container.querySelectorAll('.sidebar-icon-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.panel === panelId)
    })

    // Ocultar todos los paneles
    container.querySelectorAll('.sidebar-panel').forEach(p => {
      p.style.display = 'none'
    })

    // Mostrar el panel objetivo
    const target = document.getElementById(`panel-${panelId}`)
    if (target) target.style.display = 'flex'

    state.sidebarPanel = panelId

    // Inicializar tienda de extensiones la primera vez
    if (panelId === 'extensions' && !extStoreInstance) {
      const host = document.getElementById('ext-store-host')
      if (host) {
        try {
          extStoreInstance = new ExtensionStore(host, state)
          extStoreInstance.mount()
        } catch (error) {
          console.error('Failed to initialize ExtensionStore:', error)
          // Fallback: mostrar un mensaje de error
          host.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text1);">
              <h3 style="color: var(--text0); margin-bottom: 10px;">Error al cargar tienda de extensiones</h3>
              <p style="font-size: 12px;">No se pudo inicializar la tienda de extensiones.</p>
              <p style="font-size: 11px; color: var(--text2); margin-top: 10px;">Error: ${error.message}</p>
            </div>
          `
        }
      }
    }

    // Focus en búsqueda al abrir
    if (panelId === 'search') {
      setTimeout(() => document.getElementById('search-query')?.focus(), 50)
    }
  }

  // ── Click en iconos de sidebar ────────────────────────────────────────
  container.querySelectorAll('.sidebar-icon-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPanel(btn.dataset.panel))
  })

  // ── Escuchar eventos externos ─────────────────────────────────────────
  state.on('panelToggle', ({ panel }) => {
    if (panel === 'search' || panel === 'extensions') switchPanel(panel)
  })

  // ── Inicializar FileManager ─────────────────────────────────────────────
  function initFileManager() {
    const fmContainer = document.getElementById('fm-container')
    fileManager = new FileManager(fmContainer, {
      showHidden: false,
      enableAnimations: true
    })

    // Configurar callbacks
    fileManager.setCallbacks({
      onFileOpen: (filePath, content, language) => {
        // Abrir archivo en Monaco Editor
        state.openFile(filePath, content)
      },
      onFolderChange: (folderPath) => {
        // Actualizar estado global
        state.currentFolder = folderPath
        state.emit('folderChanged', folderPath)
      },
      onFileSave: (filePath, content) => {
        // Guardar archivo (implementar si es necesario)
        window.api.saveFile(filePath, content)
      }
    })

    // Cargar carpeta actual si existe
    if (state.currentFolder) {
      fileManager.loadProject(state.currentFolder)
    }
  }

  // ── Búsqueda en archivos ──────────────────────────────────────────────
  function initSearchPanel() {
    let searchTimeout
    
    const searchQuery = document.getElementById('search-query')
    const searchResults = document.getElementById('search-results')
    
    if (!searchQuery || !searchResults) return

    searchQuery.addEventListener('input', (e) => {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => runSearch(e.target.value), 400)
    })

    async function runSearch(query) {
      if (!query.trim()) { 
        searchResults.innerHTML = ''; 
        return 
      }
      
      searchResults.innerHTML = '<div class="searching">Buscando…</div>'

      const caseSensitive = document.getElementById('search-case')?.checked || false
      const useRegex      = document.getElementById('search-regex')?.checked || false
      const wholeWord     = document.getElementById('search-word')?.checked || false
      const matches       = []

      for (const tab of state.openTabs) {
        const lines = (tab.content || '').split('\n')
        lines.forEach((line, i) => {
          let hit = false
          try {
            if (useRegex)      hit = new RegExp(query, caseSensitive ? '' : 'i').test(line)
            else if (wholeWord) hit = new RegExp(`\\b${query}\\b`, caseSensitive ? '' : 'i').test(line)
            else               hit = caseSensitive ? line.includes(query) : line.toLowerCase().includes(query.toLowerCase())
          } catch {}
          if (hit) matches.push({ file: tab.path, line: i + 1, text: line.trim() })
        })
      }

      if (matches.length === 0) { 
        searchResults.innerHTML = '<div class="no-results">Sin resultados en archivos abiertos</div>'; 
        return 
      }
      
      searchResults.innerHTML = ''
      const grouped = {}
      matches.forEach(m => { ;(grouped[m.file] ??= []).push(m) })

      Object.entries(grouped).forEach(([file, ms]) => {
        const fileEl = document.createElement('div')
        fileEl.className = 'search-file'
        fileEl.textContent = file.split(/[/\\]/).pop()
        searchResults.appendChild(fileEl)
        
        ms.slice(0, 10).forEach(m => {
          const lineEl = document.createElement('div')
          lineEl.className = 'search-match'
          lineEl.innerHTML = `<span class="search-line-num">${m.line}</span><span>${escapeHtml(m.text.slice(0,80))}</span>`
          lineEl.addEventListener('click', async () => {
            const content = await window.api.readFile(m.file)
            state.openFile(m.file, content)
            setTimeout(() => {
              state.editorInstance?.revealLineInCenter(m.line)
              state.editorInstance?.setPosition({ lineNumber: m.line, column: 1 })
            }, 150)
          })
          searchResults.appendChild(lineEl)
        })
      })
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }
  }

  // ── Eventos globales ───────────────────────────────────────────────────
  state.on('menu:openFolder', async () => {
    const folder = await window.api.openFolder()
    if (folder && fileManager) {
      await fileManager.loadProject(folder)
    }
  })

  state.on('refreshTree', () => {
    if (fileManager) {
      fileManager.refreshTree()
    }
  })

  // ── Inicialización ─────────────────────────────────────────────────────
  initFileManager()
  initSearchPanel()

  // ── API pública ────────────────────────────────────────────────────────
  return {
    fileManager,
    switchPanel,
    refreshTree: () => fileManager?.refreshTree(),
    loadProject: (folderPath) => fileManager?.loadProject(folderPath),
    getActiveFile: () => fileManager?.getActiveFile()
  }
}
