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

// Commands run through a shell, so only checking the first word is not enough:
// "git status && anything" would pass. Any operator that chains, pipes,
// redirects or substitutes commands is rejected outright.
const SHELL_OPERATORS = /[&|;<>`\r\n]|\$\(/;

/**
 * Explain why a command is rejected, or return null if it is allowed.
 * @param {string} fullCommand The command string.
 * @returns {string|null}
 */
function getCommandRejection(fullCommand) {
  if (!fullCommand || !fullCommand.trim()) return 'Comando vacío.';
  if (SHELL_OPERATORS.test(fullCommand)) {
    return 'Por seguridad no se permite encadenar, redirigir ni sustituir comandos (&, |, ;, <, >, `, $()). Ejecuta un comando por vez.';
  }
  const mainCommand = fullCommand.trim().split(/\s+/)[0].toLowerCase();

  // Clean executable extension on Windows
  const cleanCommand = mainCommand.replace(/\.(exe|cmd|bat)$/, '');

  if (!COMMAND_WHITELIST.includes(cleanCommand)) {
    return `Comando no permitido: ${mainCommand}. Por seguridad, solo se permiten comandos básicos de desarrollo.`;
  }
  return null;
}

/**
 * Check if a command is allowed.
 * @param {string} fullCommand The command string.
 * @returns {boolean}
 */
function isCommandAllowed(fullCommand) {
  return getCommandRejection(fullCommand) === null;
}

module.exports = { isCommandAllowed, getCommandRejection, COMMAND_WHITELIST };
