// src/renderer/components/tabs.js
import { getLang } from './editor.js'

const FILE_ICONS = {
  js:'🟨',jsx:'⚛️',ts:'🔷',tsx:'⚛️',py:'🐍',rb:'💎',go:'🐹',rs:'🦀',
  html:'🌐',css:'🎨',scss:'🎨',less:'🎨',json:'📋',md:'📝',
  sh:'⚙️',bash:'⚙️',ps1:'⚙️',sql:'🗄️',yaml:'⚙️',yml:'⚙️',
  vue:'💚',svelte:'🧡',cs:'🔵',java:'☕',php:'🐘',dockerfile:'🐳',
}

function getIcon(filePath) {
  const ext = filePath?.split('.').pop()?.toLowerCase()
  return FILE_ICONS[ext] || '📄'
}

function getBaseName(filePath) {
  return filePath?.replace(/\\/g, '/').split('/').pop() || 'Sin título'
}

export function createTabs(container, state) {
  function render() {
    container.innerHTML = ''
    state.openTabs.forEach(tab => {
      const el = document.createElement('div')
      el.className = `tab${tab.path === state.currentFile ? ' active' : ''}${tab.saved ? '' : ' dirty'}`
      el.dataset.path = tab.path

      const icon = document.createElement('span')
      icon.className = 'tab-icon'
      icon.textContent = getIcon(tab.path)

      const name = document.createElement('span')
      name.className = 'tab-name'
      name.textContent = getBaseName(tab.path)

      const dot = document.createElement('span')
      dot.className = 'tab-dirty-dot'
      dot.textContent = '●'

      const close = document.createElement('button')
      close.className = 'tab-close'
      close.innerHTML = '×'
      close.title = 'Cerrar'

      el.append(icon, name, dot, close)

      el.addEventListener('click', async (e) => {
        if (e.target === close || close.contains(e.target)) return
        if (tab.path === state.currentFile) return
        // Cargar contenido si no está en memoria
        if (!tab.content) {
          tab.content = await window.api.readFile(tab.path)
        }
        state.openFile(tab.path, tab.content)
      })

      close.addEventListener('click', async (e) => {
        e.stopPropagation()
        if (!tab.saved) {
          const ok = confirm(`¿Cerrar "${getBaseName(tab.path)}" sin guardar?`)
          if (!ok) return
        }
        state.closeTab(tab.path)
      })

      // Ctrl+W para cerrar tab activo
      container.appendChild(el)
    })

    if (state.openTabs.length === 0) {
      container.innerHTML = '<div class="tabs-empty"></div>'
    }
  }

  state.on('tabsChanged', render)

  // Ctrl+W
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
      e.preventDefault()
      if (state.currentFile) state.closeTab(state.currentFile)
    }
    // Ctrl+Tab — siguiente tab
    if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
      e.preventDefault()
      const idx = state.openTabs.findIndex(t => t.path === state.currentFile)
      const next = state.openTabs[(idx + (e.shiftKey ? -1 : 1) + state.openTabs.length) % state.openTabs.length]
      if (next) state.openFile(next.path, next.content)
    }
  })

  render()
}
