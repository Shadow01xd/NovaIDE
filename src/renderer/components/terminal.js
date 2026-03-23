// src/renderer/components/terminal.js
// Terminal con xterm.js (cargado desde CDN) + node-pty en el proceso main

let termCounter = 0
const terminals = {}

export function createTerminalPanel(container, state) {
  container.innerHTML = `
    <div class="term-header">
      <div class="term-tabs" id="term-tabs"></div>
      <div class="term-actions">
        <button class="icon-btn" id="btn-new-term" title="Nueva terminal">＋</button>
        <button class="icon-btn" id="btn-kill-term" title="Cerrar terminal">✕</button>
        <button class="icon-btn" id="btn-close-termbar" title="Ocultar">⌄</button>
      </div>
    </div>
    <div class="term-body" id="term-body"></div>
  `

  let activeTermId = null

  // Escuchar datos del proceso pty
  const unsubData = window.api.onTermData(({ id, data }) => {
    terminals[id]?.xterm?.write(data)
  })
  const unsubExit = window.api.onTermExit(({ id }) => {
    terminals[id]?.xterm?.write('\r\n\x1b[31m[Proceso terminado]\x1b[0m\r\n')
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

    // FitAddon — window.FitAddon es el objeto exportado por xterm-addon-fit
    let fitAddon = null
    try {
      // xterm-addon-fit@0.8.0 expone: window.FitAddon = { FitAddon: class }
      const FitAddonClass = window.FitAddon?.FitAddon ?? window.FitAddon
      if (FitAddonClass) {
        fitAddon = new FitAddonClass()
        xterm.loadAddon(fitAddon)
      }
    } catch (e) {
      console.warn('FitAddon no disponible:', e)
    }

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
    if (remaining.length > 0) switchTo(Number(remaining[remaining.length - 1]))
  })

  document.getElementById('btn-close-termbar').addEventListener('click', () => {
    state.terminalOpen = false
    state.emit('panelToggle', { panel: 'terminal', open: false })
  })

  // Crear la primera terminal automáticamente
  newTerminal()
}
