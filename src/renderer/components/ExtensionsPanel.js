// src/renderer/components/ExtensionsPanel.js
// Tienda de Extensiones conectada a VS Code Marketplace vía IPC

const CATEGORIES = [
  { id: 'featured', label: '⭐ Featured', query: '', icon: '⭐' },
  { id: 'themes', label: '🎨 Themes', query: 'tag:theme', icon: '🎨' },
  { id: 'languages', label: '💻 Languages', query: 'category:programming languages', icon: '💻' },
  { id: 'snippets', label: '✂️ Snippets', query: 'tag:snippet', icon: '✂️' },
  { id: 'linters', label: '🔍 Linters', query: 'tag:linters', icon: '🔍' },
  { id: 'formatters', label: '✨ Formatters', query: 'category:formatters', icon: '✨' },
  { id: 'other', label: '🔧 Other', query: '', icon: '🔧' }
];

export class ExtensionsPanel {
  constructor(container, state = {}) {
    this.container = container;
    this.state = state;
    
    // Estado interno
    this.currentCategory = 'featured';
    this.currentQuery = '';
    this.selectedExtension = null;
    this.extensions = [];
    this.installedExtensions = new Map(); // Para almacenar { publisher.name -> info }
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

  async loadInstalledExtensions() {
    try {
      const installed = await window.api.marketplaceInstalled();
      this.installedExtensions.clear();
      installed.forEach(ext => {
        this.installedExtensions.set(ext.id, ext); // id is "publisher.name"
      });
      this.updateInstalledCount();
    } catch (e) {
      console.error('Error loading installed extensions:', e);
    }
  }

  mount() {
    this.render();
    this.cacheElements();
    this.attachEventListeners();
    this.loadCategory('featured');
    return this;
  }

  refresh() {
    this.loadInstalledExtensions().then(() => {
      if (this.currentQuery) {
        this.search(this.currentQuery);
      } else {
        this.loadCategory(this.currentCategory);
      }
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="extension-store">
        <div class="store-header">
          <div class="search-container">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input 
                type="text" 
                class="search-input" 
                placeholder="Search extensions in VS Code Marketplace..."
                autocomplete="off"
              />
              <button class="search-clear" style="display: none;">×</button>
            </div>
            <div class="search-source">
              <span>🛒</span>
              <span>VS Code Marketplace</span>
            </div>
          </div>
        </div>

        <div class="store-layout">
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

          <div class="store-content">
            <div class="store-list-view" id="list-view">
              <div class="list-header">
                <h2 class="list-title">Featured Extensions</h2>
                <div class="list-stats">
                  <span class="extension-count">0 extensions</span>
                </div>
              </div>
              
              <div class="extensions-grid" id="extensions-grid"></div>

              <div class="loading-skeleton" id="loading-skeleton" style="display: none;">
                <div class="store-spinner" style="margin: 2rem auto; width: 40px; height: 40px; border: 4px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div style="text-align:center; color: var(--text2)">Loading...</div>
              </div>

              <div class="empty-state" id="empty-state" style="display: none;">
                <div class="empty-icon">🔍</div>
                <h3>No extensions found</h3>
                <p>No results for "<span class="empty-query"></span>"</p>
                <p>Try different keywords or browse categories</p>
              </div>
            </div>

            <div class="store-detail-view" id="detail-view" style="display: none;">
              <div class="detail-header">
                <button class="back-btn">← Back to extensions</button>
              </div>
              <div class="detail-content" id="detail-content"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

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

  attachEventListeners() {
    this.elements.searchInput.addEventListener('input', this.handleSearch);
    this.elements.searchClear.addEventListener('click', this.handleClearSearch);
    
    this.elements.categoryButtons.forEach(btn => {
      btn.addEventListener('click', this.handleCategoryClick);
    });
    
    this.elements.backBtn.addEventListener('click', this.handleBackClick);
    
    this.elements.extensionsGrid.addEventListener('click', this.handleExtensionClick);
    this.elements.extensionsGrid.addEventListener('click', this.handleInstallClick);
  }

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
    }, 500);
    
    this.currentQuery = query;
  }

  handleClearSearch() {
    this.elements.searchInput.value = '';
    this.elements.searchClear.style.display = 'none';
    this.currentQuery = '';
    this.loadCategory(this.currentCategory);
  }

  handleCategoryClick(event) {
    const btn = event.currentTarget;
    const category = btn.dataset.category;
    
    this.elements.categoryButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    this.elements.searchInput.value = '';
    this.elements.searchClear.style.display = 'none';
    this.currentQuery = '';
    
    this.loadCategory(category);
  }

  handleExtensionClick(event) {
    const card = event.target.closest('.extension-card');
    if (!card || event.target.closest('.install-btn')) return;
    
    const extensionId = card.dataset.extensionId;
    const extension = this.extensions.find(ext => ext._id === extensionId);
    if (extension) {
      this.showDetailReal(extension.publisher.publisherName, extension.extensionName);
    }
  }

  handleInstallClick(event) {
    const btn = event.target.closest('.install-btn');
    if (!btn) return;
    
    event.stopPropagation();
    const extensionId = btn.dataset.extensionId;
    // Búsqueda en caché local 
    let extension = this.extensions.find(ext => ext._id === extensionId);
    
    // Si no está en this.extensions, pero está instalada
    if (!extension && this.installedExtensions.has(extensionId)) {
        const info = this.installedExtensions.get(extensionId);
        extension = {
            publisher: { publisherName: info.publisher },
            extensionName: info.name,
            versions: [{version: info.version}],
            displayName: info.name,
            _id: extensionId
        };
    }
    
    if (extension) {
      this.toggleInstall(extension, btn);
    }
  }

  handleBackClick() {
    this.hideDetail();
  }

  async loadCategory(category) {
    this.currentCategory = category;
    
    if (category === 'installed') {
      this.showInstalled();
      return;
    }
    
    const categoryInfo = CATEGORIES.find(c => c.id === category);
    this.updateListHeader(categoryInfo?.label || 'Extensions');
    
    await this.search(categoryInfo?.query || '');
  }

  async showInstalled() {
    this.updateListHeader('Installed Extensions');
    await this.loadInstalledExtensions();
    
    if (this.installedExtensions.size === 0) {
        this.showEmpty('Installed');
        return;
    }

    this.setLoading(true);
    
    // Convert current installed map to UI format mimicking marketplace
    const exts = Array.from(this.installedExtensions.values()).map(info => {
       return {
           _id: info.id,
           publisher: { publisherName: info.publisher, displayName: info.publisher },
           extensionName: info.name,
           displayName: info.name,
           shortDescription: 'Local extension',
           versions: [{ version: info.version }],
           statistics: []
       };
    });
    
    this.setLoading(false);
    this.renderExtensions(exts);
  }

  async search(query) {
    this.setLoading(true);
    try {
      const results = await window.api.marketplaceSearch(query);
      
      const normalized = results.map(ext => {
          ext._id = `${ext.publisher.publisherName}.${ext.extensionName}`;
          return ext;
      });
      
      this.setLoading(false);
      
      if (normalized.length === 0) {
        this.showEmpty(query);
      } else {
        this.renderExtensions(normalized);
        if (this.currentCategory !== 'installed') {
           this.updateListHeader(query ? `Search results for "${query}"` : 'Extensions');
        }
      }
    } catch (error) {
      console.error('Marketplace search failed:', error);
      this.setLoading(false);
      this.showEmpty(query);
    }
  }

  setLoading(isLoading) {
    this.loading = isLoading;
    this.elements.loadingSkeleton.style.display = isLoading ? 'block' : 'none';
    this.elements.extensionsGrid.style.display = isLoading ? 'none' : 'grid';
    this.elements.emptyState.style.display = 'none';
    if (!isLoading) {
        this.elements.listView.style.display = 'block';
        this.elements.detailView.style.display = 'none';
    }
  }

  showEmpty(query) {
    this.elements.extensionsGrid.style.display = 'none';
    this.elements.loadingSkeleton.style.display = 'none';
    this.elements.emptyState.style.display = 'flex';
    this.elements.emptyQuery.textContent = query || 'this category';
    this.updateExtensionCount(0);
  }

  renderExtensions(extensions) {
    this.extensions = extensions;
    this.elements.extensionsGrid.innerHTML = '';
    
    extensions.forEach(extension => {
      const card = this.createExtensionCard(extension);
      this.elements.extensionsGrid.appendChild(card);
    });
    
    this.elements.extensionsGrid.style.display = 'grid';
    this.updateExtensionCount(extensions.length);
  }

  getStat(extension, name) {
      if (!extension.statistics) return 0;
      const stat = extension.statistics.find(s => s.statisticName === name);
      return stat ? stat.value : 0;
  }

  createExtensionCard(extension) {
    const id = extension._id;
    const isInstalled = this.installedExtensions.has(id);
    
    let iconUrl = '';
    const iconVersion = extension.versions?.[0];
    if (iconVersion && iconVersion.files) {
        const iconFile = iconVersion.files.find(f => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Default');
        if (iconFile) iconUrl = iconFile.source;
    }

    const card = document.createElement('div');
    card.className = `extension-card ${isInstalled ? 'installed' : ''}`;
    card.dataset.extensionId = id;
    
    const downloads = this.getStat(extension, 'install');
    const rating = this.getStat(extension, 'averagerating');
    
    card.innerHTML = `
      <div class="card-icon">
        <img src="${iconUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <span class="fallback-icon">🔧</span>
      </div>
      <div class="card-content">
        <div class="card-header">
          <h3 class="card-name" title="${this.escape(extension.displayName)}">
            ${this.escape(extension.displayName)}
          </h3>
          <div class="card-author" title="${this.escape(extension.publisher.publisherName)}">
            ${this.escape(extension.publisher.displayName || extension.publisher.publisherName)}
          </div>
        </div>
        <p class="card-description" title="${this.escape(extension.shortDescription)}">
          ${this.escape(this.truncate(extension.shortDescription, 100))}
        </p>
        <div class="card-footer">
          <div class="card-stats">
            <span class="stat-item">
              <span class="stat-icon">⬇</span>
              <span class="stat-value">${this.fmtNum(downloads)}</span>
            </span>
            <span class="stat-item">
              <span class="stat-icon">★</span>
              <span class="stat-value">${rating.toFixed(1)}</span>
            </span>
          </div>
          <button class="install-btn store-btn ${isInstalled ? 'store-btn--uninstall installed' : 'store-btn--install'}" data-extension-id="${id}">
            ${isInstalled ? 'Uninstall' : 'Install'}
          </button>
        </div>
      </div>
    `;
    
    return card;
  }

  async showDetailReal(publisher, name) {
      this.setLoading(true);
      try {
          const extension = await window.api.marketplaceDetails(publisher, name);
          extension._id = `${extension.publisher.publisherName}.${extension.extensionName}`;
          this.setLoading(false);
          this.showDetail(extension);
      } catch (e) {
          this.setLoading(false);
          this.toast('Error loading extension details', true);
      }
  }

  showDetail(extension) {
    this.selectedExtension = extension;
    const id = extension._id;
    const isInstalled = this.installedExtensions.has(id);
    
    let iconUrl = '';
    const iconVersion = extension.versions?.[0];
    const versionStr = iconVersion ? iconVersion.version : '?';
    if (iconVersion && iconVersion.files) {
        const iconFile = iconVersion.files.find(f => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Default');
        if (iconFile) iconUrl = iconFile.source;
    }

    const downloads = this.getStat(extension, 'install');
    const rating = this.getStat(extension, 'averagerating');

    this.elements.detailContent.innerHTML = `
      <div class="detail-hero">
        <div class="detail-icon">
          <img src="${iconUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" style="width:72px; height:72px;">
          <span class="fallback-icon">🔧</span>
        </div>
        <div class="detail-info">
          <h1 class="detail-name">${this.escape(extension.displayName)}</h1>
          <div class="detail-meta">
            <span class="detail-author">by ${this.escape(extension.publisher.displayName || extension.publisher.publisherName)}</span>
            <span class="detail-separator">•</span>
            <span class="detail-version">v${versionStr}</span>
            <span class="detail-separator">•</span>
            <span class="detail-rating">★ ${rating.toFixed(1)}</span>
            <span class="detail-separator">•</span>
            <span class="detail-downloads">⬇ ${this.fmtNum(downloads)}</span>
          </div>
        </div>
      </div>
      
      <div class="detail-actions" style="margin: 1rem 0;">
        <button class="detail-install-btn store-btn ${isInstalled ? 'store-btn--uninstall installed' : 'store-btn--install'}" data-extension-id="${id}">
          ${isInstalled ? '🗑️ Uninstall' : '⬇️ Install'}
        </button>
      </div>
      
      <div class="detail-description">
        <p>${this.escape(extension.shortDescription)}</p>
      </div>
      
      ${extension.readmeContent ? `
        <div class="detail-readme" style="margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1rem;">
          <h2>README</h2>
          <div class="readme-content" style="max-height: 50vh; overflow-y: auto; padding: 1rem; background: var(--bg2); border-radius: 4px;">
            ${extension.readmeContent} <!-- Note: typically you need a Markdown parser here. -->
          </div>
        </div>
      ` : ''}
    `;
    
    const installBtn = this.elements.detailContent.querySelector('.detail-install-btn');
    installBtn.addEventListener('click', () => {
      this.toggleInstall(extension, installBtn);
    });
    
    this.elements.listView.style.display = 'none';
    this.elements.detailView.style.display = 'block';
  }

  hideDetail() {
    this.elements.listView.style.display = 'block';
    this.elements.detailView.style.display = 'none';
    this.selectedExtension = null;
  }

  async toggleInstall(extension, button) {
    const id = extension._id;
    const isInstalling = button.disabled;
    if (isInstalling) return;
    
    if (this.installedExtensions.has(id)) {
      // Uninstall
      button.textContent = '⏳ Uninstalling...';
      button.disabled = true;
      
      try {
        await window.api.marketplaceUninstall(extension.publisher.publisherName, extension.extensionName);
        this.installedExtensions.delete(id);
        this.updateInstalledCount();
        
        button.className = 'store-btn store-btn--install install-btn detail-install-btn';
        button.textContent = '⬇️ Install';
        button.disabled = false;
        
        const card = this.container.querySelector(`[data-extension-id="${id}"]`);
        if (card) {
          card.classList.remove('installed');
          const cardBtn = card.querySelector('.install-btn');
          if (cardBtn) {
            cardBtn.className = 'store-btn store-btn--install install-btn';
            cardBtn.textContent = 'Install';
          }
        }
        
        this.toast(`✓ Uninstalled ${extension.displayName}`);
        
        // Refrescar si estamos en "installed"
        if (this.currentCategory === 'installed') this.showInstalled();
        
      } catch (error) {
        console.error(error);
        button.textContent = '🗑️ Uninstall';
        button.disabled = false;
        this.toast(`Failed to uninstall: ${error.message}`, true);
      }
      
    } else {
      // Install
      button.textContent = '⏳ Installing...';
      button.disabled = true;
      
      try {
        const version = extension.versions?.[0]?.version;
        const meta = await window.api.marketplaceInstall(extension.publisher.publisherName, extension.extensionName, version);
        
        this.installedExtensions.set(id, meta);
        this.updateInstalledCount();
        
        button.className = 'store-btn store-btn--uninstall installed install-btn detail-install-btn';
        button.textContent = '🗑️ Uninstall';
        button.disabled = false;
        
        const card = this.container.querySelector(`[data-extension-id="${id}"]`);
        if (card) {
          card.classList.add('installed');
          const cardBtn = card.querySelector('.install-btn');
          if (cardBtn) {
            cardBtn.className = 'store-btn store-btn--uninstall installed install-btn';
            cardBtn.textContent = 'Uninstall';
          }
        }
        
        this.toast(`✓ ${extension.displayName} installed successfully`);
      } catch (error) {
        console.error(error);
        button.textContent = 'Install';
        button.disabled = false;
        this.toast(`Failed to install: ${error.message}`, true);
      }
    }
  }

  updateListHeader(title) {
    this.elements.listTitle.textContent = title;
  }

  updateExtensionCount(count) {
    this.elements.extensionCount.textContent = `${count} extensions`;
  }

  updateInstalledCount() {
    if (this.elements.installedCount) {
      this.elements.installedCount.textContent = this.installedExtensions.size;
    }
  }

  escape(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  truncate(str, length) {
      if (!str) return '';
      if (str.length <= length) return str;
      return str.substring(0, length) + '...';
  }

  fmtNum(n) {
      if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
      if (n >= 1000) return (n/1000).toFixed(1)+'K';
      return String(n);
  }

  toast(msg, isErr = false) {
      const existing = document.querySelector('.ide-toast');
      if (existing) existing.remove();
      const el = document.createElement('div');
      el.className = `ide-toast${isErr ? ' ide-toast--error' : ''}`;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3500);
  }
}

export function createExtensionsPanel(container, state) {
    const panel = new ExtensionsPanel(container, state);
    return panel.mount();
}
