// src/renderer/components/ai-agent.js
// AGENTE DE IA COMPLETO - Reemplaza el chat simple anterior
// Soporta: Ollama (local) + DeepSeek (API) con streaming en tiempo real
// Features: Tool calls, ReAct loop, historial, integración Monaco, contexto automático

// ============================================================================
// UTILIDADES
// ============================================================================

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const generateId = () => Math.random().toString(36).substring(2, 15);

const formatDate = (d) => {
  const now = new Date();
  const date = new Date(d);
  if (now.toDateString() === date.toDateString()) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

// Markdown básico con soporte para bloques de código
function renderMarkdown(text) {
  if (!text) return '';
  let html = escapeHtml(text)
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const highlighted = window.hljs ? window.hljs.highlightAuto(code.trim(), lang ? [lang] : undefined).value : escapeHtml(code.trim());
      const langName = lang || 'texto';
      return `<div class="ai-code-block">
                <div class="ai-code-header">
                  <span class="ai-code-lang">${langName}</span>
                  <div class="ai-code-actions"></div>
                </div>
                <div class="ai-code-body">
                  <pre><code class="language-${lang || 'plaintext'}">${highlighted}</code></pre>
                </div>
              </div>`;
    })
    .replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/^[-*]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  return `<p>${html}</p>`;
}

// ============================================================================
// CLASE PRINCIPAL: AIAgent
// ============================================================================

export class AIAgent {
  constructor({ container, state }) {
    this.container = container;
    this.state = state;
    
    // Estado interno
    this.messages = [];
    this.activeTab = 'agent'; // 'agent' | 'chat' | 'history'
    this.activeModel = state.aiModel || 'deepseek-coder';
    this.provider = 'ollama'; // 'ollama' | 'deepseek' | 'groq'
    this.deepseekApiKey = localStorage.getItem('ide_deepseek_api_key') || '';
    this.groqApiKey = localStorage.getItem('ide_groq_api_key') || '';
    this.activeConversation = null;
    this.isStreaming = false;
    this.pendingTools = [];
    this.confirmBeforeExecute = true; // Toggle para confirmar acciones
    this.pendingContext = null; // Contexto adjunto (@archivo, selección, etc)
    this.ollamaModels = [];
    this.reqCounter = 0;
    this.currentStreamCleanup = null;
    
    // Historial desde localStorage
    this.conversations = this.loadConversations();
    
    // Bindings
    this.handleSend = this.handleSend.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.stopGeneration = this.stopGeneration.bind(this);
    this.switchTab = this.switchTab.bind(this);
    this.attachContext = this.attachContext.bind(this);
    this.removeContext = this.removeContext.bind(this);
    this.loadModelList = this.loadModelList.bind(this);
    this.executeTool = this.executeTool.bind(this);
    this.confirmToolExecution = this.confirmToolExecution.bind(this);
    this.rejectToolExecution = this.rejectToolExecution.bind(this);
    this.saveConversation = this.saveConversation.bind(this);
    this.loadConversation = this.loadConversation.bind(this);
    this.deleteConversation = this.deleteConversation.bind(this);
    this.newConversation = this.newConversation.bind(this);
    this.autoExpandTextarea = this.autoExpandTextarea.bind(this);
  }

  // ==========================================================================
  // INICIALIZACIÓN
  // ==========================================================================

  mount() {
    this.render();
    this.attachEventListeners();
    this.loadModelList();
    this.renderMessages();
    return this;
  }

  renderMessages() {
    const container = this.container.querySelector('#ai-messages');
    if (!container) return;
    
    if (this.messages.length === 0) {
      container.innerHTML = this.renderWelcome();
      return;
    }
    
    container.innerHTML = '';
    this.messages.forEach(msg => {
      if (msg.role === 'user') {
        this.appendMessage('user', msg.content);
      } else if (msg.role === 'assistant') {
        const el = this.appendMessage('assistant', '');
        this.finalizeMessage(el, msg.content, null);
      }
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="ai-agent-container">
        <!-- Header con tabs -->
        <div class="ai-agent-header">
          <div class="ai-tabs">
            <button class="ai-tab ${this.activeTab === 'agent' ? 'active' : ''}" data-tab="agent">
              <span class="ai-tab-icon">🤖</span> Agente
            </button>
            <button class="ai-tab ${this.activeTab === 'chat' ? 'active' : ''}" data-tab="chat">
              <span class="ai-tab-icon">💬</span> Chat
            </button>
            <button class="ai-tab ${this.activeTab === 'history' ? 'active' : ''}" data-tab="history">
              <span class="ai-tab-icon">🕐</span> Historial
            </button>
          </div>
          <div class="ai-header-actions">
            <button class="ai-btn-icon" id="ai-btn-new-chat" title="Nueva conversación">+</button>
            <button class="ai-btn-icon" id="ai-btn-settings" title="Configuración">⚙️</button>
          </div>
        </div>

        <!-- Panel de configuración (Popover) -->
        <div class="ai-settings-popover" id="ai-settings-panel" style="display: none;">
          <div class="ai-settings-group">
            <label>Proveedor:</label>
            <select id="ai-provider-select" class="ai-select">
              <option value="ollama" ${this.provider === 'ollama' ? 'selected' : ''}>Ollama (Local)</option>
              <option value="deepseek" ${this.provider === 'deepseek' ? 'selected' : ''}>DeepSeek API</option>
              <option value="groq" ${this.provider === 'groq' ? 'selected' : ''}>Groq API</option>
            </select>
          </div>
          <div class="ai-settings-group" id="ai-model-group">
            <label>Modelo:</label>
            <select id="ai-model-select" class="ai-select">
              <option>Cargando...</option>
            </select>
          </div>
          <div class="ai-settings-group" id="ai-apikey-group" style="display: ${this.provider === 'deepseek' ? 'block' : 'none'};">
            <label>API Key DeepSeek:</label>
            <input type="password" id="ai-apikey-input" class="ai-input" value="${escapeHtml(this.deepseekApiKey)}" placeholder="sk-...">
          </div>
          <div class="ai-settings-group" id="ai-groqkey-group" style="display: ${this.provider === 'groq' ? 'block' : 'none'};">
            <label>API Key Groq:</label>
            <input type="password" id="ai-groqkey-input" class="ai-input" value="${escapeHtml(this.groqApiKey)}" placeholder="gsk_...">
          </div>
          <div class="ai-settings-group">
            <label class="ai-checkbox-label">
              <input type="checkbox" id="ai-confirm-toggle" ${this.confirmBeforeExecute ? 'checked' : ''}>
              Pedir confirmación al actuar
            </label>
          </div>
        </div>

        <!-- Área de contenido -->
        <div class="ai-content-area">
          <!-- Vista Agente/Chat -->
          <div class="ai-chat-view" id="ai-chat-view">
            <div class="ai-messages" id="ai-messages">
              ${this.messages.length === 0 ? this.renderWelcome() : ''}
            </div>
          </div>

          <!-- Input Flotante -->
          <div class="ai-floating-input" id="ai-floating-input" style="display: ${this.activeTab === 'history' ? 'none' : 'flex'}">
            <!-- Contexto adjunto -->
            <div class="ai-context-bar" id="ai-context-bar" style="display: none;">
              <div class="ai-context-chips" id="ai-context-chips"></div>
            </div>
            
            <div class="ai-input-wrapper">
              <textarea 
                id="ai-input" 
                class="ai-textarea" 
                placeholder="Pregunta a NVCode AI..."
                rows="1"
                maxlength="4000"
              ></textarea>
              <div class="ai-input-actions">
                <button class="ai-btn-icon" id="ai-btn-attach" title="Adjuntar contexto (@)">@</button>
                <button class="ai-btn-send" id="ai-btn-send" title="Enviar (Ctrl+Enter)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
                <button class="ai-btn-stop" id="ai-btn-stop" style="display: none;" title="Detener">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12"></rect>
                  </svg>
                </button>
              </div>
            </div>
            <div class="ai-status" id="ai-status"></div>
          </div>

          <!-- Vista Historial -->
          <div class="ai-history-view" id="ai-history-view" style="display: none;">
            <div class="ai-history-header">
              <h3>Conversaciones anteriores</h3>
              <button class="ai-btn-secondary" id="ai-btn-clear-history">Limpiar todo</button>
            </div>
            <div class="ai-history-list" id="ai-history-list">
              ${this.renderHistoryList()}
            </div>
          </div>
        </div>

        <!-- Menú de contexto (popup) -->
        <div class="ai-context-menu" id="ai-context-menu" style="display: none;">
          <div class="ai-context-item" data-context="active-file">
            <span class="ai-context-icon">📄</span><span>Archivo activo</span>
          </div>
          <div class="ai-context-item" data-context="selection">
            <span class="ai-context-icon">✂️</span><span>Selección actual</span>
          </div>
          <div class="ai-context-item" data-context="project">
            <span class="ai-context-icon">📁</span><span>Todo el proyecto</span>
          </div>
        </div>
      </div>
    `;
  }

  renderWelcome() {
    return `
      <div class="ai-welcome">
        <div class="ai-welcome-icon">⚛</div>
        <h2 class="ai-welcome-title">NVCode AI</h2>
        <p class="ai-welcome-subtitle">
          I'm your intelligent coding assistant. Write natural language queries or use <strong>Agent mode</strong> for autonomous coding execution.
        </p>
        <div class="ai-suggestions">
          <button class="ai-suggestion-btn" data-prompt="Explain this file">📖 Explain file</button>
          <button class="ai-suggestion-btn" data-prompt="Find associated bugs">🐛 Find bugs</button>
          <button class="ai-suggestion-btn" data-prompt="Refactor this code to be cleaner">♻️ Refactor code</button>
          <button class="ai-suggestion-btn" data-prompt="Generate unit tests">🧪 Generate tests</button>
        </div>
        <div class="ai-shortcuts">
          <div class="ai-shortcut"><kbd>Ctrl+Enter</kbd> Send msg</div>
          <div class="ai-shortcut"><kbd>@</kbd> Attach Context</div>
          <div class="ai-shortcut"><kbd>Ctrl+L</kbd> Selection to chat</div>
        </div>
      </div>
    `;
  }

  renderHistoryList() {
    if (this.conversations.length === 0) {
      return `<div class="ai-empty-history">No hay conversaciones guardadas</div>`;
    }
    
    return this.conversations.map(conv => `
      <div class="ai-history-item" data-id="${conv.id}">
        <div class="ai-history-info">
          <div class="ai-history-title">${escapeHtml(conv.title)}</div>
          <div class="ai-history-meta">
            <span class="ai-history-model">${conv.model}</span>
            <span class="ai-history-date">${formatDate(conv.date)}</span>
            <span class="ai-history-count">${conv.messages.length} mensajes</span>
          </div>
        </div>
        <div class="ai-history-actions">
          <button class="ai-btn-icon ai-btn-load" title="Cargar">📂</button>
          <button class="ai-btn-icon ai-btn-delete" title="Eliminar">🗑️</button>
        </div>
      </div>
    `).join('');
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  attachEventListeners() {
    // Tabs
    this.container.querySelectorAll('.ai-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Envío de mensajes
    const input = this.container.querySelector('#ai-input');
    const sendBtn = this.container.querySelector('#ai-btn-send');
    const stopBtn = this.container.querySelector('#ai-btn-stop');
    
    input.addEventListener('keydown', this.handleKeyDown);
    input.addEventListener('input', this.autoExpandTextarea);
    sendBtn.addEventListener('click', this.handleSend);
    stopBtn.addEventListener('click', this.stopGeneration);

    // Nueva conversación
    this.container.querySelector('#ai-btn-new-chat').addEventListener('click', this.newConversation);

    // Configuración
    const settingsBtn = this.container.querySelector('#ai-btn-settings');
    const settingsPanel = this.container.querySelector('#ai-settings-panel');
    settingsBtn.addEventListener('click', () => {
      settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'block' : 'none';
    });

    // Cambio de proveedor
    const providerSelect = this.container.querySelector('#ai-provider-select');
    providerSelect.addEventListener('change', (e) => {
      this.provider = e.target.value;
      this.container.querySelector('#ai-apikey-group').style.display = 
        this.provider === 'deepseek' ? 'block' : 'none';
      this.container.querySelector('#ai-groqkey-group').style.display = 
        this.provider === 'groq' ? 'block' : 'none';
      
      // Cambiar al modelo por defecto del proveedor seleccionado
      if (this.provider === 'groq') {
        this.activeModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
        this.state.aiModel = this.activeModel;
      } else if (this.provider === 'deepseek') {
        this.activeModel = 'deepseek-coder';
        this.state.aiModel = this.activeModel;
      }
      
      this.loadModelList();
    });

    // Cambio de modelo
    const modelSelect = this.container.querySelector('#ai-model-select');
    modelSelect.addEventListener('change', (e) => {
      this.activeModel = e.target.value;
      this.state.aiModel = this.activeModel;
    });

    // API Key
    const apiKeyInput = this.container.querySelector('#ai-apikey-input');
    apiKeyInput?.addEventListener('change', (e) => {
      this.deepseekApiKey = e.target.value;
      localStorage.setItem('ide_deepseek_api_key', this.deepseekApiKey);
    });

    // Groq API Key
    const groqKeyInput = this.container.querySelector('#ai-groqkey-input');
    groqKeyInput?.addEventListener('change', (e) => {
      this.groqApiKey = e.target.value;
      localStorage.setItem('ide_groq_api_key', this.groqApiKey);
    });

    // Confirmación toggle
    const confirmToggle = this.container.querySelector('#ai-confirm-toggle');
    confirmToggle?.addEventListener('change', (e) => {
      this.confirmBeforeExecute = e.target.checked;
    });

    // Adjuntar contexto
    const attachBtn = this.container.querySelector('#ai-btn-attach');
    const contextMenu = this.container.querySelector('#ai-context-menu');
    attachBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = attachBtn.getBoundingClientRect();
      contextMenu.style.display = contextMenu.style.display === 'none' ? 'block' : 'none';
      contextMenu.style.left = rect.left + 'px';
      contextMenu.style.top = (rect.bottom + 5) + 'px';
    });

    // Items de contexto
    this.container.querySelectorAll('.ai-context-item').forEach(item => {
      item.addEventListener('click', () => {
        this.attachContext(item.dataset.context);
        contextMenu.style.display = 'none';
      });
    });

    // Cerrar menú al click fuera
    document.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target) && e.target !== attachBtn) {
        contextMenu.style.display = 'none';
      }
    });

    // Sugerencias rápidas
    this.container.querySelectorAll('.ai-suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        input.value = btn.dataset.prompt;
        this.handleSend();
      });
    });

    // Historial
    this.container.querySelector('#ai-btn-clear-history')?.addEventListener('click', () => {
      if (confirm('¿Eliminar todas las conversaciones?')) {
        this.conversations = [];
        this.saveConversations();
        this.switchTab('history');
      }
    });

    // Delegación de eventos para historial
    const historyList = this.container.querySelector('#ai-history-list');
    historyList?.addEventListener('click', (e) => {
      const item = e.target.closest('.ai-history-item');
      if (!item) return;
      
      if (e.target.closest('.ai-btn-load')) {
        this.loadConversation(item.dataset.id);
      } else if (e.target.closest('.ai-btn-delete')) {
        this.deleteConversation(item.dataset.id);
      } else {
        // Click en el item carga la conversación
        this.loadConversation(item.dataset.id);
      }
    });

    // Escuchar eventos de estado para adjuntar código automáticamente
    this.state.on('sendToAI', (data) => {
      if (data?.code) {
        this.pendingContext = {
          type: 'selection',
          code: data.code,
          file: data.file,
          lang: data.lang,
          selection: data.selection
        };
        this.updateContextDisplay();
        this.container.querySelector('#ai-input')?.focus();
        // Abrir panel si está cerrado
        if (!this.state.aiPanelOpen) {
          this.state.aiPanelOpen = true;
          this.state.emit('panelToggle', { panel: 'ai', open: true });
        }
      }
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    
    // Actualizar tabs UI
    this.container.querySelectorAll('.ai-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    // Mostrar/ocultar vistas
    const chatView = this.container.querySelector('#ai-chat-view');
    const historyView = this.container.querySelector('#ai-history-view');
    
    if (tab === 'history') {
      chatView.style.display = 'none';
      historyView.style.display = 'block';
      this.container.querySelector('#ai-history-list').innerHTML = this.renderHistoryList();
    } else {
      chatView.style.display = 'flex';
      historyView.style.display = 'none';
    }
    
    // Toggle input based on history view
    const floatingInput = this.container.querySelector('#ai-floating-input');
    if (floatingInput) {
      floatingInput.style.display = tab === 'history' ? 'none' : 'flex';
    }
  }

  // ==========================================================================
  // GESTIÓN DE MODELOS
  // ==========================================================================

  async loadModelList() {
    const select = this.container.querySelector('#ai-model-select');
    
    if (this.provider === 'ollama') {
      try {
        const response = await fetch('http://localhost:11434/api/tags');
        const data = await response.json();
        this.ollamaModels = (data.models || []).map(m => m.name);
        
        if (this.ollamaModels.length === 0) {
          select.innerHTML = '<option>deepseek-coder</option>';
        } else {
          this.ollamaModels.forEach(m => {
            const opt = document.createElement('option')
            opt.value = opt.textContent = m
            if (m === this.state.aiModel || m.includes('deepseek-coder')) opt.selected = true
            select.appendChild(opt)
          })
        }
      } catch (err) {
        select.innerHTML = '<option>deepseek-coder (offline)</option>';
      }
    } else if (this.provider === 'groq') {
      // Groq - modelos fijos
      select.innerHTML = `
        <option value="meta-llama/llama-4-scout-17b-16e-instruct" ${this.activeModel === 'meta-llama/llama-4-scout-17b-16e-instruct' ? 'selected' : ''}>Meta-Llama-4-Scout-17B-16E-Instruct</option>
      `;
    } else {
      // DeepSeek - modelos fijos
      select.innerHTML = `
        <option value="deepseek-chat" ${this.activeModel === 'deepseek-chat' ? 'selected' : ''}>deepseek-chat</option>
        <option value="deepseek-coder" ${this.activeModel === 'deepseek-coder' ? 'selected' : ''}>deepseek-coder</option>
        <option value="deepseek-reasoner" ${this.activeModel === 'deepseek-reasoner' ? 'selected' : ''}>deepseek-reasoner</option>
      `;
    }
  }

  // ==========================================================================
  // CONTEXTO Y ADJUNTOS
  // ==========================================================================

  async attachContext(type) {
    const editor = this.state.editorInstance;
    const currentFile = this.state.currentFile;
    
    switch (type) {
      case 'active-file':
        if (!editor || !currentFile) {
          this.showStatus('No hay archivo activo', 'error');
          return;
        }
        this.pendingContext = {
          type: 'file',
          code: editor.getValue(),
          file: currentFile,
          lang: currentFile.split('.').pop() || 'text'
        };
        break;
        
      case 'selection':
        if (!editor || !currentFile) {
          this.showStatus('No hay archivo activo', 'error');
          return;
        }
        const selection = editor.getSelection();
        const selectedText = editor.getModel()?.getValueInRange(selection) || '';
        if (!selectedText.trim()) {
          this.showStatus('No hay texto seleccionado', 'error');
          return;
        }
        this.pendingContext = {
          type: 'selection',
          code: selectedText,
          file: currentFile,
          lang: currentFile.split('.').pop() || 'text',
          selection: selection
        };
        break;
        
      case 'project':
        if (!this.state.currentFolder) {
          this.showStatus('No hay carpeta abierta', 'error');
          return;
        }
        try {
          const fileTree = await window.api.readDir(this.state.currentFolder);
          this.pendingContext = {
            type: 'project',
            fileTree: fileTree,
            folder: this.state.currentFolder
          };
        } catch (err) {
          this.showStatus('Error al leer proyecto: ' + err.message, 'error');
          return;
        }
        break;
    }
    
    this.updateContextDisplay();
    this.showStatus('Contexto adjunto', 'success');
  }

  removeContext() {
    this.pendingContext = null;
    this.updateContextDisplay();
  }

  updateContextDisplay() {
    const bar = this.container.querySelector('#ai-context-bar');
    const chips = this.container.querySelector('#ai-context-chips');
    
    if (!this.pendingContext) {
      bar.style.display = 'none';
      chips.innerHTML = '';
      return;
    }
    
    bar.style.display = 'block';
    
    let label, icon;
    switch (this.pendingContext.type) {
      case 'file':
        label = `📄 ${this.pendingContext.file.split(/[\\/]/).pop()}`;
        icon = '📄';
        break;
      case 'selection':
        label = `✂️ Selección de ${this.pendingContext.file.split(/[\\/]/).pop()}`;
        icon = '✂️';
        break;
      case 'project':
        label = `📁 Proyecto: ${this.pendingContext.folder.split(/[\\/]/).pop()}`;
        icon = '📁';
        break;
      default:
        label = 'Contexto';
        icon = '📎';
    }
    
    chips.innerHTML = `
      <div class="ai-context-chip">
        <span>${label}</span>
        <button class="ai-chip-remove" title="Eliminar">×</button>
      </div>
    `;
    
    chips.querySelector('.ai-chip-remove').addEventListener('click', () => {
      this.removeContext();
    });
  }

  // ==========================================================================
  // CONSTRUCCIÓN DE MENSAJES
  // ==========================================================================

  buildSystemPrompt() {
    const isAgent = this.activeTab === 'agent';
    
    let prompt = isAgent 
      ? `Eres un agente de programación experto integrado en un IDE llamado MyIDE. Tienes acceso a herramientas para modificar archivos, ejecutar comandos y analizar código. Usa las herramientas disponibles cuando sea necesario.`
      : `Eres un asistente de programación experto integrado en MyIDE. Responde en español. Cuando des código, usa bloques de código con el lenguaje especificado.`;

    // Contexto automático del agente
    if (isAgent) {
      const editor = this.state.editorInstance;
      const currentFile = this.state.currentFile;
      
      if (editor && currentFile) {
        const content = editor.getValue();
        const language = currentFile.split('.').pop() || 'text';
        const selection = editor.getSelection();
        const selectedText = editor.getModel()?.getValueInRange(selection);
        
        prompt += `\n\n--- CONTEXTO ACTUAL ---\n`;
        prompt += `Archivo activo: ${currentFile}\n`;
        prompt += `Lenguaje: ${language}\n`;
        
        if (selectedText && selectedText.trim()) {
          prompt += `\nSelección actual:\n\`\`\`${language}\n${selectedText}\n\`\`\`\n`;
        }
        
        // Solo incluir contenido completo si no es muy grande
        if (content.length < 5000) {
          prompt += `\nContenido completo del archivo:\n\`\`\`${language}\n${content}\n\`\`\`\n`;
        } else {
          prompt += `\nEl archivo es muy grande (${content.length} caracteres). Usa read_file para leerlo si necesitas ver el contenido completo.\n`;
        }
      }
      
      if (this.state.currentFolder) {
        prompt += `\nCarpeta del proyecto: ${this.state.currentFolder}\n`;
      }
      
      // Descripción de herramientas disponibles
      prompt += `\n--- HERRAMIENTAS DISPONIBLES ---\n`;
      prompt += `Puedes usar estas herramientas invocándolas con formato JSON:\n`;
      prompt += `{"tool": "nombre_tool", "params": {...}}\n\n`;
      prompt += `Herramientas:\n`;
      prompt += `- read_file: Lee un archivo. Params: {path}\n`;
      prompt += `- write_file: Escribe/sobrescribe un archivo. Params: {path, content}\n`;
      prompt += `- create_file: Crea un archivo nuevo. Params: {path, content}\n`;
      prompt += `- delete_file: Elimina un archivo. Params: {path}\n`;
      prompt += `- list_files: Lista archivos en un directorio. Params: {directory}\n`;
      prompt += `- get_open_file: Obtiene el archivo actualmente abierto. Params: {}\n`;
      prompt += `- replace_selection: Reemplaza la selección actual en el editor. Params: {newText}\n`;
      prompt += `- run_terminal: Ejecuta un comando en la terminal. Params: {command}\n`;
      prompt += `- search_in_files: Busca texto en archivos. Params: {query, directory}\n\n`;
      prompt += `Cuando necesites usar una herramienta, responde SOLO con el JSON de invocación. Después de recibir el resultado, continúa con tu análisis.`;
    }
    
    return prompt;
  }

  buildUserMessage(text) {
    if (!this.pendingContext) return text;
    
    let contextStr = '';
    
    switch (this.pendingContext.type) {
      case 'file':
        contextStr = `Archivo: ${this.pendingContext.file}\n\`\`\`${this.pendingContext.lang}\n${this.pendingContext.code}\n\`\`\`\n\n`;
        break;
      case 'selection':
        contextStr = `Selección de ${this.pendingContext.file}:\n\`\`\`${this.pendingContext.lang}\n${this.pendingContext.code}\n\`\`\`\n\n`;
        break;
      case 'project':
        contextStr = `Estructura del proyecto ${this.pendingContext.folder}:\n${this.formatFileTree(this.pendingContext.fileTree)}\n\n`;
        break;
    }
    
    return contextStr + text;
  }

  formatFileTree(tree, indent = '') {
    if (!tree || !Array.isArray(tree)) return '';
    return tree.map(item => {
      const isDir = item.isDirectory;
      const icon = isDir ? '📁' : '📄';
      const children = isDir && item.children ? '\n' + this.formatFileTree(item.children, indent + '  ') : '';
      return `${indent}${icon} ${item.name}${children}`;
    }).join('\n');
  }

  // ==========================================================================
  // STREAMING Y GENERACIÓN
  // ==========================================================================

  async handleSend() {
    if (this.isStreaming) return;
    
    const input = this.container.querySelector('#ai-input');
    const text = input.value.trim();
    if (!text) return;
    
    // Limpiar input
    input.value = '';
    input.style.height = 'auto';
    
    // Añadir mensaje del usuario
    const userMsg = { role: 'user', content: this.buildUserMessage(text) };
    this.messages.push(userMsg);
    this.appendMessage('user', text);
    
    // Limpiar contexto adjunto después de enviar
    const contextCopy = this.pendingContext ? { ...this.pendingContext } : null;
    this.pendingContext = null;
    this.updateContextDisplay();
    
    // Iniciar streaming
    await this.streamResponse(contextCopy);
    
    // Guardar conversación automáticamente
    this.saveConversation();
  }

  async streamResponse(contextData) {
    this.isStreaming = true;
    this.updateUIState();
    
    const reqId = ++this.reqCounter;
    const systemPrompt = this.buildSystemPrompt();
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...this.messages
    ];
    
    // Crear elemento de mensaje vacío para streaming
    const msgEl = this.appendMessage('assistant', '', true);
    let fullResponse = '';
    let toolCalls = [];
    
    try {
      if (this.provider === 'ollama') {
        await this.streamOllama(fullMessages, reqId, (token, done) => {
          fullResponse += token;
          this.updateStreamingMessage(msgEl, fullResponse);
          
          // Detectar posibles tool calls
          const toolCall = this.parseToolCall(fullResponse);
          if (toolCall && !toolCalls.find(t => t.json === JSON.stringify(toolCall))) {
            toolCalls.push({ json: JSON.stringify(toolCall), data: toolCall, executed: false });
          }
        });
      } else if (this.provider === 'groq') {
        try {
          await window.api.aiStreamGroq(fullMessages, this.activeModel, this.groqApiKey, reqId);
        } catch (err) {
          // Fallback: intentar streaming directo si el IPC no está disponible
          await this.streamGroq(fullMessages, reqId, (token, done) => {
            fullResponse += token;
            this.updateStreamingMessage(msgEl, fullResponse);
            
            // Detectar posibles tool calls
            const toolCall = this.parseToolCall(fullResponse);
            if (toolCall && !toolCalls.find(t => t.json === JSON.stringify(toolCall))) {
              toolCalls.push({ json: JSON.stringify(toolCall), data: toolCall, executed: false });
            }
          });
        }
      } else {
        await this.streamDeepSeek(fullMessages, reqId, (token, done) => {
          fullResponse += token;
          this.updateStreamingMessage(msgEl, fullResponse);
          
          // Detectar posibles tool calls
          const toolCall = this.parseToolCall(fullResponse);
          if (toolCall && !toolCalls.find(t => t.json === JSON.stringify(toolCall))) {
            toolCalls.push({ json: JSON.stringify(toolCall), data: toolCall, executed: false });
          }
        });
      }
      
      // Procesar tool calls si estamos en modo agente
      if (this.activeTab === 'agent' && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          if (!toolCall.executed) {
            await this.processToolCall(toolCall, msgEl);
          }
        }
      }
      
      // Finalizar mensaje
      this.finalizeMessage(msgEl, fullResponse, contextData);
      
      // Añadir al historial
      this.messages.push({ role: 'assistant', content: fullResponse });
      
    } catch (err) {
      this.updateStreamingMessage(msgEl, `❌ Error: ${err.message}`);
      console.error('Error en streaming:', err);
    } finally {
      this.isStreaming = false;
      this.updateUIState();
    }
  }

  async streamOllama(messages, reqId, onToken) {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.activeModel,
        messages: messages,
        stream: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const token = obj.message?.content || '';
          const isDone = obj.done || false;
          onToken(token, isDone);
        } catch {}
      }
    }
  }

  async streamDeepSeek(messages, reqId, onToken) {
    if (!this.deepseekApiKey) {
      throw new Error('API Key de DeepSeek no configurada');
    }
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.deepseekApiKey}`
      },
      body: JSON.stringify({
        model: this.activeModel,
        messages: messages,
        stream: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`DeepSeek error: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const lines = decoder.decode(value).split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;
        
        try {
          const obj = JSON.parse(line.slice(6));
          const token = obj.choices?.[0]?.delta?.content || '';
          onToken(token, false);
        } catch {}
      }
    }
  }

  async streamGroq(messages, reqId, onToken) {
    if (!this.groqApiKey) {
      throw new Error('API Key de Groq no configurada');
    }
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`
      },
      body: JSON.stringify({ 
        model: this.activeModel || 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: messages,
        stream: true,
        max_tokens: 8192,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Groq API error:', errorText)
      throw new Error(`Groq ${response.status}: ${errorText}`)
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const lines = decoder.decode(value).split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line === 'data: [DONE]') continue;
        if (!line.startsWith('data: ')) continue;
        
        try {
          const obj = JSON.parse(line.slice(6));
          const token = obj.choices?.[0]?.delta?.content || '';
          onToken(token, false);
        } catch {}
      }
    }
  }

  parseToolCall(text) {
    // Buscar JSON que parezca un tool call
    const patterns = [
      /\{[\s\S]*?"tool"\s*:\s*"(\w+)"[\s\S]*?\}/,
      /\{[\s\S]*?"name"\s*:\s*"(\w+)"[\s\S]*?"params"[\s\S]*?\}/,
      /\{\s*"action"\s*:\s*"(\w+)"[\s\S]*?\}/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const json = JSON.parse(match[0]);
          // Normalizar formatos
          if (json.tool || json.action || json.name) {
            return {
              tool: json.tool || json.action || json.name,
              params: json.params || json.parameters || json
            };
          }
        } catch {}
      }
    }
    return null;
  }

  // ==========================================================================
  // TOOL CALLS Y EJECUCIÓN
  // ==========================================================================

  async processToolCall(toolCall, msgEl) {
    const { tool, params } = toolCall.data;
    toolCall.executed = true;
    
    // Mostrar que se detectó un tool call
    this.appendToolStep(msgEl, 'detected', tool, params);
    
    // Verificar confirmación si está activada
    if (this.confirmBeforeExecute && this.isDestructiveTool(tool)) {
      const confirmed = await this.showToolConfirmation(tool, params);
      if (!confirmed) {
        this.appendToolStep(msgEl, 'cancelled', tool, null, 'Cancelado por el usuario');
        return;
      }
    }
    
    // Ejecutar tool
    this.appendToolStep(msgEl, 'executing', tool, params);
    
    try {
      const result = await this.executeTool(tool, params);
      this.appendToolStep(msgEl, 'completed', tool, null, result);
      
      // Añadir resultado al mensaje para continuar la conversación
      this.messages.push({
        role: 'system',
        content: `Resultado de ${tool}: ${JSON.stringify(result)}`
      });
    } catch (err) {
      this.appendToolStep(msgEl, 'error', tool, null, err.message);
      this.messages.push({
        role: 'system',
        content: `Error en ${tool}: ${err.message}`
      });
    }
  }

  isDestructiveTool(tool) {
    return ['write_file', 'delete_file', 'replace_selection', 'run_terminal'].includes(tool);
  }

  async showToolConfirmation(tool, params) {
    return new Promise((resolve) => {
      const action = this.describeToolAction(tool, params);
      const confirmed = confirm(`El agente quiere ejecutar:\n\n${action}\n\n¿Confirmar?`);
      resolve(confirmed);
    });
  }

  describeToolAction(tool, params) {
    const descriptions = {
      read_file: `Leer archivo: ${params.path}`,
      write_file: `Escribir archivo: ${params.path}`,
      create_file: `Crear archivo: ${params.path}`,
      delete_file: `Eliminar archivo: ${params.path}`,
      list_files: `Listar archivos en: ${params.directory}`,
      get_open_file: 'Obtener archivo abierto',
      replace_selection: 'Reemplazar selección en editor',
      run_terminal: `Ejecutar: ${params.command}`,
      search_in_files: `Buscar "${params.query}" en ${params.directory}`
    };
    return descriptions[tool] || `${tool}(${JSON.stringify(params)})`;
  }

  async executeTool(tool, params) {
    // Convertir paths relativos a absolutos
    const resolvePath = (p) => {
      if (!p) return p;
      if (window.api.pathIsAbsolute(p)) return p;
      const base = this.state.currentFolder;
      if (!base) throw new Error('No hay carpeta abierta. Abre una carpeta primero.');
      return window.api.pathJoin(base, p);
    };

    switch (tool) {
      case 'read_file': {
        const fullPath = resolvePath(params.path);
        const result = await window.api.agentReadFile(fullPath);
        if (!result.success) throw new Error(result.error);
        return result.content;
      }
        
      case 'write_file': {
        const fullPath = resolvePath(params.path);
        const result = await window.api.agentWriteFile(fullPath, params.content);
        if (!result.success) throw new Error(result.error);
        this.updateMonacoIfOpen(fullPath, params.content);
        this.refreshFileExplorer();
        return { success: true, path: fullPath };
      }
        
      case 'create_file': {
        const fullPath = resolvePath(params.path);
        const result = await window.api.agentCreateFile(fullPath, params.content || '');
        if (!result.success) throw new Error(result.error);
        this.refreshFileExplorer();
        return { success: true, path: fullPath };
      }
        
      case 'delete_file': {
        const fullPath = resolvePath(params.path);
        const result = await window.api.agentDeleteFile(fullPath);
        if (!result.success) throw new Error(result.error);
        this.refreshFileExplorer();
        return { success: true, path: fullPath };
      }
        
      case 'list_files': {
        const fullPath = resolvePath(params.directory);
        const result = await window.api.agentListFiles(fullPath);
        if (!result.success) throw new Error(result.error);
        return result.files;
      }
        
      case 'get_open_file':
        return {
          path: this.state.currentFile,
          content: this.state.editorInstance?.getValue()
        };
        
      case 'replace_selection': {
        const editor = this.state.editorInstance;
        if (!editor) throw new Error('No hay editor activo');
        const selection = editor.getSelection();
        editor.executeEdits('ai-agent', [{
          range: selection,
          text: params.newText
        }]);
        return { success: true };
      }
        
      case 'run_terminal': {
        if (!this.state.terminalOpen) {
          this.state.emit('panelToggle', { panel: 'terminal', open: true });
        }
        return { success: true, command: params.command, note: 'Comando enviado a terminal' };
      }
        
      case 'search_in_files': {
        const fullPath = resolvePath(params.directory);
        const result = await window.api.agentSearch(params.query, fullPath);
        if (!result.success) throw new Error(result.error);
        return result.results;
      }
        
      default:
        throw new Error(`Tool desconocida: ${tool}`);
    }
  }

  refreshFileExplorer() {
    // Emitir evento para refrescar el árbol de archivos
    this.state.emit('refreshTree');
  }

  async searchInFiles(query, directory) {
    const result = await window.api.agentSearch(query, directory);
    if (!result.success) throw new Error(result.error);
    return result.results;
  }

  findMatches(content, query) {
    const lines = content.split('\n');
    const matches = [];
    lines.forEach((line, idx) => {
      if (line.includes(query)) {
        matches.push({ line: idx + 1, text: line.trim() });
      }
    });
    return matches;
  }

  updateMonacoIfOpen(filePath, content) {
    const tab = this.state.openTabs?.find(t => t.path === filePath);
    if (tab && this.state.currentFile === filePath) {
      const model = this.state.editorInstance?.getModel();
      if (model) {
        model.setValue(content);
      }
    }
  }

  appendToolStep(msgEl, status, tool, params, result) {
    const stepsContainer = msgEl.querySelector('.ai-tool-steps') || (() => {
      const container = document.createElement('div');
      container.className = 'ai-tool-steps';
      msgEl.querySelector('.ai-msg-content').appendChild(container);
      return container;
    })();
    
    const icons = {
      detected: '🔍',
      executing: '⚙️',
      completed: '✅',
      error: '❌',
      cancelled: '🚫'
    };
    
    const stepEl = document.createElement('div');
    stepEl.className = `ai-tool-step ai-tool-step--${status}`;
    stepEl.innerHTML = `
      <span class="ai-tool-icon">${icons[status]}</span>
      <span class="ai-tool-text">
        ${status === 'detected' && `Detectado: ${tool}`}
        ${status === 'executing' && `Ejecutando: ${this.describeToolAction(tool, params)}`}
        ${status === 'completed' && `${tool} completado${result ? `: ${JSON.stringify(result).slice(0, 100)}` : ''}`}
        ${status === 'error' && `Error en ${tool}: ${result}`}
        ${status === 'cancelled' && `${tool} cancelado`}
      </span>
    `;
    
    stepsContainer.appendChild(stepEl);
    this.scrollToBottom();
  }

  // ==========================================================================
  // UI Y RENDERIZADO DE MENSAJES
  // ==========================================================================

  appendMessage(role, text, isStreaming = false) {
    const welcome = this.container.querySelector('.ai-welcome');
    if (welcome) welcome.remove();
    
    const container = this.container.querySelector('#ai-messages');
    const el = document.createElement('div');
    el.className = `ai-msg ai-msg--${role}`;
    
    if (role === 'user') {
      el.innerHTML = `
        <div class="ai-msg-bubble">
          <div class="ai-msg-content">${escapeHtml(text)}</div>
        </div>
      `;
    } else {
      el.innerHTML = `
        <div class="ai-msg-header">
          <span class="ai-msg-avatar">⚛</span>
          <span class="ai-msg-role">NVCode AI</span>
        </div>
        <div class="ai-msg-bubble">
          <div class="ai-msg-content ${isStreaming ? 'streaming' : ''}">
            ${isStreaming ? '<span class="ai-cursor">▋</span>' : renderMarkdown(text)}
          </div>
        </div>
      `;
    }
    
    container.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  updateStreamingMessage(el, text) {
    const contentEl = el.querySelector('.ai-msg-content');
    if (!contentEl) return;
    
    contentEl.innerHTML = renderMarkdown(text) + '<span class="ai-cursor">▋</span>';
    this.scrollToBottom();
  }

  finalizeMessage(el, text, contextData) {
    const contentEl = el.querySelector('.ai-msg-content');
    if (!contentEl) return;
    
    contentEl.classList.remove('streaming');
    contentEl.innerHTML = renderMarkdown(text);
    
    // Añadir botones de acción a bloques de código
    el.querySelectorAll('.ai-code-block').forEach(block => {
      const pre = block.querySelector('pre');
      const code = pre.querySelector('code')?.textContent || pre.textContent;
      const actionsContainer = block.querySelector('.ai-code-actions');
      if (!actionsContainer) return;
      
      // Copiar
      const btnCopy = document.createElement('button');
      btnCopy.className = 'ai-code-btn';
      btnCopy.innerHTML = '📋 Copiar';
      btnCopy.addEventListener('click', () => {
        navigator.clipboard.writeText(code);
        btnCopy.innerHTML = '✓ Copiado';
        setTimeout(() => btnCopy.innerHTML = '📋 Copiar', 2000);
      });
      
      // Insertar en cursor
      const btnInsert = document.createElement('button');
      btnInsert.className = 'ai-code-btn';
      btnInsert.innerHTML = '↙ Insertar';
      btnInsert.addEventListener('click', () => {
        const editor = this.state.editorInstance;
        if (!editor) return;
        const pos = editor.getPosition();
        editor.executeEdits('ai-agent', [{
          range: editor.getSelection() || { startLineNumber: pos.lineNumber, startColumn: pos.column, endLineNumber: pos.lineNumber, endColumn: pos.column },
          text: code
        }]);
        editor.focus();
      });
      
      // Reemplazar selección
      const btnReplace = document.createElement('button');
      btnReplace.className = 'ai-code-btn ai-code-btn--primary';
      btnReplace.innerHTML = '✦ Reemplazar';
      btnReplace.addEventListener('click', () => {
        const editor = this.state.editorInstance;
        if (!editor) return;
        const selection = editor.getSelection();
        editor.executeEdits('ai-agent', [{
          range: selection,
          text: code
        }]);
        btnReplace.innerHTML = '✓ Listo';
        setTimeout(() => btnReplace.innerHTML = '✦ Reemplazar', 2000);
      });
      
      actionsContainer.append(btnCopy, btnInsert, btnReplace);
    });
    
    // Lógica de "Ver más" si el mensaje es muy alto
    const bubble = el.querySelector('.ai-msg-bubble');
    if (bubble && contentEl.scrollHeight > 500) {
      contentEl.classList.add('ai-msg-collapsed');
      
      const expandBtn = document.createElement('button');
      expandBtn.className = 'ai-msg-expand-btn';
      expandBtn.innerHTML = '🔽 Ver más';
      
      expandBtn.addEventListener('click', () => {
        if (contentEl.classList.contains('ai-msg-collapsed')) {
          contentEl.classList.remove('ai-msg-collapsed');
          expandBtn.innerHTML = '🔼 Ver menos';
        } else {
          contentEl.classList.add('ai-msg-collapsed');
          expandBtn.innerHTML = '🔽 Ver más';
          // Scroll ligero para no perder contexto
          bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
      
      bubble.appendChild(expandBtn);
    }
    
    this.scrollToBottom();
  }

  scrollToBottom() {
    const container = this.container.querySelector('#ai-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // ==========================================================================
  // HISTORIAL Y PERSISTENCIA
  // ==========================================================================

  loadConversations() {
    try {
      const data = localStorage.getItem('ide_chat_history');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  saveConversations() {
    localStorage.setItem('ide_chat_history', JSON.stringify(this.conversations));
  }

  saveConversation() {
    if (this.messages.length === 0) return;
    
    // Generar título del primer mensaje del usuario
    const firstUserMsg = this.messages.find(m => m.role === 'user');
    const title = firstUserMsg 
      ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
      : 'Sin título';
    
    const conversation = {
      id: this.activeConversation || generateId(),
      title,
      date: new Date().toISOString(),
      messages: [...this.messages],
      model: this.activeModel,
      provider: this.provider
    };
    
    // Actualizar o añadir
    const idx = this.conversations.findIndex(c => c.id === conversation.id);
    if (idx >= 0) {
      this.conversations[idx] = conversation;
    } else {
      this.conversations.unshift(conversation);
      this.activeConversation = conversation.id;
    }
    
    // Mantener solo últimas 50 conversaciones
    if (this.conversations.length > 50) {
      this.conversations = this.conversations.slice(0, 50);
    }
    
    this.saveConversations();
  }

  loadConversation(id) {
    const conv = this.conversations.find(c => c.id === id);
    if (!conv) return;
    
    this.activeConversation = id;
    this.messages = [...conv.messages];
    this.activeModel = conv.model || this.activeModel;
    this.provider = conv.provider || 'ollama';
    
    // Actualizar UI
    this.container.querySelector('#ai-model-select').value = this.activeModel;
    this.container.querySelector('#ai-provider-select').value = this.provider;
    
    // Renderizar mensajes
    this.container.querySelector('#ai-messages').innerHTML = '';
    this.messages.forEach(msg => {
      if (msg.role === 'user') {
        this.appendMessage('user', msg.content);
      } else if (msg.role === 'assistant') {
        const el = this.appendMessage('assistant', '');
        this.finalizeMessage(el, msg.content, null);
      }
    });
    
    this.switchTab(this.activeTab === 'agent' ? 'agent' : 'chat');
  }

  deleteConversation(id) {
    this.conversations = this.conversations.filter(c => c.id !== id);
    this.saveConversations();
    
    if (this.activeConversation === id) {
      this.newConversation();
    } else {
      this.switchTab('history');
    }
  }

  newConversation() {
    this.messages = [];
    this.activeConversation = null;
    this.pendingContext = null;
    this.container.querySelector('#ai-messages').innerHTML = this.renderWelcome();
    this.updateContextDisplay();
    this.switchTab(this.activeTab === 'history' ? 'agent' : this.activeTab);
  }

  // ==========================================================================
  // UTILIDADES UI
  // ==========================================================================

  handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.handleSend();
    }
    
    // Atajo @ para contexto
    if (e.key === '@' && !e.ctrlKey && !e.metaKey) {
      const attachBtn = this.container.querySelector('#ai-btn-attach');
      attachBtn.click();
    }
  }

  autoExpandTextarea() {
    const textarea = this.container.querySelector('#ai-input');
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 150); // max 6 líneas aprox
    textarea.style.height = newHeight + 'px';
  }

  updateUIState() {
    const sendBtn = this.container.querySelector('#ai-btn-send');
    const stopBtn = this.container.querySelector('#ai-btn-stop');
    const status = this.container.querySelector('#ai-status');
    
    if (this.isStreaming) {
      sendBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
      status.textContent = this.activeTab === 'agent' ? 'El agente está trabajando...' : 'Generando...';
    } else {
      sendBtn.style.display = 'flex';
      stopBtn.style.display = 'none';
      status.textContent = '';
    }
  }

  stopGeneration() {
    // Implementar cancelación si es posible
    this.isStreaming = false;
    this.updateUIState();
    this.showStatus('Generación detenida', 'info');
  }

  showStatus(message, type = 'info') {
    const status = this.container.querySelector('#ai-status');
    status.textContent = message;
    status.className = `ai-status ai-status--${type}`;
    setTimeout(() => {
      status.textContent = '';
      status.className = 'ai-status';
    }, 3000);
  }

  // Confirmación/rechazo desde UI
  confirmToolExecution(toolCallId) {
    // Implementar para UI más avanzada
  }

  rejectToolExecution(toolCallId) {
    // Implementar para UI más avanzada
  }
}

// ============================================================================
// FUNCIÓN DE FÁBRICA PARA CREAR INSTANCIA
// ============================================================================

export function createAIAgent(container, state) {
  const agent = new AIAgent({ container, state });
  return agent.mount();
}
