/**
 * SnippetManager registers completion providers for extension snippets
 */
export class SnippetManager {
  constructor(monaco) {
    this.monaco = monaco;
    this.providers = [];
  }

  async init() {
    await this.loadSnippets();
  }

  async loadSnippets() {
    try {
      const contributions = await window.api.getExtensionContributions();
      if (!contributions || !contributions.snippets) return;

      // Clear previous providers if necessary (though usually we just append)

      for (const snippetInfo of contributions.snippets) {
        try {
          const snippets = await window.api.readExtensionFile(snippetInfo.path);
          this._registerSnippets(snippetInfo.language, snippets);
        } catch (e) {
          console.error("Error loading snippet file:", e);
        }
      }
    } catch (error) {
      console.error("Error fetching snippets:", error);
    }
  }

  _registerSnippets(language, snippets) {
    // Handle both single language and array of languages
    const languages = Array.isArray(language) ? language : [language];

    const suggestions = [];
    for (const [name, data] of Object.entries(snippets)) {
      const body = Array.isArray(data.body) ? data.body.join("\n") : data.body;

      suggestions.push({
        label: data.prefix || name,
        kind: this.monaco.languages.CompletionItemKind.Snippet,
        documentation: data.description || name,
        insertText: body,
        insertTextRules:
          this.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: null, // Let monaco decide
      });
    }

    languages.forEach((lang) => {
      const provider = this.monaco.languages.registerCompletionItemProvider(
        lang,
        {
          provideCompletionItems: () => {
            return { suggestions: suggestions };
          },
        },
      );
      this.providers.push(provider);
    });
  }

  async refresh() {
    this.dispose();
    await this.loadSnippets();
  }

  dispose() {
    this.providers.forEach((p) => {
      if (p && typeof p.dispose === "function") {
        p.dispose();
      }
    });
    this.providers = [];
  }
}
