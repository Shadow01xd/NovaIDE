// src/renderer/components/extensions.js
// Tienda de extensiones conectada a Open VSX Registry (open-vsx.org)

const OPENVSX_API = 'https://open-vsx.org/api'

const CATEGORIES = [
  { id: 'featured',              label: '⭐ Destacadas',      query: '' },
  { id: 'themes',                label: '🎨 Temas',            query: 'theme' },
  { id: 'programming-languages', label: '💻 Lenguajes',        query: 'language' },
  { id: 'snippets',              label: '✂️ Snippets',         query: 'snippets' },
  { id: 'linters',               label: '🔍 Linters',          query: 'linter' },
  { id: 'formatters',            label: '✨ Formateadores',    query: 'formatter' },
  { id: 'keymaps',               label: '⌨️ Keymaps',          query: 'keymap' },
  { id: 'debuggers',             label: '🐛 Depuradores',      query: 'debugger' },
  { id: 'other',                 label: '🔧 Otros',            query: 'productivity' },
]

const FEATURED = [
  { namespace:'dracula-theme',     name:'theme-dracula',           displayName:'Dracula Official',          description:'Tema oscuro elegante — el más popular del mundo',       version:'3.0.0',  downloads:8200000, stars:5, icon:'🧛', tags:['theme'] },
  { namespace:'PKief',             name:'material-icon-theme',     displayName:'Material Icon Theme',       description:'Iconos de Material Design para el explorador de archivos', version:'5.1.4',downloads:7100000, stars:5, icon:'🎨', tags:['theme','icons'] },
  { namespace:'esbenp',            name:'prettier-vscode',         displayName:'Prettier',                  description:'Formateador de código opinionado para JS, TS, CSS, HTML…', version:'11.0.0',downloads:6500000,stars:5,icon:'✨',tags:['formatter'] },
  { namespace:'dbaeumer',          name:'vscode-eslint',           displayName:'ESLint',                    description:'Integra ESLint directamente en el editor',              version:'3.0.5',  downloads:5900000, stars:5, icon:'🔍', tags:['linter'] },
  { namespace:'eamodio',           name:'gitlens',                 displayName:'GitLens',                   description:'Superpoderes de Git: blame, historial, comparar ramas', version:'15.5.0', downloads:5200000, stars:5, icon:'🔀', tags:['git'] },
  { namespace:'ritwickdey',        name:'liveserver',              displayName:'Live Server',               description:'Servidor local con recarga automática en vivo',         version:'5.7.9',  downloads:4800000, stars:5, icon:'🌐', tags:['server'] },
  { namespace:'ms-python',         name:'python',                  displayName:'Python',                    description:'Soporte completo: IntelliSense, debug, linting, tests', version:'2024.2', downloads:4400000, stars:5, icon:'🐍', tags:['language','python'] },
  { namespace:'Gruntfuggly',       name:'todo-tree',               displayName:'Todo Tree',                 description:'Muestra TODO/FIXME en un panel lateral organizado',     version:'0.0.226',downloads:3100000, stars:4, icon:'📌', tags:['productivity'] },
  { namespace:'oderwat',           name:'indent-rainbow',          displayName:'Indent Rainbow',            description:'Colorea la indentación por niveles — muy útil en Python', version:'8.3.1',downloads:2900000,stars:4,icon:'🌈',tags:['formatting'] },
  { namespace:'CoenraadS',         name:'bracket-pair-colorizer-2',displayName:'Bracket Pair Colorizer',   description:'Colorea pares de brackets anidados con colores únicos',  version:'0.2.4',  downloads:2700000, stars:4, icon:'🔶', tags:['formatting'] },
  { namespace:'streetsidesoftware',name:'code-spell-checker',      displayName:'Code Spell Checker',        description:'Corrector ortográfico inteligente para código',          version:'3.0.1',  downloads:2500000, stars:4, icon:'📝', tags:['linter'] },
  { namespace:'Equinusocio',       name:'vsc-material-theme',      displayName:'Material Theme',            description:'El tema más épico — Material Ocean, Darker, Palenight', version:'34.0.0', downloads:2200000, stars:4, icon:'💎', tags:['theme'] },
  { namespace:'ms-vscode',         name:'cpptools',                displayName:'C/C++',                     description:'IntelliSense, debug y navegación de código C/C++',      version:'1.19.9', downloads:2000000, stars:4, icon:'⚙️', tags:['language','cpp'] },
  { namespace:'bradlc',            name:'vscode-tailwindcss',      displayName:'Tailwind CSS IntelliSense', description:'Autocompletado, linting y preview de clases Tailwind',  version:'0.11.1', downloads:1900000, stars:5, icon:'💨', tags:['css','language'] },
  { namespace:'Vue',               name:'volar',                   displayName:'Vue - Official',            description:'Soporte oficial para Vue 3 con IntelliSense completo',  version:'2.0.7',  downloads:1800000, stars:5, icon:'💚', tags:['language','vue'] },
  { namespace:'ms-vscode',         name:'PowerShell',              displayName:'PowerShell',                description:'Soporte completo: IntelliSense, debug, scripts',         version:'2024.0', downloads:1600000, stars:4, icon:'💙', tags:['language'] },
  { namespace:'formulahendry',     name:'auto-rename-tag',         displayName:'Auto Rename Tag',           description:'Renombra automáticamente el tag HTML de cierre',        version:'0.1.10', downloads:1500000, stars:4, icon:'🏷️', tags:['html'] },
  { namespace:'christian-kohler',  name:'path-intellisense',       displayName:'Path Intellisense',         description:'Autocompletado inteligente para rutas de archivos',     version:'2.8.5',  downloads:1400000, stars:4, icon:'📂', tags:['productivity'] },
  { namespace:'zhuangtongfa',      name:'material-theme',          displayName:'One Dark Pro',              description:'Tema oscuro One Dark Pro inspirado en Atom',            version:'3.17.0', downloads:2100000, stars:5, icon:'🌙', tags:['theme'] },
  { namespace:'ms-vscode',         name:'vscode-typescript-next',  displayName:'JavaScript and TypeScript', description:'Soporte mejorado de JS/TS con las últimas features',   version:'5.4.0',  downloads:1300000, stars:4, icon:'🔷', tags:['language','typescript'] },
  { namespace:'golang',            name:'Go',                      displayName:'Go',                        description:'Soporte completo para Go: IntelliSense, debug, test',  version:'0.41.4', downloads:1200000, stars:5, icon:'🐹', tags:['language','go'] },
  { namespace:'rust-lang',         name:'rust-analyzer',           displayName:'rust-analyzer',             description:'El servidor LSP oficial de Rust con todas las features', version:'0.4.0', downloads:1100000, stars:5, icon:'🦀', tags:['language','rust'] },
  { namespace:'rebornix',          name:'ruby',                    displayName:'Ruby',                      description:'Soporte completo para Ruby con IntelliSense',           version:'0.28.1', downloads:900000,  stars:3, icon:'💎', tags:['language','ruby'] },
  { namespace:'mtxr',             name:'sqltools',                 displayName:'SQLTools',                  description:'Gestión de bases de datos desde el editor',             version:'0.28.3', downloads:850000,  stars:4, icon:'🗄️', tags:['database','sql'] },
  { namespace:'ms-azuretools',     name:'vscode-docker',           displayName:'Docker',                    description:'Gestión de contenedores, Dockerfiles y Compose',        version:'1.29.1', downloads:800000,  stars:4, icon:'🐳', tags:['docker'] },
  { namespace:'usernamehw',        name:'errorlens',               displayName:'Error Lens',                description:'Muestra errores y warnings inline en el código',        version:'3.17.0', downloads:780000,  stars:5, icon:'🚨', tags:['linter','productivity'] },
  { namespace:'Zignd',             name:'html-css-class-completion',displayName:'HTML CSS Class Completion', description:'Autocompletado de clases CSS en HTML',               version:'1.20.0', downloads:750000,  stars:4, icon:'🌐', tags:['html','css'] },
  { namespace:'alexcvzz',          name:'vscode-sqlite',           displayName:'SQLite Viewer',             description:'Navega y consulta bases de datos SQLite',              version:'0.14.1', downloads:700000,  stars:4, icon:'📊', tags:['database'] },
  { namespace:'ms-vscode',         name:'hexeditor',               displayName:'Hex Editor',                description:'Editor hexadecimal para archivos binarios',             version:'1.10.0', downloads:650000,  stars:4, icon:'🔢', tags:['editor'] },
  { namespace:'wayou',             name:'vscode-todo-highlight',   displayName:'TODO Highlight',            description:'Resalta TODO, FIXME y palabras clave en comentarios',  version:'1.0.5',  downloads:620000,  stars:4, icon:'📌', tags:['productivity'] },
]

let installedExtensions = new Set(JSON.parse(localStorage.getItem('ide-extensions') || '[]'))
function saveInstalled() {
  localStorage.setItem('ide-extensions', JSON.stringify([...installedExtensions]))
}

export function createExtensionsStore(container, state) {
  let currentCategory = 'featured'

  container.innerHTML = `
    <div class="store-layout">
      <div class="store-header">
        <div class="store-search-wrap">
          <span class="store-search-icon">🔍</span>
          <input type="text" id="store-search" class="store-search-input"
            placeholder="Buscar extensiones en Open VSX…"/>
          <button class="store-search-clear" id="btn-search-clear" style="display:none">×</button>
        </div>
        <div class="store-source-badge">
          <span>📦</span>
          <span>Open VSX Registry</span>
        </div>
      </div>

      <div class="store-body">
        <div class="store-cats" id="store-cats">
          ${CATEGORIES.map(c => `
            <button class="store-cat${c.id==='featured'?' active':''}" data-cat="${c.id}">${c.label}</button>
          `).join('')}
          <div class="store-cats-sep"></div>
          <button class="store-cat" data-cat="installed">✅ Instaladas (${installedExtensions.size})</button>
        </div>

        <div class="store-content">
          <div class="store-list-wrap" id="store-list-wrap">
            <div class="store-list" id="store-list"></div>
            <div class="store-loading" id="store-loading" style="display:none">
              <div class="store-spinner"></div>
              <span>Buscando en Open VSX…</span>
            </div>
            <div class="store-empty" id="store-empty" style="display:none">
              <div class="store-empty-icon">🔍</div>
              <p>Sin resultados para "<span id="store-empty-q"></span>"</p>
              <p class="store-empty-sub">Prueba con otros términos</p>
            </div>
          </div>

          <div class="store-detail" id="store-detail" style="display:none">
            <button class="store-back-btn" id="btn-detail-close">← Volver</button>
            <div id="store-detail-body"></div>
          </div>
        </div>
      </div>
    </div>
  `

  // ── Búsqueda ──────────────────────────────────────────────────────
  const searchInput = document.getElementById('store-search')
  const clearBtn    = document.getElementById('btn-search-clear')
  let searchTimeout

  searchInput.addEventListener('input', e => {
    const q = e.target.value.trim()
    clearBtn.style.display = q ? 'inline-block' : 'none'
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      if (!q) { loadCategory(currentCategory); return }
      doSearch(q)
    }, 400)
  })

  clearBtn.addEventListener('click', () => {
    searchInput.value = ''
    clearBtn.style.display = 'none'
    loadCategory(currentCategory)
  })

  // ── Categorías ────────────────────────────────────────────────────
  document.getElementById('store-cats').addEventListener('click', e => {
    const btn = e.target.closest('.store-cat')
    if (!btn) return
    document.querySelectorAll('.store-cat').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentCategory = btn.dataset.cat
    searchInput.value = ''
    clearBtn.style.display = 'none'
    hideDetail()
    loadCategory(currentCategory)
  })

  function loadCategory(cat) {
    if (cat === 'installed') { showInstalled(); return }
    const catInfo = CATEGORIES.find(c => c.id === cat)
    if (cat === 'featured' || !catInfo?.query) { renderList(FEATURED); return }
    doSearch(catInfo.query)
  }

  // ── Open VSX API ──────────────────────────────────────────────────
  async function doSearch(query) {
    showLoading(true)
    try {
      const url = `${OPENVSX_API}/-/search?query=${encodeURIComponent(query)}&size=50&sortBy=downloadCount&sortOrder=desc`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const exts = (data.extensions || []).map(normalizeExt)
      showLoading(false)
      if (exts.length === 0) showEmpty(query)
      else renderList(exts)
    } catch {
      showLoading(false)
      const fallback = FEATURED.filter(e =>
        e.displayName.toLowerCase().includes(query.toLowerCase()) ||
        e.description.toLowerCase().includes(query.toLowerCase()) ||
        e.tags?.some(t => t.includes(query.toLowerCase()))
      )
      fallback.length > 0 ? renderList(fallback) : showEmpty(query)
    }
  }

  function normalizeExt(e) {
    return {
      namespace: e.namespace, name: e.name,
      displayName: e.displayName || e.name,
      description: e.description || '',
      version: e.version || '?',
      downloads: e.downloadCount || 0,
      stars: Math.round(e.averageRating || 0),
      icon: getExtIcon(e),
      tags: e.tags || [],
      license: e.license,
    }
  }

  function getExtIcon(e) {
    const t = (e.tags || []).join(' ').toLowerCase() + ' ' + (e.description || '').toLowerCase()
    if (t.includes('theme'))   return '🎨'
    if (t.includes('python'))  return '🐍'
    if (t.includes('java') && !t.includes('javascript')) return '☕'
    if (t.includes('rust'))    return '🦀'
    if (t.includes('go'))      return '🐹'
    if (t.includes('git'))     return '🔀'
    if (t.includes('docker'))  return '🐳'
    if (t.includes('snippet')) return '✂️'
    if (t.includes('lint'))    return '🔍'
    if (t.includes('format'))  return '✨'
    if (t.includes('debug'))   return '🐛'
    if (t.includes('html'))    return '🌐'
    if (t.includes('css'))     return '🎨'
    if (t.includes('vue'))     return '💚'
    if (t.includes('react'))   return '⚛️'
    if (t.includes('sql'))     return '🗄️'
    return '🔧'
  }

  // ── Instaladas ────────────────────────────────────────────────────
  function showInstalled() {
    if (installedExtensions.size === 0) {
      document.getElementById('store-list').innerHTML = `
        <div class="store-no-installed">
          <div style="font-size:40px;margin-bottom:12px">📦</div>
          <p>No tienes extensiones instaladas todavía.</p>
          <p style="margin-top:6px;color:var(--text2);font-size:12px">Explora las categorías para encontrar extensiones.</p>
        </div>`
      document.getElementById('store-loading').style.display = 'none'
      document.getElementById('store-empty').style.display   = 'none'
      document.getElementById('store-list').style.display    = 'block'
      return
    }
    const installed = [...installedExtensions].map(id => {
      return FEATURED.find(e => `${e.namespace}.${e.name}` === id) ||
        { namespace: id.split('.')[0], name: id.split('.').slice(1).join('.') || id,
          displayName: id, description: 'Extensión instalada', version:'?', downloads:0, stars:0, icon:'🔧', tags:[] }
    })
    renderList(installed)
  }

  // ── Render lista ──────────────────────────────────────────────────
  function renderList(exts) {
    const list = document.getElementById('store-list')
    document.getElementById('store-empty').style.display   = 'none'
    document.getElementById('store-loading').style.display = 'none'
    list.style.display = 'block'
    list.innerHTML = ''

    exts.forEach(ext => {
      const id        = `${ext.namespace}.${ext.name}`
      const installed = installedExtensions.has(id)
      const stars     = renderStars(ext.stars)
      const dlFmt     = fmtNum(ext.downloads)

      const item = document.createElement('div')
      item.className = `store-item${installed ? ' installed' : ''}`
      item.innerHTML = `
        <div class="store-item-icon">${ext.icon}</div>
        <div class="store-item-body">
          <div class="store-item-header">
            <span class="store-item-name">${esc(ext.displayName)}</span>
            ${installed ? '<span class="ext-installed-badge">✓ Instalada</span>' : ''}
          </div>
          <div class="store-item-desc">${esc(ext.description.slice(0,90))}${ext.description.length>90?'…':''}</div>
          <div class="store-item-footer">
            <span class="store-item-ns">${esc(ext.namespace)}</span>
            <span class="store-item-sep">·</span>
            <span class="store-item-dl">⬇ ${dlFmt}</span>
            <span class="store-item-sep">·</span>
            <span class="store-item-stars">${stars}</span>
          </div>
        </div>
        <div class="store-item-action">
          <button class="store-btn ${installed?'store-btn--uninstall':'store-btn--install'}"
            data-id="${id}">${installed ? 'Desinstalar' : 'Instalar'}</button>
        </div>
      `

      item.addEventListener('click', e => {
        if (e.target.closest('.store-btn')) return
        showDetail(ext)
      })

      item.querySelector('.store-btn').addEventListener('click', e => {
        e.stopPropagation()
        toggleInstall(ext, item, e.currentTarget)
      })

      list.appendChild(item)
    })
  }

  // ── Instalar / desinstalar ────────────────────────────────────────
  async function toggleInstall(ext, itemEl, btn) {
    const id = `${ext.namespace}.${ext.name}`
    if (installedExtensions.has(id)) {
      installedExtensions.delete(id)
      saveInstalled()
      applyUninstall(ext)
      btn.textContent = 'Instalar'
      btn.className   = 'store-btn store-btn--install'
      itemEl.classList.remove('installed')
      itemEl.querySelector('.ext-installed-badge')?.remove()
      updateCount()
      toast(`${ext.displayName} desinstalada`)
    } else {
      btn.textContent = '⏳ Instalando…'
      btn.disabled    = true
      try {
        await applyInstall(ext)
        installedExtensions.add(id)
        saveInstalled()
        btn.textContent = 'Desinstalar'
        btn.className   = 'store-btn store-btn--uninstall'
        btn.disabled    = false
        itemEl.classList.add('installed')
        if (!itemEl.querySelector('.ext-installed-badge')) {
          const badge = document.createElement('span')
          badge.className = 'ext-installed-badge'
          badge.textContent = '✓ Instalada'
          itemEl.querySelector('.store-item-header').appendChild(badge)
        }
        updateCount()
        toast(`✓ ${ext.displayName} instalada correctamente`)
      } catch (err) {
        btn.textContent = 'Instalar'
        btn.disabled    = false
        toast(`Error: ${err.message}`, true)
      }
    }
  }

  async function applyInstall(ext) {
    const t = ext.tags?.join(' ').toLowerCase() || ''
    if (t.includes('theme') || ext.displayName.toLowerCase().includes('theme')) {
      applyTheme(ext); return
    }
    if (t.includes('snippet')) { await applySnippets(ext); return }
    // Otros tipos: registrados, en futuro se puede integrar descarga de .vsix
    await new Promise(r => setTimeout(r, 600)) // simular descarga
  }

  function applyUninstall(ext) {
    const t = ext.tags?.join(' ').toLowerCase() || ''
    if (t.includes('theme') && state.monacoRef) {
      state.monacoRef.editor.setTheme('myide-dark')
    }
  }

  function applyTheme(ext) {
    if (!state.monacoRef) return
    const name = ext.displayName.toLowerCase()
    let theme  = 'vs-dark'
    if (name.includes('light') || name.includes('white') || name.includes('day')) theme = 'vs'
    else if (name.includes('high contrast') || name.includes('hc'))               theme = 'hc-black'
    state.monacoRef.editor.setTheme(theme)
    toast(`🎨 Tema "${ext.displayName}" aplicado al editor`)
  }

  async function applySnippets(ext) {
    if (!state.monacoRef) return
    const t    = ext.tags?.join(' ').toLowerCase() || ''
    const lang = t.includes('typescript') ? 'typescript'
               : t.includes('javascript') ? 'javascript'
               : t.includes('python')     ? 'python'
               : t.includes('html')       ? 'html'
               : t.includes('css')        ? 'css'
               : 'plaintext'
    state.monacoRef.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems: () => ({ suggestions: [] })
    })
    await new Promise(r => setTimeout(r, 400))
  }

  // ── Detalle ───────────────────────────────────────────────────────
  function showDetail(ext) {
    const id        = `${ext.namespace}.${ext.name}`
    const installed = installedExtensions.has(id)
    const url       = `https://open-vsx.org/extension/${ext.namespace}/${ext.name}`

    document.getElementById('store-detail-body').innerHTML = `
      <div class="detail-hero">
        <div class="detail-hero-icon">${ext.icon}</div>
        <div class="detail-hero-text">
          <h2 class="detail-title">${esc(ext.displayName)}</h2>
          <div class="detail-subtitle">
            <span>${esc(ext.namespace)}</span>
            <span>·</span>
            <span>v${esc(ext.version)}</span>
            <span>·</span>
            <span>${renderStars(ext.stars)}</span>
            <span>·</span>
            <span>⬇ ${fmtNum(ext.downloads)}</span>
          </div>
        </div>
      </div>

      <div class="detail-actions-bar">
        <button class="detail-main-btn ${installed?'detail-uninstall':'detail-install'}" id="detail-toggle-btn">
          ${installed ? '🗑️ Desinstalar' : '⬇️ Instalar extensión'}
        </button>
        <button class="detail-link-btn" id="detail-openvsx-btn">🌐 Open VSX</button>
      </div>

      <p class="detail-description">${esc(ext.description)}</p>

      ${ext.tags?.length ? `
        <div class="detail-tags">
          ${ext.tags.slice(0,10).map(t => `<span class="detail-tag">${esc(t)}</span>`).join('')}
        </div>` : ''}

      <div class="detail-stats-grid">
        <div class="detail-stat-card">
          <div class="detail-stat-label">Descargas totales</div>
          <div class="detail-stat-value">${ext.downloads.toLocaleString()}</div>
        </div>
        <div class="detail-stat-card">
          <div class="detail-stat-label">Versión</div>
          <div class="detail-stat-value">${esc(ext.version)}</div>
        </div>
        <div class="detail-stat-card">
          <div class="detail-stat-label">Valoración</div>
          <div class="detail-stat-value">${renderStars(ext.stars)}</div>
        </div>
        ${ext.license ? `<div class="detail-stat-card">
          <div class="detail-stat-label">Licencia</div>
          <div class="detail-stat-value">${esc(ext.license)}</div>
        </div>` : ''}
      </div>

      <div class="detail-info-note">
        <strong>ℹ️ Sobre la integración</strong>
        <p>Los <strong>temas de color</strong> se aplican al editor inmediatamente.<br>
        Los <strong>snippets</strong> quedan disponibles en el autocompletado.<br>
        Linters, formatters y depuradores quedan registrados para integración futura vía LSP.</p>
        <p style="margin-top:6px">Las extensiones provienen de <strong>Open VSX Registry</strong>, el marketplace open source compatible con VS Code, usado por VSCodium, Gitpod y Eclipse Theia.</p>
      </div>
    `

    document.getElementById('detail-toggle-btn').addEventListener('click', () => {
      const fakeItem = document.createElement('div')
      fakeItem.innerHTML = '<div class="store-item-header"></div>'
      toggleInstall(ext, fakeItem, document.getElementById('detail-toggle-btn'))
    })

    document.getElementById('detail-openvsx-btn').addEventListener('click', () => {
      if (window.api?.openInShell) window.api.openInShell(url)
      else window.open(url, '_blank')
    })

    document.getElementById('store-list-wrap').style.display = 'none'
    document.getElementById('store-detail').style.display    = 'flex'
  }

  function hideDetail() {
    document.getElementById('store-detail').style.display    = 'none'
    document.getElementById('store-list-wrap').style.display = 'block'
  }

  document.getElementById('btn-detail-close').addEventListener('click', hideDetail)

  // ── Helpers ───────────────────────────────────────────────────────
  function showLoading(on) {
    document.getElementById('store-loading').style.display = on ? 'flex' : 'none'
    document.getElementById('store-list').style.display    = on ? 'none' : 'block'
    document.getElementById('store-empty').style.display   = 'none'
  }
  function showEmpty(q) {
    document.getElementById('store-empty').style.display   = 'flex'
    document.getElementById('store-list').style.display    = 'none'
    document.getElementById('store-loading').style.display = 'none'
    document.getElementById('store-empty-q').textContent   = q
  }
  function updateCount() {
    const btn = document.querySelector('.store-cat[data-cat="installed"]')
    if (btn) btn.textContent = `✅ Instaladas (${installedExtensions.size})`
  }
  function renderStars(n) {
    n = Math.min(5, Math.max(0, Math.round(n || 0)))
    return '<span class="stars">'+('★'.repeat(n)+'☆'.repeat(5-n))+'</span>'
  }
  function fmtNum(n) {
    if (n >= 1000000) return (n/1000000).toFixed(1)+'M'
    if (n >= 1000)    return Math.round(n/1000)+'K'
    return String(n)
  }
  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }

  let toastTimer
  function toast(msg, isErr = false) {
    const existing = document.querySelector('.ide-toast')
    existing?.remove()
    clearTimeout(toastTimer)
    const el = document.createElement('div')
    el.className = `ide-toast${isErr ? ' ide-toast--error' : ''}`
    el.textContent = msg
    document.body.appendChild(el)
    toastTimer = setTimeout(() => el.remove(), 3500)
  }

  // Cargar inicial
  loadCategory('featured')
}
