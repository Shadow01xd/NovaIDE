// src/renderer/utils/checkpoint-manager.js
/**
 * Sistema de checkpoints tipo Cursor.
 * Guarda el estado completo (archivos Y directorios) ANTES de que el agente
 * los modifique, permitiendo restaurar cualquier cambio con un solo clic.
 *
 * Estructura de un checkpoint:
 * {
 *   id, label, timestamp,
 *   entries: [
 *     { path, type: 'file',      content, existed }
 *     { path, type: 'directory', existed }
 *   ]
 * }
 */

export class CheckpointManager {
  constructor() {
    this.checkpoints = []
    this.maxCheckpoints = 30
    this._staged = [] // [{ path, type: 'file'|'directory' }]
  }

  // ── Staging ────────────────────────────────────────────────

  stageFile(filePath) {
    if (filePath && !this._staged.some(s => s.path === filePath)) {
      this._staged.push({ path: filePath, type: 'file' })
    }
  }

  stageDirectory(dirPath) {
    if (dirPath && !this._staged.some(s => s.path === dirPath)) {
      this._staged.push({ path: dirPath, type: 'directory' })
    }
  }

  // ── Crear checkpoint ───────────────────────────────────────

  /**
   * Captura el estado actual de todos los paths staged.
   * Para directorios: hace un snapshot recursivo completo.
   * @param {string} label
   * @returns {Promise<string|null>} id del checkpoint
   */
  async createCheckpoint(label) {
    const staged = [...this._staged]
    this._staged = []
    if (staged.length === 0) return null

    const entries = []

    for (const item of staged) {
      if (item.type === 'directory') {
        await this._snapshotDirectory(item.path, entries)
      } else {
        await this._snapshotFile(item.path, entries)
      }
    }

    if (entries.length === 0) return null

    const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const cp = { id, label, timestamp: Date.now(), entries }
    this.checkpoints.push(cp)
    if (this.checkpoints.length > this.maxCheckpoints) this.checkpoints.shift()
    return id
  }

  async _snapshotFile(filePath, entries) {
    try {
      const r = await window.api.agentReadFile(filePath)
      entries.push({
        path: filePath,
        type: 'file',
        content: r?.content ?? r ?? '',
        existed: r?.success !== false,
      })
    } catch {
      entries.push({ path: filePath, type: 'file', content: '', existed: false })
    }
  }

  async _snapshotDirectory(dirPath, entries) {
    try {
      const r = await window.api.agentReadDirRecursive(dirPath)
      if (!r.success) {
        // Directorio no existe todavía (será creado por el agente)
        entries.push({ path: dirPath, type: 'directory', existed: false, files: [] })
        return
      }
      // Guardar todos los archivos dentro
      const files = r.entries.filter(e => !e.isDirectory && !e.skipped).map(e => ({
        path: e.path,
        content: e.content ?? '',
      }))
      // Guardar lista de subdirectorios (para recrear estructura vacía también)
      const dirs = r.entries.filter(e => e.isDirectory).map(e => e.path)
      entries.push({ path: dirPath, type: 'directory', existed: true, files, dirs })
    } catch {
      entries.push({ path: dirPath, type: 'directory', existed: false, files: [] })
    }
  }

  // ── Restaurar checkpoint ───────────────────────────────────

  /**
   * Restaura todos los archivos y directorios al estado del checkpoint.
   * @param {string} id
   * @returns {Promise<{ restored: string[], deleted: string[], errors: string[] }>}
   */
  async restoreCheckpoint(id) {
    const cp = this.checkpoints.find(c => c.id === id)
    if (!cp) throw new Error(`Checkpoint "${id}" no encontrado`)

    const restored = []
    const deleted = []
    const errors = []

    for (const entry of cp.entries) {
      try {
        if (entry.type === 'file') {
          if (entry.existed) {
            // Recrear directorios padre si faltan
            const r = await window.api.agentWriteFile(entry.path, entry.content)
            if (r?.success !== false) restored.push(entry.path)
            else errors.push(`No se pudo restaurar: ${entry.path}`)
          } else {
            // El archivo no existía → eliminar si ahora existe
            try {
              await window.api.agentDeleteFile(entry.path)
              deleted.push(entry.path)
            } catch { /* ya no existe */ }
          }
        } else if (entry.type === 'directory') {
          if (entry.existed) {
            // Restaurar directorio y todos sus archivos
            await this._restoreDirectory(entry, restored, errors)
          } else {
            // El directorio no existía → eliminarlo si fue creado
            try {
              await window.api.agentDeleteDirectory(entry.path)
              deleted.push(entry.path)
            } catch { /* ya no existe */ }
          }
        }
      } catch (e) {
        errors.push(`Error restaurando ${entry.path}: ${e.message}`)
      }
    }

    return { restored, deleted, errors }
  }

  async _restoreDirectory(entry, restored, errors) {
    // 1. Primero crear el directorio raíz y subdirectorios
    try {
      await window.api.agentCreateDir(entry.path)
    } catch {}

    if (entry.dirs) {
      // Ordenar por profundidad para crear padres antes que hijos
      const sorted = [...entry.dirs].sort((a, b) => a.split(/[\\/]/).length - b.split(/[\\/]/).length)
      for (const dir of sorted) {
        try { await window.api.agentCreateDir(dir) } catch {}
      }
    }

    // 2. Restaurar todos los archivos dentro
    for (const file of (entry.files || [])) {
      try {
        const r = await window.api.agentWriteFile(file.path, file.content)
        if (r?.success !== false) restored.push(file.path)
        else errors.push(`No se pudo restaurar: ${file.path}`)
      } catch (e) {
        errors.push(`Error en ${file.path}: ${e.message}`)
      }
    }

    // 3. Si la carpeta fue vaciada por completo (no había archivos), igual se marca
    if (!entry.files?.length) restored.push(entry.path + ' (directorio vacío)')
  }

  // ── Helpers ────────────────────────────────────────────────

  /**
   * Añade un path al checkpoint YA existente (para acumular en la misma sesión).
   */
  async addToCheckpoint(id, path, type = 'file') {
    const cp = this.getById(id)
    if (!cp) return
    const already = cp.entries.some(e => e.path === path)
    if (already) return
    const tempEntries = []
    if (type === 'directory') {
      await this._snapshotDirectory(path, tempEntries)
    } else {
      await this._snapshotFile(path, tempEntries)
    }
    cp.entries.push(...tempEntries)
  }

  /**
   * Guarda estadísticas de líneas (añadidas/eliminadas) en la entrada del checkpoint.
   */
  setEntryStats(id, path, added, removed) {
    const cp = this.getById(id)
    if (!cp) return
    const entry = cp.entries.find(e => e.path === path)
    if (entry) entry.stats = { added, removed }
  }

  getAll() { return [...this.checkpoints].reverse() }
  getById(id) { return this.checkpoints.find(c => c.id === id) || null }
  remove(id) { this.checkpoints = this.checkpoints.filter(c => c.id !== id) }
  clear() { this.checkpoints = []; this._staged = [] }
}

export const checkpointManager = new CheckpointManager()
