// src/renderer/components/ai-agent.js
// Nova AI Agent — rewrite completo
// Soporta: Ollama (local) + DeepSeek API + Groq API con streaming real
// Features: ReAct loop, tool calls, historial, Monaco integration, AbortController

// ============================================================================
// UTILIDADES
// ============================================================================

import { escapeHtml, renderMarkdown } from "../utils/markdown.js";
import { estimateTokens } from "../utils/token-counter.js";
import { MemoryManager } from "../utils/memory-manager.js";
import { checkpointManager } from "../utils/checkpoint-manager.js";

const generateId = () => Math.random().toString(36).substring(2, 11);

const formatDate = (d) => {
  const now = new Date(),
    date = new Date(d);
  if (now.toDateString() === date.toDateString())
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\b/i,
  /\brmdir\b/i,
  /\bdel\b/i,
  /\bformat\b/i,
  /\bmkfs\b/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+clean\b/i,
  /\bnpm\s+publish\b/i,
  /\byarn\s+publish\b/i,
  /\bpnpm\s+publish\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\binvoke-webrequest\b/i,
  /\birm\b/i,
  /\biex\b/i,
];

function isPathInside(basePath, targetPath) {
  if (!basePath || !targetPath) return false;
  const normalize = (value) =>
    String(value).replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
  const base = normalize(basePath);
  const target = normalize(targetPath);
  return target === base || target.startsWith(base + "\\");
}

function hasDangerousCommand(command = "") {
  return DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command));
}

// renderMarkdown is now imported from ../utils/markdown.js

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

export class AIAgent {
  constructor({ container, state }) {
    this.container = container;
    this.state = state;

    this.messages = [];
    this.activeTab = "agent";
    this.activeModel = state.aiModel || "deepseek-coder";
    this.provider = localStorage.getItem("ide_provider") || "ollama";
    this.deepseekApiKey = (localStorage.getItem("ide_deepseek_key") || "").trim();
    this.groqApiKey = (localStorage.getItem("ide_groq_key") || "").trim();
    this.activeConversation = null;
    this.isStreaming = false;
    this.pendingContext = null;
    this.ollamaModels = [];
    this.reqCounter = 0;
    this.abortController = null;
    // Confirmación solo para delete_file (no para write/create)
    this.confirmDelete = true;
    this.confirmCommands = true;
    this.fileLocks = new Map(); // path -> Promise (cola de operaciones)
    this.mode = localStorage.getItem("ide_agent_mode") || "simple"; // "simple" | "planner"
    this.lastToolCallsHash = null;
    this.repetitionCount = 0;

    this.conversations = this.loadConversations();
  }

  // ==========================================================================
  // MOUNT / RENDER
  // ==========================================================================

  mount() {
    this.render();
    this.attachEventListeners();
    this.loadModelList();
    this.loadSession(); // Restaurar sesión si existe
    this.setupInlineCompletions();
    return this;
  }

  render() {
    this.container.innerHTML = `
      <div class="ai-agent-container">

        <!-- HEADER -->
        <div class="ai-agent-header">
          <div class="ai-tabs">
            <button class="ai-tab ${this.activeTab === "agent" ? "active" : ""}" data-tab="agent">Agente</button>
            <button class="ai-tab ${this.activeTab === "chat" ? "active" : ""}"  data-tab="chat">Chat</button>
            <button class="ai-tab ${this.activeTab === "history" ? "active" : ""}" data-tab="history">Historial</button>
          </div>
          <div class="ai-mode-selector">
            <select id="ai-mode-select" class="ai-select-mini">
              <option value="simple" ${this.mode === "simple" ? "selected" : ""}>Simple</option>
              <option value="planner" ${this.mode === "planner" ? "selected" : ""}>Planificador</option>
            </select>
          </div>
          <span class="ai-model-badge" id="ai-model-badge">${escapeHtml(this.activeModel)}</span>
          <div class="ai-header-actions">
            <button class="ai-btn-icon" id="ai-btn-new-chat" title="Nueva conversación">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
            <button class="ai-btn-icon" id="ai-btn-settings" title="Configuración">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06-.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
          </div>
        </div>

        <!-- SETTINGS PANEL -->
        <div class="ai-settings-popover" id="ai-settings-panel" style="display:none">
          <div class="ai-settings-group">
            <label>Proveedor</label>
            <select id="ai-provider-select" class="ai-select">
              <option value="ollama"   ${this.provider === "ollama" ? "selected" : ""}>Ollama (Local)</option>
              <option value="deepseek" ${this.provider === "deepseek" ? "selected" : ""}>DeepSeek API</option>
              <option value="groq"     ${this.provider === "groq" ? "selected" : ""}>Groq API</option>
            </select>
          </div>
          <div class="ai-settings-group">
            <label>Modelo</label>
            <select id="ai-model-select" class="ai-select"><option>Cargando...</option></select>
          </div>
          <div class="ai-settings-group" id="ai-apikey-group" style="display:${this.provider === "deepseek" ? "block" : "none"}">
            <label>API Key DeepSeek</label>
            <input type="password" id="ai-apikey-input" class="ai-input" value="${escapeHtml(this.deepseekApiKey)}" placeholder="sk-...">
          </div>
          <div class="ai-settings-group" id="ai-groqkey-group" style="display:${this.provider === "groq" ? "block" : "none"}">
            <label>API Key Groq</label>
            <input type="password" id="ai-groqkey-input" class="ai-input" value="${escapeHtml(this.groqApiKey)}" placeholder="gsk_...">
          </div>
          <div class="ai-settings-group">
            <label class="ai-checkbox-label">
              <input type="checkbox" id="ai-confirm-delete" ${this.confirmDelete ? "checked" : ""}>
              Confirmar antes de eliminar archivos
            </label>
          </div>
          <div class="ai-settings-group">
            <label class="ai-checkbox-label">
              <input type="checkbox" id="ai-confirm-commands" ${this.confirmCommands ? "checked" : ""}>
              Confirmar antes de ejecutar comandos
            </label>
          </div>
        </div>

        <!-- CONTENT -->
        <div class="ai-content-area">
          <div class="ai-chat-view" id="ai-chat-view">
            <div class="ai-messages" id="ai-messages">
              ${this.renderWelcome()}
            </div>
            <div class="ai-plan-progress" id="ai-plan-progress" style="display:none"></div>
          </div>

          <div class="ai-floating-input" id="ai-floating-input">
            <div class="ai-context-bar" id="ai-context-bar" style="display:none">
              <div class="ai-context-chips" id="ai-context-chips"></div>
            </div>
            <div class="ai-input-wrapper">
              <textarea id="ai-input" class="ai-textarea" placeholder="Pregunta a Nova AI... (Ctrl+Enter para enviar)" rows="1" maxlength="8000"></textarea>
              <div class="ai-input-actions">
                <button class="ai-btn-icon ai-btn-attach" id="ai-btn-attach" title="Adjuntar contexto">@</button>
                <button class="ai-btn-send" id="ai-btn-send" title="Enviar (Ctrl+Enter)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
                <button class="ai-btn-stop" id="ai-btn-stop" style="display:none" title="Detener generación">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                </button>
              </div>
            </div>
            <div class="ai-status" id="ai-status"></div>
          </div>

          <div class="ai-history-view" id="ai-history-view" style="display:none">
            <div class="ai-history-header">
              <h3>Conversaciones</h3>
              <button class="ai-btn-secondary" id="ai-btn-clear-history">Limpiar todo</button>
            </div>
            <div class="ai-history-list" id="ai-history-list">${this.renderHistoryList()}</div>
          </div>
        </div>

        <!-- CONTEXT MENU -->
        <div class="ai-context-menu" id="ai-context-menu" style="display:none">
          <div class="ai-context-item" data-context="active-file">📄 <span>Archivo activo</span></div>
          <div class="ai-context-item" data-context="selection">✂️ <span>Selección actual</span></div>
          <div class="ai-context-item" data-context="project">📁 <span>Estructura del proyecto</span></div>
        </div>
      </div>
    `;
  }

  renderWelcome() {
    return `
      <div class="ai-welcome">
        <div class="ai-welcome-logo">✦</div>
        <h2 class="ai-welcome-title">Nova AI</h2>
        <p class="ai-welcome-subtitle">Agente de programación con acceso completo al proyecto.<br>Crea, edita y ejecuta archivos automáticamente.</p>
        <div class="ai-suggestions">
          <button class="ai-suggestion-btn" data-prompt="Crea una página web completa con HTML, CSS y JavaScript">Crear página web</button>
          <button class="ai-suggestion-btn" data-prompt="Explica qué hace este archivo y cada función">Explicar archivo</button>
          <button class="ai-suggestion-btn" data-prompt="Encuentra y corrige bugs en este código">Buscar y corregir bugs</button>
          <button class="ai-suggestion-btn" data-prompt="Refactoriza este código para que sea más limpio">Refactorizar</button>
        </div>
        <div class="ai-shortcuts">
          <div class="ai-shortcut"><kbd>Ctrl+Enter</kbd> Enviar</div>
          <div class="ai-shortcut"><kbd>@</kbd> Adjuntar contexto</div>
          <div class="ai-shortcut"><kbd>Ctrl+L</kbd> Enviar selección</div>
        </div>
      </div>
    `;
  }

  renderHistoryList() {
    if (!this.conversations.length)
      return `<div class="ai-empty-history">No hay conversaciones guardadas</div>`;
    return this.conversations
      .map(
        (c) => `
      <div class="ai-history-item" data-id="${c.id}">
        <div class="ai-history-info">
          <div class="ai-history-title">${escapeHtml(c.title)}</div>
          <div class="ai-history-meta">
            <span class="ai-history-model">${escapeHtml(c.model)}</span>
            <span class="ai-history-date">${formatDate(c.date)}</span>
            <span class="ai-history-count">${c.messages.length} msgs</span>
          </div>
        </div>
        <div class="ai-history-actions">
          <button class="ai-btn-icon ai-btn-load" title="Cargar">📂</button>
          <button class="ai-btn-icon ai-btn-delete" title="Eliminar">🗑️</button>
        </div>
      </div>
    `,
      )
      .join("");
  }

  // ==========================================================================
  // EVENT LISTENERS
  // ==========================================================================

  attachEventListeners() {
    // Tabs
    this.container
      .querySelectorAll(".ai-tab")
      .forEach((tab) =>
        tab.addEventListener("click", () => this.switchTab(tab.dataset.tab)),
      );

    // Mode selector
    this.container
      .querySelector("#ai-mode-select")
      ?.addEventListener("change", (e) => {
        this.mode = e.target.value;
        localStorage.setItem("ide_agent_mode", this.mode);
        this.showStatus(`Modo: ${this.mode}`, "info");
      });

    // Send / stop
    const input = this.container.querySelector("#ai-input");
    const sendBtn = this.container.querySelector("#ai-btn-send");
    const stopBtn = this.container.querySelector("#ai-btn-stop");

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleSend();
      }
      if (e.key === "@" && !e.ctrlKey && !e.metaKey)
        this.container.querySelector("#ai-btn-attach").click();
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 150) + "px";
    });
    sendBtn.addEventListener("click", () => this.handleSend());
    stopBtn.addEventListener("click", () => this.stopGeneration());

    // New chat
    this.container
      .querySelector("#ai-btn-new-chat")
      .addEventListener("click", () => this.newConversation());

    // Settings toggle
    const settingsBtn = this.container.querySelector("#ai-btn-settings");
    const settingsPanel = this.container.querySelector("#ai-settings-panel");
    settingsBtn.addEventListener("click", () => {
      settingsPanel.style.display =
        settingsPanel.style.display === "none" ? "block" : "none";
    });

    // Provider change
    this.container
      .querySelector("#ai-provider-select")
      .addEventListener("change", (e) => {
        this.provider = e.target.value;
        localStorage.setItem("ide_provider", this.provider);
        this.container.querySelector("#ai-apikey-group").style.display =
          this.provider === "deepseek" ? "block" : "none";
        this.container.querySelector("#ai-groqkey-group").style.display =
          this.provider === "groq" ? "block" : "none";
        if (this.provider === "groq")
          this.activeModel = "meta-llama/llama-4-scout-17b-16e-instruct";
        else if (this.provider === "deepseek")
          this.activeModel = "deepseek-chat";
        this.state.aiModel = this.activeModel;
        this.loadModelList();
      });

    // Model change
    this.container
      .querySelector("#ai-model-select")
      .addEventListener("change", (e) => {
        this.activeModel = e.target.value;
        this.state.aiModel = this.activeModel;
        this.updateBadge();
      });

    // API keys
    this.container
      .querySelector("#ai-apikey-input")
      ?.addEventListener("change", (e) => {
        this.deepseekApiKey = e.target.value.trim();
        localStorage.setItem("ide_deepseek_key", this.deepseekApiKey);
      });
    this.container
      .querySelector("#ai-groqkey-input")
      ?.addEventListener("change", (e) => {
        this.groqApiKey = e.target.value.trim();
        localStorage.setItem("ide_groq_key", this.groqApiKey);
      });

    // Confirm delete toggle
    this.container
      .querySelector("#ai-confirm-delete")
      ?.addEventListener("change", (e) => {
        this.confirmDelete = e.target.checked;
      });
    this.container
      .querySelector("#ai-confirm-commands")
      ?.addEventListener("change", (e) => {
        this.confirmCommands = e.target.checked;
      });

    // Context attach
    const attachBtn = this.container.querySelector("#ai-btn-attach");
    const contextMenu = this.container.querySelector("#ai-context-menu");
    attachBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const r = attachBtn.getBoundingClientRect();
      contextMenu.style.cssText = `display:block;left:${r.left}px;top:${r.bottom + 4}px`;
    });
    this.container.querySelectorAll(".ai-context-item").forEach((item) =>
      item.addEventListener("click", () => {
        this.attachContext(item.dataset.context);
        contextMenu.style.display = "none";
      }),
    );
    document.addEventListener("click", (e) => {
      if (!contextMenu.contains(e.target) && e.target !== attachBtn)
        contextMenu.style.display = "none";
    });

    // Suggestion buttons
    this.container.querySelectorAll(".ai-suggestion-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        input.value = btn.dataset.prompt;
        this.handleSend();
      }),
    );

    // History
    this.container
      .querySelector("#ai-btn-clear-history")
      ?.addEventListener("click", () => {
        if (confirm("¿Eliminar todas las conversaciones guardadas?")) {
          this.conversations = [];
          this.saveConversations();
          this.container.querySelector("#ai-history-list").innerHTML =
            this.renderHistoryList();
        }
      });
    this.container
      .querySelector("#ai-history-list")
      ?.addEventListener("click", (e) => {
        const item = e.target.closest(".ai-history-item");
        if (!item) return;
        if (e.target.closest(".ai-btn-load"))
          this.loadConversation(item.dataset.id);
        else if (e.target.closest(".ai-btn-delete"))
          this.deleteConversation(item.dataset.id);
        else this.loadConversation(item.dataset.id);
      });

    // State events
    this.state.on("sendToAI", (data) => {
      if (!data?.code) return;
      this.pendingContext = {
        type: "selection",
        code: data.code,
        file: data.file,
        lang: data.lang,
      };
      this.updateContextDisplay();
      if (this.activeTab !== "agent") this.switchTab("agent");
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.container
      .querySelectorAll(".ai-tab")
      .forEach((t) => t.classList.toggle("active", t.dataset.tab === tab));
    const chatView = this.container.querySelector("#ai-chat-view");
    const historyView = this.container.querySelector("#ai-history-view");
    const floatInput = this.container.querySelector("#ai-floating-input");

    if (tab === "history") {
      chatView.style.display = "none";
      historyView.style.display = "block";
      floatInput.style.display = "none";
      this.container.querySelector("#ai-history-list").innerHTML =
        this.renderHistoryList();
    } else {
      chatView.style.display = "flex";
      historyView.style.display = "none";
      floatInput.style.display = "flex";
    }
  }

  // ==========================================================================
  // MODELOS
  // ==========================================================================

  async loadModelList() {
    const select = this.container.querySelector("#ai-model-select");
    select.innerHTML = "";

    if (this.provider === "ollama") {
      try {
        const models = await window.api.aiModels();
        if (!models.length) {
          select.innerHTML =
            '<option value="deepseek-coder">deepseek-coder (sin modelos)</option>';
        } else {
          models.forEach((m) => {
            const opt = document.createElement("option");
            opt.value = opt.textContent = m;
            if (
              m === this.activeModel ||
              (!this.activeModel && m.includes("deepseek-coder"))
            )
              opt.selected = true;
            select.appendChild(opt);
          });
          if (!select.value && models.length) {
            select.value = models[0];
            this.activeModel = models[0];
          }
        }
      } catch {
        select.innerHTML =
          '<option value="deepseek-coder">deepseek-coder (Ollama offline)</option>';
      }
    } else if (this.provider === "groq") {
      select.innerHTML = `
        <option value="meta-llama/llama-4-scout-17b-16e-instruct">Llama-4-Scout-17B</option>
        <option value="llama-3.3-70b-versatile">Llama-3.3-70B</option>
        <option value="llama-3.1-8b-instant">Llama-3.1-8B (rápido)</option>
        <option value="mixtral-8x7b-32768">Mixtral-8x7B</option>
      `;
      select.value =
        this.activeModel || "meta-llama/llama-4-scout-17b-16e-instruct";
    } else {
      select.innerHTML = `
        <option value="deepseek-chat">deepseek-chat</option>
        <option value="deepseek-coder">deepseek-coder</option>
        <option value="deepseek-reasoner">deepseek-reasoner</option>
      `;
      select.value = this.activeModel || "deepseek-chat";
    }

    this.activeModel = select.value;
    this.state.aiModel = this.activeModel;
    this.updateBadge();
  }

  // ==========================================================================
  // CONTEXTO
  // ==========================================================================

  async attachContext(type) {
    const editor = this.state.editorInstance;
    const file = this.state.currentFile;

    switch (type) {
      case "active-file":
        if (!editor || !file) {
          this.showStatus("No hay archivo activo", "error");
          return;
        }
        this.pendingContext = {
          type: "file",
          code: editor.getValue(),
          file,
          lang: file.split(".").pop() || "text",
        };
        break;
      case "selection": {
        if (!editor || !file) {
          this.showStatus("No hay archivo activo", "error");
          return;
        }
        const sel = editor.getSelection();
        const text = editor.getModel()?.getValueInRange(sel) || "";
        if (!text.trim()) {
          this.showStatus("No hay texto seleccionado", "error");
          return;
        }
        this.pendingContext = {
          type: "selection",
          code: text,
          file,
          lang: file.split(".").pop() || "text",
        };
        break;
      }
      case "project":
        if (!this.state.currentFolder) {
          this.showStatus("No hay carpeta abierta", "error");
          return;
        }
        try {
          const r = await window.api.agentGetProjectStructure(
            this.state.currentFolder,
            3,
          );
          this.pendingContext = {
            type: "project",
            tree: r.tree,
            folder: this.state.currentFolder,
          };
        } catch (err) {
          this.showStatus("Error: " + err.message, "error");
          return;
        }
        break;
    }

    this.updateContextDisplay();
    this.showStatus("Contexto adjunto ✓", "success");
  }

  updateContextDisplay() {
    const bar = this.container.querySelector("#ai-context-bar");
    const chips = this.container.querySelector("#ai-context-chips");
    if (!this.pendingContext) {
      bar.style.display = "none";
      chips.innerHTML = "";
      return;
    }

    const labels = {
      file: `📄 ${this.pendingContext.file?.split(/[\\/]/).pop()}`,
      selection: `✂️ Selección de ${this.pendingContext.file?.split(/[\\/]/).pop()}`,
      project: `📁 Proyecto: ${this.pendingContext.folder?.split(/[\\/]/).pop()}`,
    };
    bar.style.display = "block";
    chips.innerHTML = `
      <div class="ai-context-chip">
        <span>${labels[this.pendingContext.type] || "Contexto"}</span>
        <button class="ai-chip-remove">×</button>
      </div>`;
    chips.querySelector(".ai-chip-remove").addEventListener("click", () => {
      this.pendingContext = null;
      this.updateContextDisplay();
    });
  }

  // ==========================================================================
  // SYSTEM PROMPT
  // ==========================================================================

  buildSystemPrompt() {
    if (this.activeTab !== "agent") {
      return `Eres un asistente de programación experto en nvcODE. Responde en español. Usa bloques de código con el lenguaje correcto.`;
    }

    if (this.mode === "planner") {
      return this.buildPlannerPrompt();
    }

    const folder = this.state.currentFolder || "(ninguna)";
    const file = this.state.currentFile || "(ninguno)";

    let prompt = `You are Nova AI, a world-class expert software engineer and coding assistant.
You operate inside NVCode, a powerful Electron-based IDE.
Your goal is to help the user with coding tasks, from simple bug fixes to creating entire projects.

== CRITICAL PROTOCOL: THINK BEFORE ACTING ==
Before every single response or tool call, you MUST analyze the situation and plan your steps inside a <thought> block in SPANISH.
Format:
<thought>
1. Análisis: ¿Qué me ha pedido el usuario? ¿Qué archivos tengo abiertos?
2. Descubrimiento: ¿Necesito leer algún archivo o ver la estructura del proyecto? (SIEMPRE lee antes de editar).
3. Plan: ¿Qué pasos voy a seguir?
4. Herramientas: ¿Qué herramienta voy a usar ahora?
</thought>
[Your tool call or final response here]

Rules:
- RESPOND AND THINK IN SPANISH (Español).
- **NON-NEGOTIABLE**: If you need to modify an existing file, you MUST use the \`apply_diff\` tool with a unified diff format. This is MUCH faster and safer than rewriting the whole file.
- **FOR NEW FILES**: Use the \`write_file\` tool to create the initial content.
- **FORBIDDEN: NO "create-react-app"**: Do NOT use \`npx create-react-app\`. It is too slow and fails often. Instead, use \`npm create vite@latest . -- --template react\` or create files manually (package.json, src/App.jsx, etc.).
- **REASONING**: If a tool fails, DO NOT simply repeat it. Analyze the error message, check if the file exists using \`list_files\`, and adapt your plan.
- NEVER assume a file exists; use \`list_files\` or \`get_project_structure\` to check existence without erroring. 
- Avoid using \`read_file\` or \`open_file\` on files you suspect might not exist yet, as they will return an error and stop your workflow.
- For WEB projects: Use modern React + Tailwind CSS.
- Break down complex tasks into small, multiple tool calls. Use as many iterations as needed.
- If a tool fails, read the error result and try an alternative approach in the next step.

== TOOL FORMAT ==
You can output tools in two ways:
1. RAW JSON: {"tool":"name","params":{...}}
2. MARKDOWN BLOCK:
\`\`\`json
{"tool":"name","params":{...}}
\`\`\`

== AVAILABLE TOOLS ==
apply_diff          {"tool":"apply_diff","params":{"path":"src/App.jsx","diff":"unified diff content..."}}
write_file          {"tool":"write_file","params":{"path":"src/App.jsx","content":"..."}} (Use only for NEW files)
create_file         {"tool":"create_file","params":{"path":"README.md","content":"# My Project"}} (Alias of write_file)
read_file           {"tool":"read_file","params":{"path":"package.json"}}
list_files          {"tool":"list_files","params":{"directory":"src"}}
get_project_structure {"tool":"get_project_structure","params":{}}
run_command         {"tool":"run_command","params":{"command":"npm install"}}
get_diagnostics     {"tool":"get_diagnostics","params":{}} -> Returns Linter/Editor errors.
open_file           {"tool":"open_file","params":{"path":"index.html"}} -> Opens existing file.
delete_file         {"tool":"delete_file","params":{"path":"old.js"}}
search_in_files     {"tool":"search_in_files","params":{"query":"text"}}
write_memory        {"tool":"write_memory","params":{"key":"user_pref","value":"..."}}
read_memory         {"tool":"read_memory","params":{"key":"user_pref"}}`;

    // Contexto del editor
    const editor = this.state.editorInstance;
    if (editor && file && file !== "(ninguno)") {
      const content = editor.getValue();
      const lang = file.split(".").pop() || "text";
      const sel =
        editor.getModel()?.getValueInRange(editor.getSelection()) || "";
      prompt += `\n\n== ARCHIVO ACTIVO ==\nPath: ${file}\nLenguaje: ${lang}`;
      if (sel.trim()) prompt += `\nSelección:\n\`\`\`${lang}\n${sel}\n\`\`\``;
      if (content.length < 5000)
        prompt += `\nContenido:\n\`\`\`${lang}\n${content}\n\`\`\``;
      else
        prompt += `\n(Archivo grande — usa read_file si necesitas verlo completo)`;
    }

    return prompt;
  }

  buildPlannerPrompt() {
    const folder = this.state.currentFolder || "(ninguna)";
    const file = this.state.currentFile || "(ninguno)";

    return `You are the Planner Agent for NVCode.
Your job is to break down complex tasks into a multi-step plan.
Each step should be clear and actionable.

== PROTOCOLO DE PLANIFICACIÓN ==
1. Analiza el requerimiento del usuario.
2. Crea un plan detallado con fases (Fase 1, Fase 2, etc.).
3. Para cada fase, indica qué archivos se verán afectados.
4. Muestra el estado del plan al inicio de cada respuesta usando este formato:
   PLAN:
   - [ ] Fase 1: ...
   - [ ] Fase 2: ...

5. Una vez definido el plan, comienza ejecutando la primera fase tú mismo o indicando los pasos.
6. Actualiza el estado del plan (cambia [ ] por [x]) conforme avances.

Responde siempre en ESPAÑOL. Tienes acceso a todas las herramientas.`;
  }

  buildUserMessage(text) {
    if (!this.pendingContext) return text;
    switch (this.pendingContext.type) {
      case "file":
        return `Archivo: ${this.pendingContext.file}\n\`\`\`${this.pendingContext.lang}\n${this.pendingContext.code}\n\`\`\`\n\n${text}`;
      case "selection":
        return `Selección de ${this.pendingContext.file}:\n\`\`\`${this.pendingContext.lang}\n${this.pendingContext.code}\n\`\`\`\n\n${text}`;
      case "project":
        return `Estructura del proyecto:\n${this.formatFileTree(this.pendingContext.tree)}\n\n${text}`;
      default:
        return text;
    }
  }

  formatFileTree(tree, indent = "") {
    if (!tree || !Array.isArray(tree)) return "";
    return tree
      .map((n) => {
        const icon = n.isDirectory ? "📁" : "📄";
        const children =
          n.isDirectory && n.children
            ? "\n" + this.formatFileTree(n.children, indent + "  ")
            : "";
        return `${indent}${icon} ${n.name}${children}`;
      })
      .join("\n");
  }

  buildConversationWindow(limit = 24) {
    return this.messages.slice(-limit).map((msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return {
        ...msg,
        content: content.length > 12000 ? content.slice(-12000) : content,
      };
    });
  }

  // ==========================================================================
  // HANDLE SEND
  // ==========================================================================

  async handleSend() {
    if (this.isStreaming) return;
    const input = this.container.querySelector("#ai-input");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";

    const fullText = this.buildUserMessage(text);
    this.messages.push({ role: "user", content: fullText });
    this.appendMessage("user", text);

    this.pendingContext = null;
    this.updateContextDisplay();

    await this.streamResponse(0);
    this.saveConversation();
  }

  // ==========================================================================
  // STREAMING + REACT LOOP
  // ==========================================================================

  async streamResponse(iteration) {
    const MAX_ITER = 15;

    if (iteration === 0) {
      this.abortController = new AbortController();
      this.isStreaming = true;
      this._currentCheckpointId = null; // Resetear para esta vuelta del usuario
      this.updateUIState();
    }

    // Advanced Context Management: Summarization if > 80% limit
    const TOKEN_LIMIT = 32000;
    const currentTokens = estimateTokens(this.messages);
    if (currentTokens > TOKEN_LIMIT * 0.8 && this.messages.length > 15) {
      await this.summarizeOldContext();
    }

    if (iteration >= MAX_ITER) {
      this.appendSystemNote("Límite de iteraciones alcanzado.");
      return;
    }

    const signal = this.abortController?.signal;
    const reqId = ++this.reqCounter;
    const historyWindow = this.buildConversationWindow();
    const fullMessages = [
      { role: "system", content: this.buildSystemPrompt() },
      ...historyWindow,
    ];

    const msgEl = this.appendMessage("assistant", "", true);
    let fullResponse = "";
    let pendingRender = false;
    let latestRendered = "";

    try {
      const onToken = (tok) => {
        if (signal?.aborted) return;
        fullResponse += tok;
        
        // Detección temprana en streaming
        if (this.activeTab === "agent") {
          this.detectEarlyToolCalls(fullResponse, msgEl, signal);
        }

        if (pendingRender) return;
        pendingRender = true;
        setTimeout(() => {
          pendingRender = false;
          if (signal?.aborted) return;
          const visible = this.getStreamingDisplay(fullResponse);
          if (visible === latestRendered) return;
          latestRendered = visible;
          this.updateStreamingMessage(msgEl, visible);
        }, 33);
      };

      if (this.provider === "ollama")
        await this.streamOllama(fullMessages, onToken, signal);
      else if (this.provider === "groq")
        await this.streamGroq(fullMessages, onToken, signal);
      else await this.streamDeepSeek(fullMessages, onToken, signal);

      if (signal?.aborted) return;

      const toolCalls =
        this.activeTab === "agent" ? this.parseToolCalls(fullResponse) : [];

      // Finalizar mensaje
      const visibleText = this.stripToolCalls(fullResponse);
      latestRendered = visibleText;
      this.finalizeMessage(
        msgEl,
        visibleText ||
          (toolCalls.length ? "Usando herramientas para resolverlo..." : ""),
      );
      this.messages.push({ role: "assistant", content: fullResponse });

      // ReAct loop
      if (toolCalls.length > 0) {
        // Repetition Guard
        const hash = JSON.stringify(toolCalls);
        if (hash === this.lastToolCallsHash) {
          this.repetitionCount++;
          if (this.repetitionCount >= 2) {
            this.appendSystemNote("DETECCIÓN DE BUCLE: El agente está repitiendo las mismas acciones. Deteniendo para evitar errores infinitos.");
            this.isStreaming = false;
            this.updateUIState();
            return;
          }
        } else {
          this.lastToolCallsHash = hash;
          this.repetitionCount = 0;
        }

        const results = await this.runToolCallsInParallel(toolCalls, msgEl, signal);
        if (!signal?.aborted) {
          await this.streamResponse(iteration + 1);
        }
      }
    } catch (err) {
      if (err.name === "AbortError") {
        const c = msgEl.querySelector(".ai-msg-content");
        if (c) {
          c.classList.remove("streaming");
          const v = this.stripToolCalls(fullResponse);
          c.innerHTML = v
            ? renderMarkdown(v)
            : '<em style="opacity:.5">Generación detenida</em>';
        }
        return;
      }
      const c = msgEl.querySelector(".ai-msg-content");
      if (c) {
        c.classList.remove("streaming");
        c.innerHTML = `<span class="ai-error">❌ Error: ${escapeHtml(err.message)}</span>`;
      }
      console.error("[Nova AI]", err);
    } finally {
      if (iteration === 0) {
        this.abortController = null;
        this.isStreaming = false;
        this.updateUIState();

        // Mostrar botón de restaurar si se hicieron cambios en archivos
        if (this._currentCheckpointId) {
          this.addCheckpointRestoreButton(this._currentCheckpointId);
          this._currentCheckpointId = null;
        }
      }
    }
  }

  // ==========================================================================
  // STREAMING POR PROVEEDOR
  // ==========================================================================

  // Ollama corre en localhost — fetch directo desde renderer funciona sin CORS
  async streamOllama(messages, onToken, signal) {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.activeModel,
        messages,
        stream: true,
        options: { temperature: 0.3 },
      }),
    }).catch(() => {
      throw new Error(
        "Ollama no está ejecutándose. Inicia Ollama o cambia de proveedor en Configuración.",
      );
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}`);
    const reader = res.body.getReader(),
      dec = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done || signal?.aborted) break;

      buffer += dec.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          onToken(JSON.parse(line).message?.content || "");
        } catch {}
      }
    }
  }

  // DeepSeek y Groq van por IPC (proceso principal) para evitar bloqueos CORS en Electron
  async streamDeepSeek(messages, onToken, signal) {
    if (!this.deepseekApiKey)
      throw new Error(
        "API Key de DeepSeek no configurada. Abre ⚙ Configuración para añadirla.",
      );
    await this._streamViaIPC("deepseek", messages, onToken, signal);
  }

  async streamGroq(messages, onToken, signal) {
    if (!this.groqApiKey)
      throw new Error(
        "API Key de Groq no configurada. Abre ⚙ Configuración para añadirla.",
      );
    await this._streamViaIPC("groq", messages, onToken, signal);
  }

  // Streaming a través del proceso principal via IPC + evento ai:token
  _streamViaIPC(provider, messages, onToken, signal) {
    const reqId = this.reqCounter; // ya fue incrementado antes
    return new Promise((resolve, reject) => {
      let cleanup;

      const handler = (data) => {
        if (data.reqId !== reqId) return;
        if (signal?.aborted) {
          cleanup();
          resolve();
          return;
        }
        if (data.error) {
          cleanup();
          let niceError = data.error;
          if (data.error.includes("401")) {
            niceError = "Error de Autenticación (401): Tu API Key parece ser inválida o ha expirado. Por favor, revísala en Configuración. Nota: Si usas DeepSeek, asegúrate de tener saldo en tu cuenta.";
          }
          reject(new Error(niceError));
          return;
        }
        if (data.done) {
          cleanup();
          resolve();
          return;
        }
        if (data.token) onToken(data.token);
      };

      cleanup = window.api.onAiToken(handler);
      signal?.addEventListener("abort", () => {
        cleanup();
        resolve();
      });

      // Invocar el handler IPC (no await — los tokens llegan por evento)
      if (provider === "deepseek") {
        window.api.aiStreamDeepSeek(
          messages,
          this.activeModel,
          this.deepseekApiKey,
          reqId,
        );
      } else {
        window.api.aiStreamGroq(
          messages,
          this.activeModel,
          this.groqApiKey,
          reqId,
        );
      }
    });
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isStreaming = false;
    this.updateUIState();
  }

  // ==========================================================================
  // PARSEO DE TOOL CALLS (stack-based, maneja JSON anidado)
  // ==========================================================================

  parseToolCalls(text) {
    // Ya NO eliminamos bloques de código, buscamos el JSON donde sea
    const stripped = text; // Mantenemos el texto completo pero podemos limpiar ruidos si quisiéramos
    const calls = [];
    const seen = new Set();
    let i = 0;

    while (i < stripped.length) {
      if (stripped[i] !== "{") {
        i++;
        continue;
      }

      // Extraer JSON completo con stack
      let depth = 0,
        j = i,
        inStr = false,
        esc = false;
      while (j < stripped.length) {
        const ch = stripped[j];
        if (esc) {
          esc = false;
          j++;
          continue;
        }
        if (ch === "\\" && inStr) {
          esc = true;
          j++;
          continue;
        }
        if (ch === '"') {
          inStr = !inStr;
          j++;
          continue;
        }
        if (!inStr) {
          if (ch === "{") depth++;
          else if (ch === "}") {
            depth--;
            if (depth === 0) {
              j++;
              break;
            }
          }
        }
        j++;
      }

      if (depth === 0 && j > i) {
        try {
          const obj = JSON.parse(stripped.slice(i, j));
          const toolName = obj.tool || obj.action || obj.name;
          if (toolName && typeof toolName === "string") {
            const params = obj.params || obj.parameters || obj.arguments || {};
            const key = `${toolName}:${params.path || params.source || params.directory || params.command || params.query || JSON.stringify(params).slice(0, 60)}`;
            if (!seen.has(key)) {
              seen.add(key);
              calls.push({ tool: toolName, params });
            }
          }
        } catch {}
        i = j;
      } else {
        i++;
      }
    }
    return calls;
  }

  detectEarlyToolCalls(text, msgEl, signal) {
    // Buscamos JSONs de herramientas cerrados } que aún no han sido procesados.
    // Usamos un set para no repetir.
    const calls = this.parseToolCalls(text);
    if (!this.processedEarlyCalls) this.processedEarlyCalls = new Set();

    for (const tc of calls) {
      const key = JSON.stringify(tc);
      if (!this.processedEarlyCalls.has(key)) {
        this.processedEarlyCalls.add(key);
        // Ejecutar de forma asíncrona pero sin esperar al stream
        this.runToolCall(tc, msgEl);
      }
    }
  }

  // Durante streaming: oculta JSON parcial/completo que está construyendo
  getStreamingDisplay(text) {
    if (!text) return "";
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{")) return ""; // Pure tool call — no mostrar nada
    const jsonStart = text.search(/\n?\s*\{"tool"/);
    if (jsonStart > 0)
      return this.stripToolCalls(text.slice(0, jsonStart)).trim();
    return this.stripToolCalls(text);
  }

  // Elimina todos los tool-call JSON del texto final (stack-based)
  stripToolCalls(text) {
    if (!text) return "";
    let result = "",
      i = 0;
    while (i < text.length) {
      if (text[i] !== "{") {
        result += text[i++];
        continue;
      }
      let depth = 0,
        j = i,
        inStr = false,
        esc = false;
      while (j < text.length) {
        const ch = text[j];
        if (esc) {
          esc = false;
          j++;
          continue;
        }
        if (ch === "\\" && inStr) {
          esc = true;
          j++;
          continue;
        }
        if (ch === '"') {
          inStr = !inStr;
          j++;
          continue;
        }
        if (!inStr) {
          if (ch === "{") depth++;
          else if (ch === "}") {
            depth--;
            if (depth === 0) {
              j++;
              break;
            }
          }
        }
        j++;
      }
      if (depth === 0 && j > i) {
        try {
          const obj = JSON.parse(text.slice(i, j));
          if (obj && typeof obj.tool === "string") {
            i = j;
            continue;
          }
        } catch {}
      }
      result += text[i++];
    }
    return result.replace(/\n{3,}/g, "\n\n").trim();
  }

  // ==========================================================================
  // EJECUCIÓN DE HERRAMIENTAS
  // ==========================================================================

  async runToolCallsInParallel(toolCalls, msgEl, signal) {
    const readOnlyTools = [
      "read_file",
      "list_files",
      "get_project_structure",
      "search_in_files",
      "get_diagnostics",
      "get_open_file",
    ];

    const promises = toolCalls.map(async (tc) => {
      if (signal?.aborted) return;

      const { tool, params } = tc;

      // Si es una herramienta de escritura, usamos el bloqueo de archivo
      if (!readOnlyTools.includes(tool) && params.path) {
        const fp = this.resolvePath(params.path);
        const currentLock = this.fileLocks.get(fp) || Promise.resolve();
        const nextLock = currentLock.then(() => this.runToolCall(tc, msgEl));
        this.fileLocks.set(fp, nextLock);
        return nextLock;
      }

      // Si no es de escritura o no tiene path (ej. run_command), ejecutamos directamente (paralelo)
      // Nota: run_command podría ser serializado si se requiere, pero por ahora lo dejamos libre.
      return this.runToolCall(tc, msgEl);
    });

    return Promise.all(promises);
  }

  resolvePath(p) {
    if (!p) return p;
    if (/^([a-zA-Z]:[/\\]|\/|\\\\)/.test(p)) return p;
    const base = this.state.currentFolder;
    if (!base) return p;
    const sep = base.includes("\\") ? "\\" : "/";
    return base.replace(/[/\\]+$/, "") + sep + p.replace(/^[/\\]+/, "");
  }

  async runToolCall(tc, msgEl) {
    const { tool, params } = tc;

    if (this.shouldConfirmToolCall(tool, params)) {
      const ok = confirm(this.buildToolConfirmationMessage(tool, params));
      if (!ok) {
        this.addToolStep(msgEl, "cancelled", tool, "Cancelado por el usuario");
        this.messages.push({
          role: "user",
          content: `[Herramienta ${tool} cancelada]`,
        });
        return false;
      }
    }

    // Solo pedir confirmación para delete_file
    if (tool === "delete_file" && this.confirmDelete) {
      const ok = confirm(
        `El agente quiere ELIMINAR:\n${params.path}\n\n¿Confirmar?`,
      );
      if (!ok) {
        this.addToolStep(msgEl, "cancelled", tool, "Cancelado por el usuario");
        this.messages.push({
          role: "user",
          content: `[Herramienta ${tool} cancelada]`,
        });
        return false;
      }
    }

    this.addToolStep(msgEl, "running", tool, this.describeAction(tool, params));

    // ── Checkpoint: capturar estado ANTES de modificar archivos ──────────────
    const FILE_MUTATING_TOOLS = new Set([
      "write_file", "create_file", "delete_file",
      "apply_diff", "move_file", "delete_directory",
    ]);
    if (FILE_MUTATING_TOOLS.has(tool)) {
      const affectedPath =
        params.path || params.source || params.destination || null;
      if (affectedPath) {
        checkpointManager.stageFile(this.resolvePath(affectedPath));
        if (params.destination) {
          checkpointManager.stageFile(this.resolvePath(params.destination));
        }
        // Si no hay checkpoint activo para esta "vuelta" del agente, crearlo
        if (!this._currentCheckpointId) {
          this._currentCheckpointId = await checkpointManager.createCheckpoint(
            `Antes de: ${this.describeAction(tool, params)}`
          );
        } else {
          // Acumular en el checkpoint existente (misma vuelta del agente)
          const cp = checkpointManager.getById(this._currentCheckpointId);
          if (cp) {
            const resolved = this.resolvePath(affectedPath);
            if (!cp.files.some((f) => f.path === resolved)) {
              try {
                const r = await window.api.agentReadFile(resolved);
                cp.files.push({
                  path: resolved,
                  content: r?.content ?? r ?? "",
                  existed: true,
                });
              } catch {
                cp.files.push({ path: resolved, content: "", existed: false });
              }
            }
          }
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    try {
      const result = await this.executeTool(tool, params);
      const summary =
        typeof result === "string"
          ? result.slice(0, 300)
          : JSON.stringify(result).slice(0, 300);
      this.addToolStep(msgEl, "done", tool, summary);
      this.messages.push({
        role: "user",
        content: `[Resultado de "${tool}"]\n${typeof result === "string" ? result : JSON.stringify(result, null, 2)}`,
      });
      return true;
    } catch (err) {
      this.addToolStep(msgEl, "error", tool, err.message);
      this.messages.push({
        role: "user",
        content: `[Error en "${tool}"]: ${err.message}`,
      });
      return false;
    }
  }

  describeAction(tool, params) {
    const map = {
      read_file: `Leer ${params.path}`,
      apply_diff: `Aplicar cambios en ${params.path}`,
      delete_directory: `Eliminar carpeta ${params.path}`,
      write_file: `Escribir ${params.path}`,
      create_file: `Crear ${params.path}`,
      create_directory: `Crear carpeta ${params.path}`,
      delete_file: `Eliminar ${params.path}`,
      move_file: `Mover ${params.source} → ${params.destination}`,
      list_files: `Listar ${params.directory || "."}`,
      get_project_structure: "Estructura del proyecto",
      search_in_files: `Buscar "${params.query}"`,
      run_command: `$ ${params.command}`,
      get_diagnostics: "Obtener errores del editor",
      get_open_file: "Archivo abierto en editor",
      open_file: `Abrir ${params.path}`,
      insert_at_cursor: "Insertar en cursor",
      replace_selection: "Reemplazar selección",
    };
    return map[tool] || `${tool}(${JSON.stringify(params).slice(0, 60)})`;
  }

  shouldConfirmToolCall(tool, params = {}) {
    if (tool === "run_command") {
      return this.confirmCommands || hasDangerousCommand(params.command || "");
    }
    if (tool === "move_file") {
      return (
        !this.isPathInWorkspace(params.source) ||
        !this.isPathInWorkspace(params.destination)
      );
    }
    return false;
  }

  buildToolConfirmationMessage(tool, params = {}) {
    if (tool === "delete_file") {
      return `El agente quiere ELIMINAR:\n${params.path}\n\n¿Confirmar?`;
    }
    if (tool === "run_command") {
      const cwd =
        params.cwd || this.state.currentFolder || "(sin carpeta abierta)";
      return `El agente quiere ejecutar este comando:\n${params.command || "(vacío)"}\n\nCarpeta:\n${cwd}\n\n¿Confirmar?`;
    }
    if (tool === "move_file") {
      return `El agente quiere mover:\n${params.source}\n→\n${params.destination}\n\n¿Confirmar?`;
    }
    return `El agente quiere ejecutar ${tool}.\n\n¿Confirmar?`;
  }

  isPathInWorkspace(filePath) {
    if (!filePath) return false;
    const workspace = this.state.currentFolder;
    if (!workspace) return false;
    if (!/^([a-zA-Z]:[/\\]|\/|\\\\)/.test(filePath)) return true;
    return isPathInside(workspace, filePath);
  }

  async executeTool(tool, params) {
    // Resolver rutas relativas a absolutas (sincróno, sin IPC)
    const resolve = (p) => {
      if (!p) return p;
      if (/^([a-zA-Z]:[/\\]|\/|\\\\)/.test(p)) return p; // ya absoluta
      const base = this.state.currentFolder;
      if (!base)
        throw new Error("No hay carpeta abierta. Abre una carpeta primero.");
      const sep = base.includes("\\") ? "\\" : "/";
      return base.replace(/[/\\]+$/, "") + sep + p.replace(/^[/\\]+/, "");
    };

    const allowedTools = ["read_file","write_file","create_file","delete_file","delete_directory","create_directory","move_file","list_files","get_project_structure","search_in_files","run_command","get_open_file","open_file","insert_at_cursor","replace_selection","get_diagnostics","write_memory","read_memory","apply_diff"];
    if (!allowedTools.includes(tool)) {
      return `ERROR: La herramienta "${tool}" no existe. Por favor, usa SOLO una de las herramientas permitidas: ${allowedTools.join(", ")}.`;
    }

    switch (tool) {
      case "read_file": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(
          fp,
          "No se puede leer fuera de la carpeta abierta.",
        );
        const r = await window.api.agentReadFile(fp);
        if (!r.success) throw new Error(r.error);
        return r.content;
      }

      case "write_file": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(
          fp,
          "No se puede escribir fuera de la carpeta abierta.",
        );
        const r = await window.api.agentWriteFile(fp, params.content ?? "");
        if (!r.success) throw new Error(r.error);
        this.syncEditorIfOpen(fp, params.content ?? "");
        if (!this.state.getTab(fp)) {
          this.state.openFile(fp, params.content ?? "");
        }
        this.state.emit("refreshTree");
        return `Archivo guardado: ${fp}`;
      }

      // Alias — create_file es igual que write_file
      case "create_file": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(
          fp,
          "No se puede crear archivos fuera de la carpeta abierta.",
        );
        const r = await window.api.agentCreateFile(fp, params.content ?? "");
        if (!r.success) throw new Error(r.error);
        this.syncEditorIfOpen(fp, params.content ?? "");
        this.state.openFile(fp, params.content ?? "");
        this.state.emit("refreshTree");
        return `Archivo creado: ${fp}`;
      }

      case "delete_file": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(
          fp,
          "No se puede eliminar fuera de la carpeta abierta.",
        );
        const r = await window.api.agentDeleteFile(fp);
        if (!r.success) throw new Error(r.error);
        this.closeTabIfOpen(fp);
        this.state.emit("refreshTree");
        return `Eliminado: ${params.path}`;
      }

      case "delete_directory": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(
          fp,
          "No se puede eliminar fuera de la carpeta abierta.",
        );
        const r = await window.api.agentDeleteDirectory(fp);
        if (!r.success) throw new Error(r.error);
        this.state.emit("refreshTree");
        return `Carpeta eliminada: ${fp}`;
      }

      case "create_directory": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(
          fp,
          "No se puede crear carpetas fuera de la carpeta abierta.",
        );
        const r = await window.api.agentCreateDir(fp);
        if (!r.success) throw new Error(r.error);
        this.state.emit("refreshTree");
        return `Carpeta creada: ${fp}`;
      }

      case "move_file": {
        const source = resolve(params.source);
        const destination = resolve(params.destination);
        this.ensureWorkspacePath(
          source,
          "No se puede mover archivos fuera de la carpeta abierta.",
        );
        this.ensureWorkspacePath(
          destination,
          "No se puede mover archivos fuera de la carpeta abierta.",
        );
        const r = await window.api.agentMoveFile(source, destination);
        if (!r.success) throw new Error(r.error);
        this.renameTabIfOpen(source, destination);
        this.state.emit("refreshTree");
        return `Movido: ${params.source} → ${params.destination}`;
      }

      case "list_files": {
        const fp = resolve(params.directory || ".");
        this.ensureWorkspacePath(
          fp,
          "No se puede listar fuera de la carpeta abierta.",
        );
        const r = await window.api.agentListFiles(fp);
        if (!r.success) throw new Error(r.error);
        return r.files
          .map((f) => (f.isDirectory ? "📁 " : "📄 ") + f.name)
          .join("\n");
      }

      case "get_project_structure": {
        const folder = this.state.currentFolder;
        if (!folder) throw new Error("No hay carpeta de proyecto abierta.");
        const r = await window.api.agentGetProjectStructure(folder, 4);
        if (!r.success) throw new Error(r.error);
        return this.formatFileTree(r.tree);
      }

      case "search_in_files": {
        const dir = params.directory
          ? resolve(params.directory)
          : this.state.currentFolder;
        if (!dir) throw new Error("No hay carpeta abierta.");
        this.ensureWorkspacePath(
          dir,
          "No se puede buscar fuera de la carpeta abierta.",
        );
        const r = await window.api.agentSearch(params.query, dir);
        if (!r.success) throw new Error(r.error);
        if (!r.results.length) return "Sin resultados.";
        return r.results
          .map(
            (x) =>
              `${x.path}:\n  ${x.matches.map((m) => `L${m.line}: ${m.text}`).join("\n  ")}`,
          )
          .join("\n\n");
      }

      case "run_command": {
        const cwd = params.cwd ? resolve(params.cwd) : this.state.currentFolder;
        if (!cwd) throw new Error("No hay carpeta abierta.");
        this.ensureWorkspacePath(
          cwd,
          "No se pueden ejecutar comandos fuera de la carpeta abierta.",
        );
        const r = await window.api.agentRunCommand(params.command, cwd);
        const out = [
          r.stdout && `stdout:\n${r.stdout}`,
          r.stderr && `stderr:\n${r.stderr}`,
          `exit: ${r.exitCode}`,
        ]
          .filter(Boolean)
          .join("\n");
        return out || "(sin salida)";
      }

      case "get_open_file":
        return {
          path: this.state.currentFile || null,
          content: this.state.editorInstance?.getValue() || "",
        };

      case "open_file": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(
          fp,
          "No se puede abrir fuera de la carpeta abierta.",
        );
        const r = await window.api.agentReadFile(fp);
        if (!r.success) throw new Error(r.error);
        this.state.openFile(fp, r.content);
        return `Abriendo: ${fp}`;
      }

      case "insert_at_cursor": {
        const ed = this.state.editorInstance;
        if (!ed) throw new Error("No hay editor activo");
        const pos = ed.getPosition();
        ed.executeEdits("nova-ai", [
          {
            range: {
              startLineNumber: pos.lineNumber,
              startColumn: pos.column,
              endLineNumber: pos.lineNumber,
              endColumn: pos.column,
            },
            text: params.text,
          },
        ]);
        ed.focus();
        return "Texto insertado en cursor.";
      }

      case "replace_selection": {
        const ed = this.state.editorInstance;
        if (!ed) throw new Error("No hay editor activo");
        ed.executeEdits("nova-ai", [
          { range: ed.getSelection(), text: params.newText },
        ]);
        ed.focus();
        return "Selección reemplazada.";
      }

      case "get_diagnostics": {
        const ed = this.state.editorInstance;
        if (!ed || !window.monaco)
          return "No hay editor o modelo activo para obtener diagnósticos.";
        const model = ed.getModel();
        if (!model) return "No hay archivo cargado en el editor.";
        const markers = window.monaco.editor.getModelMarkers({
          resource: model.uri,
        });
        if (!markers.length)
          return "No se detectaron errores ni advertencias en el archivo actual. ✓";
        return markers
          .map((m) => {
            const sev =
              m.severity === 8
                ? "ERROR"
                : m.severity === 4
                  ? "WARNING"
                  : "INFO";
            return `[${sev}] L${m.startLineNumber}:C${m.startColumn} - ${m.message}`;
          })
          .join("\n");
      }

      case "write_memory": {
        const r = await MemoryManager.write(params.key, params.value);
        if (!r.success) throw new Error(r.error);
        return `Memoria guardada: ${params.key}`;
      }

      case "read_memory": {
        const r = await MemoryManager.read(params.key);
        if (!r.success) throw new Error(r.error);
        return r.content;
      }

      case "apply_diff": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(fp, "No se puede editar fuera de la carpeta abierta.");
        const r = await window.api.agentApplyDiff(fp, params.diff);
        if (!r.success) throw new Error(r.error);
        this.syncEditorIfOpen(fp, r.content);
        this.highlightDiff(fp, params.diff); // Resaltar cambios en Monaco
        return `Cambios aplicados con éxito en: ${fp}`;
      }

      default:
        throw new Error(
          `Herramienta desconocida: "${tool}". Usa una de: read_file, apply_diff, write_file, create_file, create_directory, delete_file, move_file, list_files, get_project_structure, search_in_files, run_command, get_diagnostics, get_open_file, open_file, insert_at_cursor, replace_selection`,
        );
    }
  }

  syncEditorIfOpen(filePath, content) {
    const tab = this.state.getTab(filePath);
    if (tab) {
      tab.content = content;
      tab.saved = true;
      this.state.emit("tabsChanged", this.state.openTabs);
    }
    if (this.state.currentFile === filePath && this.state.editorInstance) {
      const model = this.state.editorInstance.getModel();
      if (model) model.setValue(content);
    }
  }

  closeTabIfOpen(filePath) {
    const tab = this.state.getTab(filePath);
    if (tab) {
      this.state.closeTab(filePath);
    }
  }

  renameTabIfOpen(oldPath, newPath) {
    const tab = this.state.getTab(oldPath);
    if (!tab) return;
    tab.path = newPath;
    if (this.state.currentFile === oldPath) {
      this.state.currentFile = newPath;
    }
    this.state.emit("tabsChanged", this.state.openTabs);
  }

  ensureWorkspacePath(targetPath, message) {
    if (!this.isPathInWorkspace(targetPath)) {
      const workspace = this.state.currentFolder || "ninguno";
      throw new Error(`${message}. Estas intentando acceder a: ${targetPath}. Tu espacio de trabajo permitido es: ${workspace}`);
    }
  }

  // ==========================================================================
  // UI DE MENSAJES
  // ==========================================================================

  appendMessage(role, text, streaming = false) {
    const welcome = this.container.querySelector(".ai-welcome");
    if (welcome) welcome.remove();

    const messages = this.container.querySelector("#ai-messages");
    const el = document.createElement("div");
    el.className = `ai-msg ai-msg--${role}`;

    if (role === "user") {
      el.innerHTML = `<div class="ai-msg-bubble"><div class="ai-msg-content">${escapeHtml(text)}</div></div>`;
    } else {
      el.innerHTML = `
        <div class="ai-msg-header">
          <div class="ai-msg-avatar">✦</div>
          <span class="ai-msg-role">Nova AI</span>
        </div>
        <div class="ai-msg-bubble">
          <div class="ai-msg-content ${streaming ? "streaming" : ""}">
            ${streaming ? '<span class="ai-cursor">▋</span>' : renderMarkdown(text)}
          </div>
        </div>
        <div class="ai-tool-steps"></div>
      `;
    }

    messages.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  updateStreamingMessage(el, text) {
    const c = el.querySelector(".ai-msg-content");
    if (!c) return;
    c.innerHTML =
      (text ? renderMarkdown(text) : "") + '<span class="ai-cursor">▋</span>';
    this.scrollToBottom();
  }

  finalizeMessage(el, text) {
    const c = el.querySelector(".ai-msg-content");
    if (!c) return;
    c.classList.remove("streaming");
    c.innerHTML = text ? renderMarkdown(text) : "";

    // Botones en bloques de código
    el.querySelectorAll(".ai-code-block").forEach((block) => {
      const code = block.querySelector("pre code")?.textContent || "";
      const actions = block.querySelector(".ai-code-actions");
      if (!actions) return;

      const btnCopy = document.createElement("button");
      btnCopy.className = "ai-code-btn";
      btnCopy.textContent = "Copiar";
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(code);
        btnCopy.textContent = "✓ Copiado";
        setTimeout(() => (btnCopy.textContent = "Copiar"), 2000);
      };

      const btnInsert = document.createElement("button");
      btnInsert.className = "ai-code-btn";
      btnInsert.textContent = "Insertar";
      btnInsert.onclick = () => {
        const ed = this.state.editorInstance;
        if (!ed) return;
        const pos = ed.getPosition();
        ed.executeEdits("nova-ai", [
          {
            range: ed.getSelection() || {
              startLineNumber: pos.lineNumber,
              startColumn: pos.column,
              endLineNumber: pos.lineNumber,
              endColumn: pos.column,
            },
            text: code,
          },
        ]);
        ed.focus();
      };

      const btnReplace = document.createElement("button");
      btnReplace.className = "ai-code-btn ai-code-btn--primary";
      btnReplace.textContent = "↩ Reemplazar";
      btnReplace.onclick = () => {
        const ed = this.state.editorInstance;
        if (!ed) return;
        ed.executeEdits("nova-ai", [{ range: ed.getSelection(), text: code }]);
        btnReplace.textContent = "✓";
        setTimeout(() => (btnReplace.textContent = "↩ Reemplazar"), 2000);
      };

      actions.append(btnCopy, btnInsert, btnReplace);
    });

    // "Ver más" si el mensaje es largo
    const bubble = el.querySelector(".ai-msg-bubble");
    if (bubble && c.scrollHeight > 500) {
      c.style.maxHeight = "500px";
      c.style.overflow = "hidden";
      const btn = document.createElement("button");
      btn.className = "ai-msg-expand-btn";
      btn.textContent = "▼ Ver más";
      btn.onclick = () => {
        const expanded = c.style.maxHeight !== "none";
        c.style.maxHeight = expanded ? "none" : "500px";
        c.style.overflow = expanded ? "visible" : "hidden";
        btn.textContent = expanded ? "▲ Ver menos" : "▼ Ver más";
        if (!expanded)
          bubble.scrollIntoView({ behavior: "smooth", block: "nearest" });
      };
      bubble.appendChild(btn);
    }

    this.scrollToBottom();
  }

  addToolStep(msgEl, status, tool, detail = "") {
    const stepsEl = msgEl.querySelector(".ai-tool-steps");
    if (!stepsEl) return;

    const icons = { running: "⚙️", done: "✅", error: "❌", cancelled: "🚫" };
    const labels = {
      running: "Ejecutando",
      done: "Completado",
      error: "Error",
      cancelled: "Cancelado",
    };

    const step = document.createElement("div");
    step.className = `ai-tool-step ai-tool-step--${status}`;

    // Texto del detalle con truncado
    const detailShort =
      detail.length > 120 ? detail.slice(0, 120) + "…" : detail;

    step.innerHTML = `
      <span class="ai-step-icon">${icons[status] || "•"}</span>
      <span class="ai-step-body">
        <span class="ai-step-label">${labels[status] || status}: <strong>${escapeHtml(tool)}</strong></span>
        ${detailShort ? `<span class="ai-step-detail">${escapeHtml(detailShort)}</span>` : ""}
      </span>
    `;

    stepsEl.appendChild(step);
    this.scrollToBottom();
  }

  /**
   * Agrega un botón de "Restaurar checkpoint" al chat después de que el agente
   * modifique archivos. Similar al sistema de checkpoints de Cursor.
   */
  addCheckpointRestoreButton(checkpointId) {
    const cp = checkpointManager.getById(checkpointId);
    if (!cp || cp.files.length === 0) return;

    const messages = this.container.querySelector("#ai-messages");
    const el = document.createElement("div");
    el.className = "ai-checkpoint-bar";
    el.dataset.checkpointId = checkpointId;

    const fileList = cp.files
      .map((f) => {
        const name = f.path.split(/[\\/]/).pop();
        return `<span class="ai-cp-file">${escapeHtml(name)}</span>`;
      })
      .join("");

    el.innerHTML = `
      <div class="ai-cp-info">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        <span class="ai-cp-label">Checkpoint guardado</span>
        <div class="ai-cp-files">${fileList}</div>
      </div>
      <button class="ai-cp-restore-btn" title="Revertir cambios del agente a este checkpoint">
        ↩ Restaurar
      </button>
    `;

    el.querySelector(".ai-cp-restore-btn").addEventListener("click", async () => {
      const btn = el.querySelector(".ai-cp-restore-btn");
      btn.disabled = true;
      btn.textContent = "Restaurando...";
      try {
        const { restored, deleted } = await checkpointManager.restoreCheckpoint(checkpointId);

        // Sincronizar editor para los archivos restaurados
        for (const fp of restored) {
          try {
            const r = await window.api.agentReadFile(fp);
            const content = r?.content ?? r ?? "";
            this.syncEditorIfOpen(fp, content);
          } catch {}
        }
        // Cerrar tabs de archivos que se eliminaron
        for (const fp of deleted) {
          this.closeTabIfOpen(fp);
        }
        this.state.emit("refreshTree");

        btn.textContent = "✓ Restaurado";
        btn.style.background = "var(--color-success, #238636)";
        el.classList.add("ai-cp-restored");

        const total = restored.length + deleted.length;
        this.appendSystemNote(`Checkpoint restaurado: ${total} archivo(s) revertidos.`);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "↩ Restaurar";
        this.appendSystemNote(`Error al restaurar: ${err.message}`);
      }
    });

    messages.appendChild(el);
    this.scrollToBottom();
  }

  appendSystemNote(msg) {
    const messages = this.container.querySelector("#ai-messages");
    const el = document.createElement("div");
    el.className = "ai-system-note";
    el.textContent = msg;
    messages.appendChild(el);
    this.scrollToBottom();
  }

  scrollToBottom() {
    const c = this.container.querySelector("#ai-messages");
    if (c) c.scrollTop = c.scrollHeight;
  }

  async summarizeOldContext() {
    this.appendSystemNote("Comprimiendo contexto...");
    const toSummarize = this.messages.slice(0, -10);
    const lastTen = this.messages.slice(-10);

    const summaryPrompt = [
      {
        role: "system",
        content: "Resume esta conversación de forma muy concisa, manteniendo solo los hechos clave y decisiones técnicas importantes.",
      },
      {
        role: "user",
        content: JSON.stringify(toSummarize),
      },
    ];

    let summary = "";
    try {
      if (this.provider === "ollama") {
        const res = await window.api.aiChat(summaryPrompt, this.activeModel);
        summary = res;
      } else {
        summary = "Resumen automático de la conversación previa para ahorrar tokens.";
      }

      this.messages = [{ role: "assistant", content: `RESUMEN PREVIO: ${summary}` }, ...lastTen];
    } catch (err) {
      console.warn("Error summarizing context:", err);
    }
  }

  appendSystemNote(text) {
    const messages = this.container.querySelector("#ai-messages");
    if (!messages) return;
    const el = document.createElement("div");
    el.className = "ai-system-note";
    el.innerHTML = `<span>${escapeHtml(text)}</span>`;
    messages.appendChild(el);
    this.scrollToBottom();
  }

  // ==========================================================================
  // HISTORIAL
  // ==========================================================================

  loadConversations() {
    try {
      return JSON.parse(localStorage.getItem("ide_chat_history") || "[]");
    } catch {
      return [];
    }
  }

  saveConversations() {
    localStorage.setItem(
      "ide_chat_history",
      JSON.stringify(this.conversations),
    );
  }

  saveConversation() {
    if (!this.messages.length) return;
    const firstUser = this.messages.find((m) => m.role === "user");
    const title = firstUser
      ? firstUser.content.slice(0, 60) +
        (firstUser.content.length > 60 ? "..." : "")
      : "Sin título";
    const conv = {
      id: this.activeConversation || generateId(),
      title,
      date: new Date().toISOString(),
      messages: [...this.messages],
      model: this.activeModel,
      provider: this.provider,
    };
    const idx = this.conversations.findIndex((c) => c.id === conv.id);
    if (idx >= 0) this.conversations[idx] = conv;
    else {
      this.conversations.unshift(conv);
      this.activeConversation = conv.id;
    }
    if (this.conversations.length > 50)
      this.conversations = this.conversations.slice(0, 50);
    this.saveConversations();
  }

  loadConversation(id) {
    const conv = this.conversations.find((c) => c.id === id);
    if (!conv) return;
    this.activeConversation = id;
    this.messages = [...conv.messages];
    this.activeModel = conv.model || this.activeModel;
    this.provider = conv.provider || "ollama";

    const messagesEl = this.container.querySelector("#ai-messages");
    messagesEl.innerHTML = "";
    this.messages.forEach((msg) => {
      if (msg.role === "user") this.appendMessage("user", msg.content);
      else if (msg.role === "assistant") {
        const el = this.appendMessage("assistant", "");
        this.finalizeMessage(el, this.stripToolCalls(msg.content));
      }
    });

    const provSel = this.container.querySelector("#ai-provider-select");
    const modSel = this.container.querySelector("#ai-model-select");
    if (provSel) provSel.value = this.provider;
    if (modSel) modSel.value = this.activeModel;
    this.updateBadge();
    this.switchTab("agent");
  }

  deleteConversation(id) {
    this.conversations = this.conversations.filter((c) => c.id !== id);
    this.saveConversations();
    if (this.activeConversation === id) this.newConversation();
    else
      this.container.querySelector("#ai-history-list").innerHTML =
        this.renderHistoryList();
  }

  newConversation() {
    this.messages = [];
    this.activeConversation = null;
    this.pendingContext = null;
    this.container.querySelector("#ai-messages").innerHTML =
      this.renderWelcome();
    this.updateContextDisplay();

    // Re-attach suggestion buttons
    this.container.querySelectorAll(".ai-suggestion-btn").forEach((btn) =>
      btn.addEventListener("click", () => {
        this.container.querySelector("#ai-input").value = btn.dataset.prompt;
        this.handleSend();
      }),
    );

    this.switchTab(this.activeTab === "history" ? "agent" : this.activeTab);
    this.saveSession();
  }

  async saveSession() {
    const session = {
      messages: this.messages,
      mode: this.mode,
      model: this.activeModel,
      provider: this.provider,
      date: new Date().toISOString(),
    };
    await window.api.agentWriteFile(".ide/session.json", JSON.stringify(session, null, 2));
  }

  async loadSession() {
    try {
      const r = await window.api.agentReadFile(".ide/session.json");
      if (r.success) {
        const session = JSON.parse(r.content);
        if (confirm("Se encontró una sesión guardada. ¿Deseas restaurarla?")) {
          this.messages = session.messages;
          this.mode = session.mode;
          this.activeModel = session.model;
          this.provider = session.provider;
          this.render(); // Re-render para actualizar UI
          this.attachEventListeners();
          this.switchTab("agent");
          this.appendSystemNote("Sesión restaurada.");
        }
      }
    } catch {}
  }

  // ==========================================================================
  // UI HELPERS
  // ==========================================================================

  updateUIState() {
    const sendBtn = this.container.querySelector("#ai-btn-send");
    const stopBtn = this.container.querySelector("#ai-btn-stop");
    const status = this.container.querySelector("#ai-status");

    if (this.isStreaming) {
      sendBtn.style.display = "none";
      stopBtn.style.display = "flex";
      status.innerHTML = `<span class="ai-status-dot"></span>${this.activeTab === "agent" ? "Agente trabajando..." : "Generando..."}`;
    } else {
      sendBtn.style.display = "flex";
      stopBtn.style.display = "none";
      status.innerHTML = "";
    }

    this.updateBadge();
  }

  updateBadge() {
    const badge = this.container.querySelector("#ai-model-badge");
    if (badge) badge.textContent = this.activeModel;
  }

  setupInlineCompletions() {
    if (!window.monaco) return;

    window.monaco.languages.registerInlineCompletionsProvider({
      provideInlineCompletions: async (model, position, context, token) => {
        // Solo en modos IA activos y si no es un archivo grande
        if (this.mode !== "planner" && this.activeTab !== "agent") return;
        if (token.isCancellationRequested) return;

        const textBefore = model.getValueInRange({
          startLineNumber: Math.max(1, position.lineNumber - 50),
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        if (textBefore.length < 5) return;

        try {
          // Usamos la API de chat para obtener una sugerencia corta
          const prompt = [
            {
              role: "system",
              content: "Eres un autocompletador de código. Provee el código para completar la línea actual. NO uses markdown, NO des explicaciones. Solo el CÓDIGO faltante.",
            },
            {
              role: "user",
              content: `Lenguaje: ${model.getLanguageId()}\nContexto:\n${textBefore}`,
            },
          ];

          // Nota: Sería ideal un modelo más rápido o local para esto
          const suggestion = await window.api.aiChat(prompt, this.activeModel);
          if (!suggestion || token.isCancellationRequested) return;

          return {
            items: [
              {
                insertText: suggestion.trim(),
                range: new window.monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column,
                ),
              },
            ],
          };
        } catch {
          return { items: [] };
        }
      },
      freeInlineCompletions: () => {},
    });
  }

  showStatus(msg, type = "info") {
    const status = this.container.querySelector("#ai-status");
    if (!status) return;
    status.textContent = msg;
    status.className = `ai-status ai-status--${type}`;
    setTimeout(() => {
      status.textContent = "";
      status.className = "ai-status";
    }, 3000);
  }

  highlightDiff(filePath, diffText) {
    const editor = this.state.editorInstance;
    if (!editor || this.state.currentFile !== filePath) return;

    const model = editor.getModel();
    if (!model) return;

    // Analizar el diff para encontrar líneas añadidas/eliminadas
    const lines = diffText.split("\n");
    const decorations = [];
    let currentLine = 0;

    // Nota: Esto es una simplificación. Un parseo real de diff sería mejor.
    // Buscamos líneas que empiecen con + o - (evitando las de metadatos)
    lines.forEach((line) => {
      if (line.startsWith("@@")) {
        const match = line.match(/\+(\d+)/);
        if (match) currentLine = parseInt(match[1]) - 1;
      } else if (line.startsWith("+") && !line.startsWith("+++")) {
        currentLine++;
        decorations.push({
          range: new window.monaco.Range(currentLine, 1, currentLine, 1),
          options: {
            isWholeLine: true,
            className: "ai-diff-line-added",
            linesDecorationsClassName: "ai-diff-gutter-added",
          },
        });
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        // Para eliminaciones, resaltamos la línea actual o la siguiente
        decorations.push({
          range: new window.monaco.Range(currentLine + 1, 1, currentLine + 1, 1),
          options: {
            isWholeLine: true,
            className: "ai-diff-line-removed",
            linesDecorationsClassName: "ai-diff-gutter-removed",
          },
        });
      } else if (!line.startsWith("\\")) {
        currentLine++;
      }
    });

    const oldDecorations = this.lastDecorations || [];
    this.lastDecorations = editor.deltaDecorations(oldDecorations, decorations);

    // Limpiar después de 5 segundos
    setTimeout(() => {
      this.lastDecorations = editor.deltaDecorations(this.lastDecorations, []);
    }, 5000);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createAIAgent(container, state) {
  return new AIAgent({ container, state }).mount();
}
