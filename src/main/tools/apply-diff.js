const fs = require('fs');
const diff = require('diff');

/**
 * Apply a unified diff to a file.
 * @param {string} filePath Absolute path to the file.
 * @param {string} diffText Unified diff content.
 * @returns {Object} { success: boolean, content?: string, error?: string }
 */
function applyUnifiedDiff(filePath, diffText) {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const currentContent = fs.readFileSync(filePath, 'utf-8');
    
    // patch object from unified diff
    const patches = diff.parsePatch(diffText);
    
    if (!patches || patches.length === 0) {
      return { success: false, error: 'Invalid diff format or empty diff.' };
    }

    // Try with increasing fuzz tolerance so minor line-number drift doesn't break the patch
    let newContent = diff.applyPatch(currentContent, patches[0], { fuzzFactor: 0 });
    if (newContent === false) newContent = diff.applyPatch(currentContent, patches[0], { fuzzFactor: 2 });
    if (newContent === false) newContent = diff.applyPatch(currentContent, patches[0], { fuzzFactor: 4 });

    if (newContent === false) {
      return {
        success: false,
        error: 'Failed to apply patch. The diff context lines do not match the file content.'
      };
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { success: true, content: newContent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { applyUnifiedDiff };
