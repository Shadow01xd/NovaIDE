/**
 * Memory Management for AI Agent.
 * Saves/reads information from .ide/context directory.
 */

export class MemoryManager {
  static async write(key, value) {
    const fileName = `.ide/context/${key}.txt`;
    const result = await window.api.agentWriteFile(fileName, value);
    return result;
  }

  static async read(key) {
    const fileName = `.ide/context/${key}.txt`;
    const result = await window.api.agentReadFile(fileName);
    return result;
  }

  static async list() {
    const result = await window.api.agentListFiles('.ide/context');
    return result;
  }
}
