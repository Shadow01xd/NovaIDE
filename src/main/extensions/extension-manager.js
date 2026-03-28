const fs = require('fs-extra');
const path = require('path');
const { app } = require('electron');

class ExtensionManager {
  constructor() {
    this.extensionsDir = path.join(app.getPath('userData'), 'extensions');
  }

  async getContributions() {
    if (!fs.existsSync(this.extensionsDir)) return { themes: [], snippets: [], iconThemes: [] };

    const themes = [];
    const snippets = [];
    const iconThemes = [];
    
    try {
      const folders = await fs.readdir(this.extensionsDir);
      
      for (const folder of folders) {
        const extPath = path.join(this.extensionsDir, folder);
        
        // Find the actual root (where package.json lives)
        let finalRoot = extPath;
        let packageJsonPath = path.join(extPath, 'package.json');
        
        if (!fs.existsSync(packageJsonPath)) {
          const nestedPkgPath = path.join(extPath, 'extension', 'package.json');
          if (fs.existsSync(nestedPkgPath)) {
            packageJsonPath = nestedPkgPath;
            finalRoot = path.join(extPath, 'extension');
          } else {
            continue;
          }
        }

        try {
          const pkg = await fs.readJson(packageJsonPath);
          const contributes = pkg.contributes;
          if (!contributes) continue;

          // Extract Themes
          if (contributes.themes && Array.isArray(contributes.themes)) {
            contributes.themes.forEach(theme => {
              themes.push({
                label: theme.label,
                uiTheme: theme.uiTheme,
                path: path.join(finalRoot, theme.path),
                extensionId: folder,
                publisher: pkg.publisher,
                name: pkg.name
              });
            });
          }

          // Extract Icon Themes
          if (contributes.iconThemes && Array.isArray(contributes.iconThemes)) {
            contributes.iconThemes.forEach(it => {
              iconThemes.push({
                label: it.label || it.id,
                id: it.id,
                path: path.join(finalRoot, it.path),
                extensionId: folder
              });
            });
          }

          // Extract Snippets
          if (contributes.snippets && Array.isArray(contributes.snippets)) {
            contributes.snippets.forEach(snippet => {
              snippets.push({
                language: snippet.language,
                path: path.join(finalRoot, snippet.path),
                extensionId: folder
              });
            });
          }
        } catch (e) {
          console.warn(`Failed to parse package.json for extension ${folder}:`, e);
        }
      }
    } catch (e) {
      console.error('Error scanning extensions directory:', e);
    }

    return { themes, snippets, iconThemes };
  }

  async readExtensionFile(fullPath) {
    try {
      if (fullPath.endsWith('.json')) {
        return await fs.readJson(fullPath);
      }
      return await fs.readFile(fullPath, 'utf8');
    } catch (e) {
      console.error(`Failed to read extension file at ${fullPath}:`, e);
      throw e;
    }
  }

  async format(code, languageId) {
    // Try to find if prettier extension is installed
    const contributions = await this.getContributions();
    // Simplified: Check if any theme/snippet comes from a "prettier" extension
    const prettierExt = await this._findPrettierExtension();
    
    if (prettierExt) {
      try {
        // Try to require prettier from the extension folder
        // Note: This is an optimistic approach
        const prettierPath = path.join(prettierExt, 'node_modules', 'prettier');
        if (fs.existsSync(prettierPath)) {
          const prettier = require(prettierPath);
          return prettier.format(code, { parser: this._getPrettierParser(languageId) });
        }
      } catch (e) {
        console.warn('Failed to use extension prettier:', e);
      }
    }

    // Fallback: simple beautifier or return as is
    return this._simpleFormat(code, languageId);
  }

  async _findPrettierExtension() {
    if (!fs.existsSync(this.extensionsDir)) return null;
    const folders = await fs.readdir(this.extensionsDir);
    for (const folder of folders) {
      if (folder.toLowerCase().includes('prettier')) {
        return path.join(this.extensionsDir, folder);
      }
    }
    return null;
  }

  _getPrettierParser(lang) {
    const map = {
      'javascript': 'babel',
      'typescript': 'typescript',
      'css': 'css',
      'less': 'less',
      'scss': 'scss',
      'json': 'json',
      'html': 'html',
      'vue': 'vue',
      'yaml': 'yaml'
    };
    return map[lang] || 'babel';
  }

  _simpleFormat(code, lang) {
    // Very basic indentation logic
    let indent = 0;
    return code.split('\n').map(line => {
      line = line.trim();
      if (line.startsWith('}') || line.endsWith('}')) indent = Math.max(0, indent - 1);
      const res = '  '.repeat(indent) + line;
      if (line.endsWith('{') || line.startsWith('{')) indent++;
      return res;
    }).join('\n');
  }
}

module.exports = ExtensionManager;
