// src/renderer/components/file-manager.js
/**
 * FileManager - Administrador de archivos mejorado para MyIDE
 * Creado con Vanilla JS, sin dependencias externas de UI
 * @author MyIDE Team
 */

export class FileManager {
  constructor(container, options = {}) {
    this.container = container
    this.options = {
      showHidden: false,
      enableAnimations: true,
      ...options
    }
    
    // Estado interno
    this.currentFolder = null
    this.activeFile = null
    this.fileTree = []
    this.expandedFolders = new Set()
    this.contextMenu = null
    this.editingItem = null
    
    // Callbacks externos
    this.onFileOpen = null
    this.onFolderChange = null
    this.onFileSave = null
    
    // Iconos por tipo de archivo
    this.FILE_ICONS = {
      // Lenguajes de programación
      js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️', 
      py: '🐍', rb: '💎', go: '🐹', rs: '🦀',
      cs: '🔵', java: '☕', php: '🐘', cpp: '⚙️', 
      c: '⚙️', h: '⚙️', hpp: '⚙️',
      
      // Web
      html: '🌐', htm: '🌐', css: '🎨', scss: '🎨', 
      sass: '🎨', less: '🎨', vue: '💚', svelte: '🧡',
      astro: '🚀', jsx: '⚛️', tsx: '⚛️',
      
      // Datos y configuración
      json: '📋', jsonc: '📋', xml: '📋', yaml: '📐', 
      yml: '📐', toml: '📐', ini: '📋', env: '🔒',
      
      // Documentación
      md: '📝', txt: '📄', rst: '📝', adoc: '📝',
      
      // Scripts
      sh: '⚙️', bash: '⚙️', zsh: '⚙️', fish: '⚙️',
      ps1: '💙', bat: '⚙️', cmd: '⚙️',
      
      // Base de datos
      sql: '🗄️', ddl: '🗄️', dml: '🗄️',
      
      // Imágenes
      png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️',
      svg: '🖼️', ico: '🖼️', webp: '🖼️',
      
      // Otros
      pdf: '📕', zip: '📦', rar: '📦', tar: '📦',
      gz: '📦', exe: '⚙️', msi: '⚙️', deb: '📦',
      rpm: '📦', dmg: '📦', pkg: '📦',
      
      // Archivos especiales
      gitignore: '🚫', dockerfile: '🐳', makefile: '🔧',
      license: '📄', readme: '📖', changelog: '📋',
      config: '⚙️', lock: '🔒'
    }
    
    this.init()
  }
  
  /**
   * Inicializa el componente
   */
  init() {
    this.render()
    this.bindEvents()
  }
  
  /**
   * Renderiza la estructura HTML del componente
   */
  render() {
    this.container.innerHTML = `
      <div class="file-manager">
        <div class="fm-header">
          <div class="fm-title">
            <span class="fm-icon">📁</span>
            <span class="fm-text">EXPLORADOR</span>
          </div>
          <div class="fm-actions">
            <button class="fm-btn" id="fm-new-file" title="Nuevo archivo">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zm-9 4a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm0 2a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1H5zm0 2a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1H5z"/>
              </svg>
            </button>
            <button class="fm-btn" id="fm-new-folder" title="Nueva carpeta">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.826a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31z"/>
              </svg>
            </button>
            <button class="fm-btn" id="fm-open-folder" title="Abrir carpeta">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0 1 15 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9z"/>
              </svg>
            </button>
            <button class="fm-btn" id="fm-refresh" title="Actualizar">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
                <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
              </svg>
            </button>
          </div>
        </div>
        
        <div class="fm-breadcrumb" id="fm-breadcrumb" style="display: none;">
          <div class="fm-path"></div>
        </div>
        
        <div class="fm-tree-container" id="fm-tree-container">
          <div class="fm-empty-state">
            <div class="fm-empty-icon">📂</div>
            <div class="fm-empty-title">Sin carpeta abierta</div>
            <div class="fm-empty-sub">Abre una carpeta para comenzar</div>
            <button class="fm-btn-primary" id="fm-open-folder-big">Abrir carpeta</button>
          </div>
        </div>
      </div>
    `
  }
  
  /**
   * Vincula eventos DOM
   */
  bindEvents() {
    // Botones de acción
    document.getElementById('fm-new-file').addEventListener('click', () => this.createNewFile())
    document.getElementById('fm-new-folder').addEventListener('click', () => this.createNewFolder())
    document.getElementById('fm-open-folder').addEventListener('click', () => this.openFolder())
    document.getElementById('fm-open-folder-big').addEventListener('click', () => this.openFolder())
    document.getElementById('fm-refresh').addEventListener('click', () => this.refreshTree())
    
    // Cerrar menú contextual al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (this.contextMenu && !this.contextMenu.contains(e.target)) {
        this.closeContextMenu()
      }
    })
    
    // Cerrar edición al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (this.editingItem && !this.editingItem.contains(e.target)) {
        this.finishEditing()
      }
    })
    
    // Atajos de teclado
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('.file-manager')) {
        this.handleKeyboard(e)
      }
    })
  }
  
  /**
   * Maneja eventos de teclado
   */
  handleKeyboard(e) {
    if (e.key === 'Escape') {
      if (this.editingItem) {
        this.cancelEditing()
      } else if (this.contextMenu) {
        this.closeContextMenu()
      }
    }
    
    if (e.key === 'Enter' && this.editingItem) {
      this.finishEditing()
    }
    
    // F2 para renombrar
    if (e.key === 'F2' && !this.editingItem) {
      const selectedItem = this.getSelectedItem()
      if (selectedItem) {
        this.startRenaming(selectedItem)
      }
    }
  }
  
  /**
   * Carga un proyecto con su estructura de archivos
   */
  async loadProject(folderPath) {
    this.currentFolder = folderPath
    this.updateBreadcrumb()
    await this.refreshTree()
    
    if (this.onFolderChange) {
      this.onFolderChange(folderPath)
    }
  }
  
  /**
   * Actualiza el breadcrumb con la ruta actual
   */
  updateBreadcrumb() {
    const breadcrumb = document.getElementById('fm-breadcrumb')
    const pathEl = breadcrumb.querySelector('.fm-path')
    
    if (this.currentFolder) {
      breadcrumb.style.display = 'block'
      
      const parts = this.currentFolder.replace(/\\/g, '/').split('/')
      const pathHtml = parts.map((part, index) => {
        const path = parts.slice(0, index + 1).join('/')
        return `<span class="fm-path-part" data-path="${path}">${part}</span>`
      }).join('<span class="fm-path-separator">/</span>')
      
      pathEl.innerHTML = pathHtml
      
      // Vincular eventos a las partes del path
      pathEl.querySelectorAll('.fm-path-part').forEach(part => {
        part.addEventListener('click', () => {
          this.loadProject(part.dataset.path)
        })
      })
    } else {
      breadcrumb.style.display = 'none'
    }
  }
  
  /**
   * Refresca el árbol de archivos
   */
  async refreshTree() {
    if (!this.currentFolder) return
    
    const container = document.getElementById('fm-tree-container')
    container.innerHTML = '<div class="fm-loading">Cargando...</div>'
    
    try {
      const entries = await window.api.readDir(this.currentFolder)
      this.fileTree = this.buildFileTree(entries)
      this.renderTree()
    } catch (error) {
      container.innerHTML = `
        <div class="fm-error">
          <div class="fm-error-icon">❌</div>
          <div class="fm-error-title">Error al cargar</div>
          <div class="fm-error-message">${error.message}</div>
        </div>
      `
    }
  }
  
  /**
   * Construye la estructura de árbol de archivos
   */
  buildFileTree(entries, basePath = '') {
    return entries.map(entry => ({
      ...entry,
      path: entry.path,
      children: entry.isDirectory ? [] : undefined,
      expanded: this.expandedFolders.has(entry.path)
    }))
  }
  
  /**
   * Renderiza el árbol de archivos
   */
  renderTree() {
    const container = document.getElementById('fm-tree-container')
    
    if (this.fileTree.length === 0) {
      container.innerHTML = `
        <div class="fm-empty-state">
          <div class="fm-empty-icon">📂</div>
          <div class="fm-empty-title">Carpeta vacía</div>
        </div>
      `
      return
    }
    
    const treeEl = document.createElement('div')
    treeEl.className = 'fm-tree'
    
    this.fileTree.forEach(item => {
      treeEl.appendChild(this.createTreeItem(item, 0))
    })
    
    container.innerHTML = ''
    container.appendChild(treeEl)
  }
  
  /**
   * Crea un elemento del árbol
   */
  createTreeItem(item, depth) {
    const itemEl = document.createElement('div')
    itemEl.className = `fm-tree-item ${item.isDirectory ? 'fm-folder' : 'fm-file'}`
    itemEl.dataset.path = item.path
    itemEl.dataset.type = item.isDirectory ? 'folder' : 'file'
    itemEl.dataset.depth = depth
    itemEl.draggable = true
    
    // Configurar el Drag an Drop interno hacia el Chat/Editor
    itemEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/nvcode-file', JSON.stringify({
        path: item.path,
        name: item.name,
        isDirectory: item.isDirectory
      }))
      e.dataTransfer.effectAllowed = 'copyMove'
    })
    
    // Indentación
    itemEl.style.paddingLeft = `${8 + depth * 16}px`
    
    // Flecha (solo para carpetas)
    const arrow = document.createElement('span')
    arrow.className = 'fm-arrow'
    if (item.isDirectory) {
      arrow.textContent = item.expanded ? '▼' : '▶'
      arrow.style.visibility = 'visible'
    }
    
    // Icono
    const icon = document.createElement('span')
    icon.className = 'fm-icon'
    icon.textContent = this.getIcon(item.name, item.isDirectory, item.expanded)
    
    // Label
    const label = document.createElement('span')
    label.className = 'fm-label'
    label.textContent = item.name
    
    itemEl.append(arrow, icon, label)
    
    // Eventos
    itemEl.addEventListener('click', (e) => this.handleItemClick(e, item))
    itemEl.addEventListener('dblclick', (e) => this.handleItemDoubleClick(e, item))
    itemEl.addEventListener('contextmenu', (e) => this.handleContextMenu(e, item))
    
    // Renderizar hijos si está expandido
    if (item.isDirectory && item.expanded && item.children) {
      const childrenEl = document.createElement('div')
      childrenEl.className = 'fm-children'
      item.children.forEach(child => {
        childrenEl.appendChild(this.createTreeItem(child, depth + 1))
      })
      itemEl.insertAdjacentElement('afterend', childrenEl)
    }
    
    return itemEl
  }
  
  /**
   * Maneja el click en un item
   */
  async handleItemClick(e, item) {
    e.stopPropagation()
    
    if (this.editingItem) {
      this.finishEditing()
      return
    }
    
    // Remover selección anterior
    this.clearSelection()
    
    // Seleccionar item actual
    const itemEl = e.currentTarget
    itemEl.classList.add('fm-selected')
    
    if (item.isDirectory) {
      this.toggleFolder(item, itemEl)
    } else {
      this.openFile(item)
    }
  }
  
  /**
   * Maneja el doble click en un item
   */
  handleItemDoubleClick(e, item) {
    e.stopPropagation()
    
    if (!item.isDirectory) {
      this.startRenaming(e.currentTarget)
    }
  }
  
  /**
   * Maneja el menú contextual
   */
  handleContextMenu(e, item) {
    e.preventDefault()
    e.stopPropagation()
    
    this.showContextMenu(e, item)
  }
  
  /**
   * Alterna el estado expandido de una carpeta
   */
  async toggleFolder(item, itemEl) {
    const isExpanded = item.expanded
    
    if (isExpanded) {
      // Colapsar
      item.expanded = false
      this.expandedFolders.delete(item.path)
      
      // Actualizar UI
      const arrow = itemEl.querySelector('.fm-arrow')
      const icon = itemEl.querySelector('.fm-icon')
      arrow.textContent = '▶'
      icon.textContent = this.getIcon(item.name, true, false)
      
      // Remover hijos
      itemEl.nextElementSibling?.remove()
    } else {
      // Expandir
      item.expanded = true
      this.expandedFolders.add(item.path)
      
      // Actualizar UI
      const arrow = itemEl.querySelector('.fm-arrow')
      const icon = itemEl.querySelector('.fm-icon')
      arrow.textContent = '▼'
      icon.textContent = this.getIcon(item.name, true, true)
      
      // Cargar y renderizar hijos
      try {
        const children = await window.api.readDirSub(item.path)
        item.children = this.buildFileTree(children)
        
        const childrenEl = document.createElement('div')
        childrenEl.className = 'fm-children'
        
        item.children.forEach(child => {
          childrenEl.appendChild(this.createTreeItem(child, parseInt(itemEl.dataset.depth) + 1))
        })
        
        itemEl.insertAdjacentElement('afterend', childrenEl)
      } catch (error) {
        console.error('Error al cargar carpeta:', error)
      }
    }
  }
  
  /**
   * Abre un archivo en el editor
   */
  async openFile(item) {
    try {
      const content = await window.api.readFile(item.path)
      this.activeFile = item.path
      
      // Actualizar UI
      this.clearSelection()
      const itemEl = document.querySelector(`[data-path="${item.path}"]`)
      if (itemEl) {
        itemEl.classList.add('fm-active')
      }
      
      // Callback externo
      if (this.onFileOpen) {
        this.onFileOpen(item.path, content, this.detectLanguage(item.name))
      }
    } catch (error) {
      console.error('Error al abrir archivo:', error)
    }
  }
  
  /**
   * Detecta el lenguaje del archivo por su extensión
   */
  detectLanguage(filename) {
    const ext = filename.split('.').pop()?.toLowerCase()
    
    const languageMap = {
      js: 'javascript', jsx: 'javascript', mjs: 'javascript',
      ts: 'typescript', tsx: 'typescript',
      py: 'python', pyw: 'python',
      html: 'html', htm: 'html',
      css: 'css', scss: 'scss', sass: 'scss', less: 'less',
      json: 'json', jsonc: 'json',
      md: 'markdown', markdown: 'markdown',
      sql: 'sql',
      sh: 'shell', bash: 'shell', zsh: 'shell',
      ps1: 'powershell',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp', c: 'c', h: 'c', hpp: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      vue: 'html',
      svelte: 'javascript',
      xml: 'xml',
      yaml: 'yaml', yml: 'yaml'
    }
    
    return languageMap[ext] || 'plaintext'
  }
  
  /**
   * Obtiene el icono para un archivo
   */
  getIcon(name, isDir, isOpen) {
    if (isDir) {
      return isOpen ? '📂' : '📁'
    }
    
    const ext = name.split('.').pop()?.toLowerCase()
    const nameLower = name.toLowerCase()
    
    // Archivos especiales
    if (nameLower.startsWith('.')) {
      return this.FILE_ICONS[name.slice(1).toLowerCase()] || '🔒'
    }
    
    // Por extensión
    return this.FILE_ICONS[ext] || '📄'
  }
  
  /**
   * Muestra el menú contextual
   */
  showContextMenu(e, item) {
    this.closeContextMenu()
    
    const menu = document.createElement('div')
    menu.className = 'fm-context-menu'
    menu.style.left = `${e.pageX}px`
    menu.style.top = `${e.pageY}px`
    
    const items = this.getContextMenuItems(item)
    
    items.forEach(menuItem => {
      if (menuItem.type === 'separator') {
        const separator = document.createElement('div')
        separator.className = 'fm-separator'
        menu.appendChild(separator)
      } else {
        const itemEl = document.createElement('div')
        itemEl.className = 'fm-menu-item'
        itemEl.innerHTML = `
          <span class="fm-menu-icon">${menuItem.icon}</span>
          <span class="fm-menu-text">${menuItem.label}</span>
        `
        
        if (menuItem.shortcut) {
          const shortcut = document.createElement('span')
          shortcut.className = 'fm-menu-shortcut'
          shortcut.textContent = menuItem.shortcut
          itemEl.appendChild(shortcut)
        }
        
        itemEl.addEventListener('click', () => {
          menuItem.action()
          this.closeContextMenu()
        })
        
        menu.appendChild(itemEl)
      }
    })
    
    document.body.appendChild(menu)
    this.contextMenu = menu
    
    // Ajustar posición si sale de la pantalla
    this.adjustMenuPosition(menu)
  }
  
  /**
   * Obtiene los items del menú contextual
   */
  getContextMenuItems(item) {
    const items = []
    
    // Crear nuevo
    if (item.isDirectory) {
      items.push(
        { icon: '📄', label: 'Nuevo archivo', action: () => this.createNewFileIn(item) },
        { icon: '📁', label: 'Nueva carpeta', action: () => this.createNewFolderIn(item) },
        { type: 'separator' }
      )
    }
    
    // Acciones generales
    items.push(
      { icon: '✏️', label: 'Renombrar', action: () => this.startRenamingItem(item), shortcut: 'F2' },
      { icon: '🗑️', label: 'Eliminar', action: () => this.deleteItem(item) },
      { type: 'separator' }
    )
    
    // Copiar ruta
    items.push(
      { icon: '📋', label: 'Copiar ruta', action: () => this.copyPath(item) }
    )
    
    return items
  }
  
  /**
   * Ajusta la posición del menú si sale de la pantalla
   */
  adjustMenuPosition(menu) {
    const rect = menu.getBoundingClientRect()
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight
    
    let left = parseInt(menu.style.left)
    let top = parseInt(menu.style.top)
    
    if (rect.right > windowWidth) {
      left = windowWidth - rect.width - 10
      menu.style.left = `${left}px`
    }
    
    if (rect.bottom > windowHeight) {
      top = windowHeight - rect.height - 10
      menu.style.top = `${top}px`
    }
  }
  
  /**
   * Cierra el menú contextual
   */
  closeContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove()
      this.contextMenu = null
    }
  }
  
  /**
   * Limpia la selección actual
   */
  clearSelection() {
    this.container.querySelectorAll('.fm-selected, .fm-active').forEach(el => {
      el.classList.remove('fm-selected', 'fm-active')
    })
  }
  
  /**
   * Obtiene el item seleccionado
   */
  getSelectedItem() {
    const selected = this.container.querySelector('.fm-selected')
    if (selected) {
      const path = selected.dataset.path
      const type = selected.dataset.type
      return this.fileTree.find(item => item.path === path && item.type === type)
    }
    return null
  }
  
  /**
   * Crea un nuevo archivo
   */
  async createNewFile() {
    if (!this.currentFolder) {
      this.showMessage('Abre una carpeta primero', 'warning')
      return
    }
    
    const name = await this.promptInlineName('Nuevo archivo', 'archivo.txt')
    if (!name) return
    
    const fullPath = `${this.currentFolder}\\${name}`
    
    try {
      await window.api.createFile(fullPath)
      await this.refreshTree()
      
      // Abrir el nuevo archivo
      setTimeout(() => {
        this.openFile({ path: fullPath, name, isDirectory: false })
      }, 100)
    } catch (error) {
      this.showMessage('Error al crear archivo: ' + error.message, 'error')
    }
  }
  
  /**
   * Crea una nueva carpeta
   */
  async createNewFolder() {
    if (!this.currentFolder) {
      this.showMessage('Abre una carpeta primero', 'warning')
      return
    }
    
    const name = await this.promptInlineName('Nueva carpeta', 'nueva-carpeta')
    if (!name) return
    
    const fullPath = `${this.currentFolder}\\${name}`
    
    try {
      await window.api.createDir(fullPath)
      await this.refreshTree()
    } catch (error) {
      this.showMessage('Error al crear carpeta: ' + error.message, 'error')
    }
  }
  
  /**
   * Crea un nuevo archivo en una carpeta específica
   */
  async createNewFileIn(folder) {
    const name = await this.promptInlineName('Nuevo archivo', 'archivo.txt')
    if (!name) return
    
    const fullPath = `${folder.path}\\${name}`
    
    try {
      await window.api.createFile(fullPath)
      await this.refreshTree()
      
      // Abrir el nuevo archivo
      setTimeout(() => {
        this.openFile({ path: fullPath, name, isDirectory: false })
      }, 100)
    } catch (error) {
      this.showMessage('Error al crear archivo: ' + error.message, 'error')
    }
  }
  
  /**
   * Crea una nueva carpeta en una carpeta específica
   */
  async createNewFolderIn(folder) {
    const name = await this.promptInlineName('Nueva carpeta', 'nueva-carpeta')
    if (!name) return
    
    const fullPath = `${folder.path}\\${name}`
    
    try {
      await window.api.createDir(fullPath)
      await this.refreshTree()
    } catch (error) {
      this.showMessage('Error al crear carpeta: ' + error.message, 'error')
    }
  }
  
  /**
   * Abre una carpeta
   */
  async openFolder() {
    try {
      const folder = await window.api.openFolder()
      if (folder) {
        await this.loadProject(folder)
      }
    } catch (error) {
      this.showMessage('Error al abrir carpeta: ' + error.message, 'error')
    }
  }
  
  /**
   * Inicia el renombrado de un item
   */
  startRenamingItem(item) {
    const itemEl = document.querySelector(`[data-path="${item.path}"]`)
    if (itemEl) {
      this.startRenaming(itemEl)
    }
  }
  
  /**
   * Inicia el modo de edición inline
   */
  startRenaming(itemEl) {
    if (this.editingItem) {
      this.cancelEditing()
    }
    
    const label = itemEl.querySelector('.fm-label')
    const originalName = label.textContent
    
    // Crear input
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'fm-edit-input'
    input.value = originalName
    
    // Reemplazar label con input
    label.style.display = 'none'
    label.insertAdjacentElement('afterend', input)
    
    // Seleccionar todo el texto
    input.select()
    input.focus()
    
    // Guardar referencia
    this.editingItem = {
      element: itemEl,
      label: label,
      input: input,
      originalName: originalName
    }
    
    // Eventos del input
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancelEditing()
      } else if (e.key === 'Enter') {
        this.finishEditing()
      }
    })
    
    input.addEventListener('blur', () => {
      setTimeout(() => this.finishEditing(), 200)
    })
  }
  
  /**
   * Finaliza la edición inline
   */
  async finishEditing() {
    if (!this.editingItem) return
    
    const { element, label, input, originalName } = this.editingItem
    const newName = input.value.trim()
    
    // Remover input
    input.remove()
    label.style.display = ''
    
    // Limpiar referencia
    this.editingItem = null
    
    // Si el nombre no cambió, no hacer nada
    if (newName === originalName || !newName) {
      return
    }
    
    // Renombrar
    const oldPath = element.dataset.path
    const newPath = oldPath.replace(/[^/\\]+$/, newName)
    
    try {
      await window.api.rename(oldPath, newPath)
      
      // Actualizar el elemento
      element.dataset.path = newPath
      label.textContent = newName
      
      // Actualizar icono si es necesario
      const icon = element.querySelector('.fm-icon')
      icon.textContent = this.getIcon(newName, element.dataset.type === 'folder', false)
      
      // Refrescar si es necesario
      if (this.activeFile === oldPath) {
        this.activeFile = newPath
      }
      
      this.showMessage('Renombrado exitosamente', 'success')
    } catch (error) {
      this.showMessage('Error al renombrar: ' + error.message, 'error')
      // Revertir nombre en UI
      label.textContent = originalName
    }
  }
  
  /**
   * Cancela la edición inline
   */
  cancelEditing() {
    if (!this.editingItem) return
    
    const { label, input } = this.editingItem
    
    // Remover input y mostrar label
    input.remove()
    label.style.display = ''
    
    // Limpiar referencia
    this.editingItem = null
  }
  
  /**
   * Elimina un item
   */
  async deleteItem(item) {
    const itemName = item.name || item.path.split(/[/\\]/).pop()
    
    if (!confirm(`¿Eliminar "${itemName}"?`)) {
      return
    }
    
    try {
      await window.api.deleteFile(item.path)
      
      // Cerrar archivo si estaba abierto
      if (this.activeFile === item.path) {
        this.activeFile = null
      }
      
      await this.refreshTree()
      this.showMessage('Eliminado exitosamente', 'success')
    } catch (error) {
      this.showMessage('Error al eliminar: ' + error.message, 'error')
    }
  }
  
  /**
   * Copia la ruta al portapapeles
   */
  async copyPath(item) {
    try {
      await navigator.clipboard.writeText(item.path)
      this.showMessage('Ruta copiada al portapapeles', 'success')
    } catch (error) {
      this.showMessage('Error al copiar ruta', 'error')
    }
  }
  
  /**
   * Muestra un prompt inline
   */
  promptInlineName(title, defaultValue) {
    return new Promise((resolve) => {
      const modal = document.createElement('div')
      modal.className = 'fm-modal-overlay'
      modal.innerHTML = `
        <div class="fm-modal">
          <div class="fm-modal-title">${title}</div>
          <input type="text" class="fm-modal-input" value="${defaultValue}" />
          <div class="fm-modal-actions">
            <button class="fm-btn fm-btn-cancel">Cancelar</button>
            <button class="fm-btn fm-btn-primary">Crear</button>
          </div>
        </div>
      `
      
      document.body.appendChild(modal)
      
      const input = modal.querySelector('.fm-modal-input')
      const cancelBtn = modal.querySelector('.fm-btn-cancel')
      const confirmBtn = modal.querySelector('.fm-btn-primary')
      
      input.select()
      input.focus()
      
      const cleanup = () => {
        modal.remove()
      }
      
      const handleConfirm = () => {
        const value = input.value.trim()
        cleanup()
        resolve(value)
      }
      
      const handleCancel = () => {
        cleanup()
        resolve(null)
      }
      
      confirmBtn.addEventListener('click', handleConfirm)
      cancelBtn.addEventListener('click', handleCancel)
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          handleConfirm()
        } else if (e.key === 'Escape') {
          handleCancel()
        }
      })
      
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          handleCancel()
        }
      })
    })
  }
  
  /**
   * Muestra un mensaje temporal
   */
  showMessage(message, type = 'info') {
    const toast = document.createElement('div')
    toast.className = `fm-toast fm-toast-${type}`
    toast.textContent = message
    
    document.body.appendChild(toast)
    
    // Animación de entrada
    setTimeout(() => toast.classList.add('fm-toast-show'), 10)
    
    // Remover después de 3 segundos
    setTimeout(() => {
      toast.classList.remove('fm-toast-show')
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  }
  
  /**
   * Obtiene el archivo activo
   */
  getActiveFile() {
    return this.activeFile
  }
  
  /**
   * Establece callbacks externos
   */
  setCallbacks(callbacks) {
    if (callbacks.onFileOpen) this.onFileOpen = callbacks.onFileOpen
    if (callbacks.onFolderChange) this.onFolderChange = callbacks.onFolderChange
    if (callbacks.onFileSave) this.onFileSave = callbacks.onFileSave
  }
  
  /**
   * Destruye el componente
   */
  destroy() {
    this.closeContextMenu()
    if (this.editingItem) {
      this.cancelEditing()
    }
    this.container.innerHTML = ''
  }
}
