// src/renderer/components/PreviewUrlPopup.js

export class PreviewUrlPopup {
  constructor(state) {
    this.state = state
    this.isOpen = false
    this.container = null
    this.input = null
    this.onUrlSubmit = null
    
    this.init()
  }

  init() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close()
      }
    })

    document.addEventListener('click', (e) => {
      if (this.isOpen && this.container && !this.container.contains(e.target)) {
        this.close()
      }
    })
  }

  show(callback) {
    this.onUrlSubmit = callback
    if (this.isOpen) return

    this.render()
    document.body.appendChild(this.container)
    
    this.isOpen = true
    
    // Animación de entrada
    requestAnimationFrame(() => {
      this.container.style.opacity = '1'
      this.container.style.transform = 'translate(-50%, 0)'
      this.input?.focus()
      if (this.state.liveServerUrl) {
          this.input.value = this.state.liveServerUrl
          this.input.select()
      }
    })
  }

  close() {
    if (!this.isOpen) return

    this.container.style.opacity = '0'
    this.container.style.transform = 'translate(-50%, -20px)'
    
    setTimeout(() => {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container)
      }
      this.isOpen = false
    }, 200)
  }

  render() {
    this.container = document.createElement('div')
    this.container.className = 'preview-url-popup'
    this.container.innerHTML = `
      <div class="preview-url-popup-header">
        <span>🌐 Abrir Preview (Node.js / Localhost)</span>
      </div>
      <div class="preview-url-popup-body">
        <input type="text" id="preview-popup-input" class="search-input" placeholder="http://localhost:3000">
        <div class="preview-url-popup-hint">Presiona Enter para abrir en ventana externa</div>
      </div>
    `

    this.input = this.container.querySelector('#preview-popup-input')
    
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = this.input.value.trim()
        if (url) {
          const fullUrl = url.startsWith('http') ? url : `http://${url}`
          if (this.onUrlSubmit) this.onUrlSubmit(fullUrl)
          this.close()
        }
      }
    })
  }
}

export function createPreviewUrlPopup(state) {
  return new PreviewUrlPopup(state)
}
