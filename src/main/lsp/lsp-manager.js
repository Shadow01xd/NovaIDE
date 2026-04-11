const { spawn } = require('child_process')
const path = require('path')

function pathToFileUri(p) {
  let out = String(p).replace(/\\/g, '/')
  if (!out.startsWith('/')) out = '/' + out
  return 'file://' + encodeURI(out)
}

function lspPositionFromMonaco(pos) {
  return { line: Math.max(0, pos.lineNumber - 1), character: Math.max(0, pos.column - 1) }
}

function monacoFromLspPosition(pos) {
  return { lineNumber: (pos?.line ?? 0) + 1, column: (pos?.character ?? 0) + 1 }
}

class LspProcess {
  constructor({ name, command, args, rootPath, env }) {
    this.name = name
    this.command = command
    this.args = args || []
    this.rootPath = rootPath || null
    this.env = env || null

    this.proc = null
    this.buffer = ''
    this.nextId = 1
    this.pending = new Map()
    this.initialized = false
    this._initPromise = null
    this.lastError = null
    this.lastStderr = ''
  }

  start() {
    if (this.proc) return

    this.proc = spawn(this.command, this.args, {
      stdio: 'pipe',
      windowsHide: true,
      env: this.env ? { ...process.env, ...this.env } : process.env,
    })

    this.proc.stdout.on('data', (chunk) => this._onStdout(chunk))
    this.proc.stderr.on('data', (chunk) => {
      try {
        const s = chunk.toString('utf8')
        this.lastStderr = (this.lastStderr + s).slice(-8000)
      } catch {}
    })

    this.proc.on('error', (err) => {
      this.lastError = err
      for (const [, p] of this.pending) {
        try {
          p.reject(err)
        } catch {}
      }
      this.pending.clear()
      this.proc = null
      this.initialized = false
      this._initPromise = null
    })

    this.proc.on('exit', () => {
      for (const [, p] of this.pending) {
        try {
          p.reject(new Error(`${this.name} exited`))
        } catch {}
      }
      this.pending.clear()
      this.proc = null
      this.initialized = false
      this._initPromise = null
      this.buffer = ''
    })
  }

  stop() {
    if (!this.proc) return
    try {
      this.proc.kill()
    } catch {}
  }

  setRootPath(rootPath) {
    this.rootPath = rootPath || null
  }

  _write(msg) {
    if (!this.proc) throw new Error(`${this.name} not started`)
    const json = JSON.stringify(msg)
    const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`
    this.proc.stdin.write(payload)
  }

  request(method, params) {
    const id = this.nextId++
    const msg = { jsonrpc: '2.0', id, method, params }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      try {
        this._write(msg)
      } catch (e) {
        this.pending.delete(id)
        reject(e)
      }
    })
  }

  notify(method, params) {
    const msg = { jsonrpc: '2.0', method, params }
    this._write(msg)
  }

  async initialize() {
    if (this.initialized) return true
    if (this._initPromise) return this._initPromise

    this.start()

    const rootUri = this.rootPath ? pathToFileUri(this.rootPath) : null

    this._initPromise = (async () => {
      try {
        await this.request('initialize', {
        processId: process.pid,
        rootUri,
        capabilities: {
          textDocument: {
            completion: { completionItem: { snippetSupport: true } },
            hover: {},
            definition: {},
          },
          workspace: {},
        },
        workspaceFolders: this.rootPath
          ? [{ uri: rootUri, name: path.basename(this.rootPath) }]
          : null,
        })

        this.notify('initialized', {})
        this.initialized = true
        return true
      } catch (e) {
        const stderr = this.lastStderr ? `\n${this.lastStderr}` : ''
        const msg = `${this.name} initialize failed: ${e?.message || e}${stderr}`
        throw new Error(msg)
      }
    })()

    return this._initPromise
  }

  _onStdout(chunk) {
    this.buffer += chunk.toString('utf8')

    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n')
      if (headerEnd === -1) return

      const header = this.buffer.slice(0, headerEnd)
      const match = /Content-Length: (\d+)/i.exec(header)
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4)
        continue
      }

      const len = Number(match[1])
      const bodyStart = headerEnd + 4
      if (this.buffer.length < bodyStart + len) return

      const body = this.buffer.slice(bodyStart, bodyStart + len)
      this.buffer = this.buffer.slice(bodyStart + len)

      let msg
      try {
        msg = JSON.parse(body)
      } catch {
        continue
      }

      if (msg && typeof msg.id !== 'undefined') {
        const pending = this.pending.get(msg.id)
        if (pending) {
          this.pending.delete(msg.id)
          if (msg.error) pending.reject(new Error(msg.error.message || 'LSP error'))
          else pending.resolve(msg.result)
        }
      }
    }
  }
}

class LspManager {
  constructor() {
    this.rootPath = null
    this.servers = new Map()
  }

  setWorkspaceRoot(rootPath) {
    this.rootPath = rootPath || null
    for (const [, server] of this.servers) server.setRootPath(this.rootPath)
  }

  _ensureServer(languageId) {
    const key = this._serverKey(languageId)
    if (!key) return null
    if (this.servers.has(key)) return this.servers.get(key)

    const server = this._createServer(key)
    this.servers.set(key, server)
    return server
  }

  _serverKey(languageId) {
    const lang = String(languageId || '').toLowerCase()
    if (['typescript', 'javascript', 'typescriptreact', 'javascriptreact'].includes(lang)) return 'ts'
    if (lang === 'python') return 'py'
    if (['c', 'cpp'].includes(lang)) return 'clangd'
    return null
  }

  _createServer(key) {
    if (key === 'ts') {
      const script = require.resolve('typescript-language-server/lib/cli.mjs')
      return new LspProcess({
        name: 'typescript-language-server',
        command: process.execPath,
        args: [script, '--stdio'],
        rootPath: this.rootPath,
        env: { ELECTRON_RUN_AS_NODE: '1' },
      })
    }

    if (key === 'py') {
      const script = require.resolve('pyright/dist/pyright-langserver.js')
      return new LspProcess({
        name: 'pyright-langserver',
        command: process.execPath,
        args: [script, '--stdio'],
        rootPath: this.rootPath,
        env: { ELECTRON_RUN_AS_NODE: '1' },
      })
    }

    if (key === 'clangd') {
      return new LspProcess({
        name: 'clangd',
        command: 'clangd',
        args: ['--log=error'],
        rootPath: this.rootPath,
      })
    }

    throw new Error(`Unknown LSP server key: ${key}`)
  }

  async start(languageId) {
    const server = this._ensureServer(languageId)
    if (!server) return { ok: false, error: 'unsupported-language' }
    try {
      await server.initialize()
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }

  async didOpen({ uri, languageId, text, version }) {
    const server = this._ensureServer(languageId)
    if (!server) return { ok: false, error: 'unsupported-language' }
    await server.initialize()
    server.notify('textDocument/didOpen', {
      textDocument: { uri, languageId, version: version || 1, text: text || '' },
    })
    return { ok: true }
  }

  async didChange({ uri, languageId, text, version }) {
    const server = this._ensureServer(languageId)
    if (!server) return { ok: false, error: 'unsupported-language' }
    await server.initialize()
    server.notify('textDocument/didChange', {
      textDocument: { uri, version: version || 1 },
      contentChanges: [{ text: text || '' }],
    })
    return { ok: true }
  }

  async didClose({ uri, languageId }) {
    const server = this._ensureServer(languageId)
    if (!server) return { ok: false, error: 'unsupported-language' }
    await server.initialize()
    server.notify('textDocument/didClose', { textDocument: { uri } })
    return { ok: true }
  }

  async completion({ uri, languageId, position }) {
    const server = this._ensureServer(languageId)
    if (!server) return { ok: false, error: 'unsupported-language' }
    await server.initialize()
    const lspPos = lspPositionFromMonaco(position)
    const result = await server.request('textDocument/completion', {
      textDocument: { uri },
      position: lspPos,
    })
    return { ok: true, result }
  }

  async hover({ uri, languageId, position }) {
    const server = this._ensureServer(languageId)
    if (!server) return { ok: false, error: 'unsupported-language' }
    await server.initialize()
    const lspPos = lspPositionFromMonaco(position)
    const result = await server.request('textDocument/hover', {
      textDocument: { uri },
      position: lspPos,
    })
    return { ok: true, result }
  }

  async definition({ uri, languageId, position }) {
    const server = this._ensureServer(languageId)
    if (!server) return { ok: false, error: 'unsupported-language' }
    await server.initialize()
    const lspPos = lspPositionFromMonaco(position)
    const result = await server.request('textDocument/definition', {
      textDocument: { uri },
      position: lspPos,
    })
    return { ok: true, result }
  }

  static monacoFromLspPosition(pos) {
    return monacoFromLspPosition(pos)
  }
}

module.exports = { LspManager, pathToFileUri }
