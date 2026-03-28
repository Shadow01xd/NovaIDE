const fs = require("fs-extra");
const path = require("path");
const { app } = require("electron");
const yauzl = require("yauzl"); // for extracting vsix

class MarketplaceService {
  constructor() {
    this.extensionsDir = path.join(app.getPath("userData"), "extensions");
    this.dbPath = path.join(this.extensionsDir, "extensions-db.json");
    fs.ensureDirSync(this.extensionsDir);
    if (!fs.existsSync(this.dbPath)) {
      fs.writeJsonSync(this.dbPath, []);
    }
  }

  async extensionQuery(payload) {
    const response = await fetch(
      "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json;api-version=3.0-preview.1",
        },
        body: JSON.stringify({
          filters: [
            {
              criteria: payload.criteria,
              pageNumber: payload.pageNumber || 1,
              pageSize: payload.pageSize || 50,
              sortBy: 4, // 4 = Install count
              sortOrder: 2, // 2 = Descending
            },
          ],
          flags: payload.flags,
          assetTypes: payload.assetTypes,
        }),
      },
    );
    if (!response.ok)
      throw new Error(
        `Marketplace API error: ${response.status} ${response.statusText}`,
      );
    return await response.json();
  }

  async searchExtensions(query) {
    const criteria = [{ filterType: 8, value: "Microsoft.VisualStudio.Code" }];

    if (query) {
      if (query.startsWith("category:")) {
        criteria.push({
          filterType: 5,
          value: query.replace("category:", "").trim(),
        });
      } else if (query.startsWith("tag:")) {
        criteria.push({
          filterType: 1,
          value: query.replace("tag:", "").trim(),
        });
      } else {
        criteria.push({ filterType: 10, value: query });
      }
    } else {
      criteria.push({ filterType: 10, value: " " });
    }

    try {
      const result = await this.extensionQuery({
        criteria: criteria,
        pageNumber: 1,
        pageSize: 50,
        flags: 1 | 2 | 256 | 512 | 128 | 2048 | 4096,
        assetTypes: ["Microsoft.VisualStudio.Services.Icons.Default"],
      });
      return result.results[0].extensions || [];
    } catch (e) {
      console.error("Error searching extensions:", e);
      return [];
    }
  }

  async getExtensionDetails(publisher, name) {
    try {
      const result = await this.extensionQuery({
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          { filterType: 7, value: `${publisher}.${name}` },
        ],
        pageNumber: 1,
        pageSize: 1,
        flags: 1 | 2 | 4 | 256 | 512 | 128 | 2048 | 4096 | 8192,
      });

      const extensions = result.results[0].extensions;
      if (!extensions || extensions.length === 0)
        throw new Error("Extension not found");

      const ext = extensions[0];

      // Load readme if possible
      const version = ext.versions?.[0]?.version;
      if (version) {
        ext.readmeContent = await this.getReadme(publisher, name, version);
      }

      return ext;
    } catch (e) {
      console.error("Error getting extension details:", e);
      throw e;
    }
  }

  async getReadme(publisher, name, version) {
    try {
      const url = `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/${version}/assetbyname/Microsoft.VisualStudio.Services.Content.Details`;
      const res = await fetch(url);
      if (res.ok) {
        let text = await res.text();
        // Resolve relative images. Marketplace images are usually at:
        const baseUrl = `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/${version}/assetbyname/`;

        // Simple regex to find markdown image patterns ![alt](path)
        text = text.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, (match, alt, src) => {
          if (src.startsWith("http")) return match;
          return `![${alt}](${baseUrl}${src})`;
        });

        // Also handle HTML <img> tags
        text = text.replace(/<img[^>]+src="([^">]+)"/g, (match, src) => {
          if (src.startsWith("http")) return match;
          return match.replace(src, `${baseUrl}${src}`);
        });

        return text;
      }
      return "";
    } catch {
      return "";
    }
  }

  async downloadExtension(publisher, name, version) {
    const extName = `${publisher}.${name}`;
    const v = version || "latest";
    // Default download url format for visual studio marketplace
    let url = `https://marketplace.visualstudio.com/_apis/public/gallery/publishers/${publisher}/vsextensions/${name}/${v}/vspackage`;
    const tempPath = path.join(app.getPath("temp"), `${extName}-${v}.vsix`);

    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Failed to download: ${response.statusText} (${url})`);

    const buffer = await response.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(buffer));

    return tempPath;
  }

  async installExtension(publisher, name, version) {
    const vsixPath = await this.downloadExtension(publisher, name, version);
    const extractPath = path.join(this.extensionsDir, `${publisher}.${name}`);

    // Eliminar si ya existe
    if (fs.existsSync(extractPath)) {
      await fs.remove(extractPath);
    }
    await fs.ensureDir(extractPath);

    // Descomprimir VSIX (es un ZIP)
    await new Promise((resolve, reject) => {
      yauzl.open(vsixPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);
        zipfile.readEntry();
        zipfile.on("entry", (entry) => {
          // VS Code extensions are often inside an "extension/" folder in the ZIP
          let fileName = entry.fileName;
          if (fileName.startsWith("extension/")) {
            fileName = fileName.substring(10); // remove 'extension/'
          } else {
            // If it's not in 'extension/', skip it unless it's basic metadata
            if (
              !["package.json", "README.md", "CHANGELOG.md"].includes(fileName)
            ) {
              zipfile.readEntry();
              return;
            }
          }

          if (!fileName || /\/$/.test(fileName)) {
            // dir or empty
            zipfile.readEntry();
          } else {
            // file
            const fullPath = path.join(extractPath, fileName);
            fs.ensureDirSync(path.dirname(fullPath));
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);
              const writeStream = fs.createWriteStream(fullPath);
              readStream.on("end", () => zipfile.readEntry());
              readStream.pipe(writeStream);
            });
          }
        });
        zipfile.on("end", resolve);
        zipfile.on("error", reject);
      });
    });

    // Cleanup vsix
    await fs.remove(vsixPath);

    // Save metadata
    const db = await fs.readJson(this.dbPath);
    const id = `${publisher}.${name}`;
    const existingIdx = db.findIndex((e) => e.id === id);
    const meta = {
      id,
      publisher,
      name,
      version,
      installedAt: new Date().toISOString(),
    };
    if (existingIdx >= 0) db[existingIdx] = meta;
    else db.push(meta);

    await fs.writeJson(this.dbPath, db, { spaces: 2 });
    return meta;
  }

  async getInstalledExtensions() {
    if (!fs.existsSync(this.dbPath)) return [];
    try {
      return await fs.readJson(this.dbPath);
    } catch {
      return [];
    }
  }

  async uninstallExtension(publisher, name) {
    const id = `${publisher}.${name}`;
    const extractPath = path.join(this.extensionsDir, id);
    if (fs.existsSync(extractPath)) {
      await fs.remove(extractPath);
    }

    const db = await fs.readJson(this.dbPath);
    const newDb = db.filter((e) => e.id !== id);
    await fs.writeJson(this.dbPath, newDb, { spaces: 2 });
    return true;
  }

  async checkUpdates() {
    // To implement
    return [];
  }
}

module.exports = MarketplaceService;
