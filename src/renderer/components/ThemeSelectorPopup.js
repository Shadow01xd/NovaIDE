import { createThemeSelector } from './ThemeSelector.js'

export class ThemeSelectorPopup {
  constructor(themeManager) {
    this.themeManager = themeManager
    this.isOpen = false
    this.popupElement = null
    this.selector = null
    this.triggerElement = null
    
    this.init()
  }

  init() {
    document.addEventListener('openThemeSelector', (e) => {
      this.triggerElement = e.detail.target
      this.toggle()
    })

    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.popupElement?.contains(e.target) && e.target !== this.triggerElement) {
        this.close()
      }
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close()
      }
    })
  }

  toggle() {
    if (this.isOpen) {
      this.close()
    } else {
      this.open()
    }
  }

  open() {
    if (this.isOpen) return

    this.createPopup()
    
    this.positionPopup()
    
    this.popupElement.style.opacity = '0'
    this.popupElement.style.transform = 'translateY(-10px)'
    document.body.appendChild(this.popupElement)
    
    this.popupElement.offsetHeight
    
    this.popupElement.style.transition = 'all 0.2s ease-out'
    this.popupElement.style.opacity = '1'
    this.popupElement.style.transform = 'translateY(0)'
    
    this.isOpen = true
    
    setTimeout(() => {
      this.selector?.triggerElement?.focus()
    }, 100)
  }

  close() {
    if (!this.isOpen) return

    this.popupElement.style.transition = 'all 0.2s ease-in'
    this.popupElement.style.opacity = '0'
    this.popupElement.style.transform = 'translateY(-10px)'
    
    setTimeout(() => {
      if (this.popupElement && this.popupElement.parentNode) {
        this.popupElement.parentNode.removeChild(this.popupElement)
      }
      this.popupElement = null
      this.selector = null
    }, 200)
    
    this.isOpen = false
  }

  createPopup() {
    this.popupElement = document.createElement('div')
    this.popupElement.className = 'theme-selector-popup'
    this.popupElement.innerHTML = `
      <div class="theme-selector-popup-content">
        <div class="theme-selector-popup-header">
          <span class="theme-selector-popup-title">🎨 Temas</span>
          <button class="theme-selector-popup-close" id="theme-popup-close" title="Cerrar (Escape)">✕</button>
        </div>
        <div class="theme-selector-popup-body">
          <!-- El selector se creará aquí -->
        </div>
      </div>
    `

    const container = this.popupElement.querySelector('.theme-selector-popup-body')
    this.selector = createThemeSelector(this.themeManager, container)
    
    this.popupElement.querySelector('#theme-popup-close').addEventListener('click', () => {
      this.close()
    })
  }

  positionPopup() {
    if (!this.triggerElement) return

    const rect = this.triggerElement.getBoundingClientRect()
    const popupWidth = 320 
    const popupHeight = 400 
    
    let left = rect.left + rect.width / 2 - popupWidth / 2
    let top = rect.top - popupHeight - 10 
    
    if (left < 10) left = 10
    if (left + popupWidth > window.innerWidth - 10) {
      left = window.innerWidth - popupWidth - 10
    }
    
    if (top < 10) {
      top = rect.bottom + 10
    }
    
    this.popupElement.style.position = 'fixed'
    this.popupElement.style.left = `${left}px`
    this.popupElement.style.top = `${top}px`
    this.popupElement.style.zIndex = '10000'
  }

  destroy() {
    this.close()
  }
}

export function createThemeSelectorPopup(themeManager) {
  return new ThemeSelectorPopup(themeManager)
}
