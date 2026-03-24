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
      dragCounter = 0;
      document.body.classList.remove('is-dragging');
      this.clearHighlights();

      const targetZone = this.determineDropZone(e.clientX, e.clientY);
      if (!targetZone) return;

      // 1. Verificar si viene del explorador interno (Custom Drag)
      const internalData = e.dataTransfer.getData('application/nvcode-file');
      if (internalData) {
        try {
          const item = JSON.parse(internalData);
          if (targetZone === 'explorer') return; // Mover dentro del explorer aun no sportado completamente, o se ignoraría.
          
          const mockFile = {
            path: item.path,
            name: item.name,
            text: async () => window.api.readFile(item.path)
          };
          
          await this.handleFileDrop(mockFile, targetZone);
        } catch(err) {
          console.error("Error parseando archivo interno", err);
        }
        return;
      }

      // 2. Verificar archivos nativos de SO
      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;

      for (const file of files) {
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
    const filePath = file.path; // API de Electron Files
    const fileName = file.name;
    let content = '';
    
    // Si no somos el explorer, quizas necesitamos el contenido textual
    if (targetZone === 'chat' || targetZone === 'editor') {
      try {
        content = await file.text();
      } catch (err) {
        console.warn('El archivo no es texto plano');
      }
    }

    try {
      const stat = await window.api.stat(filePath);

      if (targetZone === 'chat') {
        if (stat.isDirectory) {
          alert('No puedes adjuntar carpetas directamente al chat mediante Drop. Usa el comando @Proyecto');
          return;
        }
        // Emitir al chat
        const lang = fileName.split('.').pop() || 'text';
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
