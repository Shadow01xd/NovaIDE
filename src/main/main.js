// src/main/main.js
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('path')
const fs   = require('fs')
const os   = require('os')

const VITE_DEV_URL = 'http://localhost:5173'
async function isViteRunning() {
  try {
    const http = require('http')
    return await new Promise(r => {
      const req = http.get(VITE_DEV_URL, () => r(true))
      req.on('error', () => r(false))
      req.setTimeout(1000, () => { req.destroy(); r(false) })
    })
  } catch { return false }
}

let mainWin
async function createWindow() {
  mainWin = new BrowserWindow({
    width: 1600, height: 950, minWidth: 1000, minHeight: 600,
    backgroundColor: '#0d1117',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Archivo', submenu: [
      { label: 'Abrir carpeta…', accelerator: 'CmdOrCtrl+Shift+O', click: () => mainWin.webContents.send('menu:openFolder') },
      { label: 'Nuevo archivo',  accelerator: 'CmdOrCtrl+N',       click: () => mainWin.webContents.send('menu:newFile') },
      { label: 'Guardar',        accelerator: 'CmdOrCtrl+S',       click: () => mainWin.webContents.send('menu:save') },
      { label: 'Guardar como…',  accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWin.webContents.send('menu:saveAs') },
      { type: 'separator' },
      { role: 'quit', label: 'Salir' },
    ]},
    { label: 'Editar', submenu: [
      { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' },
      { type: 'separator' },
      { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' },
    ]},
    { label: 'Ver', submenu: [
      { label: 'Explorador',   accelerator: 'CmdOrCtrl+B',         click: () => mainWin.webContents.send('menu:toggleExplorer') },
      { label: 'Cerrar Explorador', accelerator: 'CmdOrCtrl+Shift+B', click: () => mainWin.webContents.send('menu:closeExplorer') },
      { label: 'Terminal',     accelerator: 'CmdOrCtrl+`',        click: () => mainWin.webContents.send('menu:toggleTerminal') },
      { label: 'Chat IA',      accelerator: 'CmdOrCtrl+Shift+L',  click: () => mainWin.webContents.send('menu:toggleAI') },
      { label: 'Toggle Chat IA', accelerator: 'CmdOrCtrl+Alt+I',   click: () => mainWin.webContents.send('menu:toggleAI') },
      { label: 'Extensiones',  accelerator: 'CmdOrCtrl+Shift+X',  click: () => mainWin.webContents.send('menu:toggleExtensions') },
      { label: 'Buscar',       accelerator: 'CmdOrCtrl+Shift+F',  click: () => mainWin.webContents.send('menu:toggleSearch') },
      { type: 'separator' },
      { role: 'reload' }, { role: 'toggleDevTools' },
    ]},
  ]))

  if (await isViteRunning()) {
    mainWin.loadURL(VITE_DEV_URL)
    mainWin.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWin.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ── File System ──────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('dialog:saveAs', async (_, defaultPath) => {
  const r = await dialog.showSaveDialog({ defaultPath })
  return r.canceled ? null : r.filePath
})

function walkDir(dir, depth = 0) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    return entries
      .filter(e => !e.name.startsWith('.') || ['gitignore','.env'].includes(e.name))
      .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name))
      .map(e => {
        const full = path.join(dir, e.name)
        return {
          name: e.name, path: full, isDirectory: e.isDirectory(),
          children: e.isDirectory() ? [] : undefined,
        }
      })
  } catch { return [] }
}

ipcMain.handle('fs:readDir',    async (_, p) => walkDir(p))
ipcMain.handle('fs:readDirSub', async (_, p) => walkDir(p))
ipcMain.handle('fs:readFile',   async (_, p) => fs.readFileSync(p, 'utf-8'))
ipcMain.handle('fs:saveFile',   async (_, p, c) => { fs.writeFileSync(p, c, 'utf-8'); return true })
ipcMain.handle('fs:copyFile',   async (_, s, d) => { fs.copyFileSync(s, d); return true })
ipcMain.handle('fs:stat',       async (_, p) => { const st = fs.statSync(p); return { isDirectory: st.isDirectory() } })
ipcMain.handle('fs:deleteFile', async (_, p) => {
  const stat = fs.statSync(p)
  if (stat.isDirectory()) fs.rmdirSync(p, { recursive: true })
  else fs.unlinkSync(p)
  return true
})
ipcMain.handle('fs:rename',     async (_, o, n) => { fs.renameSync(o, n); return true })
ipcMain.handle('fs:createFile', async (_, p) => { fs.writeFileSync(p, '', 'utf-8'); return true })
ipcMain.handle('fs:createDir',  async (_, p) => { fs.mkdirSync(p, { recursive: true }); return true })
ipcMain.handle('fs:exists',     async (_, p) => fs.existsSync(p))
ipcMain.handle('shell:open',    async (_, p) => shell.openPath(p))

// ── AI: streaming via Ollama ──────────────────────────────────────────────────
ipcMain.handle('ai:models', async () => {
  try {
    const res  = await fetch('http://127.0.0.1:11434/api/tags')
    const data = await res.json()
    return (data.models || []).map(m => m.name)
  } catch { return [] }
})

// Non-streaming (for quick queries)
ipcMain.handle('ai:chat', async (_, { messages, model = 'deepseek-coder' }) => {
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)
  return (await res.json()).message.content
})

// Streaming — emite 'ai:token' para cada chunk
ipcMain.handle('ai:stream', async (_, { messages, model = 'deepseek-coder', reqId }) => {
  const res = await fetch('http://127.0.0.1:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}`)

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = dec.decode(value).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        const token = obj.message?.content || ''
        full += token
        mainWin.webContents.send('ai:token', { reqId, token, done: obj.done })
      } catch {}
    }
  }
  return full
})

// ── Settings persistence ──────────────────────────────────────────────────────
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')
ipcMain.handle('settings:get', () => {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')) } catch { return {} }
})
ipcMain.handle('settings:set', (_, data) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2)); return true
})

// ── Terminal (node-pty) ───────────────────────────────────────────────────────
const ptys = {}
ipcMain.handle('terminal:create', async (_, { id, cwd }) => {
  if (ptys[id]) { try { ptys[id].kill() } catch {} }
  try {
    const pty = require('node-pty')
    const sh  = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash')
    ptys[id]  = pty.spawn(sh, [], {
      name: 'xterm-256color', cols: 120, rows: 30,
      cwd: cwd || os.homedir(), env: process.env,
    })
    ptys[id].onData(data => mainWin.webContents.send('terminal:data', { id, data }))
    ptys[id].onExit(()   => mainWin.webContents.send('terminal:exit', { id }))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})
ipcMain.on('terminal:write',  (_, { id, data })      => ptys[id]?.write(data))
ipcMain.on('terminal:resize', (_, { id, cols, rows }) => ptys[id]?.resize(cols, rows))
ipcMain.handle('terminal:kill', (_, id) => { try { ptys[id]?.kill(); delete ptys[id] } catch {} })

// ── AI Agent Tools ───────────────────────────────────────────────────────────

// Path utilities for renderer
ipcMain.handle('path:join', (_, ...args) => path.join(...args))
ipcMain.handle('path:isAbsolute', (_, p) => path.isAbsolute(p))
ipcMain.handle('path:dirname', (_, p) => path.dirname(p))
ipcMain.handle('path:basename', (_, p) => path.basename(p))

ipcMain.handle('agent:readFile', async (_, p) => {
  try {
    return { success: true, content: fs.readFileSync(p, 'utf-8') }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('agent:writeFile', async (_, p, c) => {
  try {
    fs.writeFileSync(p, c, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('agent:createFile', async (_, p, c = '') => {
  try {
    fs.writeFileSync(p, c, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('agent:deleteFile', async (_, p) => {
  try {
    const stat = fs.statSync(p)
    if (stat.isDirectory()) {
      fs.rmdirSync(p, { recursive: true })
    } else {
      fs.unlinkSync(p)
    }
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('agent:listFiles', async (_, p) => {
  try {
    const entries = fs.readdirSync(p, { withFileTypes: true })
    return {
      success: true,
      files: entries
        .filter(e => !e.name.startsWith('.') || ['.gitignore','.env'].includes(e.name))
        .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name))
        .map(e => ({
          name: e.name,
          path: path.join(p, e.name),
          isDirectory: e.isDirectory()
        }))
    }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('agent:searchInFiles', async (_, query, dir) => {
  const results = []
  function searchRecursive(currentDir) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          searchRecursive(fullPath)
        } else if (entry.isFile() && entry.name.match(/\.(js|ts|jsx|tsx|py|json|md|txt|html|css|scss|java|go|rs|c|cpp|h|hpp)$/)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            if (content.includes(query)) {
              const lines = content.split('\n')
              const matches = []
              lines.forEach((line, idx) => {
                if (line.includes(query)) {
                  matches.push({ line: idx + 1, text: line.trim().substring(0, 100) })
                }
              })
              if (matches.length > 0) {
                results.push({ path: fullPath, matches: matches.slice(0, 5) })
              }
            }
          } catch {}
        }
      }
    } catch {}
  }
  searchRecursive(dir)
  return { success: true, results: results.slice(0, 20) }
})

// ── DeepSeek API streaming ───────────────────────────────────────────────────
ipcMain.handle('ai:streamDeepSeek', async (_, { messages, model, apiKey, reqId }) => {
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, stream: true })
    })
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`)
    
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let full = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = dec.decode(value).split('\n').filter(line => line.trim())
      for (const line of lines) {
        if (line === 'data: [DONE]') continue
        if (!line.startsWith('data: ')) continue
        
        try {
          const obj = JSON.parse(line.slice(6))
          const token = obj.choices?.[0]?.delta?.content || ''
          mainWindow.webContents.send('ai:token', { token, done: false, reqId })
        } catch {}
      }
    }
    
    mainWindow.webContents.send('ai:token', { token: '', done: true, reqId })
  } catch (err) {
    mainWindow.webContents.send('ai:error', { error: err.message, reqId })
  }
})

// ── Groq API streaming ───────────────────────────────────────────────────
ipcMain.handle('ai:streamGroq', async (_, { messages, model, apiKey, reqId }) => {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ 
        model: model || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: messages, 
        stream: true,
        max_tokens: 8192,
        temperature: 0.7
      })
    })
    if (!res.ok) {
      const errorText = await res.text()
      console.error('Groq API error:', errorText)
      throw new Error(`Groq ${res.status}: ${errorText}`)
    }
    
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let full = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const lines = dec.decode(value).split('\n').filter(line => line.trim())
      for (const line of lines) {
        if (line === 'data: [DONE]') continue
        if (!line.startsWith('data: ')) continue
        
        try {
          const obj = JSON.parse(line.slice(6))
          const token = obj.choices?.[0]?.delta?.content || ''
          mainWindow.webContents.send('ai:token', { token, done: false, reqId })
        } catch {}
      }
    }
    
    mainWindow.webContents.send('ai:token', { token: '', done: true, reqId })
  } catch (err) {
    mainWindow.webContents.send('ai:error', { error: err.message, reqId })
  }
})

// ── Extension Store (Marketplace Oficial) ───────────────────────────────────
const MarketplaceService = require('./marketplace/marketplace-service.js')
const marketplace = new MarketplaceService()

ipcMain.handle('marketplace:search', async (_, query) => {
  return await marketplace.searchExtensions(query)
})

ipcMain.handle('marketplace:details', async (_, { publisher, name }) => {
  return await marketplace.getExtensionDetails(publisher, name)
})

ipcMain.handle('marketplace:install', async (_, { publisher, name, version }) => {
  try {
    const meta = await marketplace.installExtension(publisher, name, version)
    return { success: true, meta }
  } catch (error) {
    console.error('Failed to install extension:', error)
    throw error
  }
})

ipcMain.handle('marketplace:uninstall', async (_, { publisher, name }) => {
  try {
    const result = await marketplace.uninstallExtension(publisher, name)
    return { success: true, result }
  } catch (error) {
    console.error('Failed to uninstall extension:', error)
    throw error
  }
})

ipcMain.handle('marketplace:installed', async () => {
  return await marketplace.getInstalledExtensions()
})

ipcMain.handle('marketplace:check-updates', async () => {
  return await marketplace.checkUpdates()
})
