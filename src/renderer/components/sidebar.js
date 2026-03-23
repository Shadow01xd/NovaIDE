// src/renderer/components/sidebar.js
import { ExtensionStore } from './extensions-store.js'

const FILE_ICONS = {
  js:'🟨',jsx:'⚛️',ts:'🔷',tsx:'⚛️',py:'🐍',rb:'💎',go:'🐹',rs:'🦀',
  cs:'🔵',java:'☕',php:'🐘',cpp:'⚙️',c:'⚙️',
  html:'🌐',css:'🎨',scss:'🎨',less:'🎨',
  json:'📋',jsonc:'📋',md:'📝',txt:'📄',
  sh:'⚙️',bash:'⚙️',ps1:'💙',dockerfile:'🐳',
  sql:'🗄️',yaml:'📐',yml:'📐',toml:'📐',
  png:'🖼️',jpg:'🖼️',svg:'🖼️',gif:'🖼️',
  pdf:'📕',zip:'📦',
  vue:'💚',svelte:'🧡',astro:'🚀',
  gitignore:'🚫',env:'🔒',
}

function getIcon(name, isDir, isOpen) {
  if (isDir) return isOpen ? '📂' : '📁'
  const ext = name.split('.').pop()?.toLowerCase()
  if (name.startsWith('.')) return FILE_ICONS[name.slice(1)] || '🔒'
  return FILE_ICONS[ext] || '📄'
}

function basename(p) { return p.replace(/\\/g,'/').split('/').pop() }

export function createSidebar(container, state) {
  let contextMenu = null
  let extStoreInstance = null

  container.innerHTML = `
    <div class="sidebar-icons">
      <button class="sidebar-icon-btn active" data-panel="explorer" title="Explorador (Ctrl+Shift+E)">
        <svg viewBox="0 0 16 16" fill="currentColor" width="22" height="22"><path d="M1.5 1h5.563l4 4H14.5A1.5 1.5 0 0 1 16 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 13.5v-11A1.5 1.5 0 0 1 1.5 1zM1 2.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5H6.5l-4-4H1.5a.5.5 0 0 0-.5.5z"/></svg>
      </button>
      <button class="sidebar-icon-btn" data-panel="search" title="Buscar (Ctrl+Shift+F)">
        <svg viewBox="0 0 16 16" fill="currentColor" width="22" height="22"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/></svg>
      </button>
      <button class="sidebar-icon-btn" data-panel="extensions" title="Extensiones (Ctrl+Shift+X)">
        <svg viewBox="0 0 16 16" fill="currentColor" width="22" height="22"><path d="M13 4.5a2.5 2.5 0 1 1 .702 1.737L6.97 9.604a2.518 2.518 0 0 1 0 .792l6.733 3.367a2.5 2.5 0 1 1-.671 1.341l-6.733-3.367a2.5 2.5 0 1 1 0-3.474l6.733-3.366A2.519 2.519 0 0 1 13 4.5z"/></svg>
      </button>
    </div>

    <!-- Panel: Explorador -->
    <div class="sidebar-panel" id="panel-explorer">
      <div class="sidebar-header">
        <span id="sidebar-title">EXPLORADOR</span>
        <div class="sidebar-actions">
          <button class="icon-btn" id="btn-new-file" title="Nuevo archivo">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zm-9 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1H5z"/></svg>
          </button>
          <button class="icon-btn" id="btn-new-folder" title="Nueva carpeta">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31z"/></svg>
          </button>
          <button class="icon-btn" id="btn-open-folder" title="Abrir carpeta">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/></svg>
          </button>
          <button class="icon-btn" id="btn-refresh" title="Actualizar">⟳</button>
        </div>
      </div>
      <div class="file-tree" id="file-tree">
        <div class="empty-tree">
          <p>Sin carpeta abierta</p>
          <button class="btn-primary" id="btn-open-folder-big">Abrir carpeta</button>
        </div>
      </div>
    </div>

    <!-- Panel: Búsqueda -->
    <div class="sidebar-panel" id="panel-search" style="display:none">
      <div class="sidebar-header"><span>BUSCAR EN ARCHIVOS</span></div>
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
        extStoreInstance = new ExtensionStore(host, state)
        extStoreInstance.mount()
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

  // ── Abrir carpeta ─────────────────────────────────────────────────────
  async function openFolder() {
    const folder = await window.api.openFolder()
    if (!folder) return
    state.currentFolder = folder
    document.getElementById('sidebar-title').textContent = basename(folder).toUpperCase()
    await renderTree(folder)
  }

  document.getElementById('btn-open-folder').addEventListener('click', openFolder)
  document.getElementById('btn-open-folder-big')?.addEventListener('click', openFolder)
  document.getElementById('btn-refresh').addEventListener('click', () => {
    if (state.currentFolder) renderTree(state.currentFolder)
  })
  state.on('menu:openFolder', openFolder)
  state.on('refreshTree', () => { if (state.currentFolder) renderTree(state.currentFolder) })

  // ── Nuevo archivo / carpeta ───────────────────────────────────────────
  document.getElementById('btn-new-file').addEventListener('click', () => promptNewItem(false))
  document.getElementById('btn-new-folder').addEventListener('click', () => promptNewItem(true))

  async function promptNewItem(isDir) {
    if (!state.currentFolder) { alert('Abre una carpeta primero'); return }
    const name = prompt(isDir ? 'Nombre de la carpeta:' : 'Nombre del archivo:')
    if (!name) return
    const fullPath = state.currentFolder + '\\' + name
    if (isDir) await window.api.createDir(fullPath)
    else {
      await window.api.createFile(fullPath)
      const content = await window.api.readFile(fullPath)
      state.openFile(fullPath, content)
    }
    renderTree(state.currentFolder)
  }

  // ── Árbol de archivos ─────────────────────────────────────────────────
  async function renderTree(folderPath) {
    const tree = document.getElementById('file-tree')
    tree.innerHTML = '<div class="loading-tree">Cargando…</div>'
    try {
      const entries = await window.api.readDir(folderPath)
      tree.innerHTML = ''
      renderEntries(entries, tree, 0)
    } catch (e) {
      tree.innerHTML = `<div class="loading-tree" style="color:var(--red)">Error: ${e.message}</div>`
    }
  }

  function renderEntries(entries, parentEl, depth) {
    entries.forEach(entry => {
      const item = document.createElement('div')
      item.className = `tree-item ${entry.isDirectory ? 'tree-dir' : 'tree-file'}`
      item.style.paddingLeft = `${8 + depth * 14}px`
      item.dataset.path = entry.path

      const arrow = document.createElement('span')
      arrow.className = 'tree-arrow'
      arrow.textContent = entry.isDirectory ? '▶' : ''

      const icon = document.createElement('span')
      icon.className = 'tree-icon'
      icon.textContent = getIcon(entry.name, entry.isDirectory, false)

      const label = document.createElement('span')
      label.className = 'tree-label'
      label.textContent = entry.name

      item.append(arrow, icon, label)

      item.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (entry.isDirectory) {
          const expanded = item.dataset.expanded === 'true'
          if (expanded) {
            item.dataset.expanded = 'false'
            icon.textContent = getIcon(entry.name, true, false)
            arrow.style.transform = ''
            item.nextElementSibling?.remove()
          } else {
            item.dataset.expanded = 'true'
            icon.textContent = getIcon(entry.name, true, true)
            arrow.style.transform = 'rotate(90deg)'
            const children = document.createElement('div')
            children.className = 'tree-children'
            const subEntries = await window.api.readDirSub(entry.path)
            renderEntries(subEntries, children, depth + 1)
            item.insertAdjacentElement('afterend', children)
          }
        } else {
          parentEl.closest('.file-tree')?.querySelectorAll('.tree-file.active')
            .forEach(el => el.classList.remove('active'))
          item.classList.add('active')
          const content = await window.api.readFile(entry.path)
          state.openFile(entry.path, content)
        }
      })

      item.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        showContextMenu(e, entry)
      })

      parentEl.appendChild(item)
    })
  }

  // ── Menú contextual ───────────────────────────────────────────────────
  function showContextMenu(e, entry) {
    contextMenu?.remove()
    const menu = document.createElement('div')
    menu.className = 'context-menu'
    menu.style.left = e.pageX + 'px'
    menu.style.top  = e.pageY + 'px'

    const items = [
      { label: '📄 Nuevo archivo', action: () => promptNewItemAt(entry, false) },
      { label: '📁 Nueva carpeta', action: () => promptNewItemAt(entry, true) },
      { type: 'sep' },
      { label: '✏️ Renombrar',    action: () => renameItem(entry) },
      { label: '🗑️ Eliminar',     action: () => deleteItem(entry) },
      { type: 'sep' },
      { label: '📋 Copiar ruta',  action: () => navigator.clipboard.writeText(entry.path) },
    ]

    items.forEach(it => {
      if (it.type === 'sep') {
        menu.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-sep' }))
      } else {
        const el = document.createElement('div')
        el.className = 'ctx-item'
        el.textContent = it.label
        el.addEventListener('click', () => { it.action(); menu.remove() })
        menu.appendChild(el)
      }
    })

    document.body.appendChild(menu)
    contextMenu = menu
    setTimeout(() => {
      document.addEventListener('click', function close(ev) {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', close) }
      })
    }, 10)
  }

  async function promptNewItemAt(entry, isDir) {
    const base = entry.isDirectory ? entry.path : entry.path.replace(/[^/\\]+$/, '')
    const name = prompt(isDir ? 'Nombre de la carpeta:' : 'Nombre del archivo:')
    if (!name) return
    const fullPath = base + '\\' + name
    if (isDir) await window.api.createDir(fullPath)
    else {
      await window.api.createFile(fullPath)
      state.openFile(fullPath, '')
    }
    if (state.currentFolder) renderTree(state.currentFolder)
  }

  async function renameItem(entry) {
    const newName = prompt('Nuevo nombre:', basename(entry.path))
    if (!newName || newName === basename(entry.path)) return
    const newPath = entry.path.replace(/[^/\\]+$/, '') + newName
    await window.api.rename(entry.path, newPath)
    if (state.currentFolder) renderTree(state.currentFolder)
  }

  async function deleteItem(entry) {
    if (!confirm(`¿Eliminar "${basename(entry.path)}"?`)) return
    if (state.currentFile === entry.path) state.closeTab(entry.path)
    await window.api.deleteFile(entry.path)
    if (state.currentFolder) renderTree(state.currentFolder)
  }

  // ── Búsqueda en archivos ──────────────────────────────────────────────
  let searchTimeout
  document.getElementById('search-query').addEventListener('input', (e) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => runSearch(e.target.value), 400)
  })

  async function runSearch(query) {
    const results = document.getElementById('search-results')
    if (!query.trim()) { results.innerHTML = ''; return }
    results.innerHTML = '<div class="searching">Buscando…</div>'

    const caseSensitive = document.getElementById('search-case').checked
    const useRegex      = document.getElementById('search-regex').checked
    const wholeWord     = document.getElementById('search-word').checked
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

    if (matches.length === 0) { results.innerHTML = '<div class="no-results">Sin resultados en archivos abiertos</div>'; return }
    results.innerHTML = ''
    const grouped = {}
    matches.forEach(m => { ;(grouped[m.file] ??= []).push(m) })

    Object.entries(grouped).forEach(([file, ms]) => {
      const fileEl = document.createElement('div')
      fileEl.className = 'search-file'
      fileEl.textContent = basename(file)
      results.appendChild(fileEl)
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
        results.appendChild(lineEl)
      })
    })
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }
}
