# MyIDE v2 — IDE completo con IA estilo Cursor 🚀

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Asegurarse que Ollama esté corriendo con el modelo
ollama serve            # en otra terminal
ollama pull deepseek-coder:6.7b

# 3. Correr en desarrollo
npm run dev
```

## Características v2

### Editor
- Monaco Editor (mismo motor que VS Code)
- Syntax highlighting para 20+ lenguajes
- Autocompletado inteligente
- Bracket pair colorization
- Múltiples cursores (Alt+Click)
- Buscar/reemplazar (Ctrl+H)
- **Decoraciones IA**: las líneas modificadas por la IA se destacan en verde 8 segundos

### Chat IA (estilo Cursor)
- **Streaming** de respuestas token a token
- **3 modos**: Chat, Editar, Explicar
- **Ctrl+L** — adjunta código seleccionado al mensaje
- **Ctrl+K** — solicita edición inline
- Botones **"Aplicar al editor"** y **"Insertar en cursor"** en cada bloque de código
- **Sugerencias rápidas**: explicar, buscar bugs, refactorizar, generar tests, documentar, optimizar
- Selector de modelos (se carga automáticamente desde Ollama)
- Botón **Detener** para cancelar streaming
- Historial de conversación con contexto
- Panel redimensionable (arrastra el borde)

### Terminal integrada
- Terminal real con xterm.js + node-pty
- PowerShell en Windows, bash en Linux/Mac
- Múltiples terminales simultáneas
- Colores ANSI completos
- Ctrl+` para abrir/cerrar

### Explorador de archivos
- Árbol de archivos con expansión lazy
- **Menú contextual** (clic derecho):
  - Nuevo archivo / carpeta
  - Renombrar
  - Eliminar
  - Copiar ruta
- Crear archivos y carpetas desde la barra
- Auto-refresh

### Búsqueda en archivos
- Buscar en todos los archivos abiertos
- Opciones: case sensitive, regex, palabra completa
- Click en resultado → salta a la línea

### Extensiones
- Panel de extensiones con lista curada
- Toggle de cada extensión
- (Futuro: marketplace real)

## Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl+L` | Enviar código al chat IA |
| `Ctrl+K` | Edición inline con IA |
| `Ctrl+`` | Terminal |
| `Ctrl+Shift+L` | Mostrar/ocultar panel IA |
| `Ctrl+Shift+E` | Explorador |
| `Ctrl+Shift+F` | Buscar en archivos |
| `Ctrl+Shift+X` | Extensiones |
| `Ctrl+S` | Guardar |
| `Ctrl+Shift+S` | Guardar como |
| `Ctrl+W` | Cerrar tab |
| `Ctrl+Tab` | Siguiente tab |
| `Ctrl+Shift+Tab` | Tab anterior |

## Cómo funciona el diff de la IA

Cuando presionas **"✦ Aplicar al editor"**:
1. El código se inserta en el editor
2. Las líneas nuevas/modificadas se destacan en **verde translúcido** con un icono ✦ en el margen
3. Después de 8 segundos, las decoraciones desaparecen automáticamente

## Estructura del proyecto

```
myide/
├── src/
│   ├── main/
│   │   ├── main.js        # Electron main: ventana, IPC, IA, terminal
│   │   └── preload.js     # Bridge seguro Node.js ↔ renderer
│   └── renderer/
│       ├── main.js        # Punto de entrada: layout, atajos, panel toggle
│       ├── state.js       # Estado global reactivo
│       └── components/
│           ├── editor.js    # Monaco Editor + AI diff
│           ├── tabs.js      # Tabs de archivos abiertos
│           ├── sidebar.js   # Explorador + búsqueda + extensiones
│           ├── ai-chat.js   # Chat IA estilo Cursor
│           ├── terminal.js  # Terminal xterm.js
│           └── statusbar.js # Barra de estado inferior
├── index.html             # Carga Monaco + xterm desde CDN
└── package.json
```
