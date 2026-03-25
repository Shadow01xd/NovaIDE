// src/renderer/components/statusbar.js
import { historyManager } from '../utils/history-manager.js'

export function createStatusBar(container, state) {
  function render() {
    const file    = state.currentFile
    const name    = file ? file.replace(/\\/g,'/').split('/').pop() : null
    const ext     = name?.split('.').pop()?.toUpperCase() || ''
    const tab     = state.openTabs.find(t => t.path === state.currentFile)
    const dirty   = tab && !tab.saved

    container.innerHTML = `
      <div class="sb-left">
        <span class="sb-item sb-branch" title="Git branch">⎇ main</span>
        ${file ? `<span class="sb-item sb-errors" title="Sin errores">✓ 0</span>` : ''}
      </div>
      <div class="sb-center">
        ${file ? `<span class="sb-item sb-file">${dirty ? '● ' : ''}${name}</span>` : ''}
      </div>
      <div class="sb-right">
        ${ext ? `<span class="sb-item sb-lang" title="Lenguaje">${ext}</span>` : ''}
        <span class="sb-item sb-enc">UTF-8</span>
        <span class="sb-item sb-model" title="Modelo IA activo">✦ ${state.aiModel?.split(':')[0] || 'DeepSeek'}</span>
        <span class="sb-item sb-cursor" id="sb-cursor">Ln 1, Col 1</span>
        ${ext === 'HTML' ? `
          <span class="sb-item sb-live ${state.liveServerRunning ? 'active' : ''}" id="sb-live" title="${state.liveServerRunning ? 'Click to Stop Server' : 'Click to Go Live'}">
            <span class="live-icon">${state.liveServerRunning ? '⚡' : '📡'}</span> 
            <span class="live-text">${state.liveServerRunning ? `Port: ${state.liveServerPort || 5500} (Stop)` : 'Go Live'}</span>
          </span>
        ` : ''}
        <span class="sb-item sb-theme" id="sb-theme-selector" title="Cambiar tema (Ctrl+K Ctrl+T)">🎨</span>
        <span class="sb-item sb-history theme-text-secondary" id="sb-history"></span>
      </div>
    `
  }

  state.on('fileOpened',  render)
  state.on('fileSaved',   render)
  state.on('tabsChanged', render)
  state.on('editorClear', render)
  state.on('historyChanged', () => {
    const history = historyManager.getHistory(state.currentFile)
    const el = document.getElementById('sb-history')
    if (el && history.stack.length > 0) {
      el.textContent = `Cambio ${history.index + 1} de ${history.stack.length}`
    } else if (el) {
      el.textContent = ''
    }
  })

  // Actualizar posición del cursor
  state.on('fileOpened', () => {
    if (!state.editorInstance) return
    state.editorInstance.onDidChangeCursorPosition(e => {
      const el = document.getElementById('sb-cursor')
      if (el) el.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`
    })
  })

  // Manejar clics
  container.addEventListener('click', async (e) => {
    const item = e.target.closest('.sb-item')
    if (!item) return

    if (item.id === 'sb-theme-selector') {
      e.preventDefault()
      e.stopPropagation()
      document.dispatchEvent(new CustomEvent('openThemeSelector', { detail: { target: item } }))
    }

    if (item.id === 'sb-live') {
      if (state.liveServerRunning) {
        await window.api.liveServerStop()
        state.liveServerRunning = false
        item.classList.remove('active')
        item.querySelector('.live-text').textContent = 'Go Live'
        item.querySelector('.live-icon').textContent = '📡'
      } else {
        const root = state.currentFolder || (state.currentFile ? await window.api.pathDirname(state.currentFile) : null)
        if (!root) return
        
        // Determinar archivo actual para abrirlo en el navegador
        let filename = ''
        if (state.currentFile) {
           filename = state.currentFile.replace(/\\/g, '/').split('/').pop()
        }

        const result = await window.api.liveServerStart(root, 5500)
        state.liveServerRunning = true
        state.liveServerUrl = result.url
        state.liveServerPort = result.port
        item.classList.add('active')
        item.querySelector('.live-text').textContent = `Port: ${result.port} (Stop)`
        item.querySelector('.live-icon').textContent = '⚡'
        
        // Abrir navegador con el archivo específico
        const targetUrl = `${result.url}/${filename}`
        window.api.openExternal(targetUrl)
      }
    }
  })

  render()
}
