/**
 * Keeps the AI agent's file and command tools inside the open project folder.
 *
 * The agent acts on model output, and the model reads project files, so a
 * malicious file could instruct it to touch paths elsewhere on the disk
 * (startup folders, shell profiles, SSH keys...). Every agent:* IPC handler
 * checks its paths here, in the main process, so the renderer cannot skip it.
 */
const path = require('path')
const fs = require('fs')

let workspaceRoot = null

function setWorkspaceRoot(rootPath) {
  workspaceRoot = typeof rootPath === 'string' && rootPath ? resolveReal(rootPath) : null
}

function getWorkspaceRoot() {
  return workspaceRoot
}

// Resolves symlinks/junctions for the part of the path that exists, so a link
// inside the project cannot point the agent outside of it.
function resolveReal(p) {
  let current = path.resolve(p)
  const missing = []
  for (;;) {
    try {
      return path.join(fs.realpathSync.native(current), ...missing.reverse())
    } catch {
      const parent = path.dirname(current)
      if (parent === current) return path.resolve(p)
      missing.push(path.basename(current))
      current = parent
    }
  }
}

function isInsideWorkspace(p) {
  if (!workspaceRoot || typeof p !== 'string' || !p) return false
  const rel = path.relative(workspaceRoot, resolveReal(p))
  return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel))
}

function isWorkspaceRoot(p) {
  if (!workspaceRoot || typeof p !== 'string' || !p) return false
  return path.relative(workspaceRoot, resolveReal(p)) === ''
}

// Writing inside .git (hooks, config) would let the agent run code on the
// next git command, so it is off-limits even within the project.
function isInsideGitDir(p) {
  if (!workspaceRoot) return false
  const rel = path.relative(workspaceRoot, resolveReal(p))
  return rel.split(path.sep).includes('.git')
}

/**
 * Returns an error message if any path is outside the project, or null.
 * @param {string[]} paths
 * @param {{ write?: boolean }} [opts] write=true also blocks paths inside .git
 */
function checkPaths(paths, { write = false } = {}) {
  if (!workspaceRoot) {
    return 'No hay ninguna carpeta de proyecto abierta: el agente solo puede trabajar dentro de un proyecto.'
  }
  for (const p of paths) {
    if (!isInsideWorkspace(p)) {
      return `Ruta fuera del proyecto bloqueada por seguridad: ${p}`
    }
    if (write && isInsideGitDir(p)) {
      return `El agente no puede modificar la carpeta .git: ${p}`
    }
  }
  return null
}

module.exports = { setWorkspaceRoot, getWorkspaceRoot, isInsideWorkspace, isWorkspaceRoot, checkPaths }
