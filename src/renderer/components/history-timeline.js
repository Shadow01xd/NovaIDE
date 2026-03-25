// src/renderer/components/history-timeline.js
import { historyManager } from '../utils/history-manager.js'

export function createHistoryTimeline(container, state) {
  let isOpen = false
  
  const timelineEl = document.createElement('div')
  timelineEl.className = 'history-timeline'
  timelineEl.style.display = 'none'
  
  timelineEl.innerHTML = `
    <div class="ht-header">
      <span class="ht-title">Historial de Cambios</span>
      <button class="ht-close">&times;</button>
    </div>
    <div class="ht-list"></div>
  `
  
  container.appendChild(timelineEl)
  
  const listEl = timelineEl.querySelector('.ht-list')
  const closeBtn = timelineEl.querySelector('.ht-close')
  
  closeBtn.addEventListener('click', () => toggle(false))
  
  function toggle(force) {
    isOpen = force !== undefined ? force : !isOpen
    timelineEl.style.display = isOpen ? 'flex' : 'none'
    if (isOpen) render()
  }
  
  function render() {
    const history = historyManager.getHistory(state.currentFile)
    listEl.innerHTML = ''
    
    if (!history.stack || history.stack.length === 0) {
      listEl.innerHTML = '<div class="ht-empty">Sin historial disponible</div>'
      return
    }
    
    // Renderizar de más reciente a más antiguo
    const reversedStack = [...history.stack].reverse()
    const total = history.stack.length
    
    reversedStack.forEach((item, revIdx) => {
      const idx = total - 1 - revIdx
      const itemEl = document.createElement('div')
      itemEl.className = `ht-item ${idx === history.index ? 'active' : ''}`
      
      const time = new Date(item.timestamp).toLocaleTimeString()
      const date = new Date(item.timestamp).toLocaleDateString()
      
      itemEl.innerHTML = `
        <div class="ht-item-dot"></div>
        <div class="ht-item-content">
          <div class="ht-item-time">${time} <span class="ht-item-date">${date}</span></div>
          <div class="ht-item-desc">Cambio #${idx + 1}</div>
        </div>
      `
      
      itemEl.addEventListener('click', () => {
        state.emit('historyJump', { index: idx })
        render() // Actualizar clase 'active'
      })
      
      listEl.appendChild(itemEl)
    })
  }
  
  // Escuchar eventos
  state.on('toggleHistoryTimeline', () => toggle())
  state.on('historyChanged', ({ filePath }) => {
    if (isOpen && filePath === state.currentFile) render()
  })
  
  state.on('fileOpened', () => {
    if (isOpen) render()
  })

  return { toggle, render }
}
