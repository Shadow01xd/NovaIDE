// src/renderer/components/extensions-store.js
// Tienda de Extensiones VS Code-Style - Rediseño Completo
// Arquitectura ES6 modular con API Open VSX, layout 2-columnas y estados visuales

const OPEN_VSX_API = 'https://open-vsx.org/api';

// Categorías VS Code-style
const CATEGORIES = [
  { id: 'featured', label: '⭐ Featured', query: '', icon: '⭐' },
  { id: 'themes', label: '🎨 Themes', query: 'theme', icon: '🎨' },
  { id: 'languages', label: '💻 Languages', query: 'language', icon: '💻' },
  { id: 'snippets', label: '✂️ Snippets', query: 'snippets', icon: '✂️' },
  { id: 'linters', label: '🔍 Linters', query: 'linter', icon: '🔍' },
  { id: 'formatters', label: '✨ Formatters', query: 'formatter', icon: '✨' },
  { id: 'debuggers', label: '🐛 Debuggers', query: 'debugger', icon: '🐛' },
  { id: 'keymaps', label: '⌨️ Keymaps', query: 'keymap', icon: '⌨️' },
  { id: 'scm', label: '🔀 SCM', query: 'scm', icon: '🔀' },
  { id: 'other', label: '🔧 Other', query: 'productivity', icon: '🔧' }
];

// Extensiones destacadas (fallback cuando API no disponible)
const FEATURED_EXTENSIONS = [
  {
    namespace: 'dracula-theme',
    name: 'theme-dracula',
    displayName: 'Dracula Official',
    description: 'Elegant dark theme — the most popular in the world',
    version: '3.0.0',
    downloadCount: 8200000,
    averageRating: 5,
    icon: '🧛',
    tags: ['theme'],
    categories: ['Themes']
  },
  {
    namespace: 'PKief',
    name: 'material-icon-theme',
    displayName: 'Material Icon Theme',
    description: 'Material Design Icons for the file explorer',
    version: '5.1.4',
    downloadCount: 7100000,
    averageRating: 5,
    icon: '🎨',
    tags: ['theme', 'icons'],
    categories: ['Themes']
  },
  {
    namespace: 'esbenp',
    name: 'prettier-vscode',
    displayName: 'Prettier - Code formatter',
    description: 'Opinionated code formatter for JS, TS, CSS, HTML, and more',
    version: '11.0.0',
    downloadCount: 6500000,
    averageRating: 5,
    icon: '✨',
    tags: ['formatter'],
    categories: ['Formatters']
  },
  {
    namespace: 'dbaeumer',
    name: 'vscode-eslint',
    displayName: 'ESLint',
    description: 'Integrates ESLint into VS Code for real-time linting',
    version: '3.0.5',
    downloadCount: 5900000,
    averageRating: 5,
    icon: '🔍',
    tags: ['linter'],
    categories: ['Linters']
  },
  {
    namespace: 'eamodio',
    name: 'gitlens',
    displayName: 'GitLens — Git supercharged',
    description: 'Supercharge Git capabilities: blame, history, compare branches',
    version: '15.5.0',
    downloadCount: 5200000,
    averageRating: 5,
    icon: '🔀',
    tags: ['git'],
    categories: ['SCM']
  }
];

/**
 * ExtensionStore - Clase principal de la tienda de extensiones
 * Implementa layout VS Code con búsqueda, filtros, instalación y detalles
 */
export class ExtensionStore {
  constructor(container, state = {}) {
    this.container = container;
    this.state = state;
    
    // Estado interno
    this.currentCategory = 'featured';
    this.currentQuery = '';
    this.selectedExtension = null;
    this.extensions = [];
    this.installedExtensions = new Set();
    this.loading = false;
    this.searchTimeout = null;
    
    // Elementos DOM cache
    this.elements = {};
    
    // Bindings
    this.handleSearch = this.handleSearch.bind(this);
    this.handleCategoryClick = this.handleCategoryClick.bind(this);
    this.handleExtensionClick = this.handleExtensionClick.bind(this);
    this.handleInstallClick = this.handleInstallClick.bind(this);
    this.handleBackClick = this.handleBackClick.bind(this);
    this.handleClearSearch = this.handleClearSearch.bind(this);
    
    // Inicialización
    this.loadInstalledExtensions();
  }

  /**
   * Montar el componente en el contenedor
   */
  mount() {
    this.render();
    this.cacheElements();
    this.attachEventListeners();
    this.loadCategory('featured');
    return this;
  }

  /**
   * Refrescar la tienda (recargar datos actuales)
   */
  refresh() {
    if (this.currentQuery) {
      this.search(this.currentQuery);
    } else {
      this.loadCategory(this.currentCategory);
    }
  }

  /**
   * Renderizar estructura principal
   */
  render() {
    this.container.innerHTML = `
      <div class="extension-store">
        <!-- Header con búsqueda -->
        <div class="store-header">
          <div class="search-container">
            <div class="search-input-wrapper">
              <svg class="search-icon" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zm-5.242 1.656a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z"/>
              </svg>
              <input 
                type="text" 
                class="search-input" 
                placeholder="Search extensions in Open VSX..."
                autocomplete="off"
              />
              <button class="search-clear" style="display: none;">
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
                </svg>
              </button>
            </div>
            <div class="search-source">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9zM2.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-11z"/>
                <path d="M5.5 4a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-3a.5.5 0 0 0-.5-.5h-5z"/>
              </svg>
              <span>Open VSX Registry</span>
            </div>
          </div>
        </div>

        <!-- Layout principal: Sidebar + Content -->
        <div class="store-layout">
          <!-- Sidebar de categorías -->
          <div class="store-sidebar">
            <div class="sidebar-categories">
              ${CATEGORIES.map(cat => `
                <button 
                  class="category-btn ${cat.id === this.currentCategory ? 'active' : ''}" 
                  data-category="${cat.id}"
                >
                  <span class="category-label">${cat.label}</span>
                </button>
              `).join('')}
              <div class="category-separator"></div>
              <button class="category-btn" data-category="installed">
                <span class="category-label">Installed (<span class="installed-count">0</span>)</span>
              </button>
            </div>
          </div>

          <!-- Área de contenido principal -->
          <div class="store-content">
            <!-- Vista de lista -->
            <div class="store-list-view" id="list-view">
              <div class="list-header">
                <h2 class="list-title">Featured Extensions</h2>
                <div class="list-stats">
                  <span class="extension-count">0 extensions</span>
                </div>
              </div>
              
              <div class="extensions-grid" id="extensions-grid">
                <!-- Las tarjetas de extensiones se renderizarán aquí -->
              </div>

              <!-- Loading skeleton -->
              <div class="loading-skeleton" id="loading-skeleton" style="display: none;">
                ${Array(6).fill(0).map(() => this.renderSkeletonCard()).join('')}
              </div>

              <!-- Empty state -->
              <div class="empty-state" id="empty-state" style="display: none;">
                <div class="empty-icon">🔍</div>
                <h3>No extensions found</h3>
                <p>No results for "<span class="empty-query"></span>"</p>
                <p>Try different keywords or browse categories</p>
              </div>
            </div>

            <!-- Vista de detalle -->
            <div class="store-detail-view" id="detail-view" style="display: none;">
              <div class="detail-header">
                <button class="back-btn">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
                    <path d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
                  </svg>
                  Back to extensions
                </button>
              </div>
              
              <div class="detail-content" id="detail-content">
                <!-- El contenido del detalle se renderizará aquí -->
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Renderizar tarjeta skeleton para loading
   */
  renderSkeletonCard() {
    return `
      <div class="extension-card skeleton">
        <div class="card-icon skeleton-shimmer"></div>
        <div class="card-content">
          <div class="card-header">
            <div class="card-name skeleton-shimmer"></div>
            <div class="card-author skeleton-shimmer"></div>
          </div>
          <div class="card-description skeleton-shimmer"></div>
          <div class="card-footer">
            <div class="card-stats skeleton-shimmer"></div>
            <div class="card-action skeleton-shimmer"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Cache de elementos DOM
   */
  cacheElements() {
    this.elements = {
      searchInput: this.container.querySelector('.search-input'),
      searchClear: this.container.querySelector('.search-clear'),
      extensionsGrid: this.container.querySelector('#extensions-grid'),
      loadingSkeleton: this.container.querySelector('#loading-skeleton'),
      emptyState: this.container.querySelector('#empty-state'),
      listView: this.container.querySelector('#list-view'),
      detailView: this.container.querySelector('#detail-view'),
      detailContent: this.container.querySelector('#detail-content'),
      listTitle: this.container.querySelector('.list-title'),
      extensionCount: this.container.querySelector('.extension-count'),
      installedCount: this.container.querySelector('.installed-count'),
      emptyQuery: this.container.querySelector('.empty-query'),
      backBtn: this.container.querySelector('.back-btn'),
      categoryButtons: this.container.querySelectorAll('.category-btn')
    };
  }

  /**
   * Adjuntar event listeners
   */
  attachEventListeners() {
    // Búsqueda
    this.elements.searchInput.addEventListener('input', this.handleSearch);
    this.elements.searchClear.addEventListener('click', this.handleClearSearch);
    
    // Categorías
    this.elements.categoryButtons.forEach(btn => {
      btn.addEventListener('click', this.handleCategoryClick);
    });
    
    // Navegación
    this.elements.backBtn.addEventListener('click', this.handleBackClick);
    
    // Delegación de eventos para tarjetas
    this.elements.extensionsGrid.addEventListener('click', this.handleExtensionClick);
    this.elements.extensionsGrid.addEventListener('click', this.handleInstallClick);
  }

  /**
   * Manejar búsqueda con debounce
   */
  handleSearch(event) {
    const query = event.target.value.trim();
    this.elements.searchClear.style.display = query ? 'block' : 'none';
    
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      if (query) {
        this.search(query);
      } else {
        this.loadCategory(this.currentCategory);
      }
    }, 300);
    
    this.currentQuery = query;
  }

  /**
   * Limpiar búsqueda
   */
  handleClearSearch() {
    this.elements.searchInput.value = '';
    this.elements.searchClear.style.display = 'none';
    this.currentQuery = '';
    this.loadCategory(this.currentCategory);
  }

  /**
   * Manejar click en categoría
   */
  handleCategoryClick(event) {
    const btn = event.currentTarget;
    const category = btn.dataset.category;
    
    // Actualizar estado visual
    this.elements.categoryButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    // Limpiar búsqueda
    this.elements.searchInput.value = '';
    this.elements.searchClear.style.display = 'none';
    this.currentQuery = '';
    
    // Cargar categoría
    this.loadCategory(category);
  }

  /**
   * Manejar click en extensión (mostrar detalle)
   */
  handleExtensionClick(event) {
    const card = event.target.closest('.extension-card');
    if (!card || event.target.closest('.install-btn')) return;
    
    const extensionId = card.dataset.extensionId;
    const extension = this.extensions.find(ext => `${ext.namespace}.${ext.name}` === extensionId);
    if (extension) {
      this.showDetail(extension);
    }
  }

  /**
   * Manejar click en botón de instalar
   */
  handleInstallClick(event) {
    const btn = event.target.closest('.install-btn');
    if (!btn) return;
    
    event.stopPropagation();
    const extensionId = btn.dataset.extensionId;
    const extension = this.extensions.find(ext => `${ext.namespace}.${ext.name}` === extensionId);
    if (extension) {
      this.toggleInstall(extension, btn);
    }
  }

  /**
   * Manejar click en botón de volver
   */
  handleBackClick() {
    this.hideDetail();
  }

  /**
   * Cargar categoría específica
   */
  async loadCategory(category) {
    this.currentCategory = category;
    
    if (category === 'installed') {
      this.showInstalled();
      return;
    }
    
    const categoryInfo = CATEGORIES.find(c => c.id === category);
    if (category === 'featured' || !categoryInfo?.query) {
      this.renderExtensions(FEATURED_EXTENSIONS);
      this.updateListHeader('Featured Extensions');
      return;
    }
    
    await this.search(categoryInfo.query);
    this.updateListHeader(categoryInfo.label);
  }

  /**
   * Buscar extensiones en Open VSX API
   */
  async search(query) {
    this.setLoading(true);
    
    try {
      const url = `${OPEN_VSX_API}/-/search?query=${encodeURIComponent(query)}&size=20&sortBy=downloadCount&sortOrder=desc`;
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(8000) 
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const extensions = (data.extensions || []).map(ext => this.normalizeExtension(ext));
      
      this.setLoading(false);
      
      if (extensions.length === 0) {
        this.showEmpty(query);
      } else {
        this.renderExtensions(extensions);
        this.updateListHeader(`Search results for "${query}"`);
      }
      
    } catch (error) {
      console.warn('Open VSX API failed, using fallback:', error.message);
      this.setLoading(false);
      
      // Fallback a búsqueda local en featured
      const fallback = FEATURED_EXTENSIONS.filter(ext =>
        ext.displayName.toLowerCase().includes(query.toLowerCase()) ||
        ext.description.toLowerCase().includes(query.toLowerCase()) ||
        ext.tags?.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      );
      
      if (fallback.length > 0) {
        this.renderExtensions(fallback);
        this.updateListHeader(`Search results for "${query}" (offline)`);
      } else {
        this.showEmpty(query);
      }
    }
  }

  /**
   * Normalizar extensión de la API
   */
  normalizeExtension(extension) {
    return {
      namespace: extension.namespace,
      name: extension.name,
      displayName: extension.displayName || extension.name,
      description: extension.description || '',
      version: extension.version || 'latest',
      downloadCount: extension.downloadCount || 0,
      averageRating: extension.averageRating || 0,
      icon: this.getExtensionIcon(extension),
      tags: extension.tags || [],
      categories: extension.categories || [],
      license: extension.license,
      repository: extension.repository,
      homepage: extension.homepage,
      readme: extension.readme,
      timestamp: extension.timestamp
    };
  }

  /**
   * Obtener ícono para extensión basado en tags y descripción
   */
  getExtensionIcon(extension) {
    const text = [
      ...(extension.tags || []),
      extension.description || '',
      extension.displayName || ''
    ].join(' ').toLowerCase();
    
    const iconMap = {
      'theme': '🎨',
      'python': '🐍',
      'java': '☕',
      'javascript': '🟨',
      'typescript': '🔷',
      'rust': '🦀',
      'go': '🐹',
      'git': '🔀',
      'docker': '🐳',
      'snippet': '✂️',
      'lint': '🔍',
      'format': '✨',
      'debug': '🐛',
      'html': '🌐',
      'css': '🎨',
      'vue': '💚',
      'react': '⚛️',
      'sql': '🗄️',
      'database': '🗄️'
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (text.includes(key)) return icon;
    }
    
    return '🔧';
  }

  /**
   * Renderizar lista de extensiones
   */
  renderExtensions(extensions) {
    this.extensions = extensions;
    this.elements.extensionsGrid.innerHTML = '';
    
    extensions.forEach(extension => {
      const card = this.createExtensionCard(extension);
      this.elements.extensionsGrid.appendChild(card);
    });
    
    this.updateExtensionCount(extensions.length);
  }

  /**
   * Crear tarjeta de extensión
   */
  createExtensionCard(extension) {
    const id = `${extension.namespace}.${extension.name}`;
    const isInstalled = this.installedExtensions.has(id);
    
    const card = document.createElement('div');
    card.className = `extension-card ${isInstalled ? 'installed' : ''}`;
    card.dataset.extensionId = id;
    
    card.innerHTML = `
      <div class="card-icon">
        <img src="${extension.iconUrl || ''}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <span class="fallback-icon">${extension.icon}</span>
      </div>
      <div class="card-content">
        <div class="card-header">
          <h3 class="card-name" title="${this.escapeHtml(extension.displayName)}">
            ${this.escapeHtml(extension.displayName)}
          </h3>
          <div class="card-author" title="${extension.namespace}">
            ${this.escapeHtml(extension.namespace)}
          </div>
        </div>
        <p class="card-description" title="${this.escapeHtml(extension.description)}">
          ${this.escapeHtml(this.truncateText(extension.description, 120))}
        </p>
        <div class="card-footer">
          <div class="card-stats">
            <span class="stat-item">
              <span class="stat-icon">⬇</span>
              <span class="stat-value">${this.formatNumber(extension.downloadCount)}</span>
            </span>
            <span class="stat-item">
              <span class="stat-icon">★</span>
              <span class="stat-value">${(extension.averageRating || 0).toFixed(1)}</span>
            </span>
          </div>
          <button class="install-btn ${isInstalled ? 'installed' : ''}" data-extension-id="${id}">
            ${isInstalled ? '✓ Installed' : 'Install'}
          </button>
        </div>
      </div>
    `;
    
    return card;
  }

  /**
   * Mostrar detalle de extensión
   */
  showDetail(extension) {
    this.selectedExtension = extension;
    const id = `${extension.namespace}.${extension.name}`;
    const isInstalled = this.installedExtensions.has(id);
    
    this.elements.detailContent.innerHTML = `
      <div class="detail-hero">
        <div class="detail-icon">
          <img src="${extension.iconUrl || ''}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
          <span class="fallback-icon">${extension.icon}</span>
        </div>
        <div class="detail-info">
          <h1 class="detail-name">${this.escapeHtml(extension.displayName)}</h1>
          <div class="detail-meta">
            <span class="detail-author">by ${this.escapeHtml(extension.namespace)}</span>
            <span class="detail-separator">•</span>
            <span class="detail-version">v${extension.version}</span>
            <span class="detail-separator">•</span>
            <span class="detail-rating">★ ${(extension.averageRating || 0).toFixed(1)}</span>
            <span class="detail-separator">•</span>
            <span class="detail-downloads">⬇ ${this.formatNumber(extension.downloadCount)}</span>
          </div>
          ${extension.categories?.length ? `
            <div class="detail-categories">
              ${extension.categories.slice(0, 5).map(cat => `
                <span class="category-chip">${this.escapeHtml(cat)}</span>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="detail-actions">
        <button class="detail-install-btn ${isInstalled ? 'installed' : ''}" data-extension-id="${id}">
          ${isInstalled ? '🗑️ Uninstall' : '⬇️ Install'}
        </button>
        ${extension.repository ? `
          <a href="${extension.repository}" target="_blank" class="detail-link-btn">
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            Repository
          </a>
        ` : ''}
        ${extension.homepage ? `
          <a href="${extension.homepage}" target="_blank" class="detail-link-btn">
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8a7 7 0 1 1-14 0 7 7 0 0 1 14 0z"/>
              <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
            </svg>
            Homepage
          </a>
        ` : ''}
      </div>
      
      <div class="detail-description">
        <h2>Description</h2>
        <p>${this.escapeHtml(extension.description)}</p>
      </div>
      
      ${extension.readme ? `
        <div class="detail-readme">
          <h2>README</h2>
          <div class="readme-content">
            ${this.renderMarkdown(extension.readme)}
          </div>
        </div>
      ` : ''}
      
      ${extension.tags?.length ? `
        <div class="detail-tags">
          <h2>Tags</h2>
          <div class="tags-list">
            ${extension.tags.map(tag => `
              <span class="tag-chip">${this.escapeHtml(tag)}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="detail-stats">
        <h2>Statistics</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Downloads</div>
            <div class="stat-value">${extension.downloadCount.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Rating</div>
            <div class="stat-value">${this.renderStars(extension.averageRating || 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Version</div>
            <div class="stat-value">${extension.version}</div>
          </div>
          ${extension.license ? `
            <div class="stat-card">
              <div class="stat-label">License</div>
              <div class="stat-value">${this.escapeHtml(extension.license)}</div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="detail-note">
        <strong>ℹ️ About this extension</strong>
        <p>This extension is provided by the <strong>Open VSX Registry</strong>, the open-source marketplace compatible with VS Code, used by VSCodium, Gitpod, and Eclipse Theia.</p>
        <p>Themes are applied immediately. Other extensions may require additional integration.</p>
      </div>
    `;
    
    // Adjuntar eventos del detalle
    const installBtn = this.elements.detailContent.querySelector('.detail-install-btn');
    installBtn.addEventListener('click', () => {
      this.toggleInstall(extension, installBtn);
    });
    
    // Mostrar vista de detalle
    this.elements.listView.style.display = 'none';
    this.elements.detailView.style.display = 'block';
  }

  /**
   * Ocultar vista de detalle
   */
  hideDetail() {
    this.elements.listView.style.display = 'block';
    this.elements.detailView.style.display = 'none';
    this.selectedExtension = null;
  }

  /**
   * Toggle instalar/desinstalar extensión
   */
  async toggleInstall(extension, button) {
    const id = `${extension.namespace}.${extension.name}`;
    const isInstalling = button.classList.contains('installing');
    
    if (isInstalling) return;
    
    if (this.installedExtensions.has(id)) {
      // Desinstalar
      button.classList.add('installing');
      button.textContent = '⏳ Uninstalling...';
      button.disabled = true;
      
      try {
        await this.uninstallExtension(extension);
        this.installedExtensions.delete(id);
        this.saveInstalledExtensions();
        this.updateInstalledCount();
        
        // Actualizar UI
        button.classList.remove('installing', 'installed');
        button.textContent = '⬇️ Install';
        button.disabled = false;
        
        // Actualizar tarjeta si existe
        const card = this.container.querySelector(`[data-extension-id="${id}"]`);
        if (card) {
          card.classList.remove('installed');
          const cardBtn = card.querySelector('.install-btn');
          if (cardBtn) {
            cardBtn.classList.remove('installed');
            cardBtn.textContent = 'Install';
          }
        }
        
        this.showToast(`${extension.displayName} uninstalled successfully`);
        
      } catch (error) {
        button.classList.remove('installing');
        button.textContent = '🗑️ Uninstall';
        button.disabled = false;
        this.showToast(`Failed to uninstall: ${error.message}`, true);
      }
      
    } else {
      // Instalar
      button.classList.add('installing');
      button.textContent = '⏳ Installing...';
      button.disabled = true;
      
      try {
        await this.installExtension(extension);
        this.installedExtensions.add(id);
        this.saveInstalledExtensions();
        this.updateInstalledCount();
        
        // Actualizar UI
        button.classList.remove('installing');
        button.classList.add('installed');
        button.textContent = '🗑️ Uninstall';
        button.disabled = false;
        
        // Actualizar tarjeta si existe
        const card = this.container.querySelector(`[data-extension-id="${id}"]`);
        if (card) {
          card.classList.add('installed');
          const cardBtn = card.querySelector('.install-btn');
          if (cardBtn) {
            cardBtn.classList.add('installed');
            cardBtn.textContent = '✓ Installed';
          }
        }
        
        this.showToast(`✓ ${extension.displayName} installed successfully`);
        
      } catch (error) {
        button.classList.remove('installing');
        button.textContent = '⬇️ Install';
        button.disabled = false;
        this.showToast(`Failed to install: ${error.message}`, true);
      }
    }
  }

  /**
   * Instalar extensión (integración con Electron)
   */
  async installExtension(extension) {
    // Llamar a la API de Electron si está disponible
    if (window.api?.installExtension) {
      await window.api.installExtension(extension.namespace, extension.name, extension.version);
    } else {
      // Simulación para desarrollo
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // Aplicar efectos locales según tipo
    await this.applyExtensionEffects(extension);
  }

  /**
   * Desinstalar extensión (integración con Electron)
   */
  async uninstallExtension(extension) {
    // Llamar a la API de Electron si está disponible
    if (window.api?.uninstallExtension) {
      await window.api.uninstallExtension(extension.namespace, extension.name);
    } else {
      // Simulación para desarrollo
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    
    // Remover efectos locales
    this.removeExtensionEffects(extension);
  }

  /**
   * Aplicar efectos locales de la extensión
   */
  async applyExtensionEffects(extension) {
    const tags = (extension.tags || []).join(' ').toLowerCase();
    const name = extension.displayName.toLowerCase();
    
    // Temas
    if (tags.includes('theme') || name.includes('theme')) {
      this.applyTheme(extension);
    }
    
    // Snippets
    if (tags.includes('snippet')) {
      await this.applySnippets(extension);
    }
    
    // Otros tipos pueden requerir integración adicional
  }

  /**
   * Remover efectos locales de la extensión
   */
  removeExtensionEffects(extension) {
    const tags = (extension.tags || []).join(' ').toLowerCase();
    const name = extension.displayName.toLowerCase();
    
    if (tags.includes('theme') || name.includes('theme')) {
      this.removeTheme(extension);
    }
  }

  /**
   * Aplicar tema al editor
   */
  applyTheme(extension) {
    if (!this.state.monacoRef) return;
    
    const name = extension.displayName.toLowerCase();
    let theme = 'vs-dark';
    
    if (name.includes('light') || name.includes('white')) {
      theme = 'vs';
    } else if (name.includes('high contrast') || name.includes('hc')) {
      theme = 'hc-black';
    }
    
    this.state.monacoRef.editor.setTheme(theme);
    this.showToast(`🎨 Theme "${extension.displayName}" applied`);
  }

  /**
   * Remover tema del editor
   */
  removeTheme(extension) {
    if (this.state.monacoRef) {
      this.state.monacoRef.editor.setTheme('myide-dark');
    }
  }

  /**
   * Aplicar snippets (simulación)
   */
  async applySnippets(extension) {
    if (!this.state.monacoRef) return;
    
    // Simulación - en producción se cargarían snippets reales
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Mostrar extensiones instaladas
   */
  showInstalled() {
    this.updateListHeader('Installed Extensions');
    
    if (this.installedExtensions.size === 0) {
      this.elements.extensionsGrid.innerHTML = `
        <div class="empty-installed">
          <div class="empty-icon">📦</div>
          <h3>No extensions installed</h3>
          <p>Browse categories to find and install extensions</p>
        </div>
      `;
      this.updateExtensionCount(0);
      return;
    }
    
    const installed = [...this.installedExtensions].map(id => {
      const [namespace, ...nameParts] = id.split('.');
      const name = nameParts.join('.');
      
      // Buscar en extensions cargadas o featured
      const extension = this.extensions.find(ext => 
        ext.namespace === namespace && ext.name === name
      ) || FEATURED_EXTENSIONS.find(ext => 
        ext.namespace === namespace && ext.name === name
      );
      
      if (extension) return extension;
      
      // Crear entrada básica si no se encuentra
      return {
        namespace,
        name,
        displayName: id,
        description: 'Installed extension',
        version: 'latest',
        downloadCount: 0,
        averageRating: 0,
        icon: '🔧',
        tags: []
      };
    });
    
    this.renderExtensions(installed);
  }

  /**
   * Cargar extensiones instaladas desde localStorage/Electron
   */
  async loadInstalledExtensions() {
    try {
      // Intentar cargar desde Electron API
      if (window.api?.getInstalledExtensions) {
        const installed = await window.api.getInstalledExtensions();
        this.installedExtensions = new Set(installed);
      } else {
        // Fallback a localStorage
        const stored = localStorage.getItem('ide-installed-extensions');
        if (stored) {
          this.installedExtensions = new Set(JSON.parse(stored));
        }
      }
    } catch (error) {
      console.warn('Failed to load installed extensions:', error);
      // Fallback a localStorage
      const stored = localStorage.getItem('ide-installed-extensions');
      if (stored) {
        this.installedExtensions = new Set(JSON.parse(stored));
      }
    }
    
    this.updateInstalledCount();
  }

  /**
   * Guardar extensiones instaladas
   */
  saveInstalledExtensions() {
    try {
      // Guardar en localStorage como fallback
      localStorage.setItem('ide-installed-extensions', 
        JSON.stringify([...this.installedExtensions])
      );
    } catch (error) {
      console.warn('Failed to save installed extensions:', error);
    }
  }

  /**
   * Actualizar contador de instaladas
   */
  updateInstalledCount() {
    if (this.elements.installedCount) {
      this.elements.installedCount.textContent = this.installedExtensions.size;
    }
  }

  /**
   * Actualizar contador de extensiones
   */
  updateExtensionCount(count) {
    if (this.elements.extensionCount) {
      this.elements.extensionCount.textContent = `${count} extension${count !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Actualizar título de lista
   */
  updateListHeader(title) {
    if (this.elements.listTitle) {
      this.elements.listTitle.textContent = title;
    }
  }

  /**
   * Mostrar estado de carga
   */
  setLoading(loading) {
    this.loading = loading;
    
    if (loading) {
      this.elements.loadingSkeleton.style.display = 'grid';
      this.elements.extensionsGrid.style.display = 'none';
      this.elements.emptyState.style.display = 'none';
    } else {
      this.elements.loadingSkeleton.style.display = 'none';
      this.elements.extensionsGrid.style.display = 'grid';
    }
  }

  /**
   * Mostrar estado vacío
   */
  showEmpty(query) {
    this.elements.extensionsGrid.style.display = 'none';
    this.elements.loadingSkeleton.style.display = 'none';
    this.elements.emptyState.style.display = 'block';
    
    if (this.elements.emptyQuery) {
      this.elements.emptyQuery.textContent = query;
    }
    
    this.updateExtensionCount(0);
  }

  /**
   * Mostrar toast notification
   */
  showToast(message, isError = false) {
    // Eliminar toast existente
    const existing = document.querySelector('.extension-toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `extension-toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Auto-remover después de 3.5 segundos
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }

  /**
   * Renderizar estrellas
   */
  renderStars(rating) {
    const fullStars = Math.round(rating);
    const emptyStars = 5 - fullStars;
    
    return '<span class="stars">' + 
      '★'.repeat(fullStars) + 
      '☆'.repeat(emptyStars) + 
      '</span>';
  }

  /**
   * Renderizar markdown básico
   */
  renderMarkdown(text) {
    if (!text) return '';
    
    return this.escapeHtml(text)
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code class="language-${lang || 'plaintext'}">${this.escapeHtml(code.trim())}</code></pre>`;
      })
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
      .replace(/^[-*]\s(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Formatear número
   */
  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return Math.round(num / 1000) + 'K';
    return String(num);
  }

  /**
   * Truncar texto
   */
  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + '…';
  }

  /**
   * Escapar HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
}

// Exportar función de compatibilidad
export function createExtensionsStore(container, state) {
  const store = new ExtensionStore(container, state);
  return store.mount();
}
