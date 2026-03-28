/**
 * IconThemeManager handles VS Code Icon Themes and generates CSS
 */
export class IconThemeManager {
  constructor() {
    this.currentIconTheme = null;
    this.styleElement = null;
    this.iconRegistry = new Map(); // extension -> icon class
  }

  async init() {
    await this.loadIconTheme();
  }

  async loadIconTheme() {
    try {
      const contributions = await window.api.getExtensionContributions();
      if (
        !contributions ||
        !contributions.iconThemes ||
        contributions.iconThemes.length === 0
      ) {
        console.log("No icon themes found in extensions");
        return;
      }

      // For now, load the first one (e.g. Material Icon Theme)
      const iconThemeInfo = contributions.iconThemes[0];
      const themeData = await window.api.readExtensionFile(iconThemeInfo.path);

      this._applyIconTheme(iconThemeInfo, themeData);
    } catch (error) {
      console.error("Error loading icon theme:", error);
    }
  }

  _applyIconTheme(info, data) {
    const isWindows = info.path.includes("\\");
    const themeDir = info.path.substring(
      0,
      info.path.lastIndexOf(isWindows ? "\\" : "/"),
    );

    let css = "";

    // 1. Fonts
    if (data.fonts && Array.isArray(data.fonts)) {
      data.fonts.forEach((font) => {
        const fontPath = font.src[0].path;
        const absoluteFontPath = this._resolvePath(info.path, fontPath);

        css += `
                @font-face {
                    font-family: "${font.id}";
                    src: url("ext-resource://${absoluteFontPath.replace(/\\/g, "/")}");
                    font-weight: ${font.weight || "normal"};
                    font-style: ${font.style || "normal"};
                }
                `;
      });
    }

    // 2. Icon Definitions to Classes
    const defs = data.iconDefinitions || {};

    // 3. File Extensions
    const fileExts = data.fileExtensions || {};
    for (const [ext, iconName] of Object.entries(fileExts)) {
      const def = defs[iconName];
      if (def) {
        css += this._generateIconCSS(`fext-${ext}`, def, info.path);
      }
    }

    // 4. File Names
    const fileNames = data.fileNames || {};
    for (const [name, iconName] of Object.entries(fileNames)) {
      const safeName = name.replace(/[^a-z0-9]/gi, "-");
      const def = defs[iconName];
      if (def) {
        css += this._generateIconCSS(`fname-${safeName}`, def, info.path);
      }
    }

    // 5. Folders
    const folderNames = data.folderNames || {};
    for (const [name, iconName] of Object.entries(folderNames)) {
      const def = defs[iconName];
      if (def) {
        css += this._generateIconCSS(`fdir-${name}`, def, info.path);
      }
      // Expanded version
      const expIconName = data.folderNamesExpanded?.[name];
      if (expIconName && defs[expIconName]) {
        css += this._generateIconCSS(
          `fdir-${name}-open`,
          defs[expIconName],
          info.path,
        );
      }
    }

    // Default folder/file
    if (data.file && defs[data.file]) {
      css += this._generateIconCSS("f-default", defs[data.file], info.path);
    }
    if (data.folder && defs[data.folder]) {
      css += this._generateIconCSS("d-default", defs[data.folder], info.path);
      if (data.folderExpanded && defs[data.folderExpanded]) {
        css += this._generateIconCSS(
          "d-default-open",
          defs[data.folderExpanded],
          info.path,
        );
      }
    }

    if (this.styleElement) this.styleElement.remove();
    this.styleElement = document.createElement("style");
    this.styleElement.id = "icon-theme-styles";
    this.styleElement.textContent = css;
    document.head.appendChild(this.styleElement);

    this.currentIconTheme = info.id;
    this.themeData = data;

    console.log(`Icon theme "${info.label}" applied.`);
    document.dispatchEvent(new CustomEvent("icon-theme:updated"));
  }

  _generateIconCSS(selector, def, themePath) {
    let style = "";
    if (def.fontCharacter) {
      const content = def.fontCharacter.startsWith("\\")
        ? def.fontCharacter
        : `\\${def.fontCharacter}`;
      style = `
            .vsc-icon.${selector}::before {
                content: "${content}";
                font-family: "${def.fontId}";
                color: ${def.fontColor || "inherit"};
                font-style: normal;
            }
            `;
    } else if (def.iconPath) {
      const absoluteIconPath = this._resolvePath(themePath, def.iconPath);
      style = `
            .vsc-icon.${selector} {
                background-image: url("ext-resource://${absoluteIconPath.replace(/\\/g, "/")}");
                background-size: contain;
                background-repeat: no-repeat;
                width: 16px;
                height: 16px;
                display: inline-block;
                vertical-align: middle;
            }
            `;
    }
    return style;
  }

  _resolvePath(basePath, relativePath) {
    const isWindows = basePath.includes("\\");
    const separator = isWindows ? "\\" : "/";
    const parts = basePath.split(/[/\\]/);
    parts.pop(); // Remove filename

    const relParts = relativePath.split(/[/\\]/);
    for (const p of relParts) {
      if (p === "..") parts.pop();
      else if (p !== "." && p !== "") parts.push(p);
    }
    const resolved = parts.join(separator);
    return resolved;
  }

  getIconClass(name, isDir, isOpen) {
    if (!this.currentIconTheme) return "";

    if (isDir) {
      const nameLower = name.toLowerCase();
      let base = this.themeData.folderNames?.[nameLower]
        ? `fdir-${nameLower}`
        : "d-default";
      if (isOpen) {
        // Check if there is an open version
        if (this.themeData.folderNamesExpanded?.[nameLower])
          return `fdir-${nameLower}-open`;
        return "d-default-open";
      }
      return base;
    }

    const ext = name.split(".").pop()?.toLowerCase();
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/gi, "-");

    if (this.themeData.fileNames?.[name.toLowerCase()])
      return `fname-${safeName}`;
    if (this.themeData.fileExtensions?.[ext]) return `fext-${ext}`;

    return "f-default";
  }
}

export const iconThemeManager = new IconThemeManager();
