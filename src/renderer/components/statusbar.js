// src/renderer/components/statusbar.js

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
        <span class="sb-item sb-theme" id="sb-theme-selector" title="Cambiar tema (Ctrl+K Ctrl+T)">🎨</span>
      </div>
    `
  }

  state.on('fileOpened',  render)
  state.on('fileSaved',   render)
  state.on('tabsChanged', render)
  state.on('editorClear', render)

  // Actualizar posición del cursor
  state.on('fileOpened', () => {
    if (!state.editorInstance) return
    state.editorInstance.onDidChangeCursorPosition(e => {
      const el = document.getElementById('sb-cursor')
      if (el) el.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`
    })
  })

  // Manejar clic en selector de tema
  container.addEventListener('click', (e) => {
    if (e.target.id === 'sb-theme-selector') {
      e.preventDefault()
      e.stopPropagation()
      
      // Disparar evento personalizado para que el main.js lo maneje
      const event = new CustomEvent('openThemeSelector', {
        bubbles: true,
        detail: { target: e.target }
      })
      document.dispatchEvent(event)
    }
  })

  render()
}
