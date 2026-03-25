// src/renderer/utils/history-manager.js
/**
 * Gestiona el historial de cambios del editor con soporte para ramificación (branching),
 * agrupación inteligente de cambios y persistencia.
 */

export class HistoryManager {
  constructor(limit = 5000) {
    this.histories = {} // { filePath: { stack: [], index: -1 } }
    this.limit = limit
    this.groupingThreshold = 800 // ms por defecto
    this.lastPushTime = 0
  }

  /**
   * Inicializa el historial para un archivo si no existe.
   */
  initFile(filePath) {
    if (!this.histories[filePath]) {
      this.histories[filePath] = {
        stack: [],
        index: -1,
        lastContent: ''
      }
    }
    return this.histories[filePath]
  }

  /**
   * Agrega un nuevo estado al historial.
   * @param {string} filePath - Ruta del archivo.
   * @param {Object} state - { content, cursor, selection, language, foldedRanges }
   * @param {boolean} force - Si es true, no agrupa cambios.
   */
  pushState(filePath, state, force = false) {
    const history = this.initFile(filePath)
    const now = Date.now()
    
    // Evitar duplicados exactos del último contenido
    if (history.stack.length > 0 && history.stack[history.index].content === state.content) {
      // Solo actualizamos cursor/selección si es el mismo contenido
      history.stack[history.index].cursor = state.cursor
      history.stack[history.index].selection = state.selection
      return
    }

    // Lógica de agrupación inteligente (Debounce + Detección de Frases)
    const isPhraseEnd = /[.!?\n:;]$/.test(state.content.trim())
    const timeElapsed = now - this.lastPushTime
    
    if (!force && 
        history.index >= 0 && 
        timeElapsed < this.groupingThreshold &&
        !isPhraseEnd) {
      // Actualizamos el estado actual en lugar de añadir uno nuevo
      history.stack[history.index] = {
        ...state,
        timestamp: now
      }
    } else {
      // Branching: si estamos en medio del stack y editamos, creamos una ramificación
      // En este sistema simple, truncamos el "futuro" pero en una versión avanzada
      // podríamos guardar las ramas en un árbol.
      if (history.index < history.stack.length - 1) {
        history.stack = history.stack.slice(0, history.index + 1)
      }

      history.stack.push({
        ...state,
        timestamp: now
      })

      // Mantener el límite
      if (history.stack.length > this.limit) {
        history.stack.shift()
      } else {
        history.index++
      }
    }

    this.lastPushTime = now

    // Persistencia automática en disco
    if (window.api?.historySave) {
      window.api.historySave({ filePath, history: { stack: history.stack, index: history.index } })
    }
  }

  /**
   * Deshace el último cambio.
   */
  undo(filePath) {
    const history = this.histories[filePath]
    if (!history || history.index <= 0) return null
    history.index--
    return history.stack[history.index]
  }

  /**
   * Rehace el cambio previamente deshecho.
   */
  redo(filePath) {
    const history = this.histories[filePath]
    if (!history || history.index >= history.stack.length - 1) return null
    history.index++
    return history.stack[history.index]
  }

  /**
   * Salta a un estado específico del historial.
   */
  jumpTo(filePath, index) {
    const history = this.histories[filePath]
    if (!history || index < 0 || index >= history.stack.length) return null
    history.index = index
    return history.stack[history.index]
  }

  /**
   * Obtiene el historial completo de un archivo.
   */
  getHistory(filePath) {
    return this.histories[filePath] || { stack: [], index: -1 }
  }

  /**
   * Carga el historial desde un objeto (usado para persistencia).
   */
  loadHistory(filePath, data) {
    if (data && Array.isArray(data.stack)) {
      this.histories[filePath] = {
        stack: data.stack,
        index: data.index || (data.stack.length - 1),
        lastContent: data.stack.length > 0 ? data.stack[data.stack.length - 1].content : ''
      }
    }
  }

  /**
   * Limpia el historial de un archivo.
   */
  clear(filePath) {
    delete this.histories[filePath]
  }
}

// Exportar instancia única
export const historyManager = new HistoryManager()
