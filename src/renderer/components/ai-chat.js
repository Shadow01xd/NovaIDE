// src/renderer/components/ai-chat.js
// Panel IA estilo Cursor: streaming, edición inline, apply, historial, modos

import { applyAIEdit } from './editor.js'

let reqCounter = 0
const pendingStreams = {}

export function createAIChat(container, state) {
  container.innerHTML = `
    <div class="ai-header">
      <div class="ai-header-left">
        <span class="ai-logo">✦</span>
        <span class="ai-title">IA</span>
      </div>
      <div class="ai-header-right">
        <select id="ai-model-sel" class="model-sel" title="Modelo"></select>
        <button class="icon-btn" id="btn-ai-history" title="Historial">🕐</button>
        <button class="icon-btn" id="btn-ai-clear" title="Limpiar">🗑️</button>
      </div>
    </div>

    <div class="ai-mode-bar">
      <button class="ai-mode-btn active" data-mode="chat">💬 Chat</button>
      <button class="ai-mode-btn" data-mode="edit">✏️ Editar</button>
      <button class="ai-mode-btn" data-mode="explain">🔍 Explicar</button>
    </div>

    <div class="ai-messages" id="ai-messages">
      <div class="ai-welcome">
        <div class="ai-welcome-logo">✦</div>
        <p>Hola! Soy tu asistente de código.</p>
        <div class="ai-suggestions">
          <button class="ai-sug-btn" data-prompt="Explica qué hace este archivo">📖 Explicar archivo</button>
          <button class="ai-sug-btn" data-prompt="Encuentra bugs en este código y sugiere correcciones">🐛 Buscar bugs</button>
          <button class="ai-sug-btn" data-prompt="Refactoriza este código para hacerlo más limpio y eficiente">♻️ Refactorizar</button>
          <button class="ai-sug-btn" data-prompt="Escribe tests unitarios para este código">🧪 Generar tests</button>
          <button class="ai-sug-btn" data-prompt="Agrega comentarios JSDoc a todas las funciones">📝 Documentar</button>
          <button class="ai-sug-btn" data-prompt="Optimiza el rendimiento de este código">⚡ Optimizar</button>
        </div>
        <p class="ai-hint">
          <kbd>Ctrl+L</kbd> selecciona código para enviar<br>
          <kbd>Ctrl+K</kbd> edición inline en el editor
        </p>
      </div>
    </div>

    <div class="ai-input-area">
      <div class="ai-attach" id="ai-attach" style="display:none">
        <div class="ai-attach-inner">
          <span class="ai-attach-icon">📎</span>
          <span id="ai-attach-label">Código adjunto</span>
          <button id="btn-remove-attach">×</button>
        </div>
      </div>
      <div class="ai-textarea-wrap">
        <textarea id="ai-input" class="ai-textarea"
          placeholder="Pregunta algo… (Enter envía, Shift+Enter nueva línea)"></textarea>
        <div class="ai-input-actions">
          <button class="icon-btn" id="btn-attach-code" title="Adjuntar código seleccionado (Ctrl+L)">📎</button>
          <button class="btn-send" id="btn-send" title="Enviar (Enter)">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M15.854.146a.5.5 0 0 1 .11.54L10.066 14.8a.5.5 0 0 1-.917-.065L6.99 9.955l-4.78-2.159a.5.5 0 0 1-.065-.917L15.314.036a.5.5 0 0 1 .54.11z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="ai-input-footer">
        <span id="ai-status" class="ai-status"></span>
        <button class="ai-stop-btn" id="btn-stop" style="display:none">■ Detener</button>
      </div>
    </div>
  `

  let currentMode  = 'chat'
  let isStreaming  = false
  let stopRequested = false
  let pendingAttach = null   // { code, lang, file, selection }

  // ── Cargar modelos ─────────────────────────────────────────────────────
  async function loadModels() {
    const sel = document.getElementById('ai-model-sel')
    try {
      const models = await window.api.aiModels()
      sel.innerHTML = ''
      if (models.length === 0) {
        sel.innerHTML = '<option>deepseek-coder:6.7b</option>'
      } else {
        models.forEach(m => {
          const opt = document.createElement('option')
          opt.value = opt.textContent = m
          if (m === state.aiModel || m.includes('deepseek-coder')) opt.selected = true
          sel.appendChild(opt)
        })
      }
      state.aiModel = sel.value
    } catch {
      sel.innerHTML = '<option>deepseek-coder:6.7b</option>'
    }
  }

  loadModels()
  document.getElementById('ai-model-sel').addEventListener('change', e => { state.aiModel = e.target.value })

  // ── Modos ──────────────────────────────────────────────────────────────
  container.querySelectorAll('.ai-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.ai-mode-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentMode = btn.dataset.mode
      document.getElementById('ai-input').placeholder = {
        chat:    'Pregunta algo… (Enter envía)',
        edit:    'Describe qué cambiar en el código seleccionado…',
        explain: 'Qué quieres que explique…',
      }[currentMode]
    })
  })

  // ── Sugerencias rápidas ────────────────────────────────────────────────
  container.querySelectorAll('.ai-sug-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      attachCurrentCode()
      document.getElementById('ai-input').value = btn.dataset.prompt
      sendMessage()
    })
  })

  // ── Attach código ──────────────────────────────────────────────────────
  function attachCurrentCode() {
    if (!state.editorInstance || !state.currentFile) return
    const sel  = state.editorInstance.getSelection()
    const code = state.editorInstance.getModel()?.getValueInRange(sel) || ''
    const full = state.editorInstance.getValue()
    pendingAttach = {
      code: code.trim() || full,
      lang: state.currentFile?.split('.').pop() || 'text',
      file: state.currentFile,
      selection: code.trim() ? sel : null,
      isFull: !code.trim(),
    }
    const label = code.trim()
      ? `Selección de ${pendingAttach.file?.split(/[\\/]/).pop()}`
      : `Archivo completo: ${pendingAttach.file?.split(/[\\/]/).pop()}`
    document.getElementById('ai-attach-label').textContent = label
    document.getElementById('ai-attach').style.display = 'flex'
  }

  document.getElementById('btn-attach-code').addEventListener('click', attachCurrentCode)

  document.getElementById('btn-remove-attach').addEventListener('click', () => {
    pendingAttach = null
    document.getElementById('ai-attach').style.display = 'none'
  })

  // ── Recibir código desde editor (Ctrl+L) ──────────────────────────────
  state.on('sendToAI', (data) => {
    if (!data) return
    pendingAttach = data
    document.getElementById('ai-attach-label').textContent =
      `Selección de ${data.file?.split(/[\\/]/).pop() || 'editor'}`
    document.getElementById('ai-attach').style.display = 'flex'
    document.getElementById('ai-input').focus()
    state.aiPanelOpen = true
  })

  // ── Enviar mensaje ─────────────────────────────────────────────────────
  async function sendMessage() {
    const inputEl = document.getElementById('ai-input')
    const text = inputEl.value.trim()
    if (!text || isStreaming) return

    isStreaming   = true
    stopRequested = false
    inputEl.value = ''

    // Construir system prompt según modo
    const systemPrompts = {
      chat:    `Eres un asistente de programación experto integrado en un IDE llamado MyIDE. Responde en español. Cuando des código, usa bloques de código con el lenguaje especificado. Sé conciso y directo.`,
      edit:    `Eres un experto en refactorización. El usuario te dará código y una instrucción. Responde ÚNICAMENTE con el código modificado dentro de un bloque de código, sin explicaciones adicionales antes o después.`,
      explain: `Eres un experto en explicar código de forma clara y didáctica. Explica el código paso a paso en español. Usa analogías cuando sea útil.`,
    }

    // Construir contenido del mensaje
    let userContent = text
    if (pendingAttach?.code) {
      const ctx = pendingAttach.isFull
        ? `Archivo completo (${pendingAttach.file?.split(/[\\/]/).pop()}):`
        : `Código seleccionado de ${pendingAttach.file?.split(/[\\/]/).pop()}:`
      userContent = `${ctx}\n\`\`\`${pendingAttach.lang}\n${pendingAttach.code}\n\`\`\`\n\n${text}`
    }

    // Mostrar mensaje usuario
    appendMessage('user', text, pendingAttach ? { ...pendingAttach } : null)

    const attachForResponse = pendingAttach ? { ...pendingAttach } : null
    pendingAttach = null
    document.getElementById('ai-attach').style.display = 'none'

    // Añadir al historial
    state.aiHistory.push({ role: 'user', content: userContent })

    // Preparar streaming
    const msgEl = appendMessage('assistant', '', null, true)
    const reqId = ++reqCounter
    let fullResponse = ''

    document.getElementById('ai-status').textContent = 'Generando…'
    document.getElementById('btn-stop').style.display = 'inline-flex'

    // Registrar listener de tokens
    const unsubToken = window.api.onAiToken(({ reqId: rid, token, done }) => {
      if (rid !== reqId) return
      if (stopRequested) return
      fullResponse += token
      updateStreamingMessage(msgEl, fullResponse, currentMode, attachForResponse)
    })

    try {
      await window.api.aiStream(
        [{ role: 'system', content: systemPrompts[currentMode] }, ...state.aiHistory],
        state.aiModel,
        reqId
      )
    } catch (err) {
      updateStreamingMessage(msgEl, `Error: ${err.message}\n¿Está Ollama corriendo? Ejecuta: \`ollama serve\``, 'chat', null)
    } finally {
      unsubToken()
      isStreaming = false
      document.getElementById('ai-status').textContent = ''
      document.getElementById('btn-stop').style.display = 'none'
    }

    if (fullResponse) {
      state.aiHistory.push({ role: 'assistant', content: fullResponse })
      finalizeMessage(msgEl, fullResponse, currentMode, attachForResponse)
    }
  }

  document.getElementById('btn-stop').addEventListener('click', () => { stopRequested = true })

  document.getElementById('btn-send').addEventListener('click', sendMessage)
  document.getElementById('ai-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  })

  document.getElementById('btn-ai-clear').addEventListener('click', () => {
    state.aiHistory = []
    const msgs = document.getElementById('ai-messages')
    msgs.innerHTML = `<div class="cleared-msg">Chat limpiado ✓</div>`
    setTimeout(() => { msgs.innerHTML = '' }, 1500)
  })

  // ── Renderizado de mensajes ────────────────────────────────────────────
  function appendMessage(role, text, attach, isStreaming = false) {
    const welcome = container.querySelector('.ai-welcome')
    if (welcome) welcome.remove()

    const msgs = document.getElementById('ai-messages')
    const el   = document.createElement('div')
    el.className = `ai-msg ai-msg--${role}`

    if (role === 'user') {
      let html = `<div class="ai-msg-content">${escapeHtml(text)}</div>`
      if (attach?.code) {
        const preview = attach.code.slice(0, 120) + (attach.code.length > 120 ? '…' : '')
        html = `<div class="ai-msg-attach">
          <span class="ai-attach-badge">📎 ${attach.file?.split(/[\\/]/).pop()}</span>
          <pre class="attach-preview"><code>${escapeHtml(preview)}</code></pre>
        </div>` + html
      }
      el.innerHTML = html
    } else if (isStreaming) {
      el.innerHTML = `<div class="ai-msg-content streaming"><span class="ai-cursor">▋</span></div>`
    }

    msgs.appendChild(el)
    msgs.scrollTop = msgs.scrollHeight
    return el
  }

  function updateStreamingMessage(el, text, mode, attach) {
    const contentEl = el.querySelector('.ai-msg-content')
    if (!contentEl) return
    contentEl.innerHTML = renderMarkdown(text) + '<span class="ai-cursor">▋</span>'
    const msgs = document.getElementById('ai-messages')
    msgs.scrollTop = msgs.scrollHeight
  }

  function finalizeMessage(el, text, mode, attach) {
    const contentEl = el.querySelector('.ai-msg-content')
    if (!contentEl) return
    contentEl.classList.remove('streaming')
    contentEl.innerHTML = renderMarkdown(text)

    // Agregar botones de acción a bloques de código
    contentEl.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code')?.textContent || pre.textContent
      const lang  = pre.querySelector('code')?.className?.replace('language-','') || ''

      const actions = document.createElement('div')
      actions.className = 'code-actions'

      // Copiar
      const btnCopy = document.createElement('button')
      btnCopy.className = 'code-action-btn'
      btnCopy.textContent = '📋 Copiar'
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(code)
        btnCopy.textContent = '✓ Copiado'
        setTimeout(() => btnCopy.textContent = '📋 Copiar', 2000)
      })

      // Aplicar al archivo — con diff highlight
      const btnApply = document.createElement('button')
      btnApply.className = 'code-action-btn primary'
      btnApply.textContent = '✦ Aplicar al editor'
      btnApply.addEventListener('click', () => {
        if (!state.editorInstance) { alert('Abre un archivo primero'); return }
        applyAIEdit(state.editorInstance, state.monacoRef, code, attach?.selection || null)
        btnApply.textContent = '✓ Aplicado'
        btnApply.style.background = '#2ea043'
        setTimeout(() => {
          btnApply.textContent = '✦ Aplicar al editor'
          btnApply.style.background = ''
        }, 3000)
      })

      // Insertar en cursor
      const btnInsert = document.createElement('button')
      btnInsert.className = 'code-action-btn'
      btnInsert.textContent = '↙ Insertar en cursor'
      btnInsert.addEventListener('click', () => {
        if (!state.editorInstance) return
        const pos = state.editorInstance.getPosition()
        state.editorInstance.executeEdits('ai-insert', [{
          range: state.monacoRef.Range.fromPositions(pos, pos),
          text: code,
        }])
        state.editorInstance.focus()
      })

      actions.append(btnCopy, btnInsert, btnApply)
      pre.style.position = 'relative'
      pre.appendChild(actions)
    })

    el.querySelector('.ai-cursor')?.remove()
    document.getElementById('ai-messages').scrollTop = 9999
  }

  // Markdown básico (no requiere librerías)
  function renderMarkdown(text) {
    return text
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
        `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`)
      .replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
      .replace(/^[-*]\s(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }
}
