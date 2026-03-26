// src/renderer/utils/checkpoint-manager.js
/**
 * Sistema de checkpoints tipo Cursor — guarda el estado de los archivos
 * ANTES de que el agente los modifique, permitiendo restaurar cambios.
 */

export class CheckpointManager {
  constructor() {
    this.checkpoints = [] // [{ id, label, timestamp, files: [{path, content, existed}] }]
    this.maxCheckpoints = 30
    this._pendingFiles = new Set() // archivos staged para el próximo checkpoint
  }

  /**
   * Marca un archivo para incluirlo en el próximo checkpoint.
   */
  stageFile(filePath) {
    if (filePath) this._pendingFiles.add(filePath)
  }

  /**
   * Crea un checkpoint con los archivos staged + cualquier extra.
   * Lee el contenido ACTUAL antes de que el agente haga cambios.
   * @param {string} label - Descripción del checkpoint
   * @param {string[]} [extraPaths] - Rutas adicionales a incluir
   * @returns {Promise<string>} id del checkpoint creado
   */
  async createCheckpoint(label, extraPaths = []) {
    const allPaths = new Set([...this._pendingFiles, ...extraPaths])
    this._pendingFiles.clear()

    if (allPaths.size === 0) return null

    const files = []
    for (const fp of allPaths) {
      try {
        const r = await window.api.agentReadFile(fp)
        files.push({
          path: fp,
          content: r?.content ?? r ?? '',
          existed: true,
        })
      } catch {
        // El archivo no existía antes del cambio del agente
        files.push({ path: fp, content: '', existed: false })
      }
    }

    const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const cp = { id, label, timestamp: Date.now(), files }
    this.checkpoints.push(cp)

    // Limitar tamaño
    if (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.shift()
    }

    return id
  }

  /**
   * Restaura todos los archivos a su estado en el checkpoint indicado.
   * @param {string} id
   * @returns {Promise<{restored: string[], deleted: string[]}>}
   */
  async restoreCheckpoint(id) {
    const cp = this.checkpoints.find((c) => c.id === id)
    if (!cp) throw new Error(`Checkpoint "${id}" no encontrado`)

    const restored = []
    const deleted = []

    for (const file of cp.files) {
      if (file.existed) {
        // Restaurar contenido anterior
        const r = await window.api.agentWriteFile(file.path, file.content)
        if (r?.success !== false) restored.push(file.path)
      } else {
        // El archivo no existía → eliminarlo si ahora existe
        try {
          await window.api.agentDeleteFile(file.path)
          deleted.push(file.path)
        } catch {
          // Ya no existe, ok
        }
      }
    }

    return { restored, deleted }
  }

  /**
   * Devuelve la lista de checkpoints en orden cronológico inverso.
   */
  getAll() {
    return [...this.checkpoints].reverse()
  }

  getById(id) {
    return this.checkpoints.find((c) => c.id === id) || null
  }

  /**
   * Elimina un checkpoint específico.
   */
  remove(id) {
    this.checkpoints = this.checkpoints.filter((c) => c.id !== id)
  }

  clear() {
    this.checkpoints = []
    this._pendingFiles.clear()
  }
}

export const checkpointManager = new CheckpointManager()
