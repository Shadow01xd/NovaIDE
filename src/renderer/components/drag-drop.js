export class DragAndDropManager {
  constructor(state) {
    this.state = state;
    this.setupGlobalDragListeners();
  }

  setupGlobalDragListeners() {
    let dragCounter = 0;

    document.body.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1) {
        document.body.classList.add('is-dragging');
      }
    });

    document.body.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.highlightDropZone(e.clientX, e.clientY);
    });

    document.body.addEventListener('dragleave', (e) => {
      dragCounter--;
      if (dragCounter === 0) {
        document.body.classList.remove('is-dragging');
        this.clearHighlights();
      }
    });

    document.body.addEventListener('drop', async (e) => {
      e.preventDefault();
      console.log('[DragDrop] Drop event detected', e);
      dragCounter = 0;
      document.body.classList.remove('is-dragging');
      this.clearHighlights();

      const targetZone = this.determineDropZone(e.clientX, e.clientY);
      console.log('[DragDrop] Target zone determined:', targetZone);
      if (!targetZone) return;

      // 1. Verificar si viene del explorador interno (Custom Drag)
      const internalData = e.dataTransfer.getData('application/nvcode-file');
      console.log('[DragDrop] Internal data:', internalData);
      if (internalData) {
        try {
          const item = JSON.parse(internalData);
          if (targetZone === 'explorer') return; // Mover dentro del explorer aun no sportado completamente, o se ignoraría.
          
          const mockFile = {
            path: item.path,
            name: item.name,
            text: async () => {
              try {
                console.log('[DragDrop] Attempting to read file:', item.path);
                // Verificar si el archivo existe primero
                const exists = await window.api.exists(item.path);
                console.log('[DragDrop] File exists:', exists);
                
                if (!exists) {
                  console.error('[DragDrop] File does not exist:', item.path);
                  return '';
                }
                
                const content = await window.api.readFile(item.path);
                console.log('[DragDrop] Internal file content read:', content.length, 'bytes');
                return content;
              } catch (err) {
                console.error('[DragDrop] Error reading internal file:', err);
                return '';
              }
            }
          };
          
          console.log('[DragDrop] Handling internal file drop:', mockFile);
          await this.handleFileDrop(mockFile, targetZone);
        } catch(err) {
          console.error("Error parseando archivo interno", err);
        }
        return;
      }

      // 2. Verificar archivos nativos de SO
      const files = Array.from(e.dataTransfer.files);
      console.log('[DragDrop] Native files:', files);
      if (!files.length) return;

      for (const file of files) {
        console.log('[DragDrop] Handling native file drop:', file);
        await this.handleFileDrop(file, targetZone);
      }
    });
  }

  determineDropZone(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (el.closest('.ide-ai')) return 'chat';
    if (el.closest('.ide-sidebar')) return 'explorer';
    if (el.closest('.ide-main')) return 'editor';
    return null;
  }

  highlightDropZone(x, y) {
    const zone = this.determineDropZone(x, y);
    const zones = ['chat', 'explorer', 'editor'];
    zones.forEach(z => {
      const el = this.getZoneElement(z);
      if (el) {
        if (z === zone) el.classList.add('drop-zone-active');
        else el.classList.remove('drop-zone-active');
      }
    });
  }

  clearHighlights() {
    ['chat', 'explorer', 'editor'].forEach(z => {
      const el = this.getZoneElement(z);
      if (el) el.classList.remove('drop-zone-active');
    });
  }

  getZoneElement(zone) {
    if (zone === 'chat') return document.querySelector('.ide-ai');
    if (zone === 'explorer') return document.querySelector('.ide-sidebar');
    if (zone === 'editor') return document.querySelector('.ide-main');
    return null;
  }

  async handleFileDrop(file, targetZone) {
    console.log('[DragDrop] handleFileDrop called with:', { file: file.name, targetZone });
    const filePath = file.path; // API de Electron Files
    const fileName = file.name;
    let content = '';
    
    // Si no somos el explorer, necesitamos el contenido textual
    if (targetZone === 'chat' || targetZone === 'editor') {
      try {
        console.log('[DragDrop] Reading file content...');
        content = await file.text();
        console.log('[DragDrop] File content read successfully, length:', content.length);
        if (!content || content.trim() === '') {
          console.warn('[DragDrop] File content is empty, trying to read directly...');
          // Fallback: leer directamente con API si es archivo interno
          if (filePath) {
            try {
              console.log('[DragDrop] Fallback: attempting to read file directly:', filePath);
              const exists = await window.api.exists(filePath);
              console.log('[DragDrop] Fallback: file exists:', exists);
              
              if (!exists) {
                console.error('[DragDrop] Fallback: file does not exist:', filePath);
                // Mostrar error al usuario
                alert(`No se puede encontrar el archivo: ${filePath}\nAsegúrate de que el archivo esté dentro del workspace del IDE.`);
                return;
              }
              
              content = await window.api.readFile(filePath);
              console.log('[DragDrop] Fallback content read, length:', content.length);
              
              if (!content || content.trim() === '') {
                console.warn('[DragDrop] Fallback: content still empty after direct read');
                alert(`El archivo ${fileName} está vacío o no se puede leer como texto.`);
                return;
              }
            } catch (fallbackErr) {
              console.error('[DragDrop] Fallback read failed:', fallbackErr);
              alert(`Error al leer el archivo: ${fallbackErr.message}`);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('[DragDrop] Error reading file content:', err);
        // Intentar leer directamente como fallback
        try {
          content = await window.api.readFile(filePath);
          console.log('[DragDrop] Emergency fallback content read, length:', content.length);
        } catch (fallbackErr) {
          console.error('[DragDrop] Emergency fallback failed:', fallbackErr);
        }
      }
    }

    try {
      const stat = await window.api.stat(filePath);
      console.log('[DragDrop] File stat:', stat);

      if (targetZone === 'chat') {
        console.log('[DragDrop] Processing chat drop...');
        if (stat.isDirectory) {
          alert('No puedes adjuntar carpetas directamente al chat mediante Drop. Usa el comando @Proyecto');
          return;
        }
        // Emitir al chat
        const lang = fileName.split('.').pop() || 'text';
        console.log('[DragDrop] Emitting sendToAI event:', { code: content, file: fileName, lang, selection: null });
        this.state.emit('sendToAI', { code: content, file: fileName, lang, selection: null });
        
      } else if (targetZone === 'editor') {
        if (stat.isDirectory) {
          if (confirm(`¿Abrir carpeta ${fileName} como proyecto base de NVCode?`)) {
            this.state.currentFolder = filePath;
            this.state.emit('refreshTree');
          }
        } else {
          try {
            const rawContent = await window.api.readFile(filePath);
            this.state.openFile(filePath, rawContent);
          } catch (e) {
            alert('Error al leer el archivo en el editor');
          }
        }
      } else if (targetZone === 'explorer') {
        if (!this.state.currentFolder) {
          alert('Abre un proyecto primero en NVCode para copiar este archivo allí.');
          return;
        }
        const dest = await window.api.pathJoin(this.state.currentFolder, fileName);
        if (filePath !== dest) {
          await window.api.copyFile(filePath, dest);
          this.state.emit('refreshTree');
        }
      }
    } catch(e) {
      console.error('Error handling drop', e);
    }
  }
}
