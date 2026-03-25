<div align="center">
  <img src="https://raw.githubusercontent.com/microsoft/vscode-icons/master/icons/dark/file_type_vscode.svg" width="80" height="80" alt="NVCode Logo">
  <h1>NVCode</h1>
  <p><strong>El IDE potenciado por IA</strong></p>
  <p><em>Ligero, Rápido y Totalmente Agentic</em></p>
</div>

---

## 🚀 Instalación Rápida

1. **Instalar dependencias**:
   ```bash
   npm install
   ```
2. **Preparar la IA (Ollama)**:
   ```bash
   ollama serve
   ollama pull deepseek-coder:base # o tu modelo preferido
   ```
3. **Iniciar**:
   ```bash
   npm run dev
   ```

---

## 🔥 Características Destacadas

### 🧠 NVCode Intelligence (Agente Pro)
El Agente de IA ahora es más metódico y autónomo que nunca:
- **Chain of Thought (CoT)**: Puedes ver el bloque de **Razonamiento** de la IA en tiempo real antes de cada acción.
- **Auto-Corrección (Diagnostics)**: La IA lee los errores del editor (`get_diagnostics`) y corrige sus propios fallos de sintaxis.
- **Streaming Robusto**: Buffering de tokens mejorado para evitar cortes en respuestas largas.
- **Protocolos Agentic**: Capacidad para crear estructuras de proyectos completas desde cero de forma fiable.

### ⏪ Sistema de Deshacer/Rehacer Profesional
No pierdas ni una línea de código:
- **Undo por Frase**: Agrupación inteligente basada en puntuación y tiempo.
- **Visual History Timeline**: Explora todos los estados pasados (`Ctrl+Alt+Z`).
- **Historial Persistente**: Se guardan hasta 5,000 estados por archivo en disco.
- **Branching**: Navega entre diferentes ramas de cambios sin perder el trabajo futuro.

### ⚡ Automatización & Formateo
- **Auto-Formateo con Tab**: Pulsa `Tab` y NVCode arreglará la indentación y estilo de la línea automáticamente.
- **Formateador Nativo**: Soporte completo para JS, HTML y CSS mediante `Shift + Alt + F`.
- **Integración Live Server**: Haz clic derecho en un archivo HTML o usa el botón de la barra de estado para previsualizar cambios al instante en el puerto 5500.

### 🖥️ Terminal Inteligente
- **Detección de URLs**: Si ejecutas `npm run dev`, NVCode detecta la URL y abre el navegador por ti.
- **Enlaces Clickeables**: Abre cualquier enlace de la terminal directamente en tu navegador instalado.
- **Layout Adaptativo**: Ajuste perfecto de resolución al redimensionar paneles.

### 🛒 Marketplace Restaurado
- Conexión completa con el ecosistema de extensiones. Búsqueda fiable, metadatos y carga de iconos corregida.

---

## ⌨️ Atajos de Teclado Esenciales

| Teclas | Acción |
| :--- | :--- |
| `Ctrl + L` | Enviar código al chat IA |
| `Ctrl + K` | Edición inline ultra-rápida |
| `Ctrl + Alt + Z` | Abrir Línea de Tiempo Visual |
| `Shift + Alt + F` | Formatear archivo completo |
| `Ctrl + \`` | Abrir/Cerrar Terminal |
| `Tab` | (Al escribir) Auto-formatear línea |
| `Ctrl + Shift + S` | Detener generación de IA |

---

## 🏗️ Arquitectura del Proyecto

```text
NVCode/
├── src/
│   ├── main/
│   │   ├── main.js        # Proceso Principal: IPC, Gestión de IA, Terminal, Servidores.
│   │   └── preload.js     # Puente seguro Node.js ↔ Renderer
│   └── renderer/
│       ├── state.js       # Estado global reactivo y autoguardado.
│       ├── components/
│       │   ├── ai-agent.js  # El corazón de la IA: ReAct Loop y herramientas.
│       │   ├── MonacoEditor.js # Editor core con inyección de diffs.
│       │   └── ThemeManager.js # Gestión dinámica de temas (Oscuro/Claro/Contraste).
│       └── utils/
│           ├── markdown.js  # Renderizado de IA con soporte para pensamientos (CoT).
│           └── HistoryManager.js # Motor de Undo/Redo por frases y persistencia.
```

---

