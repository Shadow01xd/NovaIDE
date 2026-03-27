// src/main/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Path utilities (via IPC handlers)
  pathJoin: (...args) => ipcRenderer.invoke('path:join', ...args),
  pathIsAbsolute: (p) => ipcRenderer.invoke('path:isAbsolute', p),
  pathDirname: (p) => ipcRenderer.invoke('path:dirname', p),
  pathBasename: (p) => ipcRenderer.invoke('path:basename', p),
  // File system
  openFolder:    ()        => ipcRenderer.invoke('dialog:openFolder'),
  saveAs:        (p)       => ipcRenderer.invoke('dialog:saveAs', p),
  confirmDialog: (msg, detail) => ipcRenderer.invoke('dialog:confirm', msg, detail),
  readDir:       (p)       => ipcRenderer.invoke('fs:readDir', p),
  readDirSub:    (p)       => ipcRenderer.invoke('fs:readDirSub', p),
  readFile:      (p)       => ipcRenderer.invoke('fs:readFile', p),
  saveFile:      (p, c)    => ipcRenderer.invoke('fs:saveFile', p, c),
  copyFile:      (s, d)    => ipcRenderer.invoke('fs:copyFile', s, d),
  stat:          (p)       => ipcRenderer.invoke('fs:stat', p),
  deleteFile:    (p)       => ipcRenderer.invoke('fs:deleteFile', p),
  rename:        (o, n)    => ipcRenderer.invoke('fs:rename', o, n),
  createFile:    (p)       => ipcRenderer.invoke('fs:createFile', p),
  createDir:     (p)       => ipcRenderer.invoke('fs:createDir', p),
  exists:        (p)       => ipcRenderer.invoke('fs:exists', p),
  openInShell:   (p)       => ipcRenderer.invoke('shell:open', p),

  // AI
  aiModels: ()             => ipcRenderer.invoke('ai:models'),
  aiChat:   (msgs, model)  => ipcRenderer.invoke('ai:chat', { messages: msgs, model }),
  aiStream: (msgs, model, reqId) => ipcRenderer.invoke('ai:stream', { messages: msgs, model, reqId }),
  aiInlineComplete: (payload) => ipcRenderer.invoke('ai:inlineComplete', payload),
  onAiToken: (fn)          => {
    const wrapped = (_, d) => fn(d)
    ipcRenderer.on('ai:token', wrapped)
    return () => ipcRenderer.removeListener('ai:token', wrapped)
  },

  // Terminal
  termCreate: (id, cwd)    => ipcRenderer.invoke('terminal:create', { id, cwd }),
  termWrite:  (id, data)   => ipcRenderer.send('terminal:write', { id, data }),
  termResize: (id, c, r)   => ipcRenderer.send('terminal:resize', { id, cols: c, rows: r }),
  termKill:   (id)         => ipcRenderer.invoke('terminal:kill', id),
  onTermData: (fn)         => {
    const w = (_, d) => fn(d)
    ipcRenderer.on('terminal:data', w)
    return () => ipcRenderer.removeListener('terminal:data', w)
  },
  onTermExit: (fn)         => {
    const w = (_, d) => fn(d)
    ipcRenderer.on('terminal:exit', w)
    return () => ipcRenderer.removeListener('terminal:exit', w)
  },

  // Menu events
  onMenu: (fn) => {
    const events = ['openFolder','newFile','save','saveAs','toggleTerminal','toggleAI','toggleExtensions','toggleSearch','undo','redo']
    const listeners = events.map(e => {
      const w = () => fn(e)
      ipcRenderer.on(`menu:${e}`, w)
      return [e, w]
    })
    return () => listeners.forEach(([e, w]) => ipcRenderer.removeListener(`menu:${e}`, w))
  },

  // Settings
  getSettings: ()    => ipcRenderer.invoke('settings:get'),
  setSettings: (d)   => ipcRenderer.invoke('settings:set', d),

  // AI Agent Tools (consolidated - use these instead of fs:* for agent operations)
  agentReadFile:            (p)         => ipcRenderer.invoke('agent:readFile', p),
  agentWriteFile:           (p, c)      => ipcRenderer.invoke('agent:writeFile', p, c),
  agentCreateFile:          (p, c)      => ipcRenderer.invoke('agent:createFile', p, c),
  agentDeleteFile:          (p)         => ipcRenderer.invoke('agent:deleteFile', p),
  agentDeleteDirectory:     (p)         => ipcRenderer.invoke('agent:deleteDirectory', p),
  agentListFiles:           (p)         => ipcRenderer.invoke('agent:listFiles', p),
  agentSearch:              (q, d)      => ipcRenderer.invoke('agent:searchInFiles', q, d),
  agentCreateDir:           (p)         => ipcRenderer.invoke('agent:createDir', p),
  agentMoveFile:            (src, dest) => ipcRenderer.invoke('agent:moveFile', src, dest),
  agentRunCommand:          (cmd, cwd)  => ipcRenderer.invoke('agent:runCommand', cmd, cwd),
  agentRunCommandLive:      (cmd, cwd, reqId) => ipcRenderer.invoke('agent:runCommandLive', cmd, cwd, reqId),
  onCmdOutput: (fn) => {
    const w = (_, d) => fn(d)
    ipcRenderer.on('agent:cmdOutput', w)
    return () => ipcRenderer.removeListener('agent:cmdOutput', w)
  },
  onServerPort: (fn) => {
    const w = (_, d) => fn(d)
    ipcRenderer.on('agent:serverPort', w)
    return () => ipcRenderer.removeListener('agent:serverPort', w)
  },
  killServer: (reqId) => ipcRenderer.invoke('agent:killServer', reqId),
  agentGetProjectStructure: (p, depth)  => ipcRenderer.invoke('agent:getProjectStructure', p, depth),
  agentApplyDiff:           (p, diff)   => ipcRenderer.invoke('agent:applyDiff', p, diff),
  agentSearchReplace:       (p, s, r)   => ipcRenderer.invoke('agent:searchReplace', p, s, r),
  agentReadDirRecursive:    (p)         => ipcRenderer.invoke('agent:readDirRecursive', p),
  
  // DeepSeek streaming
  aiStreamDeepSeek: (msgs, model, apiKey, reqId) => 
    ipcRenderer.invoke('ai:streamDeepSeek', { messages: msgs, model, apiKey, reqId }),
  
  // Groq streaming
  aiStreamGroq: (msgs, model, apiKey, reqId) => 
    ipcRenderer.invoke('ai:streamGroq', { messages: msgs, model, apiKey, reqId }),

  // Extension Store API (Marketplace)
  marketplaceSearch: (query) => ipcRenderer.invoke('marketplace:search', query),
  marketplaceDetails: (publisher, name) => ipcRenderer.invoke('marketplace:details', { publisher, name }),
  marketplaceInstall: (publisher, name, version) => ipcRenderer.invoke('marketplace:install', { publisher, name, version }),
  marketplaceUninstall: (publisher, name) => ipcRenderer.invoke('marketplace:uninstall', { publisher, name }),
  marketplaceInstalled: () => ipcRenderer.invoke('marketplace:installed'),
  // History
  historySave: (filePath, history) => ipcRenderer.invoke('history:save', { filePath, history }),
  historyGet: (filePath)           => ipcRenderer.invoke('history:get', filePath),
  // Shell
  openExternal: (url)              => ipcRenderer.invoke('shell:openExternal', url),
  // Live Server
  liveServerStart: (root, port)    => ipcRenderer.invoke('live-server:start', { rootPath: root, port }),
  liveServerStop: ()               => ipcRenderer.invoke('live-server:stop'),

  // Preview reload events
  onPreviewReload: (fn) => {
    const w = () => fn()
    ipcRenderer.on('preview:reload', w)
    return () => ipcRenderer.removeListener('preview:reload', w)
  },

  // Preview window
  previewWindowOpen: (url) => ipcRenderer.invoke('preview-window:open', { url }),
  previewWindowReload: () => ipcRenderer.invoke('preview-window:reload'),
  previewWindowClose: () => ipcRenderer.invoke('preview-window:close'),

  // Project root notification
  sendProjectRoot: (rootPath) => ipcRenderer.send('project:root-changed', rootPath),
})
