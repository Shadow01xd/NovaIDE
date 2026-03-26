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
    this.projectType = null; // Will be auto-detected
    this._streamIteration = 0;

    this.conversations = this.loadConversations();
  }

  // ==========================================================================
  // MOUNT / RENDER
  // ==========================================================================

  mount() {
    this.render();
    this.attachEventListeners();
    this.updateUIState(); // garantizar estado inicial correcto
    this.loadModelList();
    this.loadSession(); // Restaurar sesión si hay carpeta abierta
    this.detectProjectType();
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
          <div class="ai-mode-toggle" id="ai-mode-toggle">
            <button class="ai-mode-btn ${this.mode === "simple" ? "active" : ""}" data-mode="simple" title="Modo Simple — responde directo">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              Simple
            </button>
            <button class="ai-mode-btn ${this.mode === "planner" ? "active" : ""}" data-mode="planner" title="Modo Planificador — crea un plan y ejecuta fase por fase">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="8" y1="18" x2="14" y2="18"/></svg>
              Plan
            </button>
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
    const projectName = this.state.currentFolder
      ? this.state.currentFolder.split(/[\\/]/).pop()
      : null;

    return `
      <div class="ai-welcome">
        <div class="ai-welcome-logo">✦</div>
        <h2 class="ai-welcome-title">Nova AI</h2>
        <p class="ai-welcome-subtitle">
          ${projectName
            ? `Proyecto: <strong>${escapeHtml(projectName)}</strong>${this.projectType ? ` · ${escapeHtml(this.projectType)}` : ""}`
            : "Agente de programación con acceso completo al proyecto"}
        </p>
        <div class="ai-suggestions">
          <button class="ai-suggestion-btn" data-prompt="Analiza la estructura del proyecto y explica cómo está organizado">Analizar proyecto</button>
          <button class="ai-suggestion-btn" data-prompt="Revisa el archivo activo, encuentra bugs y corrígelos">Buscar y corregir bugs</button>
          <button class="ai-suggestion-btn" data-prompt="Refactoriza el código del archivo activo para que sea más limpio, eficiente y siga buenas prácticas">Refactorizar código</button>
          <button class="ai-suggestion-btn" data-prompt="Crea tests unitarios completos para el archivo activo">Generar tests</button>
          <button class="ai-suggestion-btn" data-prompt="Explica en detalle qué hace este archivo y cada función importante">Explicar código</button>
          <button class="ai-suggestion-btn" data-prompt="Optimiza el rendimiento del código del archivo activo">Optimizar rendimiento</button>
        </div>
        <div class="ai-shortcuts">
          <div class="ai-shortcut"><kbd>Ctrl+Enter</kbd> Enviar</div>
          <div class="ai-shortcut"><kbd>@</kbd> Adjuntar contexto</div>
          <div class="ai-shortcut"><kbd>Ctrl+L</kbd> Enviar selección</div>
          <div class="ai-shortcut"><kbd>Esc</kbd> Detener agente</div>
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

    // Mode toggle buttons
    this.container
      .querySelector("#ai-mode-toggle")
      ?.addEventListener("click", (e) => {
        const btn = e.target.closest(".ai-mode-btn");
        if (!btn) return;
        const newMode = btn.dataset.mode;
        if (newMode === this.mode) return;
        this.mode = newMode;
        localStorage.setItem("ide_agent_mode", this.mode);
        this.container.querySelectorAll(".ai-mode-btn").forEach((b) =>
          b.classList.toggle("active", b.dataset.mode === this.mode)
        );
        const labels = { simple: "⚡ Modo Simple", planner: "📋 Modo Planificador" };
        this.showStatus(labels[this.mode] || this.mode, "info");
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
      return `Eres Nova AI, un asistente de programación experto integrado en NVCode IDE.
Responde siempre en ESPAÑOL. Sé conciso, preciso y usa bloques de código con el lenguaje correcto.
Si el usuario pide código, dalo listo para usar, sin omitir partes importantes.`;
    }

    if (this.mode === "planner") {
      return this.buildPlannerPrompt();
    }

    const folder = this.state.currentFolder || "(ninguna)";
    const file = this.state.currentFile || "(ninguno)";
    const projectName = folder !== "(ninguna)" ? folder.split(/[\\/]/).pop() : null;

    // Detectar tipo de proyecto
    let projectHint = "";
    if (this.projectType) {
      projectHint = `\nTipo de proyecto detectado: ${this.projectType}`;
    }

    let prompt = `Eres Nova AI, el agente de ingeniería de software más avanzado del mundo, integrado en NVCode IDE.
Tienes acceso completo al sistema de archivos, terminal y editor del usuario.
Tu misión: completar tareas de programación con código limpio, correcto y de producción.

${projectName ? `Proyecto activo: **${projectName}**` : ""}${projectHint}
Carpeta: ${folder}
Archivo abierto: ${file}

════════════════════════════════════════
PROTOCOLO DE EDICIÓN — CRÍTICO
════════════════════════════════════════

**ANTES DE EDITAR — árbol de decisión:**

1. ¿Ya tienes el contenido del archivo en este contexto?
   → SÍ: procede directamente a editar (NO uses read_file innecesariamente)
   → NO: usa read_file PRIMERO, sin excepción

2. ¿Cuánto cambia el archivo?
   → Cambios puntuales (< 30% del archivo): usa apply_diff
   → Cambios grandes (> 30% del archivo o reescritura): usa write_file con el archivo COMPLETO
   → Archivo nuevo: usa create_file

3. apply_diff falló o dio error:
   → NO reintentas el mismo diff → usa write_file con el contenido completo correcto

**EXPLORACIÓN:**
- Usa list_files / get_project_structure solo si no sabes qué archivos existen
- NO leas un archivo que ya está en el contexto de esta conversación
- search_in_files para encontrar código específico en proyectos grandes

**VERIFICACIÓN:**
- Usa get_diagnostics solo si sospechas errores de tipo/sintaxis (TypeScript/JSX)
- No lo uses por defecto después de cada cambio

════════════════════════════════════════
REGLAS DE CÓDIGO
════════════════════════════════════════

1. **Nunca asumas** el contenido de un archivo — léelo si no lo tienes en contexto
2. **Código completo** — nunca dejes TODOs, "..." o partes incompletas
3. **NUNCA uses create-react-app** — usa Vite o crea archivos manualmente
4. **Si algo falla** — cambia de estrategia (ej: apply_diff falló → usa write_file)
5. **Máx. 12 pasos** por tarea — sé eficiente, no repitas acciones
6. **Responde en ESPAÑOL**, el código en inglés
7. **Un tool call a la vez** — ejecuta, lee el resultado, luego decide el siguiente paso

════════════════════════════════════════
HERRAMIENTAS
════════════════════════════════════════

📖 LECTURA:
  read_file            {"tool":"read_file","params":{"path":"src/App.jsx"}}
  read_multiple_files  {"tool":"read_multiple_files","params":{"paths":["a.js","b.js"]}}
  list_files           {"tool":"list_files","params":{"directory":"src"}}
  get_project_structure {"tool":"get_project_structure","params":{}}
  search_in_files      {"tool":"search_in_files","params":{"query":"useState","directory":"src"}}
  get_open_file        {"tool":"get_open_file","params":{}}
  get_diagnostics      {"tool":"get_diagnostics","params":{}}

✏️ ESCRITURA:
  write_file           {"tool":"write_file","params":{"path":"archivo.js","content":"CONTENIDO COMPLETO AQUÍ"}}
  create_file          {"tool":"create_file","params":{"path":"nuevo.js","content":"..."}}
  apply_diff           {"tool":"apply_diff","params":{"path":"src/App.jsx","diff":"..."}}
  append_to_file       {"tool":"append_to_file","params":{"path":"log.txt","content":"nueva línea"}}
  delete_file          {"tool":"delete_file","params":{"path":"viejo.js"}}
  move_file            {"tool":"move_file","params":{"source":"old.js","destination":"new.js"}}
  create_directory     {"tool":"create_directory","params":{"path":"src/components"}}
  delete_directory     {"tool":"delete_directory","params":{"path":"carpeta"}}

🔧 ACCIONES:
  run_command          {"tool":"run_command","params":{"command":"npm install","cwd":"."}}
  open_file            {"tool":"open_file","params":{"path":"index.html"}}
  insert_at_cursor     {"tool":"insert_at_cursor","params":{"text":"código"}}
  replace_selection    {"tool":"replace_selection","params":{"text":"nuevo código"}}

════════════════════════════════════════
GUÍA apply_diff — SOLO para cambios pequeños/medianos
════════════════════════════════════════

Formato unified diff EXACTO:
\`\`\`
--- a/ruta/archivo.js
+++ b/ruta/archivo.js
@@ -LINEA,CONTEXTO +LINEA,NUEVA @@
 línea contexto (espacio al inicio)
-línea eliminada
+línea nueva
 línea contexto
\`\`\`

REGLAS CRÍTICAS:
- Los números de @@ deben ser EXACTOS — cuenta desde el read_file
- Incluye 2-3 líneas de contexto único antes y después del cambio
- Si el bloque a cambiar tiene líneas repetidas, usa más contexto para ser único
- Si el diff falla → NO reintentas → usa write_file con el archivo completo
- Para cambios en múltiples zonas distantes → múltiples bloques @@ en el mismo diff`;

    // Contexto del editor activo
    const editor = this.state.editorInstance;
    if (editor && file && file !== "(ninguno)") {
      const content = editor.getValue();
      const lang = file.split(".").pop() || "text";
      const sel = editor.getModel()?.getValueInRange(editor.getSelection()) || "";
      const lineCount = content.split('\n').length;

      prompt += `\n\n════════════════════════════════════════\nARCHIVO ACTIVO EN EL EDITOR\n════════════════════════════════════════`;
      prompt += `\nPath: ${file}`;
      prompt += `\nLenguaje: ${lang} | Líneas: ${lineCount}`;

      if (sel.trim()) {
        prompt += `\n\nSELECCIÓN DEL USUARIO (las líneas que el usuario ha marcado):\n\`\`\`${lang}\n${sel.slice(0, 3000)}\n\`\`\``;
      }

      if (content.length < 8000) {
        prompt += `\n\n⚠️ CONTENIDO COMPLETO YA DISPONIBLE — NO uses read_file para este archivo, ya lo tienes aquí:\n\`\`\`${lang}\n${content}\n\`\`\``;
      } else {
        prompt += `\n\n⚠️ Archivo grande (${lineCount} líneas, ${Math.round(content.length/1024)}KB) — usa read_file si necesitas el contenido completo para editar.`;
      }
    }

    return prompt;
  }

  buildPlannerPrompt() {
    const folder = this.state.currentFolder || "(ninguna)";
    const file = this.state.currentFile || "(ninguno)";
    const projectName = folder !== "(ninguna)" ? folder.split(/[\\/]/).pop() : null;
    const projectHint = this.projectType ? `\nTipo de proyecto: ${this.projectType}` : "";

    const editor = this.state.editorInstance;
    let editorCtx = "";
    if (editor && file && file !== "(ninguno)") {
      const content = editor.getValue();
      const lang = file.split(".").pop() || "text";
      const lineCount = content.split("\n").length;
      editorCtx = `\n\n════════════════════════════════════════\nARCHIVO ACTIVO: ${file} (${lang}, ${lineCount} líneas)\n════════════════════════════════════════`;
      if (content.length < 5000) editorCtx += `\n\`\`\`${lang}\n${content}\n\`\`\``;
      else editorCtx += `\n(archivo grande — usa read_file para verlo)`;
    }

    return `Eres Nova Planner, el agente de planificación inteligente de NVCode IDE.
Tu especialidad: descomponer tareas complejas en planes ejecutables y llevarlos a cabo con precisión quirúrgica.
${projectName ? `Proyecto: **${projectName}**` : ""}${projectHint}
Carpeta: ${folder} | Archivo activo: ${file}

════════════════════════════════════════
FLUJO OBLIGATORIO DE TRABAJO
════════════════════════════════════════

**RESPUESTA #1 — SIEMPRE empieza así:**
1. Explora el proyecto brevemente (get_project_structure o list_files)
2. Presenta el plan completo con este formato exacto:

---
## 📋 Plan: [título descriptivo de la tarea]

| # | Fase | Archivos | Estado |
|---|------|----------|--------|
| 1 | [descripción] | [archivos afectados] | ⏳ Pendiente |
| 2 | [descripción] | [archivos afectados] | ⏳ Pendiente |
| N | [descripción] | [archivos afectados] | ⏳ Pendiente |

**Comenzando con Fase 1...**
---

**RESPUESTAS SIGUIENTES — para cada fase:**
1. Muestra el plan actualizado con el estado actual al inicio
2. Ejecuta SOLO la fase actual (no saltes fases)
3. Verifica con get_diagnostics si hay errores después de cambios de código
4. Marca la fase como completada ✅ antes de pasar a la siguiente

**ESTADOS del plan:**
- ⏳ Pendiente — no iniciada
- 🔄 En progreso — ejecutando ahora
- ✅ Completada — finalizada y verificada
- ❌ Bloqueada — error, necesita atención

════════════════════════════════════════
REGLAS CRÍTICAS
════════════════════════════════════════

1. **EXPLORA ANTES DE ACTUAR** — nunca asumas qué existe. Usa list_files o get_project_structure primero
2. **LEE ANTES DE EDITAR** — usa read_file antes de apply_diff para obtener líneas exactas
3. **apply_diff para ediciones** — NUNCA uses write_file en archivos existentes
4. **Una fase a la vez** — completa y verifica cada fase antes de la siguiente
5. **Si algo falla** — analiza el error, ajusta el plan, comunica el problema claramente
6. **NUNCA dejes código roto** — si una fase falla, reviértela o corrígela antes de continuar
7. **Responde en ESPAÑOL** siempre — el código va en inglés

════════════════════════════════════════
HERRAMIENTAS DISPONIBLES
════════════════════════════════════════

📖 LECTURA:
  read_file            {"tool":"read_file","params":{"path":"ruta"}}
  read_multiple_files  {"tool":"read_multiple_files","params":{"paths":["a.js","b.js"]}}
  list_files           {"tool":"list_files","params":{"directory":"src"}}
  get_project_structure {"tool":"get_project_structure","params":{}}
  search_in_files      {"tool":"search_in_files","params":{"query":"texto"}}
  get_diagnostics      {"tool":"get_diagnostics","params":{}}

✏️ ESCRITURA:
  apply_diff           {"tool":"apply_diff","params":{"path":"archivo","diff":"..."}}
  write_file           {"tool":"write_file","params":{"path":"nuevo.js","content":"..."}}
  create_file          {"tool":"create_file","params":{"path":"archivo","content":"..."}}
  append_to_file       {"tool":"append_to_file","params":{"path":"archivo","content":"..."}}
  delete_file          {"tool":"delete_file","params":{"path":"viejo.js"}}
  move_file            {"tool":"move_file","params":{"source":"a","destination":"b"}}
  create_directory     {"tool":"create_directory","params":{"path":"carpeta"}}

🔧 ACCIONES:
  run_command          {"tool":"run_command","params":{"command":"npm install"}}
  open_file            {"tool":"open_file","params":{"path":"archivo"}}
  write_memory         {"tool":"write_memory","params":{"key":"k","value":"v"}}
  read_memory          {"tool":"read_memory","params":{"key":"k"}}${editorCtx}`;
  }

  async detectProjectType() {
    if (!this.state.currentFolder || this.projectType) return;
    try {
      const r = await window.api.agentReadFile(
        this.state.currentFolder + "/package.json"
      );
      if (r.success) {
        const pkg = JSON.parse(r.content);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.react) this.projectType = "React";
        else if (deps.vue) this.projectType = "Vue";
        else if (deps.svelte) this.projectType = "Svelte";
        else if (deps.next) this.projectType = "Next.js";
        else if (deps.nuxt) this.projectType = "Nuxt";
        else if (deps.express || deps.fastify || deps.koa) this.projectType = "Node.js Backend";
        else this.projectType = "Node.js";
      }
    } catch {
      // Not a Node project or no package.json
      try {
        const r = await window.api.agentListFiles(this.state.currentFolder);
        if (r.success) {
          const names = r.files.map(f => f.name);
          if (names.includes("requirements.txt") || names.includes("setup.py")) this.projectType = "Python";
          else if (names.includes("Cargo.toml")) this.projectType = "Rust";
          else if (names.includes("go.mod")) this.projectType = "Go";
          else if (names.includes("pom.xml") || names.includes("build.gradle")) this.projectType = "Java";
        }
      } catch {}
    }
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

  buildConversationWindow(limit = 30) {
    // Keep all messages but truncate very long ones
    const msgs = this.messages.slice(-limit);
    return msgs.map((msg) => {
      let content = typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);

      // Truncate extremely long tool results (file contents)
      if (msg.role === "user" && content.startsWith("[Resultado de") && content.length > 15000) {
        content = content.slice(0, 15000) + "\n...[truncado por longitud]";
      }

      // Truncate very long assistant messages (e.g., large file writes)
      if (msg.role === "assistant" && content.length > 20000) {
        content = content.slice(-20000);
      }

      return { ...msg, content };
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

    this._streamIteration = iteration;
    this.updateUIState();

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
      const visibleText = this.stripThoughts(this.stripToolCalls(fullResponse));
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

        // Separar herramientas que ya fueron ejecutadas por detectEarlyToolCalls
        // de las que aún no se han ejecutado — evita doble ejecución y doble confirmación
        const earlyPromises = [];
        const pendingCalls = [];
        for (const tc of toolCalls) {
          const key = JSON.stringify(tc);
          if (this._earlyCallPromises?.has(key)) {
            earlyPromises.push(this._earlyCallPromises.get(key));
          } else {
            pendingCalls.push(tc);
          }
        }
        // Esperar a que terminen las early (puede que sigan corriendo)
        if (earlyPromises.length) await Promise.allSettled(earlyPromises);
        // Ejecutar las que no se procesaron early
        if (pendingCalls.length) await this.runToolCallsInParallel(pendingCalls, msgEl, signal);
        // Limpiar para la siguiente iteración
        this._earlyCallPromises = new Map();

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
    const calls = this.parseToolCalls(text);
    if (!this.processedEarlyCalls) this.processedEarlyCalls = new Set();
    if (!this._earlyCallPromises) this._earlyCallPromises = new Map();

    // Tools que necesitan confirmación del usuario NO se ejecutan durante
    // el streaming — se dejan para post-stream donde la UI está en reposo
    // y el usuario puede ver e interactuar con la tarjeta de confirmación.
    const NEEDS_CONFIRM = new Set([
      "delete_file", "delete_directory", "run_command", "move_file",
    ]);

    for (const tc of calls) {
      if (NEEDS_CONFIRM.has(tc.tool)) continue; // dejar para post-stream
      const key = JSON.stringify(tc);
      if (!this.processedEarlyCalls.has(key)) {
        this.processedEarlyCalls.add(key);
        const promise = this.runToolCall(tc, msgEl);
        this._earlyCallPromises.set(key, promise);
      }
    }
  }

  // Durante streaming: oculta JSON parcial/completo que está construyendo
  getStreamingDisplay(text) {
    if (!text) return "";
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{")) return ""; // Pure tool call — no mostrar nada
    // Hide thought blocks while streaming
    const noThoughts = text
      .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
      .replace(/<thought>[\s\S]*/i, "");
    // Cut at the first inline tool call
    const jsonStart = noThoughts.search(/\n?\s*\{"tool"/);
    // Also cut at the start of a ```json fenced block that's a tool call
    const fenceStart = noThoughts.search(/\n?\s*```(?:json)?\s*\n\s*\{/);
    const cutAt = Math.min(
      jsonStart  >= 0 ? jsonStart  : Infinity,
      fenceStart >= 0 ? fenceStart : Infinity,
    );
    const visible = cutAt < Infinity ? noThoughts.slice(0, cutAt) : noThoughts;
    return this.stripToolCalls(visible).trim();
  }

  // Elimina todos los tool-call JSON del texto final (bloques ```json y JSON inline)
  stripToolCalls(text) {
    if (!text) return "";

    // 1. Strip fenced code blocks (```json ... ``` or ``` ... ```) that contain tool calls
    let cleaned = text.replace(/```(?:json)?\s*\n([\s\S]*?)\n?```/g, (match, inner) => {
      const trimmed = inner.trim();
      if (!trimmed.startsWith("{")) return match;
      try {
        const obj = JSON.parse(trimmed);
        if (obj && typeof obj.tool === "string") return "";
      } catch {}
      return match;
    });

    // 2. Strip inline JSON tool calls {\"tool\":...}
    let result = "", i = 0;
    while (i < cleaned.length) {
      if (cleaned[i] !== "{") { result += cleaned[i++]; continue; }
      let depth = 0, j = i, inStr = false, esc = false;
      while (j < cleaned.length) {
        const ch = cleaned[j];
        if (esc) { esc = false; j++; continue; }
        if (ch === "\\" && inStr) { esc = true; j++; continue; }
        if (ch === '"') { inStr = !inStr; j++; continue; }
        if (!inStr) {
          if (ch === "{") depth++;
          else if (ch === "}") { depth--; if (depth === 0) { j++; break; } }
        }
        j++;
      }
      if (depth === 0 && j > i) {
        try {
          const obj = JSON.parse(cleaned.slice(i, j));
          if (obj && typeof obj.tool === "string") { i = j; continue; }
        } catch {}
      }
      result += cleaned[i++];
    }
    return result.replace(/\n{3,}/g, "\n\n").trim();
  }

  stripThoughts(text) {
    if (!text) return "";
    // Strip <thought>...</thought> blocks (internal agent reasoning)
    return text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").replace(/\n{3,}/g, "\n\n").trim();
  }

  // ==========================================================================
  // EJECUCIÓN DE HERRAMIENTAS
  // ==========================================================================

  async runToolCallsInParallel(toolCalls, msgEl, signal) {
    const readOnlyTools = new Set([
      "read_file", "read_multiple_files", "list_files",
      "get_project_structure", "search_in_files",
      "get_diagnostics", "get_open_file",
    ]);

    // Tools que necesitan confirmación del usuario → siempre en serie
    // (no se pueden mostrar dos tarjetas al mismo tiempo)
    const confirmTools = new Set([
      "delete_file", "delete_directory", "run_command", "move_file",
    ]);

    const serial = [];   // se ejecutan una por una en orden
    const parallel = []; // se pueden lanzar todas a la vez

    for (const tc of toolCalls) {
      if (confirmTools.has(tc.tool)) serial.push(tc);
      else parallel.push(tc);
    }

    // Lanzar las paralelas (lecturas + escrituras sin confirmación)
    const parallelResults = parallel.map((tc) => {
      if (signal?.aborted) return Promise.resolve();
      if (!readOnlyTools.has(tc.tool) && tc.params?.path) {
        const fp = this.resolvePath(tc.params.path);
        const lock = this.fileLocks.get(fp) || Promise.resolve();
        const next = lock.then(() => this.runToolCall(tc, msgEl));
        this.fileLocks.set(fp, next);
        return next;
      }
      return this.runToolCall(tc, msgEl);
    });

    // Esperar las paralelas
    await Promise.all(parallelResults);

    // Ejecutar las que necesitan confirmación de una en una
    for (const tc of serial) {
      if (signal?.aborted) break;
      await this.runToolCall(tc, msgEl);
    }
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

    // Confirmación in-chat (un solo punto — sin dobles)
    const needsConfirm =
      (tool === "delete_file" && this.confirmDelete) ||
      (tool === "delete_directory" && this.confirmDelete) ||
      this.shouldConfirmToolCall(tool, params);

    if (needsConfirm) {
      const msg = this.buildToolConfirmationMessage(tool, params);
      const ok = await this.requestConfirmation(tool, params, msg);
      if (!ok) {
        this.addToolStep(msgEl, "cancelled", tool, "Cancelado por el usuario");
        this.messages.push({
          role: "user",
          content: `[Herramienta ${tool} cancelada por el usuario]`,
        });
        return false;
      }
    }

    const stepEl = this.addToolStep(msgEl, "running", tool, this.describeAction(tool, params));

    // ── Checkpoint: capturar estado ANTES de modificar ───────────────────────
    const FILE_MUTATING_TOOLS = new Set([
      "write_file", "create_file", "delete_file",
      "apply_diff", "move_file", "delete_directory",
    ]);
    if (FILE_MUTATING_TOOLS.has(tool)) {
      const isDir = tool === "delete_directory";
      const affectedPath = params.path || params.source || null;
      const destPath = params.destination ? this.resolvePath(params.destination) : null;

      if (affectedPath) {
        const resolved = this.resolvePath(affectedPath);
        if (isDir) checkpointManager.stageDirectory(resolved);
        else checkpointManager.stageFile(resolved);
        if (destPath) checkpointManager.stageFile(destPath);

        if (!this._currentCheckpointId) {
          this._currentCheckpointId = await checkpointManager.createCheckpoint(
            `Antes de: ${this.describeAction(tool, params)}`
          );
        } else {
          await checkpointManager.addToCheckpoint(
            this._currentCheckpointId, resolved, isDir ? 'directory' : 'file'
          );
          if (destPath) {
            await checkpointManager.addToCheckpoint(this._currentCheckpointId, destPath, 'file');
          }
        }
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // ── Preview en vivo para run_command ─────────────────────────────────────
    if (tool === "run_command" && window.api.agentRunCommandLive) {
      const cwd = params.cwd
        ? this.resolvePath(params.cwd)
        : this.state.currentFolder;
      if (!cwd) {
        this.addToolStep(msgEl, "error", tool, "No hay carpeta abierta.");
        this.messages.push({ role: "user", content: `[Error en "run_command"]: No hay carpeta abierta.` });
        return false;
      }

      // Área de output en tiempo real
      const preview = document.createElement("pre");
      preview.className = "ai-cmd-preview";
      stepEl?.appendChild(preview);
      this.scrollToBottom();

      const reqId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      // Escuchar detección de puerto para mostrar preview del servidor
      let previewShown = false;
      const unlistenPort = window.api.onServerPort?.((data) => {
        if (data.reqId !== reqId || previewShown) return;
        previewShown = true;
        this._showServerPreview(stepEl, data.port, reqId);
      });

      const unlisten = window.api.onCmdOutput(({ reqId: id, data }) => {
        if (id !== reqId) return;
        preview.textContent += data;
        preview.scrollTop = preview.scrollHeight;
        this.scrollToBottom();
      });

      try {
        const r = await window.api.agentRunCommandLive(params.command, cwd, reqId);
        unlisten();
        unlistenPort?.();
        if (r.port && !previewShown) {
          previewShown = true;
          this._showServerPreview(stepEl, r.port, reqId);
        }
        const out = r.isServer
          ? `Servidor ejecutándose en http://localhost:${r.port || "?"}`
          : [r.stdout && `stdout:\n${r.stdout}`, r.stderr && `stderr:\n${r.stderr}`, `exit: ${r.exitCode}`].filter(Boolean).join("\n");
        this.updateToolStep(stepEl, "done", tool, params);
        this.messages.push({ role: "user", content: `[Resultado de "run_command"]\n${out}` });
        return true;
      } catch (err) {
        unlisten();
        unlistenPort?.();
        this.updateToolStep(stepEl, "error", tool, params);
        this.messages.push({ role: "user", content: `[Error en "run_command"]: ${err.message}` });
        return false;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── Capturar contenido previo para diff (write/create/apply_diff) ────────
    const DIFF_TOOLS = new Set(["write_file", "create_file", "apply_diff", "append_to_file"]);
    let oldContent = null;
    if (DIFF_TOOLS.has(tool) && params.path) {
      try {
        const r = await window.api.agentReadFile(this.resolvePath(params.path));
        oldContent = r?.success ? (r.content ?? "") : null;
      } catch {}
    }
    // ─────────────────────────────────────────────────────────────────────────

    try {
      const result = await this.executeTool(tool, params);
      // Update the running step in place → no second row added
      this.updateToolStep(stepEl, "done", tool, params);
      this.messages.push({
        role: "user",
        content: `[Resultado de "${tool}"]\n${typeof result === "string" ? result : JSON.stringify(result, null, 2)}`,
      });

      // ── Diff en chat (verde/rojo) + diff en editor (Monaco) ─────────────
      if (DIFF_TOOLS.has(tool) && params.path) {
        const fp = this.resolvePath(params.path);
        let newContent;
        if (tool === "apply_diff") {
          if (stepEl) this.renderParsedDiff(stepEl, params.diff || "", params.path);
          try {
            const r = await window.api.agentReadFile(fp);
            newContent = r?.success ? (r.content ?? "") : "";
          } catch { newContent = ""; }
        } else {
          newContent = tool === "append_to_file"
            ? (oldContent ?? "") + "\n" + (params.content ?? "")
            : (params.content ?? "");
          if (stepEl) this.renderFileDiff(stepEl, oldContent ?? "", newContent, params.path);
        }
        this.showEditorDiff(fp, oldContent ?? "", newContent);
      }
      // ─────────────────────────────────────────────────────────────────────

      return true;
    } catch (err) {
      this.updateToolStep(stepEl, "error", tool, params);
      this.messages.push({
        role: "user",
        content: `[Error en "${tool}"]: ${err.message}`,
      });
      return false;
    }
  }

  /** Genera un diff visual simple entre oldContent y newContent */
  renderFileDiff(stepEl, oldContent, newContent, filePath) {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    const filename = (filePath || "").split(/[/\\]/).pop();
    const MAX = 18;

    // Calcular líneas añadidas/eliminadas (comparación posicional simple)
    const rows = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    let added = 0, removed = 0;

    for (let i = 0; i < maxLen; i++) {
      const o = oldLines[i], n = newLines[i];
      if (o === undefined) {
        rows.push({ type: "add", text: n }); added++;
      } else if (n === undefined) {
        rows.push({ type: "del", text: o }); removed++;
      } else if (o !== n) {
        rows.push({ type: "del", text: o }); removed++;
        rows.push({ type: "add", text: n }); added++;
      }
    }

    if (!rows.length) return; // sin cambios

    const shown = rows.slice(0, MAX);
    const extra = rows.length - shown.length;

    const html = shown.map(r =>
      `<div class="ai-diff-line ai-diff-line--${r.type}">${
        r.type === "add" ? "+" : "−"
      } ${escapeHtml(r.text)}</div>`
    ).join("") +
      (extra > 0 ? `<div class="ai-diff-more">… ${extra} líneas más</div>` : "") +
      `<div class="ai-diff-stats"><span class="ai-diff-stat-add">+${added}</span> <span class="ai-diff-stat-del">−${removed}</span></div>`;

    const el = document.createElement("div");
    el.className = "ai-file-diff";
    el.innerHTML = `<div class="ai-file-diff-name">📄 ${escapeHtml(filename)}</div>${html}`;
    stepEl.appendChild(el);
    this.scrollToBottom();
  }

  /** Renderiza un diff unificado (apply_diff) directamente */
  renderParsedDiff(stepEl, diffText, filePath) {
    if (!diffText) return;
    const filename = (filePath || "").split(/[/\\]/).pop();
    const MAX = 18;
    const lines = diffText.split("\n").filter(l =>
      (l.startsWith("+") && !l.startsWith("+++")) ||
      (l.startsWith("-") && !l.startsWith("---"))
    );
    if (!lines.length) return;

    const shown = lines.slice(0, MAX);
    const extra = lines.length - shown.length;
    let added = 0, removed = 0;

    const html = shown.map(l => {
      const isAdd = l.startsWith("+");
      if (isAdd) added++; else removed++;
      return `<div class="ai-diff-line ai-diff-line--${isAdd ? "add" : "del"}">${
        isAdd ? "+" : "−"
      } ${escapeHtml(l.slice(1))}</div>`;
    }).join("") +
      (extra > 0 ? `<div class="ai-diff-more">… ${extra} líneas más</div>` : "") +
      `<div class="ai-diff-stats"><span class="ai-diff-stat-add">+${added}</span> <span class="ai-diff-stat-del">−${removed}</span></div>`;

    const el = document.createElement("div");
    el.className = "ai-file-diff";
    el.innerHTML = `<div class="ai-file-diff-name">📄 ${escapeHtml(filename)}</div>${html}`;
    stepEl.appendChild(el);
    this.scrollToBottom();
  }

  describeAction(tool, params) {
    const file  = (params.path || params.source || "").split(/[/\\]/).pop();
    const dir   = (params.directory || ".").split(/[/\\]/).pop() || ".";
    const files = (params.paths || []).length;
    const map = {
      read_file:            `Leyendo ${file}`,
      read_multiple_files:  `Leyendo ${files} archivo${files !== 1 ? "s" : ""}`,
      write_file:           `Escribiendo ${file}`,
      create_file:          `Creando ${file}`,
      apply_diff:           `Editando ${file}`,
      append_to_file:       `Actualizando ${file}`,
      delete_file:          `Eliminando ${file}`,
      delete_directory:     `Eliminando carpeta ${file}`,
      move_file:            `Moviendo ${file}`,
      create_directory:     `Creando carpeta`,
      list_files:           `Explorando ${dir}`,
      get_project_structure:"Analizando proyecto",
      search_in_files:      `Buscando «${params.query || ""}»`,
      run_command:          `$ ${(params.command || "").slice(0, 40)}`,
      get_diagnostics:      "Verificando errores",
      get_open_file:        "Leyendo editor",
      open_file:            `Abriendo ${file}`,
      insert_at_cursor:     "Insertando código",
      replace_selection:    "Reemplazando selección",
    };
    return map[tool] || tool;
  }

  /** Actualiza un step existente al completarse (en lugar de añadir otro) */
  updateToolStep(stepEl, status, tool, params) {
    if (!stepEl) return;
    stepEl.className = `ai-tool-step ai-tool-step--${status}`;
    const indEl  = stepEl.querySelector(".ai-step-ind");
    const textEl = stepEl.querySelector(".ai-step-text");
    if (!indEl || !textEl) return;

    if (status === "done") {
      indEl.innerHTML = "";
      indEl.textContent = "✓";
      const file = (params?.path || params?.source || params?.directory || "").split(/[/\\]/).pop();
      textEl.textContent = file || tool;
    } else if (status === "error") {
      indEl.innerHTML = "";
      indEl.textContent = "✗";
      textEl.textContent = `Error — ${(params?.path || tool || "").split(/[/\\]/).pop()}`;
    } else if (status === "cancelled") {
      indEl.innerHTML = "";
      indEl.textContent = "–";
      textEl.textContent = "Cancelado";
    }
  }

  /**
   * Muestra una tarjeta de confirmación dentro del chat y devuelve true/false.
   * La tarjeta se inyecta en #ai-messages Y se clona como overlay flotante
   * para garantizar visibilidad independientemente del scroll.
   */
  requestConfirmation(tool, params, message) {
    return new Promise((resolve) => {
      const icons = {
        delete_file: "🗑️", delete_directory: "🗑️",
        run_command: "⚡", move_file: "↔️",
      };

      // Status bar
      const statusEl = this.container.querySelector("#ai-status");
      if (statusEl) {
        statusEl.innerHTML = `<span class="ai-status-dot ai-status-dot--warn"></span>⬇ Confirma la acción abajo`;
      }

      // 1) Tarjeta dentro del chat (para el historial visual)
      const messagesEl = this.container.querySelector("#ai-messages");
      if (messagesEl) {
        const ghost = document.createElement("div");
        ghost.className = "ai-confirm-card";
        ghost.innerHTML = `
          <div class="ai-confirm-header">
            <span class="ai-confirm-icon">${icons[tool] || "⚠️"}</span>
            <span class="ai-confirm-title">Acción requerida</span>
          </div>
          <div class="ai-confirm-message">${escapeHtml(message)}</div>
        `;
        messagesEl.appendChild(ghost);
        setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 0);
      }

      // 2) Overlay flotante garantizado — aparece sobre la barra de input
      const contentArea = this.container.querySelector(".ai-content-area");
      const host = contentArea || this.container;

      const el = document.createElement("div");
      el.className = "ai-confirm-overlay-card ai-confirm-card--active";
      el.innerHTML = `
        <div class="ai-confirm-header">
          <span class="ai-confirm-icon">${icons[tool] || "⚠️"}</span>
          <span class="ai-confirm-title">El agente necesita tu permiso</span>
        </div>
        <div class="ai-confirm-message">${escapeHtml(message)}</div>
        <div class="ai-confirm-actions">
          <button class="ai-confirm-btn ai-confirm-allow" type="button">✓ Permitir</button>
          <button class="ai-confirm-btn ai-confirm-deny"  type="button">✗ Cancelar</button>
        </div>
      `;
      host.appendChild(el);

      const done = (ok) => {
        // Eliminar overlay
        el.remove();
        // Marcar ghost como resuelto (si existe)
        const ghost = messagesEl?.lastElementChild;
        if (ghost?.classList.contains("ai-confirm-card")) {
          ghost.classList.add("ai-confirm-resolved");
          ghost.querySelector(".ai-confirm-message").insertAdjacentHTML(
            "afterend",
            ok
              ? `<div class="ai-confirm-actions"><span class="ai-confirm-result ai-confirm-result--ok">✓ Permitido</span></div>`
              : `<div class="ai-confirm-actions"><span class="ai-confirm-result ai-confirm-result--deny">✗ Cancelado</span></div>`
          );
        }
        if (statusEl) statusEl.innerHTML = `<span class="ai-status-dot"></span>Agente trabajando…`;
        resolve(ok);
      };

      el.querySelector(".ai-confirm-allow").addEventListener("click", () => done(true),  { once: true });
      el.querySelector(".ai-confirm-deny") .addEventListener("click", () => done(false), { once: true });
    });
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
      return `Eliminar permanentemente el archivo:\n${params.path}`;
    }
    if (tool === "delete_directory") {
      return `Eliminar la carpeta y TODO su contenido:\n${params.path}`;
    }
    if (tool === "run_command") {
      const cwd = params.cwd || this.state.currentFolder || "(sin carpeta abierta)";
      return `Ejecutar comando en terminal:\n$ ${params.command || "(vacío)"}\n\nCarpeta: ${cwd}`;
    }
    if (tool === "move_file") {
      return `Mover archivo:\n${params.source}\n→ ${params.destination}`;
    }
    return `Ejecutar acción: ${tool}`;
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

    const allowedTools = ["read_file","read_multiple_files","write_file","create_file","append_to_file","delete_file","delete_directory","create_directory","move_file","list_files","get_project_structure","search_in_files","run_command","get_open_file","open_file","insert_at_cursor","replace_selection","get_diagnostics","write_memory","read_memory","apply_diff"];
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

      case "read_multiple_files": {
        const paths = Array.isArray(params.paths) ? params.paths : [];
        const results = [];
        for (const p of paths.slice(0, 10)) { // max 10 files
          const fp = resolve(p);
          try {
            this.ensureWorkspacePath(fp, "");
            const r = await window.api.agentReadFile(fp);
            if (r.success) {
              const lines = r.content.split('\n').length;
              results.push(`\n📄 **${p}** (${lines} líneas):\n\`\`\`\n${r.content.slice(0, 8000)}\n\`\`\``);
            } else {
              results.push(`\n❌ **${p}**: ${r.error}`);
            }
          } catch (e) {
            results.push(`\n❌ **${p}**: ${e.message}`);
          }
        }
        return results.join("\n\n---") || "Sin resultados.";
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

      case "append_to_file": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(fp, "No se puede escribir fuera de la carpeta abierta.");
        // Read existing content first
        const existing = await window.api.agentReadFile(fp);
        const current = existing.success ? (existing.content || "") : "";
        const newContent = current + (current && !current.endsWith("\n") ? "\n" : "") + (params.content || "");
        const r = await window.api.agentWriteFile(fp, newContent);
        if (!r.success) throw new Error(r.error);
        this.syncEditorIfOpen(fp, newContent);
        this.state.emit("refreshTree");
        return `Contenido agregado a: ${fp}`;
      }

      case "apply_diff": {
        const fp = resolve(params.path);
        this.ensureWorkspacePath(fp, "No se puede editar fuera de la carpeta abierta.");
        const r = await window.api.agentApplyDiff(fp, params.diff);
        if (!r.success) {
          // Auto-fallback: provide detailed error + current file content for retry
          const current = await window.api.agentReadFile(fp);
          const fileInfo = current.success
            ? `\nContenido actual del archivo (${current.content.split('\n').length} líneas):\n\`\`\`\n${current.content.slice(0, 6000)}\n\`\`\``
            : "";
          throw new Error(`apply_diff falló: ${r.error}${fileInfo}\n\n→ Usa write_file con el contenido completo corregido, o corrige el diff.`);
        }
        this.syncEditorIfOpen(fp, r.content);
        this.highlightDiff(fp, params.diff);
        return `Cambios aplicados con éxito en: ${fp}`;
      }

      default:
        throw new Error(
          `Herramienta desconocida: "${tool}". Disponibles: read_file, read_multiple_files, apply_diff, write_file, create_file, append_to_file, create_directory, delete_file, move_file, list_files, get_project_structure, search_in_files, run_command, get_diagnostics, get_open_file, open_file, insert_at_cursor, replace_selection, write_memory, read_memory`,
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
    this.scrollToBottom(true); // force: new message always scrolls
    return el;
  }

  updateStreamingMessage(el, text) {
    const c = el.querySelector(".ai-msg-content");
    if (!c) return;
    c.innerHTML =
      (text ? renderMarkdown(text, true) : "") + '<span class="ai-cursor">▋</span>';
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

    const step = document.createElement("div");
    step.className = `ai-tool-step ai-tool-step--${status}`;

    if (status === "running") {
      step.innerHTML = `<span class="ai-step-ind"><span class="ai-step-spinner"></span></span><span class="ai-step-text">${escapeHtml(detail)}</span>`;
    } else if (status === "done") {
      const name = detail.split(/[/\\]/).pop() || detail;
      step.innerHTML = `<span class="ai-step-ind">✓</span><span class="ai-step-text">${escapeHtml(name)}</span>`;
    } else if (status === "error") {
      step.innerHTML = `<span class="ai-step-ind">✗</span><span class="ai-step-text">${escapeHtml(detail.slice(0, 80))}</span>`;
    } else {
      step.innerHTML = `<span class="ai-step-ind">–</span><span class="ai-step-text">Cancelado</span>`;
    }

    stepsEl.appendChild(step);
    this.scrollToBottom();
    return step;
  }

  /**
   * Agrega un botón de "Restaurar checkpoint" al chat después de que el agente
   * modifique archivos. Similar al sistema de checkpoints de Cursor.
   */
  addCheckpointRestoreButton(checkpointId) {
    const cp = checkpointManager.getById(checkpointId);
    if (!cp || !cp.entries?.length) return;

    const messages = this.container.querySelector("#ai-messages");
    const el = document.createElement("div");
    el.className = "ai-checkpoint-bar";
    el.dataset.checkpointId = checkpointId;

    // Construir lista de badges: directorios primero, luego archivos individuales
    const topLevel = cp.entries.map((e) => {
      const name = e.path.split(/[\\/]/).pop();
      const isDir = e.type === "directory";
      const icon = isDir ? "📁" : "📄";
      const filesCount = isDir && e.files ? ` (${e.files.length} archivos)` : "";
      return `<span class="ai-cp-file ${isDir ? "ai-cp-file--dir" : ""}">${icon} ${escapeHtml(name)}${filesCount}</span>`;
    }).join("");

    el.innerHTML = `
      <div class="ai-cp-info">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        <span class="ai-cp-label">Checkpoint</span>
        <div class="ai-cp-files">${topLevel}</div>
      </div>
      <button class="ai-cp-restore-btn" title="Revertir TODOS los cambios de esta sesión del agente">
        ↩ Restaurar
      </button>
    `;

    el.querySelector(".ai-cp-restore-btn").addEventListener("click", async () => {
      const btn = el.querySelector(".ai-cp-restore-btn");
      btn.disabled = true;
      btn.textContent = "Restaurando...";
      try {
        const { restored, deleted, errors } = await checkpointManager.restoreCheckpoint(checkpointId);

        // Sincronizar editor para archivos restaurados
        for (const fp of restored) {
          if (fp.includes("(directorio")) continue; // skip dir-only labels
          try {
            const r = await window.api.agentReadFile(fp);
            if (r?.success) this.syncEditorIfOpen(fp, r.content);
          } catch {}
        }
        // Cerrar tabs de archivos que fueron eliminados (revertidos a no-existentes)
        for (const fp of deleted) {
          this.closeTabIfOpen(fp);
        }
        this.state.emit("refreshTree");

        btn.textContent = "✓ Restaurado";
        el.classList.add("ai-cp-restored");

        const total = restored.length + deleted.length;
        const errTxt = errors.length ? ` (${errors.length} error(es))` : "";
        this.appendSystemNote(`✓ Checkpoint restaurado — ${total} elemento(s) revertido(s)${errTxt}`);
        if (errors.length) {
          errors.forEach(e => this.appendSystemNote(`  ⚠ ${e}`));
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "↩ Restaurar";
        this.appendSystemNote(`Error al restaurar checkpoint: ${err.message}`);
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

  scrollToBottom(force = false) {
    const c = this.container.querySelector("#ai-messages");
    if (!c) return;
    // Only auto-scroll if user is already within 140px of the bottom,
    // so they can scroll up to read without the view jumping back down.
    const nearBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 140;
    if (force || nearBottom) c.scrollTop = c.scrollHeight;
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
    this.processedEarlyCalls = null;
    this.lastToolCallsHash = null;
    this.repetitionCount = 0;
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
    if (!this.state.currentFolder) return; // sin carpeta no hay sesión
    const session = {
      messages: this.messages,
      mode: this.mode,
      model: this.activeModel,
      provider: this.provider,
      date: new Date().toISOString(),
    };
    const sessionPath = this.state.currentFolder + "/.ide/session.json";
    await window.api.agentWriteFile(sessionPath, JSON.stringify(session, null, 2));
  }

  async loadSession() {
    // Solo restaurar si hay carpeta abierta (la sesión tiene contexto de proyecto)
    if (!this.state.currentFolder) return;
    try {
      const sessionPath = this.state.currentFolder + "/.ide/session.json";
      const r = await window.api.agentReadFile(sessionPath);
      if (!r?.success) return;
      const session = JSON.parse(r.content);
      if (!session?.messages?.length) return;
      this.messages = session.messages;
      if (session.mode) this.mode = session.mode;
      if (session.model) this.activeModel = session.model;
      if (session.provider) this.provider = session.provider;
      this.render();
      this.attachEventListeners();
      this.updateUIState();
      this.switchTab("agent");
      this.appendSystemNote("Sesión anterior restaurada.");
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
      const iter = this._streamIteration || 0;
      const iterText = iter > 0 ? ` (paso ${iter}/15)` : "";
      status.innerHTML = `<span class="ai-status-dot"></span>${
        this.activeTab === "agent" ? `Agente trabajando${iterText}...` : "Generando..."
      }`;
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

  _showServerPreview(stepEl, port, reqId) {
    if (!stepEl || !port) return;
    const url = `http://localhost:${port}`;

    const wrap = document.createElement("div");
    wrap.className = "ai-server-preview";
    wrap.innerHTML = `
      <div class="ai-server-bar">
        <span class="ai-server-dot"></span>
        <span class="ai-server-url">${escapeHtml(url)}</span>
        <div class="ai-server-actions">
          <button class="ai-server-btn" data-a="reload" title="Recargar">↻</button>
          <button class="ai-server-btn" data-a="open" title="Abrir en navegador">⤢</button>
          <button class="ai-server-btn ai-server-btn--stop" data-a="stop" title="Detener">■</button>
        </div>
      </div>
      <iframe class="ai-server-frame" src="${escapeHtml(url)}" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"></iframe>
    `;

    const frame = wrap.querySelector(".ai-server-frame");
    wrap.querySelector('[data-a="reload"]').onclick = () => { frame.src = frame.src; };
    wrap.querySelector('[data-a="open"]').onclick   = () => { window.api.openExternal?.(url); };
    wrap.querySelector('[data-a="stop"]').onclick   = async () => {
      await window.api.killServer?.(reqId);
      wrap.remove();
    };

    stepEl.appendChild(wrap);
    this.scrollToBottom();
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

  // ==========================================================================
  // EDITOR DIFF (Cursor-style inline diff with Accept / Reject)
  // ==========================================================================

  /** Entry point: opens file, applies decorations, shows Accept/Reject bar */
  showEditorDiff(filePath, oldContent, newContent) {
    this.state.openFile(filePath, newContent);
    // 300ms: let Monaco finish setting the model and rendering before decorating
    setTimeout(() => this._applyEditorDiffDecorations(filePath, oldContent, newContent), 300);
  }

  /**
   * LCS-based line diff → [{type:'eq'|'add'|'del', text}]
   * Capped at MAX lines to stay fast.
   */
  _computeLineDiff(oldLines, newLines) {
    const MAX = 600;
    const ol = oldLines.slice(0, MAX);
    const nl = newLines.slice(0, MAX);
    const m = ol.length, n = nl.length;

    // Build DP table (backward)
    const dp = [];
    for (let i = 0; i <= m; i++) dp[i] = new Int32Array(n + 1);
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i][j] = ol[i] === nl[j]
          ? dp[i+1][j+1] + 1
          : Math.max(dp[i+1][j], dp[i][j+1]);
      }
    }

    const ops = [];
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (ol[i] === nl[j]) {
        ops.push({ type: "eq",  text: nl[j] }); i++; j++;
      } else if (dp[i+1][j] >= dp[i][j+1]) {
        ops.push({ type: "del", text: ol[i] }); i++;
      } else {
        ops.push({ type: "add", text: nl[j] }); j++;
      }
    }
    while (i < m) ops.push({ type: "del", text: ol[i++] });
    while (j < n) ops.push({ type: "add", text: nl[j++] });
    // Lines beyond MAX treated as additions
    for (let k = MAX; k < newLines.length; k++) ops.push({ type: "add", text: newLines[k] });
    return ops;
  }

  _applyEditorDiffDecorations(filePath, oldContent, newContent) {
    const editor = this.state.editorInstance;
    if (!editor) return;
    // Normalize slashes for cross-platform path comparison
    const norm = p => (p || "").replace(/\\/g, "/").toLowerCase();
    if (norm(this.state.currentFile) !== norm(filePath)) return;
    const model = editor.getModel();
    if (!model) return;

    const oldLines = oldContent === "" ? [] : oldContent.split("\n");
    const newLines = newContent === "" ? [] : newContent.split("\n");
    const ops = this._computeLineDiff(oldLines, newLines);

    const decorations = [];
    // Each entry: { afterLine (0=before line 1), texts[] }
    const delZones = [];

    let newLine = 0;      // 1-based current position in new content
    let pendingDels = [];

    const flushDels = () => {
      if (pendingDels.length) {
        delZones.push({ afterLine: newLine, texts: [...pendingDels] });
        pendingDels = [];
      }
    };

    for (const op of ops) {
      if (op.type === "del") {
        pendingDels.push(op.text);
      } else if (op.type === "eq") {
        flushDels();
        newLine++;
      } else { // add
        flushDels();
        newLine++;
        decorations.push({
          range: new window.monaco.Range(newLine, 1, newLine, 1),
          options: {
            isWholeLine: true,
            className: "editor-diff-line-add",
            glyphMarginClassName: "editor-diff-glyph-add",
          },
        });
      }
    }
    flushDels(); // trailing deletions

    // Apply line decorations
    if (this._editorDiffDecos) {
      this._editorDiffDecos = editor.deltaDecorations(this._editorDiffDecos, decorations);
    } else {
      this._editorDiffDecos = editor.deltaDecorations([], decorations);
    }

    // Apply view zones for deleted lines (red ghost lines)
    this._applyDiffZones(editor, delZones);

    // Count real adds/dels for the bar stats
    let added = 0, removed = 0;
    for (const op of ops) {
      if (op.type === "add") added++;
      else if (op.type === "del") removed++;
    }
    this._showDiffBar(filePath, oldContent, added, removed);
  }

  _applyDiffZones(editor, delZones) {
    // Remove old zones
    if (this._editorDiffZones && this._editorDiffZones.length) {
      editor.changeViewZones(acc => {
        this._editorDiffZones.forEach(id => acc.removeZone(id));
      });
    }
    this._editorDiffZones = [];
    if (!delZones.length) return;

    // Safe fallbacks — EditorOption enum keys may not survive minification
    let contentLeft = 60, lineHeight = 19, fontSize = 13;
    let fontFamily = "Menlo, Monaco, Consolas, 'Courier New', monospace";
    try { contentLeft = editor.getLayoutInfo().contentLeft || 60; } catch {}
    try {
      const EO = window.monaco?.editor?.EditorOption;
      if (EO) {
        const lh = editor.getOption(EO.lineHeight); if (lh > 0) lineHeight = lh;
        const fs = editor.getOption(EO.fontSize);   if (fs > 0) fontSize   = fs;
        const ff = editor.getOption(EO.fontFamily); if (ff)     fontFamily = ff;
      }
    } catch {}

    editor.changeViewZones(acc => {
      for (const { afterLine, texts } of delZones) {
        for (const text of texts) {
          // Content area node (the red line)
          const domNode = document.createElement("div");
          domNode.className = "editor-diff-del-zone";
          domNode.style.height        = lineHeight + "px";
          domNode.style.lineHeight    = lineHeight + "px";
          domNode.style.paddingLeft   = contentLeft + "px";
          domNode.style.fontSize      = fontSize + "px";
          domNode.style.fontFamily    = fontFamily;

          const inner = document.createElement("span");
          inner.className = "editor-diff-del-zone-text";
          inner.textContent = text;
          domNode.appendChild(inner);

          // Gutter node (shows the − glyph)
          const marginDom = document.createElement("div");
          marginDom.className = "editor-diff-del-glyph";
          marginDom.style.height     = lineHeight + "px";
          marginDom.style.lineHeight = lineHeight + "px";

          const zoneId = acc.addZone({
            afterLineNumber: afterLine,
            heightInLines: 1,
            domNode,
            marginDomNode: marginDom,
          });
          this._editorDiffZones.push(zoneId);
        }
      }
    });
  }

  _showDiffBar(filePath, oldContent, added, removed) {
    this._removeDiffBar();
    const wrap = document.getElementById("editor-wrap");
    if (!wrap) return;

    const filename = filePath.split(/[/\\]/).pop();
    const bar = document.createElement("div");
    bar.className = "editor-diff-bar";
    bar.innerHTML = `
      <div class="editor-diff-bar-info">
        <span class="editor-diff-bar-file">✦ ${escapeHtml(filename)}</span>
        <span class="editor-diff-stat-add">+${added}</span>
        <span class="editor-diff-stat-del">−${removed}</span>
      </div>
      <div class="editor-diff-bar-actions">
        <button class="editor-diff-btn editor-diff-btn--accept">✓ Aceptar</button>
        <button class="editor-diff-btn editor-diff-btn--reject">✕ Rechazar</button>
      </div>
    `;

    bar.querySelector(".editor-diff-btn--accept").onclick = () => this._clearEditorDiff();

    bar.querySelector(".editor-diff-btn--reject").onclick = async () => {
      try {
        await window.api.agentWriteFile(filePath, oldContent);
        this.syncEditorIfOpen(filePath, oldContent);
      } catch (e) {
        console.error("Error al rechazar diff:", e);
      }
      this._clearEditorDiff();
    };

    wrap.appendChild(bar);
    this._diffBar = bar;
    this._diffBarFile = filePath;
  }

  _removeDiffBar() {
    if (this._diffBar) {
      this._diffBar.remove();
      this._diffBar = null;
      this._diffBarFile = null;
    }
  }

  _clearEditorDiff() {
    const editor = this.state.editorInstance;
    if (editor) {
      if (this._editorDiffDecos) {
        this._editorDiffDecos = editor.deltaDecorations(this._editorDiffDecos, []);
      }
      if (this._editorDiffZones && this._editorDiffZones.length) {
        editor.changeViewZones(acc => {
          this._editorDiffZones.forEach(id => acc.removeZone(id));
        });
      }
    }
    this._editorDiffDecos = null;
    this._editorDiffZones = [];
    this._removeDiffBar();
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
