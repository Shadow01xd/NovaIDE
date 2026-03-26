/**
 * Whitelist of allowed commands for the agent to execute.
 */

const COMMAND_WHITELIST = [
  'git',
  'npm',
  'node',
  'python',
  'python3',
  'ls',
  'dir',
  'cat',
  'type',
  'mkdir',
  'cd',
  'echo',
  'ping',
  'curl',
  'wget',
  'pip',
  'npx',
  'vite',
  'tsc'
];

/**
 * Check if a command is allowed.
 * @param {string} fullCommand The command string.
 * @returns {boolean}
 */
function isCommandAllowed(fullCommand) {
  if (!fullCommand) return false;
  const mainCommand = fullCommand.trim().split(/\s+/)[0].toLowerCase();
  
  // Clean executable extension on Windows
  const cleanCommand = mainCommand.replace(/\.exe$/, '');
  
  return COMMAND_WHITELIST.includes(cleanCommand);
}

module.exports = { isCommandAllowed, COMMAND_WHITELIST };
