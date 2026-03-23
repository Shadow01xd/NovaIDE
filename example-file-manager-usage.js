// example-file-manager-usage.js
/**
 * Ejemplo completo de cómo usar el nuevo FileManager con Monaco Editor
 * Este archivo muestra la integración completa y puede servir como referencia
 */

import { FileManager } from './src/renderer/components/file-manager.js'
import { state } from './src/renderer/state.js'

// ── 1. Crear instancia del FileManager ───────────────────────────────────────
const container = document.getElementById('file-manager-container')

const fileManager = new FileManager(container, {
  showHidden: false,        // Mostrar archivos ocultos (.gitignore, .env, etc.)
  enableAnimations: true     // Activar animaciones suaves
})

// ── 2. Configurar callbacks de integración ───────────────────────────────────
fileManager.setCallbacks({
  /**
   * Se ejecuta cuando se abre un archivo
   * @param {string} filePath - Ruta completa del archivo
   * @param {string} content - Contenido del archivo
   * @param {string} language - Lenguaje detectado (javascript, typescript, etc.)
   */
  onFileOpen: async (filePath, content, language) => {
    console.log(`📂 Abriendo archivo: ${filePath}`)
    console.log(`🔤 Lenguaje detectado: ${language}`)
    console.log(`📄 Tamaño: ${content.length} caracteres`)
    
    // Aquí se integra con Monaco Editor
    // El estado global se encarga de crear el modelo y asignarlo al editor
    state.openFile(filePath, content)
    
    // Opcional: Notificar al usuario
    if (window.showToast) {
      window.showToast(`Archivo abierto: ${filePath.split(/[/\\]/).pop()}`, 'info')
    }
  },

  /**
   * Se ejecuta cuando cambia la carpeta actual
   * @param {string} folderPath - Ruta de la nueva carpeta
   */
  onFolderChange: (folderPath) => {
    console.log(`📁 Carpeta cambiada: ${folderPath}`)
    
    // Actualizar estado global
    state.currentFolder = folderPath
    
    // Actualizar título del sidebar si es necesario
    const sidebarTitle = document.querySelector('.sidebar-title span')
    if (sidebarTitle) {
      sidebarTitle.textContent = folderPath.split(/[/\\]/).pop().toUpperCase()
    }
    
    // Emitir evento para otros componentes
    state.emit('folderChanged', folderPath)
  },

  /**
   * Se ejecuta cuando se necesita guardar un archivo
   * @param {string} filePath - Ruta del archivo a guardar
   * @param {string} content - Contenido a guardar
   */
  onFileSave: async (filePath, content) => {
    try {
      await window.api.saveFile(filePath, content)
      console.log(`💾 Archivo guardado: ${filePath}`)
      
      // Actualizar estado
      state.markSaved(filePath, content)
      
      // Notificar éxito
      if (window.showToast) {
        window.showToast('Archivo guardado', 'success')
      }
    } catch (error) {
      console.error('❌ Error al guardar archivo:', error)
      
      // Notificar error
      if (window.showToast) {
        window.showToast('Error al guardar archivo', 'error')
      }
    }
  }
})

// ── 3. Métodos públicos del FileManager ───────────────────────────────────
class FileManagerAPI {
  /**
   * Carga un proyecto/carpeta completa
   * @param {string} folderPath - Ruta de la carpeta
   */
  async loadProject(folderPath) {
    await fileManager.loadProject(folderPath)
  }

  /**
   * Refresca el árbol de archivos
   */
  refreshTree() {
    fileManager.refreshTree()
  }

  /**
   * Obtiene el archivo actualmente activo
   * @returns {string|null} Ruta del archivo activo
   */
  getActiveFile() {
    return fileManager.getActiveFile()
  }

  /**
   * Abre una carpeta usando el diálogo del sistema
   */
  async openFolderDialog() {
    try {
      const folder = await window.api.openFolder()
      if (folder) {
        await this.loadProject(folder)
        return folder
      }
    } catch (error) {
      console.error('Error al abrir carpeta:', error)
    }
    return null
  }

  /**
   * Crea un nuevo archivo en la carpeta actual
   * @param {string} fileName - Nombre del archivo
   */
  async createNewFile(fileName) {
    if (!state.currentFolder) {
      throw new Error('No hay carpeta abierta')
    }
    
    const fullPath = `${state.currentFolder}\\${fileName}`
    try {
      await window.api.createFile(fullPath)
      await this.refreshTree()
      
      // Abrir el nuevo archivo
      const content = ''
      state.openFile(fullPath, content)
      
      return fullPath
    } catch (error) {
      console.error('Error al crear archivo:', error)
      throw error
    }
  }

  /**
   * Crea una nueva carpeta
   * @param {string} folderName - Nombre de la carpeta
   */
  async createNewFolder(folderName) {
    if (!state.currentFolder) {
      throw new Error('No hay carpeta abierta')
    }
    
    const fullPath = `${state.currentFolder}\\${folderName}`
    try {
      await window.api.createDir(fullPath)
      await this.refreshTree()
      return fullPath
    } catch (error) {
      console.error('Error al crear carpeta:', error)
      throw error
    }
  }

  /**
   * Elimina un archivo o carpeta
   * @param {string} path - Ruta del elemento a eliminar
   */
  async deleteItem(path) {
    try {
      await window.api.deleteFile(path)
      
      // Cerrar el archivo si estaba abierto
      if (state.currentFile === path) {
        state.closeTab(path)
      }
      
      await this.refreshTree()
    } catch (error) {
      console.error('Error al eliminar:', error)
      throw error
    }
  }

  /**
   * Renombra un archivo o carpeta
   * @param {string} oldPath - Ruta actual
   * @param {string} newName - Nuevo nombre
   */
  async renameItem(oldPath, newName) {
    const newPath = oldPath.replace(/[^/\\]+$/, newName)
    try {
      await window.api.rename(oldPath, newPath)
      
      // Actualizar estado si era el archivo activo
      if (state.currentFile === oldPath) {
        state.currentFile = newPath
      }
      
      await this.refreshTree()
      return newPath
    } catch (error) {
      console.error('Error al renombrar:', error)
      throw error
    }
  }

  /**
   * Expande o colapsa una carpeta
   * @param {string} folderPath - Ruta de la carpeta
   * @param {boolean} expand - true para expandir, false para colapsar
   */
  toggleFolder(folderPath, expand) {
    const folderEl = document.querySelector(`[data-path="${folderPath}"]`)
    if (folderEl) {
      if (expand && !folderEl.dataset.expanded) {
        folderEl.click() // Simula click para expandir
      } else if (!expand && folderEl.dataset.expanded) {
        folderEl.click() // Simula click para colapsar
      }
    }
  }

  /**
   * Busca un archivo por nombre y lo selecciona
   * @param {string} fileName - Nombre del archivo a buscar
   */
  findAndSelectFile(fileName) {
    const fileEl = document.querySelector(`[data-path*="${fileName}"]`)
    if (fileEl) {
      fileEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      fileEl.click()
      return true
    }
    return false
  }

  /**
   * Obtiene todos los archivos expandidos actualmente
   * @returns {string[]} Array de rutas de carpetas expandidas
   */
  getExpandedFolders() {
    const expanded = []
    document.querySelectorAll('.fm-folder[data-expanded="true"]').forEach(el => {
      expanded.push(el.dataset.path)
    })
    return expanded
  }

  /**
   * Expande múltiples carpetas a la vez
   * @param {string[]} folderPaths - Array de rutas de carpetas a expandir
   */
  async expandFolders(folderPaths) {
    for (const folderPath of folderPaths) {
      this.toggleFolder(folderPath, true)
      // Pequeña pausa para no sobrecargar la UI
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  /**
   * Filtra archivos por tipo
   * @param {string[]} extensions - Array de extensiones a mostrar
   */
  filterByExtension(extensions) {
    const allItems = document.querySelectorAll('.fm-tree-item')
    allItems.forEach(item => {
      if (item.dataset.type === 'folder') return
      
      const fileName = item.querySelector('.fm-label').textContent
      const ext = fileName.split('.').pop()?.toLowerCase()
      
      const shouldShow = extensions.includes(ext)
      item.style.display = shouldShow ? 'flex' : 'none'
    })
  }

  /**
   * Limpia todos los filtros
   */
  clearFilters() {
    const allItems = document.querySelectorAll('.fm-tree-item')
    allItems.forEach(item => {
      item.style.display = ''
    })
  }
}

// ── 4. Crear instancia de la API ─────────────────────────────────────────────
const fmAPI = new FileManagerAPI()

// ── 5. Atajos de teclado globales ─────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Ctrl+Shift+O: Abrir carpeta
  if (e.ctrlKey && e.shiftKey && e.key === 'O') {
    e.preventDefault()
    fmAPI.openFolderDialog()
  }
  
  // Ctrl+Shift+N: Nuevo archivo
  if (e.ctrlKey && e.shiftKey && e.key === 'N') {
    e.preventDefault()
    fileManager.createNewFile()
  }
  
  // Ctrl+Shift+F: Nuevo folder
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault()
    fileManager.createNewFolder()
  }
  
  // F5: Refrescar
  if (e.key === 'F5') {
    e.preventDefault()
    fmAPI.refreshTree()
  }
  
  // Ctrl+P: Buscar archivo (búsqueda simple)
  if (e.ctrlKey && e.key === 'p') {
    e.preventDefault()
    const fileName = prompt('Buscar archivo:')
    if (fileName) {
      fmAPI.findAndSelectFile(fileName)
    }
  }
})

// ── 6. Integración con el estado global ───────────────────────────────────────
state.on('folderChanged', (folderPath) => {
  console.log('📁 Estado actualizado - Carpeta:', folderPath)
})

state.on('fileOpened', ({ filePath }) => {
  console.log('📄 Estado actualizado - Archivo activo:', filePath)
})

state.on('fileSaved', (filePath) => {
  console.log('💾 Estado actualizado - Archivo guardado:', filePath)
})

// ── 7. Exportar API para uso global ───────────────────────────────────────────
window.FileManagerAPI = fmAPI
window.fileManager = fileManager

// ── 8. Ejemplos de uso ───────────────────────────────────────────────────────

/**
 * Ejemplo 1: Cargar un proyecto al iniciar
 */
async function loadInitialProject() {
  // Cargar última carpeta usada (si existe)
  const lastFolder = localStorage.getItem('lastFolder')
  if (lastFolder) {
    try {
      await fmAPI.loadProject(lastFolder)
      console.log('✅ Proyecto inicial cargado:', lastFolder)
    } catch (error) {
      console.error('❌ Error al cargar proyecto inicial:', error)
    }
  }
}

/**
 * Ejemplo 2: Auto-guardar el archivo actual
 */
function setupAutoSave() {
  let saveTimeout = null
  
  state.on('editorContentChanged', () => {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      if (state.currentFile && state.editorInstance) {
        const content = state.editorInstance.getValue()
        try {
          await window.api.saveFile(state.currentFile, content)
          state.markSaved(state.currentFile, content)
          console.log('💾 Auto-guardado:', state.currentFile)
        } catch (error) {
          console.error('❌ Error en auto-guardado:', error)
        }
      }
    }, 2000) // Esperar 2 segundos de inactividad
  })
}

/**
 * Ejemplo 3: Panel de búsqueda rápida de archivos
 */
function createQuickFileSearch() {
  const modal = document.createElement('div')
  modal.className = 'quick-file-search'
  modal.innerHTML = `
    <div class="quick-search-overlay">
      <div class="quick-search-modal">
        <input type="text" placeholder="Buscar archivo..." class="quick-search-input" />
        <div class="quick-search-results"></div>
      </div>
    </div>
  `
  
  document.body.appendChild(modal)
  
  const input = modal.querySelector('.quick-search-input')
  const results = modal.querySelector('.quick-search-results')
  
  // Atajo: Ctrl+P para abrir búsqueda rápida
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'p' && !e.shiftKey) {
      e.preventDefault()
      modal.style.display = 'flex'
      input.focus()
    }
  })
  
  input.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase()
    if (query.length < 2) {
      results.innerHTML = ''
      return
    }
    
    // Buscar archivos que coincidan
    const allFiles = document.querySelectorAll('.fm-file')
    const matches = []
    
    allFiles.forEach(fileEl => {
      const fileName = fileEl.querySelector('.fm-label').textContent.toLowerCase()
      if (fileName.includes(query)) {
        matches.push({
          name: fileEl.querySelector('.fm-label').textContent,
          path: fileEl.dataset.path,
          element: fileEl
        })
      }
    })
    
    // Mostrar resultados
    results.innerHTML = matches.slice(0, 10).map(match => `
      <div class="quick-search-result" data-path="${match.path}">
        <span class="quick-search-icon">${fileManager.getIcon(match.name, false, false)}</span>
        <span class="quick-search-name">${match.name}</span>
      </div>
    `).join('')
    
    // Click en resultado
    results.querySelectorAll('.quick-search-result').forEach(resultEl => {
      resultEl.addEventListener('click', () => {
        const path = resultEl.dataset.path
        fmAPI.findAndSelectFile(path.split(/[/\\]/).pop())
        modal.style.display = 'none'
        input.value = ''
        results.innerHTML = ''
      })
    })
  })
  
  // Cerrar con Escape
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modal.style.display = 'none'
      input.value = ''
      results.innerHTML = ''
    }
  })
  
  // Cerrar al hacer clic fuera
  modal.querySelector('.quick-search-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      modal.style.display = 'none'
      input.value = ''
      results.innerHTML = ''
    }
  })
}

// ── 9. Inicialización ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Cargar proyecto inicial
  loadInitialProject()
  
  // Configurar auto-guardado
  setupAutoSave()
  
  // Crear búsqueda rápida
  createQuickFileSearch()
  
  console.log('🚀 FileManager inicializado y listo para usar')
  console.log('📋 Atajos disponibles:')
  console.log('   Ctrl+Shift+O: Abrir carpeta')
  console.log('   Ctrl+Shift+N: Nuevo archivo')
  console.log('   Ctrl+Shift+F: Nueva carpeta')
  console.log('   Ctrl+P: Buscar archivo')
  console.log('   F5: Refrescar árbol')
})

// ── 10. Exportar para módulos ────────────────────────────────────────────────
export { FileManagerAPI, fileManager, fmAPI }
