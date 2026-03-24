const { VSCodeMarketplaceService } = require('vscode-marketplace-client');
const fs = require('fs-extra');
const path = require('path');
const { ipcMain } = require('electron');
const { app } = require('electron');
const yauzl = require('yauzl');

class MarketplaceService {
  constructor() {
    this.client = new VSCodeMarketplaceService();
    this.extensionsDir = path.join(app.getPath('userData'), 'extensions');
    this.extensionsDbPath = path.join(this.extensionsDir, 'extensions-db.json');
    this.tempDir = path.join(app.getPath('temp'), 'myide-extensions');
    
    this.ensureDirectories();
  }

  async ensureDirectories() {
    await fs.ensureDir(this.extensionsDir);
    await fs.ensureDir(this.tempDir);
  }

  async searchExtensions(query, pageSize = 50, pageNumber = 1) {
    try {
      const flags = 1 | 256 | 512; // IncludeVersions | IncludeStatistics | IncludeFiles
      const result = await this.client.queryExtensions({
        searchText: query,
        pageSize,
        pageNumber,
        flags
      });
      
      return {
        extensions: result.extensions.map(ext => ({
          extensionId: ext.extensionId,
          extensionName: ext.extensionName,
          displayName: ext.displayName,
          publisher: ext.publisher,
          description: ext.shortDescription,
          versions: ext.versions,
          statistics: ext.statistics,
          tags: ext.tags,
          releaseDate: ext.releaseDate,
          lastUpdated: ext.lastUpdated,
          categories: ext.categories,
          flags: ext.flags
        })),
        totalCount: result.resultMetadata?.[0]?.resultCount || 0
      };
    } catch (error) {
      console.error('Error searching extensions:', error);
      throw error;
    }
  }

  async getExtensionDetails(publisher, name) {
    try {
      const extensionId = `${publisher}.${name}`;
      const flags = 1 | 256 | 512 | 2048 | 4096; // IncludeVersions | IncludeStatistics | IncludeFiles | IncludeVersionProperties | IncludeAssetUri
      const result = await this.client.queryExtensions({
        extensionId,
        flags
      });
      
      if (!result.extensions || result.extensions.length === 0) {
        throw new Error('Extension not found');
      }
      
      const extension = result.extensions[0];
      return {
        extensionId: extension.extensionId,
        extensionName: extension.extensionName,
        displayName: extension.displayName,
        publisher: extension.publisher,
        description: extension.description || extension.shortDescription,
        versions: extension.versions,
        statistics: extension.statistics,
        tags: extension.tags,
        releaseDate: extension.releaseDate,
        lastUpdated: extension.lastUpdated,
        categories: extension.categories,
        flags: extension.flags,
        assetUri: extension.assetUri
      };
    } catch (error) {
      console.error('Error getting extension details:', error);
      throw error;
    }
  }

  async downloadExtension(publisher, name, version = 'latest') {
    try {
      const extensionId = `${publisher}.${name}`;
      const extension = await this.getExtensionDetails(publisher, name);
      
      let targetVersion;
      if (version === 'latest') {
        targetVersion = extension.versions[0];
      } else {
        targetVersion = extension.versions.find(v => v.version === version);
        if (!targetVersion) {
          throw new Error(`Version ${version} not found`);
        }
      }
      
      const assetUri = targetVersion.assetUri;
      const downloadUrl = `${assetUri}&publish=true&vscodeVersion=1.85.0`;
      
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      const fileName = `${extensionId}-${targetVersion.version}.vsix`;
      const filePath = path.join(this.tempDir, fileName);
      
      await fs.writeFile(filePath, Buffer.from(buffer));
      return filePath;
    } catch (error) {
      console.error('Error downloading extension:', error);
      throw error;
    }
  }

  async installExtension(vsixPath) {
    try {
      const extensionDir = await this.extractVsix(vsixPath);
      const manifest = await this.readExtensionManifest(extensionDir);
      
      const extensionId = `${manifest.publisher}.${manifest.name}`;
      const targetDir = path.join(this.extensionsDir, extensionId);
      
      // Remove existing installation if it exists
      if (await fs.pathExists(targetDir)) {
        await fs.remove(targetDir);
      }
      
      await fs.move(extensionDir, targetDir);
      
      // Update extensions database
      await this.updateExtensionsDatabase({
        extensionId,
        name: manifest.name,
        publisher: manifest.publisher,
        version: manifest.version,
        description: manifest.description,
        installedAt: new Date().toISOString(),
        manifest
      });
      
      await fs.remove(vsixPath); // Clean up temp file
      return { extensionId, version: manifest.version };
    } catch (error) {
      console.error('Error installing extension:', error);
      throw error;
    }
  }

  async extractVsix(vsixPath) {
    return new Promise((resolve, reject) => {
      const extractDir = path.join(this.tempDir, `extract-${Date.now()}`);
      
      yauzl.open(vsixPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          reject(err);
          return;
        }
        
        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
          } else {
            const filePath = path.join(extractDir, entry.fileName);
            fs.ensureDir(path.dirname(filePath))
              .then(() => {
                zipfile.openReadStream(entry, (err, readStream) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  readStream.pipe(fs.createWriteStream(filePath));
                  readStream.on('end', () => zipfile.readEntry());
                });
              })
              .catch(reject);
          }
        });
        
        zipfile.on('end', () => resolve(extractDir));
        zipfile.on('error', reject);
      });
    });
  }

  async readExtensionManifest(extensionDir) {
    const manifestPath = path.join(extensionDir, 'extension', 'package.json');
    if (!(await fs.pathExists(manifestPath))) {
      throw new Error('Extension manifest not found');
    }
    
    return await fs.readJson(manifestPath);
  }

  async updateExtensionsDatabase(extensionData) {
    let extensions = [];
    
    if (await fs.pathExists(this.extensionsDbPath)) {
      extensions = await fs.readJson(this.extensionsDbPath);
    }
    
    const existingIndex = extensions.findIndex(ext => ext.extensionId === extensionData.extensionId);
    if (existingIndex >= 0) {
      extensions[existingIndex] = extensionData;
    } else {
      extensions.push(extensionData);
    }
    
    await fs.writeJson(this.extensionsDbPath, extensions, { spaces: 2 });
  }

  async getInstalledExtensions() {
    try {
      if (!(await fs.pathExists(this.extensionsDbPath))) {
        return [];
      }
      
      return await fs.readJson(this.extensionsDbPath);
    } catch (error) {
      console.error('Error getting installed extensions:', error);
      return [];
    }
  }

  async uninstallExtension(publisher, name) {
    try {
      const extensionId = `${publisher}.${name}`;
      const targetDir = path.join(this.extensionsDir, extensionId);
      
      if (await fs.pathExists(targetDir)) {
        await fs.remove(targetDir);
      }
      
      // Update database
      let extensions = [];
      if (await fs.pathExists(this.extensionsDbPath)) {
        extensions = await fs.readJson(this.extensionsDbPath);
      }
      
      extensions = extensions.filter(ext => ext.extensionId !== extensionId);
      await fs.writeJson(this.extensionsDbPath, extensions, { spaces: 2 });
      
      return { success: true, extensionId };
    } catch (error) {
      console.error('Error uninstalling extension:', error);
      throw error;
    }
  }

  async checkUpdates() {
    try {
      const installedExtensions = await this.getInstalledExtensions();
      const updates = [];
      
      for (const installedExt of installedExtensions) {
        try {
          const [publisher, name] = installedExt.extensionId.split('.');
          const latestExt = await this.getExtensionDetails(publisher, name);
          const latestVersion = latestExt.versions[0].version;
          
          if (latestVersion !== installedExt.version) {
            updates.push({
              extensionId: installedExt.extensionId,
              currentVersion: installedExt.version,
              latestVersion,
              updateAvailable: true
            });
          }
        } catch (error) {
          console.error(`Error checking updates for ${installedExt.extensionId}:`, error);
        }
      }
      
      return updates;
    } catch (error) {
      console.error('Error checking updates:', error);
      throw error;
    }
  }
}

// Initialize service and register IPC handlers
const marketplaceService = new MarketplaceService();

// Search extensions
ipcMain.handle('marketplace:search', async (event, query, pageSize = 50, pageNumber = 1) => {
  try {
    return await marketplaceService.searchExtensions(query, pageSize, pageNumber);
  } catch (error) {
    console.error('IPC marketplace:search error:', error);
    throw error;
  }
});

// Get extension details
ipcMain.handle('marketplace:details', async (event, publisher, name) => {
  try {
    return await marketplaceService.getExtensionDetails(publisher, name);
  } catch (error) {
    console.error('IPC marketplace:details error:', error);
    throw error;
  }
});

// Install extension
ipcMain.handle('marketplace:install', async (event, publisher, name, version = 'latest') => {
  try {
    const vsixPath = await marketplaceService.downloadExtension(publisher, name, version);
    return await marketplaceService.installExtension(vsixPath);
  } catch (error) {
    console.error('IPC marketplace:install error:', error);
    throw error;
  }
});

// Uninstall extension
ipcMain.handle('marketplace:uninstall', async (event, publisher, name) => {
  try {
    return await marketplaceService.uninstallExtension(publisher, name);
  } catch (error) {
    console.error('IPC marketplace:uninstall error:', error);
    throw error;
  }
});

// Get installed extensions
ipcMain.handle('marketplace:installed', async () => {
  try {
    return await marketplaceService.getInstalledExtensions();
  } catch (error) {
    console.error('IPC marketplace:installed error:', error);
    throw error;
  }
});

// Check for updates
ipcMain.handle('marketplace:check-updates', async () => {
  try {
    return await marketplaceService.checkUpdates();
  } catch (error) {
    console.error('IPC marketplace:check-updates error:', error);
    throw error;
  }
});

module.exports = MarketplaceService;
