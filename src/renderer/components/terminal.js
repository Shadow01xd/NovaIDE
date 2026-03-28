// src/renderer/components/terminal.js
// Terminal con xterm.js (cargado desde CDN) + node-pty en el proceso main

let termCounter = 0
const terminals = {}

export function createTerminalPanel(container, state) {
  container.innerHTML = `
    <div class="term-header">
      <div class="term-tabs" id="term-tabs"></div>
      <div class="term-actions">
        <button class="term-icon-btn" id="btn-new-term" title="Nueva terminal">＋</button>
        <button class="term-icon-btn kill-btn" id="btn-kill-term" title="Cerrar terminal">✕</button>
        <button class="term-icon-btn" id="btn-close-termbar" title="Ocultar">⌄</button>
      </div>
    </div>
    <div class="term-body" id="term-body"></div>
  `

  let activeTermId = null

  // Escuchar datos del proceso pty
  const unsubData = window.api.onTermData(({ id, data }) => {
    const term = terminals[id]
    if (!term) return
    
    term.xterm.write(data)

    // Detección inteligente de URLs (especialmente localhost/dev)
    const urlMatch = data.match(/http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):([0-9]+)/i)
    if (urlMatch) {
      const url = urlMatch[0]
      if (term.lastUrlDetected !== url) {
        term.lastUrlDetected = url
        console.log('Automática de URL detectada:', url)
        // Opcional: Notificar al usuario o simplemente abrir si es un dev server recién iniciado
        // Usamos un pequeño timer para no ser tan agresivos si hay múltiples logs
        clearTimeout(term.urlTimer)
        term.urlTimer = setTimeout(() => {
          // window.open(url) // Abrir en navegador externo
          window.api.openExternal?.(url)
        }, 1500)
      }
    }
  })

  async function newTerminal() {
    // Verificar que xterm esté disponible (cargado desde CDN)
    if (!window.Terminal) {
      document.getElementById('term-body').innerHTML = `
        <div class="no-pty">
          <p>&#9888;&#65039; <strong>xterm.js</strong> no carg&#243; correctamente.</p>
          <p>Verifica tu conexi&#243;n a internet (se carga desde CDN) y recarga con <kbd>Ctrl+R</kbd>.</p>
        </div>`
      return
    }

    const id = ++termCounter
    const result = await window.api.termCreate(id, state.currentFolder)

    if (!result?.ok) {
      document.getElementById('term-body').innerHTML = `
        <div class="no-pty">
          <p>&#9888;&#65039; <strong>node-pty</strong> no est&#225; disponible.</p>
          <p>Para habilitar la terminal nativa ejecuta:</p>
          <pre>npm install node-pty\nnpm run postinstall</pre>
          <p>Requiere Visual Studio Build Tools en Windows.</p>
        </div>`
      return
    }

    // Contenedor para este terminal
    const termEl = document.createElement('div')
    termEl.className = 'xterm-container'
    termEl.id = `term-${id}`
    termEl.style.display = 'none'
    document.getElementById('term-body').appendChild(termEl)

    // Crear instancia xterm
    const xterm = new window.Terminal({
      theme: {
        background:    '#0d1117',
        foreground:    '#e6edf3',
        cursor:        '#58a6ff',
        black:         '#21262d', red:     '#f85149',
        green:         '#3fb950', yellow:  '#d29922',
        blue:          '#58a6ff', magenta: '#bc8cff',
        cyan:          '#39c5cf', white:   '#b1bac4',
        brightBlack:   '#6e7681', brightRed:     '#ff7b72',
        brightGreen:   '#56d364', brightYellow:  '#e3b341',
        brightBlue:    '#79c0ff', brightMagenta: '#d2a8ff',
        brightCyan:    '#56d4dd', brightWhite:   '#f0f6fc',
      },
      fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
    })

    let fitAddon = null
    try {
      // FitAddon
      const FitAddonClass = window.FitAddon?.FitAddon ?? window.FitAddon
      if (FitAddonClass) {
        fitAddon = new FitAddonClass()
        xterm.loadAddon(fitAddon)
      }
      // WebLinksAddon
      const WebLinksAddonClass = window.WebLinksAddon?.WebLinksAddon ?? window.WebLinksAddon
      if (WebLinksAddonClass) {
        xterm.loadAddon(new WebLinksAddonClass((event, uri) => {
          window.api.openExternal(uri)
        }))
      }
    } catch (e) {
      console.warn('Addons no disponibles:', e)
    }

    xterm.attachCustomKeyEventHandler((e) => {
      const mod = e.ctrlKey || e.metaKey;
      const isTermKey = ['`', 'ñ', 'Ñ', ']', ';', '}'].includes(e.key) || ['Backquote', 'Semicolon', 'BracketRight'].includes(e.code);
      if (mod && isTermKey) {
        if (e.type === 'keydown') {
          state.terminalOpen = false;
          state.emit('panelToggle', { panel: 'terminal', open: false });
        }
        return false;
      }
      
      // Smart Ctrl+C: Copiar si hay texto, matar proceso si no hay texto
      if (mod && e.code === 'KeyC' && e.type === 'keydown') {
        if (xterm.hasSelection()) {
          navigator.clipboard.writeText(xterm.getSelection());
          xterm.clearSelection();
          return false; // Evita enviar Ctrl+C (\x03) al servidor
        }
      }
      
      return true;
    });

    xterm.open(termEl)
    try { fitAddon?.fit() } catch {}

    xterm.onData(data => window.api.termWrite(id, data))
    xterm.onResize(({ cols, rows }) => window.api.termResize(id, cols, rows))

    terminals[id] = { xterm, fitAddon, container: termEl }

    // Resize observer
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { try { fitAddon?.fit() } catch {} })
      ro.observe(termEl)
    }

    addTermTab(id)
    switchTo(id)

    // Forzar el ajuste inicial tras un pequeño delay para asegurar que el DOM esté listo
    setTimeout(() => {
      try { fitAddon?.fit() } catch(e) {}
    }, 100)
  }

  function addTermTab(id) {
    const tabs = document.getElementById('term-tabs')
    const tab  = document.createElement('button')
    tab.className   = 'term-tab'
    tab.dataset.id  = id
    tab.textContent = `Terminal ${id}`
    tab.addEventListener('click', () => switchTo(id))
    tabs.appendChild(tab)
  }

  function switchTo(id) {
    activeTermId = id
    Object.entries(terminals).forEach(([tid, t]) => {
      t.container.style.display = String(tid) === String(id) ? 'block' : 'none'
    })
    document.querySelectorAll('.term-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.id === String(id))
    })
    try { terminals[id]?.fitAddon?.fit() } catch {}
    terminals[id]?.xterm?.focus()
  }

  document.getElementById('btn-new-term').addEventListener('click', newTerminal)

  document.getElementById('btn-kill-term').addEventListener('click', async () => {
    if (activeTermId === null) return
    await window.api.termKill(activeTermId)
    terminals[activeTermId]?.xterm?.dispose()
    terminals[activeTermId]?.container?.remove()
    document.querySelector(`.term-tab[data-id="${activeTermId}"]`)?.remove()
    delete terminals[activeTermId]
    const remaining = Object.keys(terminals)
    activeTermId = null
    if (remaining.length > 0) {
      switchTo(Number(remaining[remaining.length - 1]))
    } else {
      state.terminalOpen = false
      state.emit('panelToggle', { panel: 'terminal', open: false })
    }
  })

  document.getElementById('btn-close-termbar').addEventListener('click', () => {
    state.terminalOpen = false
    state.emit('panelToggle', { panel: 'terminal', open: false })
  })

  // Crear la primera terminal automáticamente
  newTerminal()

  // ── Escuchar comandos externos (ej. desde AI Agent) ────────────────────────
  state.on('terminal:run', async ({ command, cwd }) => {
    state.terminalOpen = true
    document.getElementById('terminal').style.display = 'flex'
    state.emit('panelToggle', { panel: 'terminal', open: true })

    if (activeTermId === null) {
      await newTerminal()
      // Esperar un poco a que el shell inicial de node-pty esté listo
      setTimeout(() => {
        if (activeTermId) window.api.termWrite(activeTermId, command + '\r')
      }, 800)
    } else {
      window.api.termWrite(activeTermId, command + '\r')
    }
  })

  // Reiniciar la terminal limpiamente al confirmar que el proyecto entero ha cambiado
  state.on('projectFolderChanged', async () => {
    const existingIds = Object.keys(terminals)
    if (existingIds.length === 0) return

    for (const tid of existingIds) {
      await window.api.termKill(tid)
      terminals[tid]?.xterm?.dispose()
      terminals[tid]?.container?.remove()
      document.querySelector(`.term-tab[data-id="${tid}"]`)?.remove()
      delete terminals[tid]
    }
    activeTermId = null
    newTerminal()
  })
}
