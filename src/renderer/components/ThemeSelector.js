export class ThemeSelector {
  constructor(themeManager, container) {
    this.themeManager = themeManager
    this.container = container
    this.isOpen = false
    this.currentTheme = null
    
    // Elementos del DOM
    this.selectorElement = null
    this.dropdownElement = null
    this.triggerElement = null
    
    // Callbacks
    this.onThemeChange = null
    
    // Inicialización
    this.init()
  }


  init() {
    this.createSelector()
    this.attachEventListeners()
    this.updateCurrentTheme()
    
    this.themeManager.addThemeChangeListener((themeId, theme) => {
      this.updateCurrentTheme()
      if (this.onThemeChange) {
        this.onThemeChange(themeId, theme)
      }
    })
  }

  createSelector() {
    const currentTheme = this.themeManager.getCurrentTheme()
    
    this.selectorElement = document.createElement('div')
    this.selectorElement.className = 'theme-selector'
    this.selectorElement.innerHTML = `
      <button class="theme-selector-trigger" 
              type="button" 
              aria-label="Seleccionar tema"
              aria-expanded="false"
              aria-haspopup="listbox">
        <span class="theme-selector-icon">${currentTheme?.icon || '🌙'}</span>
        <span class="theme-selector-label">${currentTheme?.name || 'Tema Oscuro'}</span>
        <svg class="theme-selector-arrow" width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      
      <div class="theme-selector-dropdown" role="listbox" aria-label="Temas disponibles">
        <div class="theme-selector-list">
          <!-- Los temas se insertarán dinámicamente -->
        </div>
      </div>
    `
    
    if (this.container) {
      this.container.appendChild(this.selectorElement)
    }
    
    this.triggerElement = this.selectorElement.querySelector('.theme-selector-trigger')
    this.dropdownElement = this.selectorElement.querySelector('.theme-selector-dropdown')
    
    this.createThemeList()
  }

  createThemeList() {
    const listElement = this.selectorElement.querySelector('.theme-selector-list')
    const themes = this.themeManager.getThemes()
    
    listElement.innerHTML = themes.map(theme => `
      <button class="theme-option ${theme.id === this.themeManager.currentTheme ? 'theme-option--active' : ''}"
              type="button"
              role="option"
              data-theme="${theme.id}"
              aria-selected="${theme.id === this.themeManager.currentTheme}">
        <div class="theme-option-preview">
          <div class="theme-option-colors">
            <div class="theme-option-color theme-option-bg" style="background-color: ${this.getThemePreviewColor(theme.id, 'bg')}"></div>
            <div class="theme-option-color theme-option-fg" style="background-color: ${this.getThemePreviewColor(theme.id, 'fg')}"></div>
            <div class="theme-option-color theme-option-accent" style="background-color: ${this.getThemePreviewColor(theme.id, 'accent')}"></div>
          </div>
        </div>
        <div class="theme-option-content">
          <div class="theme-option-header">
            <span class="theme-option-icon">${theme.icon}</span>
            <span class="theme-option-name">${theme.name}</span>
            ${theme.isDefault ? '<span class="theme-option-default">Por defecto</span>' : ''}
          </div>
          <div class="theme-option-description">${theme.description}</div>
        </div>
        ${theme.id === this.themeManager.currentTheme ? '<div class="theme-option-check">✓</div>' : ''}
      </button>
    `).join('')
  }

  getThemePreviewColor(themeId, type) {
    const colors = {
      dark: {
        bg: '#1e1e1e',
        fg: '#cccccc',
        accent: '#007acc'
      },
      light: {
        bg: '#ffffff',
        fg: '#333333',
        accent: '#0066b3'
      },
      'high-contrast': {
        bg: '#000000',
        fg: '#ffff00',
        accent: '#1e90ff'
      }
    }
    
    return colors[themeId]?.[type] || '#000000'
  }

  attachEventListeners() {
    this.triggerElement.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.toggle()
    })
    
    document.addEventListener('click', (e) => {
      if (!this.selectorElement.contains(e.target)) {
        this.close()
      }
    })
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault()
        this.close()
        this.triggerElement.focus()
      }
    })
    
    this.selectorElement.addEventListener('click', (e) => {
      const themeOption = e.target.closest('.theme-option')
      if (themeOption) {
        const themeId = themeOption.dataset.theme
        this.selectTheme(themeId)
      }
    })
    
    this.selectorElement.addEventListener('keydown', (e) => {
      if (!this.isOpen) return
      
      const options = Array.from(this.selectorElement.querySelectorAll('.theme-option'))
      const currentIndex = options.findIndex(option => option === document.activeElement)
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          const nextIndex = (currentIndex + 1) % options.length
          options[nextIndex].focus()
          break
          
        case 'ArrowUp':
          e.preventDefault()
          const prevIndex = (currentIndex - 1 + options.length) % options.length
          options[prevIndex].focus()
          break
          
        case 'Home':
          e.preventDefault()
          options[0].focus()
          break
          
        case 'End':
          e.preventDefault()
          options[options.length - 1].focus()
          break
          
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (currentIndex >= 0) {
            const themeId = options[currentIndex].dataset.theme
            this.selectTheme(themeId)
          }
          break
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
    
    this.isOpen = true
    this.selectorElement.classList.add('theme-selector--open')
    this.triggerElement.setAttribute('aria-expanded', 'true')
    
    const activeOption = this.selectorElement.querySelector('.theme-option--active')
    if (activeOption) {
      activeOption.focus()
    } else {
      const firstOption = this.selectorElement.querySelector('.theme-option')
      if (firstOption) firstOption.focus()
    }
    
    this.positionDropdown()
  }

  close() {
    if (!this.isOpen) return
    
    this.isOpen = false
    this.selectorElement.classList.remove('theme-selector--open')
    this.triggerElement.setAttribute('aria-expanded', 'false')
  }

  positionDropdown() {
    const rect = this.dropdownElement.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    
    if (rect.bottom > viewportHeight) {
      this.selectorElement.classList.add('theme-selector--dropup')
    } else {
      this.selectorElement.classList.remove('theme-selector--dropup')
    }
  }

  selectTheme(themeId) {
    const success = this.themeManager.applyTheme(themeId)
    
    if (success) {
      this.close()
      this.triggerElement.focus()
    }
  }

  updateCurrentTheme() {
    const currentTheme = this.themeManager.getCurrentTheme()
    if (!currentTheme) return
    
    // Actualizar trigger
    const iconElement = this.selectorElement.querySelector('.theme-selector-icon')
    const labelElement = this.selectorElement.querySelector('.theme-selector-label')
    
    if (iconElement) iconElement.textContent = currentTheme.icon
    if (labelElement) labelElement.textContent = currentTheme.name
    
    // Actualizar estado activo en opciones
    const options = this.selectorElement.querySelectorAll('.theme-option')
    options.forEach(option => {
      const isActive = option.dataset.theme === currentTheme.id
      option.classList.toggle('theme-option--active', isActive)
      option.setAttribute('aria-selected', isActive)
      
      // Actualizar check mark
      const checkElement = option.querySelector('.theme-option-check')
      if (isActive && !checkElement) {
        const check = document.createElement('div')
        check.className = 'theme-option-check'
        check.textContent = '✓'
        option.appendChild(check)
      } else if (!isActive && checkElement) {
        checkElement.remove()
      }
    })
  }

  setThemeChangeCallback(callback) {
    this.onThemeChange = callback
  }

  destroy() {
    if (this.selectorElement && this.selectorElement.parentNode) {
      this.selectorElement.parentNode.removeChild(this.selectorElement)
    }
    
    this.triggerElement = null
    this.dropdownElement = null
    this.selectorElement = null
  }
}

/**
 * Función de utilidad para crear un selector de temas
 */
export function createThemeSelector(themeManager, container, options = {}) {
  const selector = new ThemeSelector(themeManager, container)
  
  if (options.onThemeChange) {
    selector.setThemeChangeCallback(options.onThemeChange)
  }
  
  return selector
}

/**
 * Función para crear selector en sidebar
 */
export function createSidebarThemeSelector(themeManager, sidebarContainer) {
  // Crear contenedor específico para el selector
  const selectorContainer = document.createElement('div')
  selectorContainer.className = 'sidebar-theme-selector'
  
  // Agregar título si no existe
  const title = document.createElement('div')
  title.className = 'sidebar-section-title'
  title.textContent = 'Apariencia'
  selectorContainer.appendChild(title)
  
  // Insertar en sidebar
  if (sidebarContainer) {
    sidebarContainer.appendChild(selectorContainer)
  }
  
  // Crear selector
  const selector = createThemeSelector(themeManager, selectorContainer)
  
  return {
    selector,
    container: selectorContainer
  }
}
