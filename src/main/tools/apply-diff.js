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

    const newContent = diff.applyPatch(currentContent, patches[0]);

    if (newContent === false) {
      return { 
        success: false, 
        error: 'Failed to apply patch. The diff might be outdated or incorrect for this file version.' 
      };
    }

    fs.writeFileSync(filePath, newContent, 'utf-8');
    return { success: true, content: newContent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { applyUnifiedDiff };
