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
ipcMain.handle('fs:exists',     async (_, p) => fs.existsSync(p))

// ── AI Inline Completion (Universal) ──────────────────────────────────────────
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')

function buildInlinePrompt({ prefix, suffix, language, filePath, extendedContext, currentLine, beforeCursor, structuralContext }) {
  // Sistema inteligente según lenguaje y contexto
  const isHTML = language === 'html'
  const isJavaScript = language === 'javascript' || language === 'typescript'
  const isPython = language === 'python'
  
  return {
    system: `
Eres un motor de autocompletado de nivel profesional como Cursor/Windsurf.

PRINCIPIOS FUNDAMENTALES:
1. Analiza el contexto completo del archivo
2. Entiende el flujo lógico del código
3. Proporciona continuaciones naturales y coherentes
4. Para HTML: si escribe "html" o "htm", da el documento completo
5. Para otros lenguajes: da continuaciones lógicas con múltiples líneas si es necesario
6. NUNCA expliques lo que haces, solo da el código
7. Mantén la sintaxis y estilo del lenguaje
8. NUNCA dupliques texto que ya existe después del cursor
9. Si el sufijo ya contiene cierres/tags, evita repetirlos
10. Para HTML, respeta jerarquía de etiquetas abiertas/cerradas
11. La continuación empieza EXACTAMENTE donde terminó el cursor: no repitas palabras ni frases que ya estén en la misma línea antes del cursor (incl. si el usuario dejó una palabra a medias)

CONTEXTO COMPLETO: Usa todo el contexto del archivo para sugerencias inteligentes.
SALTOS DE LÍNEA: Son válidos y necesarios para código multilinea.

EJEMPLOS INTELIGENTES:
- HTML "html" → Documento HTML completo con estructura moderna
- JavaScript "const arr = [" → Array multilinea con elementos
- Python "def " → Función completa con lógica
- Cualquier lenguaje: Continúa el flujo lógico del código

SÉ INTELIGENTE, NO LIMITADO.
`.trim(),

    user: `
=== CONTEXTO COMPLETO ===
Archivo: ${filePath || 'sin-nombre'}
Lenguaje: ${language}
Línea actual: ${currentLine}

=== CÓDIGO ANTES DEL CURSOR (ventana reciente) ===
${prefix}

=== CÓDIGO DESPUÉS DEL CURSOR (ventana reciente) ===
${suffix}

=== TEXTO INMEDIATAMENTE ANTES DEL CURSOR ===
"${beforeCursor}"

=== VENTANA LOCAL (líneas alrededor del cursor) ===
${typeof extendedContext === 'string' && extendedContext.trim().length > 0
  ? extendedContext.trim().slice(-5500)
  : '(sin ventana local; usa prefix/suffix)'}

=== CONTEXTO ESTRUCTURAL (JSON) ===
${structuralContext ? JSON.stringify(structuralContext, null, 2) : 'Sin contexto estructural'}

=== TAREA ===
Basado en el análisis completo del contexto, proporciona la continuación lógica y natural del código.

${isHTML ? 'Si es "html" o "htm", proporciona el documento HTML completo y moderno. En otros casos HTML, completa sin duplicar etiquetas o cierres que ya estén en el sufijo.' : 'Proporciona la continuación lógica del código.'}

${isHTML ? `MODO HTML ESTRICTO:
- Si structuralContext.inElementContent es true: estás dentro del CONTENIDO de una etiqueta ya abierta (no abras otra etiqueta del mismo nombre; ej. no pongas <a> si ya hay un <a> abierto: solo continúa el texto y luego un solo </a> si falta).
- Si structuralContext.inOpeningTag es true: completa atributos o el cierre > de esa etiqueta, sin abrir etiquetas nuevas innecesarias.
- Una sola línea de continuación salvo que el contexto pida varias líneas claras.
- PROSA EN ESPAÑOL (p, h1–h6, span, li…): respeta espacios entre palabras; tras artículos/preposiciones (un, una, el, la, de, y, a, en, con, por, para) la siguiente palabra va separada. No pegues palabras ("de untexto" está mal; debe ser "de un texto").
- Si el usuario escribe frases tipo "viajes a …" o "enlace a …", prioriza: (1) nombre de lugar o continuación natural en español, o (2) un <a href="URL_REAL"> con URL creíble — evita href="" vacío salvo que el sufijo ya lo tenga.
- Si solo falta cerrar la etiqueta de texto, sugiere </p> (o el cierre correcto del openTagsChain) sin relleno innecesario.` : ''}

${isJavaScript ? 'Para JavaScript, usa sintaxis moderna y buenas prácticas.' : ''}
${isPython ? 'Para Python, sigue PEP8 y usa tipado cuando sea apropiado.' : ''}

=== RESPUESTA ===
Proporciona ÚNICAMENTE el código que debe ir después de "${beforeCursor}":
`.trim()
  }
}

function sanitizeInlineText(text) {
  if (!text) return ''

  console.log('[sanitizeInlineText] Input:', {
    text: text.substring(0, 300) + (text.length > 300 ? '...' : ''),
    length: text.length,
    containsHTML: /<[^>]*>/g.test(text)
  })

  let out = String(text)
    .replace(/\r/g, '') // Eliminar carriage returns
    .replace(/^```[\w-]*\n?/gm, '') // Eliminar bloques de código
    .replace(/```$/gm, '')
    .replace(/^`+|`+$/g, '')
    .trimEnd()

  // Eliminar texto explicativo pero de forma más inteligente
  const explanatoryPatterns = [
    /Como el texto antes del cursor es[^]*$/gim,
    /te proporcionaré[^]*$/gim,
    /Te proporcionaré[^]*$/gim,
    /Aquí está[^]*$/gim,
    /Aquí tienes[^]*$/gim,
    /htmlDocument[^]*$/gim,
    /Document[^]*$/gim,
    /^.*explicación.*$/gim,
    /^.*proporcionar.*$/gim,
    /^.*completo.*$/gim,
    /^[A-Za-z\s]+:.*$/gm,
  ]

  for (const pattern of explanatoryPatterns) {
    out = out.replace(pattern, '')
  }

  // Detectar si es un documento HTML completo
  const isHTMLDocument = out.includes('<!DOCTYPE') || out.includes('<html')
  
  if (isHTMLDocument) {
    console.log('[sanitizeInlineText] HTML document detected, PRESERVING structure and newlines')
    // Para documentos HTML, PRESERVAR estructura y saltos de línea COMPLETAMENTE
    // Solo limpiar espacios excesivos pero mantener \n
    out = out
      .replace(/>\s+</g, '>\n<') // Asegurar saltos de línea entre etiquetas
      .replace(/([>])\s+/g, '$1\n') // Saltos después de etiquetas de cierre
      .replace(/\s+([<])/g, '\n$1') // Saltos antes de etiquetas de apertura
      .replace(/\n\s*\n/g, '\n') // Reducir múltiples saltos a uno
      .replace(/^\s+|\s+$/g, '') // Limpiar inicio y fin
      .trim()
  } else if (/<[^>]*>/g.test(out)) {
    // Para fragmentos HTML, preservar etiquetas y estructura.
    // Si quitamos tags, el ghost text queda inútil para autocomplete HTML.
    console.log('[sanitizeInlineText] HTML fragment detected, preserving tags')
    out = out
      .replace(/\n\s*\n/g, '\n')
      .replace(/^\s+|\s+$/g, '')
      .trim()
  } else {
    // Para código normal, PRESERVAR estructura y saltos de línea
    console.log('[sanitizeInlineText] Normal code detected, preserving structure')
    out = out
      .replace(/[ \t]+/g, ' ') // Limpiar tabs y espacios múltiples
      .replace(/^[ \t]+/gm, '') // Limpiar inicio de líneas
      .replace(/[ \t]+$/gm, '') // Limpiar fin de líneas
      .trim()
  }

  // Rechazar solo si contiene texto explicativo obvio
  if (/explicación|proporcionar|como el texto|htmlDocument/i.test(out) && out.length > 50) {
    console.warn('[sanitizeInlineText] Contains explanatory text, rejecting')
    return ''
  }

  // Límites más permisivos
  if (!isHTMLDocument && out.length > 800) {
    console.warn('[sanitizeInlineText] Result too long for non-HTML, truncating')
    out = out.substring(0, 800)
  }

  // Para documentos HTML, permitir hasta 1000 caracteres
  if (isHTMLDocument && out.length > 1000) {
    console.warn('[sanitizeInlineText] HTML document too long, truncating')
    out = out.substring(0, 1000)
  }

  if (!out.trim()) return ''
  if (/^(claro|sure|aquí|here|por supuesto)/i.test(out.trim())) return ''

  console.log('[sanitizeInlineText] Output:', {
    text: out.substring(0, 150) + (out.length > 150 ? '...' : ''),
    length: out.length,
    lineBreaks: (out.match(/\n/g) || []).length,
    isHTMLDocument
  })

  return out
}

async function requestInlineOpenAICompatible({ baseUrl, apiKey, model, prompt }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions` 

  // Validar y formatear API key
  let formattedApiKey = apiKey || ''
  if (formattedApiKey && !formattedApiKey.startsWith('sk-')) {
    // Si no empieza con sk-, podría ser un formato diferente, lo usamos como está
    // Algunas APIs usan diferentes prefijos o ninguno
  }

  const headers = {
    'Content-Type': 'application/json',
  }

  // Solo agregar Authorization si hay una API key
  if (formattedApiKey) {
    headers['Authorization'] = `Bearer ${formattedApiKey}`
  }

  // Aumentar timeout para fetch - especialmente para DeepSeek
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 40000) // 40 segundos timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2, // Un poco de creatividad para mejores sugerencias
        max_tokens: 1000, // Aumentado significativamente para respuestas completas
        stream: false,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error(`API Error ${res.status}:`, txt)
      
      // Mensajes específicos para errores comunes
      if (res.status === 401) {
        throw new Error('API key inválida o no configurada')
      } else if (res.status === 429) {
        throw new Error('Límite de velocidad de la API alcanzado')
      } else if (res.status >= 500) {
        throw new Error('Error del servidor API - intenta de nuevo')
      } else {
        throw new Error(`HTTP ${res.status}: ${txt}`)
      }
    }

    const data = await res.json()
    return data?.choices?.[0]?.message?.content || ''
  } catch (err) {
    clearTimeout(timeoutId)
    
    if (err.name === 'AbortError') {
      throw new Error('Timeout de la API - intenta de nuevo')
    }
    
    throw err
  }
}

// ── AI Inline Completion (Universal) ──────────────────────────────────────────
ipcMain.handle('ai:inlineComplete', async (_, payload) => {
  try {
    console.log('[ai:inlineComplete] === REQUEST START ===')
    console.log('[ai:inlineComplete] Payload:', {
      model: payload?.model,
      language: payload?.language,
      filePath: payload?.filePath,
      currentLine: payload?.currentLine,
      beforeCursor: payload?.beforeCursor,
      prefixLength: payload?.prefix?.length || 0,
      suffixLength: payload?.suffix?.length || 0,
      extendedContextLength: payload?.extendedContext?.length || 0,
      hasApiKey: !!payload?.apiKey
    })

    const settings = (() => {
      try { 
        const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
        return data
      } catch (err) { 
        return {} 
      }
    })()

    // Usar el modelo desde el payload (viene del renderer) o fallback
    const model = payload?.model || settings.aiModel || 'deepseek-chat'
    
    // Detectar automáticamente el baseUrl según el modelo
    let baseUrl = settings.aiBaseUrl
    if (!baseUrl) {
      if (model.includes('llama') || model.includes('groq')) {
        baseUrl = 'https://api.groq.com/openai/v1'
      } else {
        baseUrl = 'https://api.deepseek.com/v1'
      }
    }
    
    // Usar API key desde el payload (viene del renderer) o fallback a settings
    const apiKey = payload?.apiKey || settings.aiApiKey || ''

    console.log('[ai:inlineComplete] Config:', {
      model,
      baseUrl,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 8) + '...' : 'none'
    })

    // Validaciones básicas
    if (!baseUrl) {
      console.warn('[ai:inlineComplete] No baseUrl configured')
      return ''
    }

    if ((model.includes('llama') || model.includes('groq')) && !apiKey) {
      console.warn('[ai:inlineComplete] No API key configured for Groq')
      return ''
    }

    if (model.includes('deepseek') && !apiKey) {
      console.warn('[ai:inlineComplete] No API key configured for DeepSeek')
      return ''
    }

    console.log('[ai:inlineComplete] Building prompt...')
    const prompt = buildInlinePrompt(payload || {})
    console.log('[ai:inlineComplete] Prompt built, system length:', prompt.system.length)
    console.log('[ai:inlineComplete] Prompt built, user length:', prompt.user.length)

    console.log('[ai:inlineComplete] Calling API...')
    let result = ''
    if (model.includes('llama') || model.includes('groq')) {
      result = await requestInlineOpenAICompatible({ baseUrl, apiKey, model, prompt })
    } else {
      result = await requestInlineOpenAICompatible({ baseUrl, apiKey, model, prompt })
    }

    console.log('[ai:inlineComplete] Raw result:', {
      result: result ? (result.length > 200 ? result.substring(0, 200) + '...' : result) : 'empty',
      length: result?.length || 0
    })

    console.log('[ai:inlineComplete] Sanitizing result...')
    const sanitized = sanitizeInlineText(result)
    console.log('[ai:inlineComplete] Sanitized result:', {
      sanitized: sanitized ? (sanitized.length > 200 ? sanitized.substring(0, 200) + '...' : sanitized) : 'empty',
      length: sanitized?.length || 0
    })

    console.log('[ai:inlineComplete] === REQUEST END ===')
    return sanitized
  } catch (err) {
    console.error('[ai:inlineComplete] ERROR:', err.message)
    
    // Mensajes específicos para errores comunes
    if (err.message.includes('timeout') || err.message.includes('AbortError')) {
      console.warn('[ai:inlineComplete] Timeout - la API está tardando demasiado')
    } else if (err.message.includes('401') || err.message.includes('API key')) {
      console.warn('[ai:inlineComplete] Error de autenticación - revisa tu API key')
    } else if (err.message.includes('429')) {
      console.warn('[ai:inlineComplete] Demasiadas peticiones - espera un momento')
    } else if (err.message.includes('500')) {
      console.warn('[ai:inlineComplete] Error del servidor - intenta de nuevo')
    }
    
    return ''
  }
})
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
    fs.mkdirSync(path.dirname(p), { recursive: true })
    fs.writeFileSync(p, c, 'utf-8')
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('agent:createFile', async (_, p, c = '') => {
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true })
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

ipcMain.handle('agent:createDir', async (_, p) => {
  try {
    fs.mkdirSync(p, { recursive: true })
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('agent:moveFile', async (_, src, dest) => {
  try {
    const destDir = path.dirname(dest)
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    fs.renameSync(src, dest)
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('agent:runCommand', async (_, command, cwd) => {
  return new Promise((resolve) => {
    const { exec } = require('child_process')
    exec(command, { cwd: cwd || os.homedir(), timeout: 60000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim(),
        exitCode: err ? (err.code || 1) : 0
      })
    })
  })
})

ipcMain.handle('agent:getProjectStructure', async (_, rootPath, maxDepth = 4) => {
  function buildTree(dir, depth) {
    if (depth > maxDepth) return []
    try {
      return fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => !['node_modules', '.git', 'dist', '.next', '__pycache__', '.cache'].includes(e.name) && !e.name.startsWith('.'))
        .sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name))
        .map(e => {
          const full = path.join(dir, e.name)
          return { name: e.name, path: full, isDirectory: e.isDirectory(), children: e.isDirectory() ? buildTree(full, depth + 1) : undefined }
        })
    } catch { return [] }
  }
  return { success: true, tree: buildTree(rootPath, 0) }
})

// ── Helper: streaming SSE desde main process ─────────────────────────────────
async function streamSSE(url, body, headers, reqId) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 300)}`)
  }
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of dec.decode(value).split('\n')) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const token = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || ''
        if (token) mainWin.webContents.send('ai:token', { token, done: false, reqId })
      } catch {}
    }
  }
  mainWin.webContents.send('ai:token', { token: '', done: true, reqId })
}

// ── DeepSeek API streaming ───────────────────────────────────────────────────
ipcMain.handle('ai:streamDeepSeek', async (_, { messages, model, apiKey, reqId }) => {
  try {
    await streamSSE(
      'https://api.deepseek.com/v1/chat/completions',
      { model: model || 'deepseek-chat', messages, stream: true, temperature: 0.3, max_tokens: 8192 },
      { 'Authorization': `Bearer ${apiKey}` },
      reqId
    )
  } catch (err) {
    mainWin.webContents.send('ai:token', { token: '', done: true, error: err.message, reqId })
  }
})

// ── Groq API streaming ───────────────────────────────────────────────────────
ipcMain.handle('ai:streamGroq', async (_, { messages, model, apiKey, reqId }) => {
  try {
    await streamSSE(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: model || 'meta-llama/llama-4-scout-17b-16e-instruct', messages, stream: true, temperature: 0.3, max_tokens: 8192 },
      { 'Authorization': `Bearer ${apiKey}` },
      reqId
    )
  } catch (err) {
    mainWin.webContents.send('ai:token', { token: '', done: true, error: err.message, reqId })
  }
})

// ── Extension Store (Marketplace Oficial) ───────────────────────────────────
// Temporarily commented out for testing
// const MarketplaceService = require('./marketplace/marketplace-service.js')
// const marketplace = new MarketplaceService()

// ipcMain.handle('marketplace:search', async (_, query) => {
//   return await marketplace.searchExtensions(query)
// })

// ipcMain.handle('marketplace:details', async (_, { publisher, name }) => {
//   return await marketplace.getExtensionDetails(publisher, name)
// })

// ipcMain.handle('marketplace:install', async (_, { publisher, name, version }) => {
//   try {
//     const meta = await marketplace.installExtension(publisher, name, version)
//     return { success: true, meta }
//   } catch (error) {
//     console.error('Failed to install extension:', error)
//     throw error
//   }
// })

// ipcMain.handle('marketplace:uninstall', async (_, { publisher, name }) => {
//   try {
//     const result = await marketplace.uninstallExtension(publisher, name)
//     return { success: true, result }
//   } catch (error) {
//     console.error('Failed to uninstall extension:', error)
//     throw error
//   }
// })

// ipcMain.handle('marketplace:installed', async () => {
//   return await marketplace.getInstalledExtensions()
// })

// ipcMain.handle('marketplace:check-updates', async () => {
//   return await marketplace.checkUpdates()
// })
