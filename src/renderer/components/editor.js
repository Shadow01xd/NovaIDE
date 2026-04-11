import { registerAllLanguages } from './language-extensions.js'
import { historyManager } from '../utils/history-manager.js'
import { SnippetManager } from './SnippetManager.js'

const LANG_MAP = {
  // Lenguajes Web - Monaco nativos
  js:'javascript', jsx:'javascript', ts:'typescript', tsx:'typescript',
  html:'html', css:'css', scss:'scss', less:'less',
  json:'json', jsonc:'json', md:'markdown', yaml:'yaml', yml:'yaml',
  
  // Lenguajes de Programación Principales - Monaco nativos
  py:'python', rb:'ruby', go:'go', rs:'rust', cpp:'cpp', c:'cpp', cs:'csharp',
  java:'java', kt:'kotlin', swift:'swift', php:'php',
  
  // Lenguajes de Scripting - Monaco nativos
  sh:'shell', bash:'shell', zsh:'shell', ps1:'powershell', bat:'batch',
  
  // Bases de Datos - Monaco nativos
  sql:'sql',
  
  // DevOps y Configuración - Extensiones personalizadas
  dockerfile:'dockerfile', tf:'terraform', hcl:'terraform',
  toml:'toml', ini:'ini', conf:'ini',
  
  // Web Frameworks - Monaco nativos
  vue:'html', svelte:'html', astro:'html',
  
  // Lenguajes Funcionales - Monaco nativos
  hs:'haskell', ml:'ocaml', lisp:'lisp', clojure:'clojure',
  fsharp:'fsharp', elixir:'elixir', erlang:'erlang',
  
  // Lenguajes Científicos y Matemáticos - Monaco nativos
  r:'r', julia:'julia', matlab:'matlab', m:'matlab',
  
  // Lenguajes Especializados - Extensiones personalizadas
  graphql:'graphql', solidity:'solidity',
  wasm:'webassembly', wat:'webassembly',
  
  // Lenguajes de Markup y Documentación - Monaco nativos
  xml:'xml', svg:'xml', xhtml:'xml', tex:'latex', bib:'bibtex',
  
  // Lenguajes de Redes y Protocolos - Extensiones personalizadas
  proto:'protobuf', thrift:'thrift', avsc:'avro',
  
  // Lenguajes de Mobile - Monaco nativos
  objc:'objective-c',
  
  // Lenguajes de Sistemas - Extensiones personalizadas
  asm:'assembly', nasm:'assembly', gas:'assembly',
  
  // Lenguajes Modernos - Extensiones personalizadas
  zig:'zig', nim:'nim', v:'v', odin:'odin',
  
  // Lenguajes de Plantillas - Monaco nativos
  erb:'erb', ejs:'javascript', hbs:'handlebars',
  mustache:'mustache', liquid:'liquid', pug:'pug',
  
  // Lenguajes de Estilos Extendidos - Monaco nativos
  styl:'stylus', postcss:'css',
  
  // Lenguajes de Testing - Monaco nativos
  spec:'javascript', test:'javascript', e2e:'javascript',
  
  // Lenguajes de Build - Extensiones personalizadas
  make:'makefile', cmake:'cmake', gradle:'gradle',
  maven:'xml', sbt:'scala',
  
  // Lenguajes de Infraestructura - Monaco nativos
  pulumi:'typescript', cdktf:'typescript',
  
  // Lenguajes de APIs - Monaco nativos
  openapi:'yaml', swagger:'yaml',
  
  // Lenguajes de Datos - Extensiones personalizadas
  csv:'csv', tsv:'csv',
  
  // Lenguajes de Blockchain - Extensiones personalizadas
  sol:'solidity', cairo:'cairo',
  
  // Lenguajes de Juegos - Extensiones personalizadas
  gdscript:'gdscript', lua:'lua',
  
  // Lenguajes de Embebidos - Monaco nativos
  arduino:'cpp', pico:'cpp',
  
  // Lenguajes de ML/AI - Monaco nativos
  ipynb:'jupyter',
  
  // Default - Monaco nativos
  txt:'plaintext', log:'plaintext'
}

// Configuración específica para cada lenguaje
const LANG_CONFIG = {
  javascript: {
    comments: { line: '//', block: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  python: {
    comments: { line: '#' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  rust: {
    comments: { line: '//', block: ['/*', '*/'], doc: ['///', '//!'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  go: {
    comments: { line: '//', block: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  cpp: {
    comments: { line: '//', block: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '<', close: '>' }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '<', close: '>' }
    ]
  },
  java: {
    comments: { line: '//', block: ['/*', '*/'], javadoc: ['/**', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  html: {
    comments: { block: ['<!--', '-->'] },
    brackets: [['<', '>']],
    autoClosingPairs: [
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  css: {
    comments: { block: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  json: {
    comments: { line: '//' }, // JSONC soporta comentarios
    brackets: [['{', '}'], ['[', ']']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '"', close: '"' }
    ]
  },
  yaml: {
    comments: { line: '#' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  sql: {
    comments: { line: '--', block: ['/*', '*/'] },
    brackets: [['(', ')']],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  shell: {
    comments: { line: '#' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  dockerfile: {
    comments: { line: '#' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  markdown: {
    comments: { line: '<!--', block: ['-->', '-->'] }, // HTML comments en markdown
    brackets: [['{', '}'], ['[', ']'], ['(', ')'], ['<', '>']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '*', close: '*' },
      { open: '_', close: '_' }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '*', close: '*' },
      { open: '_', close: '_' }
    ]
  },
  latex: {
    comments: { line: '%' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  php: {
    comments: { line: '//', block: ['/*', '*/'], phpdoc: ['/**', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')'], ['<', '>']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '<', close: '>' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  ruby: {
    comments: { line: '#', block: ['=begin', '=end'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  swift: {
    comments: { line: '//', block: ['/*', '*/'], doc: ['///', '/**'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  kotlin: {
    comments: { line: '//', block: ['/*', '*/'], kdoc: ['/**', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  scala: {
    comments: { line: '//', block: ['/*', '*/'], scaladoc: ['/**', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  haskell: {
    comments: { line: '--', block: ['{-', '-}'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  r: {
    comments: { line: '#' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  julia: {
    comments: { line: '#', block: ['#=', '=#'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  solidity: {
    comments: { line: '//', block: ['/*', '*/'], natspec: ['///', '@'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  lua: {
    comments: { line: '--', block: ['--[[', ']]'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  },
  assembly: {
    comments: { line: ';', block: ['/*', '*/'] },
    brackets: [['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  }
}

export function getLang(filePath) {
  if (!filePath) return 'plaintext'
  
  // Extraer extensión y nombre de archivo
  const fileName = filePath.split('/').pop()?.split('\\').pop() || ''
  const ext = fileName.split('.').pop()?.toLowerCase()
  const baseName = fileName.split('.').slice(0, -1).join('.').toLowerCase()
  
  // Mapeo de lenguajes principal
  let lang = LANG_MAP[ext] || 'plaintext'
  
  // Casos especiales basados en el nombre del archivo
  const specialFiles = {
    // Archivos de configuración
    'dockerfile': 'dockerfile',
    'makefile': 'makefile',
    'cmakelists.txt': 'cmake',
    'rakefile': 'ruby',
    'gemfile': 'ruby',
    'podfile': 'ruby',
    'vagrantfile': 'ruby',
    'package.json': 'json',
    'tsconfig.json': 'jsonc',
    'jsconfig.json': 'jsonc',
    'composer.json': 'json',
    'cargo.toml': 'toml',
    'pyproject.toml': 'toml',
    'requirements.txt': 'plaintext',
    'pipfile': 'toml',
    'poetry.lock': 'toml',
    'yarn.lock': 'yaml',
    'package-lock.json': 'json',
    'composer.lock': 'json',
    'go.mod': 'go',
    'go.sum': 'plaintext',
    'requirements.yaml': 'yaml',
    'values.yaml': 'yaml',
    'chart.yaml': 'yaml',
    'docker-compose.yml': 'yaml',
    'docker-compose.yaml': 'yaml',
    'terraform.tfvars': 'terraform',
    '.env': 'dotenv',
    '.env.example': 'dotenv',
    '.gitignore': 'gitignore',
    '.dockerignore': 'plaintext',
    'nginx.conf': 'nginx',
    'apache.conf': 'apache',
    'vhost.conf': 'apache',
    
    // Archivos de documentación
    'readme.md': 'markdown',
    'readme.txt': 'plaintext',
    'readme': 'plaintext',
    'license': 'plaintext',
    'license.md': 'markdown',
    'changelog.md': 'markdown',
    'contributing.md': 'markdown',
    
    // Archivos de CI/CD
    'jenkinsfile': 'groovy',
    'azure-pipelines.yml': 'yaml',
    '.github/workflows': 'yaml',
    '.gitlab-ci.yml': 'yaml',
    'bitbucket-pipelines.yml': 'yaml',
    
    // Archivos de bases de datos
    'schema.sql': 'sql',
    'database.sql': 'sql',
    'migration.sql': 'sql',
    'seed.sql': 'sql',
    
    // Archivos de testing
    'jest.config.js': 'javascript',
    'vitest.config.js': 'javascript',
    'cypress.config.js': 'javascript',
    'playwright.config.js': 'javascript',
    'test.spec.js': 'javascript',
    'test.spec.ts': 'typescript',
    
    // Archivos de build
    'webpack.config.js': 'javascript',
    'rollup.config.js': 'javascript',
    'vite.config.js': 'javascript',
    'babel.config.js': 'javascript',
    'tsconfig.json': 'jsonc',
    'babelrc': 'json',
    '.babelrc': 'json',
    
    // Archivos de linters
    '.eslintrc.js': 'javascript',
    '.eslintrc.json': 'json',
    '.prettierrc': 'json',
    '.prettierrc.json': 'json',
    'tslint.json': 'json',
    
    // Archivos de Docker
    'dockerfile.dev': 'dockerfile',
    'dockerfile.prod': 'dockerfile',
    'dockerfile.build': 'dockerfile',
    
    // Archivos de Kubernetes
    'k8s.yaml': 'yaml',
    'deployment.yaml': 'yaml',
    'service.yaml': 'yaml',
    'ingress.yaml': 'yaml',
    'configmap.yaml': 'yaml',
    'secret.yaml': 'yaml',
    
    // Archivos de Terraform
    'main.tf': 'terraform',
    'variables.tf': 'terraform',
    'outputs.tf': 'terraform',
    'provider.tf': 'terraform',
    
    // Archivos de Ansible
    'playbook.yml': 'yaml',
    'inventory.yml': 'yaml',
    'ansible.cfg': 'ini',
    
    // Archivos de protocolos
    'schema.proto': 'protobuf',
    'service.thrift': 'thrift',
    'model.avsc': 'avro',
    
    // Archivos de documentación técnica
    'api.md': 'markdown',
    'docs.md': 'markdown',
    'tutorial.md': 'markdown',
    'guide.md': 'markdown',
    
    // Archivos de configuración de IDE
    '.vscode/settings.json': 'jsonc',
    '.vscode/launch.json': 'jsonc',
    '.vscode/tasks.json': 'jsonc',
    '.editorconfig': 'ini',
    
    // Archivos de seguridad
    'ssh_config': 'ssh',
    'sshd_config': 'ssh',
    'known_hosts': 'plaintext',
    
    // Archivos de logs
    'access.log': 'log',
    'error.log': 'log',
    'debug.log': 'log',
    
    // Archivos de datos
    'data.csv': 'csv',
    'export.csv': 'csv',
    'import.csv': 'csv',
    'data.tsv': 'csv',
    'data.xml': 'xml',
    'config.xml': 'xml',
    
    // Archivos de plantillas
    'template.html': 'html',
    'layout.html': 'html',
    'index.html': 'html',
    'app.html': 'html',
    
    // Archivos de estilos
    'style.css': 'css',
    'main.css': 'css',
    'theme.css': 'css',
    'reset.css': 'css',
    'normalize.css': 'css',
    
    // Archivos de scripts
    'build.sh': 'shell',
    'deploy.sh': 'shell',
    'setup.sh': 'shell',
    'install.sh': 'shell',
    'run.sh': 'shell',
    'start.sh': 'shell',
    'stop.sh': 'shell',
    'script.sh': 'shell',
    'bootstrap.sh': 'shell',
    
    // Archivos de Windows
    'build.bat': 'batch',
    'deploy.bat': 'batch',
    'setup.bat': 'batch',
    'install.bat': 'batch',
    'run.bat': 'batch',
    'start.bat': 'batch',
    'stop.bat': 'batch',
    'script.bat': 'batch',
    
    // Archivos PowerShell
    'build.ps1': 'powershell',
    'deploy.ps1': 'powershell',
    'setup.ps1': 'powershell',
    'install.ps1': 'powershell',
    'run.ps1': 'powershell',
    'start.ps1': 'powershell',
    'stop.ps1': 'powershell',
    'script.ps1': 'powershell',
    
    // Archivos de juegos
    'main.gd': 'gdscript',
    'player.gd': 'gdscript',
    'enemy.gd': 'gdscript',
    'ui.gd': 'gdscript',
    
    // Archivos de LaTeX
    'main.tex': 'latex',
    'article.tex': 'latex',
    'report.tex': 'latex',
    'thesis.tex': 'latex',
    'book.tex': 'latex',
    'presentation.tex': 'latex',
    'bibliography.bib': 'bibtex'
  }
  
  // Verificar si el nombre del archivo coincide con algún caso especial
  if (specialFiles[fileName.toLowerCase()]) {
    return specialFiles[fileName.toLowerCase()]
  }
  
  // Verificar si el nombre base (sin extensión) coincide
  if (specialFiles[baseName]) {
    return specialFiles[baseName]
  }
  
  // Casos especiales basados en patrones
  if (baseName.includes('dockerfile')) return 'dockerfile'
  if (baseName.includes('makefile')) return 'makefile'
  if (baseName.includes('readme')) return baseName.includes('.md') ? 'markdown' : 'plaintext'
  if (baseName.includes('license')) return baseName.includes('.md') ? 'markdown' : 'plaintext'
  if (baseName.includes('changelog')) return baseName.includes('.md') ? 'markdown' : 'plaintext'
  if (baseName.includes('contributing')) return baseName.includes('.md') ? 'markdown' : 'plaintext'
  if (baseName.includes('test') || baseName.includes('spec')) {
    if (ext === 'js') return 'javascript'
    if (ext === 'ts') return 'typescript'
    if (ext === 'py') return 'python'
    if (ext === 'rb') return 'ruby'
    if (ext === 'go') return 'go'
    if (ext === 'java') return 'java'
  }
  if (baseName.includes('config') || baseName.includes('settings')) {
    if (ext === 'json') return 'jsonc'
    if (ext === 'yaml' || ext === 'yml') return 'yaml'
    if (ext === 'toml') return 'toml'
    if (ext === 'ini') return 'ini'
  }
  if (baseName.includes('schema') || baseName.includes('model')) {
    if (ext === 'sql') return 'sql'
    if (ext === 'proto') return 'protobuf'
    if (ext === 'thrift') return 'thrift'
    if (ext === 'avsc') return 'avro'
  }
  if (baseName.includes('migration') || baseName.includes('seed')) {
    return 'sql'
  }
  if (baseName.includes('docker') && (ext === 'yml' || ext === 'yaml')) {
    return 'yaml'
  }
  if (baseName.includes('k8s') || baseName.includes('kubernetes')) {
    return 'yaml'
  }
  if (baseName.includes('terraform') || baseName.includes('tf')) {
    return 'terraform'
  }
  if (baseName.includes('ansible')) {
    return 'yaml'
  }
  if (baseName.includes('jenkins')) {
    return 'groovy'
  }
  if (baseName.includes('pipeline') || baseName.includes('ci')) {
    return 'yaml'
  }
  if (baseName.includes('build') || baseName.includes('deploy') || baseName.includes('setup')) {
    if (ext === 'sh') return 'shell'
    if (ext === 'bat') return 'batch'
    if (ext === 'ps1') return 'powershell'
  }
  if (baseName.includes('webpack') || baseName.includes('rollup') || baseName.includes('vite') || baseName.includes('babel')) {
    return 'javascript'
  }
  if (baseName.includes('eslint') || baseName.includes('prettier') || baseName.includes('tslint')) {
    return 'json'
  }
  if (baseName.includes('jest') || baseName.includes('vitest') || baseName.includes('cypress') || baseName.includes('playwright')) {
    return 'javascript'
  }
  if (baseName.includes('style') || baseName.includes('theme') || baseName.includes('main') || baseName.includes('layout')) {
    if (ext === 'css') return 'css'
    if (ext === 'scss') return 'scss'
    if (ext === 'sass') return 'sass'
    if (ext === 'less') return 'less'
    if (ext === 'styl') return 'stylus'
  }
  if (baseName.includes('template') || baseName.includes('layout') || baseName.includes('index') || baseName.includes('app')) {
    if (ext === 'html') return 'html'
    if (ext === 'vue') return 'html'
    if (ext === 'svelte') return 'html'
    if (ext === 'jsx') return 'javascript'
    if (ext === 'tsx') return 'typescript'
  }
  if (baseName.includes('data') || baseName.includes('export') || baseName.includes('import')) {
    if (ext === 'csv' || ext === 'tsv') return 'csv'
    if (ext === 'xml') return 'xml'
    if (ext === 'json') return 'json'
  }
  if (baseName.includes('log') || baseName.includes('access') || baseName.includes('error') || baseName.includes('debug')) {
    return 'log'
  }
  if (baseName.includes('gd') && ext === 'gd') return 'gdscript'
  if (baseName.includes('main') || baseName.includes('article') || baseName.includes('report') || baseName.includes('thesis') || baseName.includes('book') || baseName.includes('presentation')) {
    if (ext === 'tex') return 'latex'
  }
  if (baseName.includes('bibliography') && ext === 'bib') return 'bibtex'
  
  // Para archivos JSX/TSX, asegurarse de que se use el modo correcto
  if (ext === 'jsx' || ext === 'tsx') {
    return lang // 'javascript' o 'typescript'
  }
  
  // Para archivos especiales que necesitan tratamiento diferente
  if (ext === 'md' && (baseName.includes('readme') || baseName.includes('license') || baseName.includes('changelog') || baseName.includes('contributing'))) {
    return 'markdown'
  }
  
  return lang
}

// Función para obtener la configuración específica del lenguaje
export function getLangConfig(language) {
  return LANG_CONFIG[language] || {
    comments: { line: '//', block: ['/*', '*/'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
      { open: "'", close: "'" }
    ]
  }
}

// Función para detectar si un archivo es de configuración
export function isConfigFile(filePath) {
  const fileName = filePath.split('/').pop()?.split('\\').pop() || ''
  const baseName = fileName.split('.').slice(0, -1).join('.').toLowerCase()
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  const configPatterns = [
    /config/i, /settings/i, /setup/i, /init/i, /rc$/i,
    /\.env/, /\.gitignore/, /\.dockerignore/,
    /dockerfile/i, /makefile/i,
    /package\.json/, /tsconfig\.json/, /jsconfig\.json/,
    /composer\.json/, /cargo\.toml/, /pyproject\.toml/,
    /requirements\.(txt|yaml|yml)/, /pipfile/, /poetry\.lock/,
    /yarn\.lock/, /package-lock\.json/, /composer\.lock/,
    /go\.mod/, /go\.sum/,
    /webpack\.config/, /rollup\.config/, /vite\.config/,
    /babel\.config/, /\.babelrc/,
    /\.eslintrc/, /\.prettierrc/, /tslint\.json/,
    /jenkinsfile/i, /azure-pipelines/, /\.github\/workflows/,
    /\.gitlab-ci\.yml/, /bitbucket-pipelines/,
    /schema\.sql/, /database\.sql/, /migration\.sql/,
    /docker-compose\.(yml|yaml)/,
    /terraform\.tfvars/, /k8s\./, /deployment\./,
    /service\./, /ingress\./, /configmap\./, /secret\./,
    /playbook\./, /inventory\./, /ansible\.cfg/,
    /schema\.proto/, /service\.thrift/, /model\.avsc/,
    /\.vscode\/settings/, /\.vscode\/launch/, /\.vscode\/tasks/,
    /\.editorconfig/, /ssh_config/, /sshd_config/,
    /access\.log/, /error\.log/, /debug\.log/,
    /nginx\.conf/, /apache\.conf/, /vhost\.conf/
  ]
  
  return configPatterns.some(pattern => pattern.test(fileName) || pattern.test(baseName))
}

// Función para detectar si un archivo es de documentación
export function isDocumentationFile(filePath) {
  const fileName = filePath.split('/').pop()?.split('\\').pop() || ''
  const baseName = fileName.split('.').slice(0, -1).join('.').toLowerCase()
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  const docPatterns = [
    /readme/i, /license/i, /changelog/i, /contributing/i,
    /docs?/i, /guide/i, /tutorial/i, /manual/i, /help/i,
    /api/i, /reference/i, /spec/i, /design/i,
    /faq/i, /troubleshooting/i, /getting\.started/i
  ]
  
  return (docPatterns.some(pattern => pattern.test(baseName)) && (ext === 'md' || ext === 'txt')) || 
         ext === 'md' || ext === 'tex' || ext === 'bib'
}

// Función para detectar si un archivo es de testing
export function isTestFile(filePath) {
  const fileName = filePath.split('/').pop()?.split('\\').pop() || ''
  const baseName = fileName.split('.').slice(0, -1).join('.').toLowerCase()
  const ext = fileName.split('.').pop()?.toLowerCase()
  
  const testPatterns = [
    /test/i, /spec/i, /e2e/i, /integration/i, /unit/i,
    /\.test\./, /\.spec\./, /__tests__/, /tests?\//,
    /cypress/, /playwright/, /jest/, /vitest/, /mocha/
  ]
  
  return testPatterns.some(pattern => pattern.test(fileName) || pattern.test(baseName))
}

// Función para obtener el tipo de archivo
export function getFileType(filePath) {
  if (isConfigFile(filePath)) return 'config'
  if (isDocumentationFile(filePath)) return 'documentation'
  if (isTestFile(filePath)) return 'test'
  return 'code'
}

// Función para configurar el editor según el lenguaje
export function configureEditorForLanguage(editor, language, filePath) {
  const monaco = window.monaco
  if (!monaco || !editor) return
  
  // Verificar si el lenguaje está registrado en Monaco
  const registeredLanguages = monaco.languages.getLanguages().map(lang => lang.id)
  if (!registeredLanguages.includes(language)) {
    console.warn(`[Editor] Lenguaje no registrado: ${language}, usando plaintext`)
    return
  }
  
  const config = getLangConfig(language)
  
  // Configurar autocompletado específico del lenguaje
  const languageConfig = {
    javascript: {
      // Configuración específica para JavaScript
      suggest: {
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showModules: true,
        showProperties: true,
        showConstructors: true
      },
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      }
    },
    typescript: {
      // Configuración específica para TypeScript
      suggest: {
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showModules: true,
        showProperties: true,
        showConstructors: true,
        showInterfaces: true,
        showTypeParameters: true
      },
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      }
    },
    python: {
      // Configuración específica para Python
      suggest: {
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showModules: true
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    },
    html: {
      // Configuración específica para HTML
      suggest: {
        showClasses: true,
        showFunctions: false,
        showVariables: false,
        showModules: false,
        showProperties: true
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    },
    css: {
      // Configuración específica para CSS
      suggest: {
        showClasses: true,
        showFunctions: false,
        showVariables: true,
        showModules: false,
        showProperties: true,
        showColors: true
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    },
    json: {
      // Configuración específica para JSON
      suggest: {
        showClasses: false,
        showFunctions: false,
        showVariables: false,
        showModules: false,
        showProperties: true
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    },
    yaml: {
      // Configuración específica para YAML
      suggest: {
        showClasses: false,
        showFunctions: false,
        showVariables: false,
        showModules: false,
        showProperties: true
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    },
    sql: {
      // Configuración específica para SQL
      suggest: {
        showClasses: false,
        showFunctions: true,
        showVariables: false,
        showModules: false,
        showProperties: false
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    },
    shell: {
      // Configuración específico para Shell
      suggest: {
        showClasses: false,
        showFunctions: true,
        showVariables: false,
        showModules: false,
        showProperties: false
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    },
    dockerfile: {
      // Configuración específica para Dockerfile
      suggest: {
        showClasses: false,
        showFunctions: true,
        showVariables: false,
        showModules: false,
        showProperties: false
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    },
    markdown: {
      // Configuración específica para Markdown
      suggest: {
        showClasses: false,
        showFunctions: false,
        showVariables: false,
        showModules: false,
        showProperties: false
      },
      quickSuggestions: {
        other: true,
        comments: false,
        strings: true
      }
    }
  }
  
  // Aplicar configuración específica del lenguaje si existe
  if (languageConfig[language]) {
    const langSpecificConfig = languageConfig[language]
    
    // Actualizar opciones del editor
    editor.updateOptions({
      suggest: {
        ...editor.getOptions().suggest,
        ...langSpecificConfig.suggest
      },
      quickSuggestions: langSpecificConfig.quickSuggestions
    })
  }
  
  // Configurar pares de cierre automático según el lenguaje
  if (config && config.autoClosingPairs && Array.isArray(config.autoClosingPairs)) {
    try {
      monaco.languages.setLanguageConfiguration(language, {
        autoClosingPairs: config.autoClosingPairs,
        surroundingPairs: config.surroundingPairs || [],
        brackets: config.brackets || [],
        comments: config.comments
      })
    } catch (error) {
      console.warn(`[Editor] Error configurando lenguaje ${language}:`, error)
    }
  }
  
  // Configurar formato al tipo para lenguajes específicos
  const formatOnTypeLanguages = ['javascript', 'typescript', 'html', 'css', 'scss', 'less']
  if (formatOnTypeLanguages.includes(language)) {
    editor.updateOptions({
      formatOnType: true
    })
  }
  
  // Configurar acciones de código al guardar para lenguajes que lo soportan
  const codeActionsLanguages = ['javascript', 'typescript', 'python', 'java', 'csharp', 'cpp']
  if (codeActionsLanguages.includes(language)) {
    editor.updateOptions({
      codeActionsOnSave: {
        'source.fixAll': 'explicit',
        'source.organizeImports': 'explicit'
      }
    })
  }
  
  // Configurar lens de código para lenguajes que lo soportan
  const codeLensLanguages = ['javascript', 'typescript', 'python', 'java', 'csharp']
  if (codeLensLanguages.includes(language)) {
    editor.updateOptions({
      codeLens: true
    })
  }
}

// Función para registrar snippets específicos por lenguaje
export function registerLanguageSpecificSnippets(monaco) {
  // JavaScript/TypeScript snippets
  const jsTsSnippets = [
    {
      label: 'console.log',
      insertText: 'console.log($1);',
      documentation: 'Console log statement'
    },
    {
      label: 'function',
      insertText: 'function ${1:functionName}(${2:parameters}) {\n\t${3:// body}\n}',
      documentation: 'Function declaration'
    },
    {
      label: 'arrow function',
      insertText: 'const ${1:functionName} = (${2:parameters}) => {\n\t${3:// body}\n}',
      documentation: 'Arrow function'
    },
    {
      label: 'if statement',
      insertText: 'if (${1:condition}) {\n\t${2:// body}\n}',
      documentation: 'If statement'
    },
    {
      label: 'try-catch',
      insertText: 'try {\n\t${1:// try block}\n} catch (${2:error}) {\n\t${3:// catch block}\n}',
      documentation: 'Try-catch block'
    },
    {
      label: 'import',
      insertText: 'import ${1:module} from \'${2:path}\'',
      documentation: 'Import statement'
    },
    {
      label: 'export default',
      insertText: 'export default ${1:name}',
      documentation: 'Export default'
    },
    {
      label: 'for loop',
      insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t${3:// body}\n}',
      documentation: 'For loop'
    },
    {
      label: 'forEach',
      insertText: '${1:array}.forEach((${2:item}) => {\n\t${3:// body}\n});',
      documentation: 'ForEach loop'
    },
    {
      label: 'map',
      insertText: '${1:array}.map((${2:item}) => ${3:expression});',
      documentation: 'Map function'
    }
  ]
  
  // Python snippets
  const pythonSnippets = [
    {
      label: 'def',
      insertText: 'def ${1:function_name}(${2:parameters}):\n\t${3:pass}',
      documentation: 'Function definition'
    },
    {
      label: 'class',
      insertText: 'class ${1:ClassName}:\n\tdef __init__(self${2:, parameters}):\n\t\t${3:pass}',
      documentation: 'Class definition'
    },
    {
      label: 'if',
      insertText: 'if ${1:condition}:\n\t${2:pass}',
      documentation: 'If statement'
    },
    {
      label: 'for',
      insertText: 'for ${1:item} in ${2:iterable}:\n\t${3:pass}',
      documentation: 'For loop'
    },
    {
      label: 'while',
      insertText: 'while ${1:condition}:\n\t${2:pass}',
      documentation: 'While loop'
    },
    {
      label: 'try-except',
      insertText: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}',
      documentation: 'Try-except block'
    },
    {
      label: 'import',
      insertText: 'import ${1:module}',
      documentation: 'Import module'
    },
    {
      label: 'from import',
      insertText: 'from ${1:module} import ${2:name}',
      documentation: 'From import'
    },
    {
      label: 'print',
      insertText: 'print(${1:value})',
      documentation: 'Print statement'
    },
    {
      label: 'list comprehension',
      insertText: '[${1:expression} for ${2:item} in ${3:iterable}]',
      documentation: 'List comprehension'
    }
  ]
  
  // HTML snippets
  const htmlSnippets = [
    {
      label: 'div',
      insertText: '<div class="${1:className}">\n\t${2:content}\n</div>',
      documentation: 'Div element'
    },
    {
      label: 'span',
      insertText: '<span class="${1:className}">${2:content}</span>',
      documentation: 'Span element'
    },
    {
      label: 'link',
      insertText: '<link rel="stylesheet" href="${1:style.css}">',
      documentation: 'Link stylesheet'
    },
    {
      label: 'script',
      insertText: '<script src="${1:script.js}"></script>',
      documentation: 'Script element'
    },
    {
      label: 'img',
      insertText: '<img src="${1:image.jpg}" alt="${2:description}">',
      documentation: 'Image element'
    },
    {
      label: 'a',
      insertText: '<a href="${1:#}">${2:link text}</a>',
      documentation: 'Anchor element'
    },
    {
      label: 'form',
      insertText: '<form action="${1:/submit}" method="${2:POST}">\n\t${3:content}\n</form>',
      documentation: 'Form element'
    },
    {
      label: 'input',
      insertText: '<input type="${1:text}" name="${2:name}" placeholder="${3:placeholder}">',
      documentation: 'Input element'
    },
    {
      label: 'button',
      insertText: '<button type="${1:submit}">${2:text}</button>',
      documentation: 'Button element'
    },
    {
      label: 'meta',
      insertText: '<meta charset="${1:UTF-8}">',
      documentation: 'Meta element'
    }
  ]
  
  // CSS snippets
  const cssSnippets = [
    {
      label: 'margin',
      insertText: 'margin: ${1:0};',
      documentation: 'Margin shorthand'
    },
    {
      label: 'padding',
      insertText: 'padding: ${1:0};',
      documentation: 'Padding shorthand'
    },
    {
      label: 'display',
      insertText: 'display: ${1:flex};',
      documentation: 'Display property'
    },
    {
      label: 'position',
      insertText: 'position: ${1:relative};',
      documentation: 'Position property'
    },
    {
      label: 'width',
      insertText: 'width: ${1:100%};',
      documentation: 'Width property'
    },
    {
      label: 'height',
      insertText: 'height: ${1:100%};',
      documentation: 'Height property'
    },
    {
      label: 'background',
      insertText: 'background: ${1:#ffffff};',
      documentation: 'Background property'
    },
    {
      label: 'color',
      insertText: 'color: ${1:#000000};',
      documentation: 'Color property'
    },
    {
      label: 'font-size',
      insertText: 'font-size: ${1:16px};',
      documentation: 'Font size property'
    },
    {
      label: 'border',
      insertText: 'border: ${1:1px solid #ccc};',
      documentation: 'Border property'
    }
  ]
  
  // Registrar snippets para cada lenguaje
  const snippetProviders = {
    javascript: jsTsSnippets,
    typescript: jsTsSnippets,
    python: pythonSnippets,
    html: htmlSnippets,
    css: cssSnippets,
    scss: cssSnippets,
    less: cssSnippets
  }
  
  Object.entries(snippetProviders).forEach(([lang, snippets]) => {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }
        
        return {
          suggestions: snippets.map(snippet => ({
            label: snippet.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: snippet.documentation,
            range: range
          }))
        }
      }
    })
  })
}

// Decoraciones de la IA (líneas añadidas/modificadas)
let aiDecorations = []

// Referencia al ThemeManager
let themeManager = null

export async function createEditor(container, state, themeMgr = null) {
  const monaco = window.monaco
  if (!monaco) throw new Error('Monaco no cargado')
  state.monacoRef = monaco
  
  const snippetManager = new SnippetManager(monaco);
  await snippetManager.init();
  // Guardar referencia al ThemeManager
  themeManager = themeMgr

  // ── Registrar extensiones de lenguaje ─────────────────────────────────────
  registerAllLanguages(monaco)

  // ── Configuración de TypeScript/JavaScript con JSX ───────────────────────────
  setupTypeScriptAndJSX(monaco)

  // ── Configuración del Editor ────────────────────────────────────────────────
  // Los temas se gestionan a través de ThemeManager
  // No definimos temas aquí para evitar conflictos

  // Determinar tema inicial
  const initialTheme = themeManager ? themeManager.themes[themeManager.currentTheme]?.monacoTheme : 'vs-dark'
  
  const editor = monaco.editor.create(container, {
    value: '',
    language: 'plaintext',
    theme: initialTheme,
    fontSize: state.settings.fontSize,
    fontFamily: state.settings.fontFamily,
    fontLigatures: true,
    minimap: { enabled: state.settings.minimap, scale: 1 },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: state.settings.tabSize,
    insertSpaces: true,
    wordWrap: state.settings.wordWrap,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    renderLineHighlight: 'all',
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    suggest: {
      showStatusBar: true,
      preview: true,
      previewMode: 'subwordSmart',
      insertMode: 'replace',
    },
    quickSuggestions: { other: true, comments: true, strings: true },
    parameterHints: { enabled: true },
    formatOnPaste: true,
    formatOnType: false,
    renderWhitespace: 'selection',
    occurrencesHighlight: 'multiFile',
    inlineSuggest: { 
      enabled: true,
      showToolbar: 'always',
      keepOnBlur: true,
      showOnHover: true
    },
    'semanticHighlighting.enabled': true,
    padding: { top: 12, bottom: 12 },
    scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
    hover: { enabled: true, delay: 300 },
    contextmenu: true,
    multiCursorModifier: 'alt',
    snippetSuggestions: 'top',
    tabCompletion: 'on',
    // Configuración avanzada por lenguaje
    acceptSuggestionOnCommitCharacter: true,
    acceptSuggestionOnEnter: 'on',
    codeActionsOnSave: {
      'source.fixAll': 'explicit',
      'source.organizeImports': 'explicit'
    },
    codeLens: true,
    lightbulb: { enabled: true },
    definitionLinkOpensInPeek: true,
    gotoLocation: { multipleDefinitions: 'goto' },
    links: true,
    mouseWheelZoom: true,
    showFoldingControls: 'mouseover',
    showUnused: true,
    smartSelect: { enabled: true },
    stickyScroll: { enabled: true },
    stickyTabStops: true,
    unicodeHighlight: { 
      ambiguousCharacters: true, 
      invisibleCharacters: true 
    },
    unboundLinkTargets: true,
    wordBasedSuggestions: true,
    wordBasedSuggestionsOnlyLanguages: true,
    suggestSelection: 'first'
  })

  state.editorInstance = editor
  
  // Guardar instancia global para acceso desde otros componentes
  window.__editorInstance = editor

  const lspVersions = new Map()
  const lspDidChangeTimers = new Map()
  const lspOpenedFiles = new Set()

  function filePathToFileUri(filePath) {
    let out = String(filePath || '').replace(/\\/g, '/')
    if (!out) return ''
    if (!out.startsWith('/')) out = '/' + out
    return 'file://' + encodeURI(out)
  }

  function fileUriToFilePath(uri) {
    try {
      const u = String(uri || '')
      if (!u.startsWith('file://')) return null
      const decoded = decodeURI(u.replace(/^file:\/\//, ''))
      const cleaned = decoded.startsWith('/') ? decoded.slice(1) : decoded
      return cleaned.replace(/\//g, '\\')
    } catch {
      return null
    }
  }

  function filePathToInMemoryUri(filePath) {
    return monaco.Uri.parse('inmemory:///' + String(filePath).replace(/\\/g, '/'))
  }

  function modelUriToFilePath(model) {
    const uri = model?.uri
    if (!uri || uri.scheme !== 'inmemory') return state.currentFile || ''
    const rawPath = decodeURIComponent(uri.path || '').replace(/^\/+/, '')
    return rawPath.replace(/\//g, '\\')
  }

  function ensureLspStarted(languageId) {
    if (!window.api?.lspStart) return
    window.api.lspStart(languageId).catch(() => {})
  }

  async function lspDidOpenForFile(filePath, model) {
    if (!window.api?.lspDidOpen) return
    if (!filePath || lspOpenedFiles.has(filePath)) return
    const languageId = model.getLanguageId()
    ensureLspStarted(languageId)
    const prev = lspVersions.get(filePath) || 0
    const version = prev + 1
    lspVersions.set(filePath, version)
    const uri = filePathToFileUri(filePath)
    await window.api.lspDidOpen({ uri, languageId, text: model.getValue(), version })
    lspOpenedFiles.add(filePath)
  }

  function lspDidChangeForFileDebounced(filePath, model) {
    if (!window.api?.lspDidChange) return
    if (!filePath) return
    const languageId = model.getLanguageId()
    ensureLspStarted(languageId)

    const existing = lspDidChangeTimers.get(filePath)
    if (existing) clearTimeout(existing)

    const t = setTimeout(async () => {
      const prev = lspVersions.get(filePath) || 0
      const version = prev + 1
      lspVersions.set(filePath, version)
      const uri = filePathToFileUri(filePath)
      try {
        await window.api.lspDidChange({ uri, languageId, text: model.getValue(), version })
      } catch {}
    }, 180)
    lspDidChangeTimers.set(filePath, t)
  }

  async function ensureModelForFilePath(filePath) {
    if (!filePath) return null
    const uri = filePathToInMemoryUri(filePath)
    let model = monaco.editor.getModel(uri)
    if (model) return model
    try {
      const content = await window.api.readFile(filePath)
      const lang = getLang(filePath)
      model = monaco.editor.createModel(content, lang, uri)
      try { await lspDidOpenForFile(filePath, model) } catch {}
      return model
    } catch {
      return null
    }
  }

  function lspCompletionItemKindToMonaco(kind) {
    const k = Number(kind || 0)
    const map = {
      1: monaco.languages.CompletionItemKind.Text,
      2: monaco.languages.CompletionItemKind.Method,
      3: monaco.languages.CompletionItemKind.Function,
      4: monaco.languages.CompletionItemKind.Constructor,
      5: monaco.languages.CompletionItemKind.Field,
      6: monaco.languages.CompletionItemKind.Variable,
      7: monaco.languages.CompletionItemKind.Class,
      8: monaco.languages.CompletionItemKind.Interface,
      9: monaco.languages.CompletionItemKind.Module,
      10: monaco.languages.CompletionItemKind.Property,
      11: monaco.languages.CompletionItemKind.Unit,
      12: monaco.languages.CompletionItemKind.Value,
      13: monaco.languages.CompletionItemKind.Enum,
      14: monaco.languages.CompletionItemKind.Keyword,
      15: monaco.languages.CompletionItemKind.Snippet,
      16: monaco.languages.CompletionItemKind.Color,
      17: monaco.languages.CompletionItemKind.File,
      18: monaco.languages.CompletionItemKind.Reference,
      19: monaco.languages.CompletionItemKind.Folder,
      20: monaco.languages.CompletionItemKind.EnumMember,
      21: monaco.languages.CompletionItemKind.Constant,
      22: monaco.languages.CompletionItemKind.Struct,
      23: monaco.languages.CompletionItemKind.Event,
      24: monaco.languages.CompletionItemKind.Operator,
      25: monaco.languages.CompletionItemKind.TypeParameter,
    }
    return map[k] || monaco.languages.CompletionItemKind.Text
  }

  function lspRangeToMonacoRange(r) {
    if (!r?.start || !r?.end) return null
    return new monaco.Range(
      (r.start.line ?? 0) + 1,
      (r.start.character ?? 0) + 1,
      (r.end.line ?? 0) + 1,
      (r.end.character ?? 0) + 1,
    )
  }

  function lspEditRangeToMonacoRange(textEdit, fallbackRange) {
    if (!textEdit) return fallbackRange
    if (textEdit.range) return lspRangeToMonacoRange(textEdit.range) || fallbackRange
    if (textEdit.insert && textEdit.replace) {
      return lspRangeToMonacoRange(textEdit.insert) || lspRangeToMonacoRange(textEdit.replace) || fallbackRange
    }
    return fallbackRange
  }

  function lspMarkedStringToMarkdown(contents) {
    if (!contents) return { value: '' }
    if (typeof contents === 'string') return { value: contents }
    if (Array.isArray(contents)) {
      const parts = contents
        .map((c) => {
          if (!c) return ''
          if (typeof c === 'string') return c
          if (c.value) return c.value
          return ''
        })
        .filter(Boolean)
      return { value: parts.join('\n\n') }
    }
    if (contents.value) return { value: contents.value }
    return { value: '' }
  }

  function getAiApiKey(aiModel) {
    if (!aiModel) return ''
    if (aiModel.includes('deepseek')) return localStorage.getItem('ide_deepseek_api_key') || ''
    if (aiModel.includes('llama') || aiModel.includes('groq')) return localStorage.getItem('ide_groq_api_key') || ''
    return ''
  }

  const lspLanguages = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact', 'python', 'c', 'cpp']

  for (const langId of lspLanguages) {
    monaco.languages.registerCompletionItemProvider(langId, {
      triggerCharacters: ['.', ':', '>', '/', '"', "'", '(', '['],
      provideCompletionItems: async (model, position) => {
        if (!window.api?.lspCompletion) return { suggestions: [] }
        const filePath = modelUriToFilePath(model)
        if (!filePath) return { suggestions: [] }
        const uri = filePathToFileUri(filePath)

        try {
          const resp = await window.api.lspCompletion({ uri, languageId: model.getLanguageId(), position })
          if (!resp?.ok) return { suggestions: [] }
          const result = resp.result
          const items = Array.isArray(result) ? result : result?.items || []

          const word = model.getWordUntilPosition(position)
          const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn)

          let suggestions = items
            .map((it) => {
              const label = typeof it.label === 'string' ? it.label : (it.label?.label || '')
              const insertText = it.insertText || it.textEdit?.newText || label
              const editRange = lspEditRangeToMonacoRange(it.textEdit, range)
              const isSnippet = it.insertTextFormat === 2
              return {
                label,
                kind: lspCompletionItemKindToMonaco(it.kind),
                detail: it.detail || '',
                documentation: it.documentation?.value || it.documentation || '',
                insertText,
                range: editRange || range,
                filterText: it.filterText || label,
                sortText: it.sortText,
                preselect: Boolean(it.preselect),
                commitCharacters: Array.isArray(it.commitCharacters) ? it.commitCharacters : undefined,
                insertTextRules: isSnippet
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                  : monaco.languages.CompletionItemInsertTextRule.KeepWhitespace,
              }
            })
            .filter((s) => s.label)



          return { suggestions }
        } catch {
          return { suggestions: [] }
        }
      },
    })

    monaco.languages.registerHoverProvider(langId, {
      provideHover: async (model, position) => {
        if (!window.api?.lspHover) return null
        const filePath = modelUriToFilePath(model)
        if (!filePath) return null
        const uri = filePathToFileUri(filePath)
        try {
          const resp = await window.api.lspHover({ uri, languageId: model.getLanguageId(), position })
          if (!resp?.ok || !resp.result) return null
          const result = resp.result
          const range = result.range ? lspRangeToMonacoRange(result.range) : null
          const contents = lspMarkedStringToMarkdown(result.contents)
          if (!contents?.value) return null
          return {
            range: range || undefined,
            contents: [contents],
          }
        } catch {
          return null
        }
      },
    })

    monaco.languages.registerDefinitionProvider(langId, {
      provideDefinition: async (model, position) => {
        if (!window.api?.lspDefinition) return null
        const filePath = modelUriToFilePath(model)
        if (!filePath) return null
        const uri = filePathToFileUri(filePath)
        try {
          const resp = await window.api.lspDefinition({ uri, languageId: model.getLanguageId(), position })
          if (!resp?.ok || !resp.result) return null
          const res = resp.result
          const locs = Array.isArray(res) ? res : [res]

          const out = []
          for (const loc of locs) {
            const targetUri = loc?.uri
            const targetRange = loc?.range
            if (!targetUri || !targetRange) continue
            const targetPath = fileUriToFilePath(targetUri)
            if (!targetPath) continue

            await ensureModelForFilePath(targetPath)

            out.push({
              uri: filePathToInMemoryUri(targetPath),
              range: lspRangeToMonacoRange(targetRange),
            })
          }

          return out.length ? out : null
        } catch {
          return null
        }
      },
    })
  }

  // ── Configurar colores para Ghost Text ─────────────────────────────────────
  // Asegurar que el ghost text sea visible
  monaco.editor.defineTheme('ghost-text-theme', {
    base: initialTheme === 'vs-dark' ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.inlineSuggest.foreground': '#888888',
      'editor.inlineSuggest.background': '#2d2d30',
      'editorGhostText.foreground': '#888888',
      'editorGhostText.background': '#2d2d30',
    }
  })
  
  // Aplicar el tema si es dark
  if (initialTheme === 'vs-dark') {
    monaco.editor.setTheme('ghost-text-theme')
  }

  // ── Proveedor de autocompletado con IA ────────────────────────────────
  registerInlineGhostProvidersV2(monaco, state)
  registerHtmlSnippetCompletions(monaco)
  
  // ── Configurar soporte completo para lenguajes ─────────────────────────────
  registerLanguageSpecificSnippets(monaco)

  // ── Comandos de prueba para Ghost Text ────────────────────────────────────
  // Trigger manual con Ctrl+Shift+I para debug
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyI, () => {
    console.log('[DEBUG] Manual ghost text trigger')
    editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
  })

  // Autocompletado automático como Cursor/Windsurf - MÁS AGRESIVO
  let triggerTimer = null
  let currentRequest = null

  editor.onDidChangeModelContent((e) => {
    if (state.currentFile) {
      state.markDirty(state.currentFile)

      const model = editor.getModel()
      if (model) lspDidChangeForFileDebounced(state.currentFile, model)
      
      // Capturar estado para el historial
      const currentFile = state.currentFile
      const content = editor.getValue()
      const cursor = editor.getPosition()
      const selection = editor.getSelection()
      
      // Agrupar cambios de escritura normales, PERO forzar si es fin de frase
      const lastChar = e.changes[0]?.text?.slice(-1)
      const isSentenceEnd = /[\.\!\?\;\:\n]/.test(lastChar)
      
      const isTyping = e.changes?.some(ch => 
        ch.text && ch.rangeLength === 0 && ch.text.length <= 20
      )
      
      const forcePush = !isTyping || isSentenceEnd

      historyManager.pushState(currentFile, {
        content,
        cursor,
        selection,
        language: getLang(currentFile)
      }, forcePush)

      // Guardar historial en disco (debounce)
      clearTimeout(state.historySaveTimer)
      state.historySaveTimer = setTimeout(async () => {
        const historyData = historyManager.getHistory(currentFile)
        await window.api.historySave(currentFile, historyData)
      }, 2000)
    }

    console.log('[editor] Content changed:', e.changes.length, 'changes')
    
    // Autocompletado automático como Cursor/Windsurf
    const isTypingForGhost = e.changes?.some(ch => 
      ch.text && ch.rangeLength === 0 && ch.text.length <= 20
    )

    if (!isTypingForGhost) return

    // Cancelar petición anterior si existe
    if (currentRequest) {
      currentRequest.cancelled = true
      currentRequest = null
    }

    clearTimeout(triggerTimer)
    triggerTimer = setTimeout(() => {
      console.log('[editor] Triggering inline completion...')
      editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
    }, 200)
  })

  // Trigger manual con Ctrl+Espacio (opcional)
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
    editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
  })

  // Se activa con Ctrl+Space cuando hay contexto suficiente
  monaco.languages.registerCompletionItemProvider('*', {
    triggerCharacters: ['.', '(', ' '],
    provideCompletionItems: async (model, position) => {
      // Solo si hay suficiente contexto (evita spam de requests)
      const lineContent = model.getLineContent(position.lineNumber)
      if (lineContent.trim().length < 3) return { suggestions: [] }

      // Completados estándar de Monaco ya están activos; esto añade IA inline
      return { suggestions: [] }  // El inline suggest se maneja por separado
    },
  })

  // ── Guardar ───────────────────────────────────────────────────────────
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
    if (!state.currentFile) return
    const content = editor.getValue()
    await window.api.saveFile(state.currentFile, content)
    state.markSaved(state.currentFile, content)
    state.emit('fileSaved', state.currentFile)
  })

  // ── Historial: Undo / Redo ───────────────────────────────────────────
  
  // Undo: Ctrl+Z
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
    const prevState = historyManager.undo(state.currentFile)
    if (prevState) {
      applyHistoryState(editor, prevState)
    }
  })

  // Redo: Ctrl+Shift+Z o Ctrl+Y
  const redoAction = () => {
    const nextState = historyManager.redo(state.currentFile)
    if (nextState) {
      applyHistoryState(editor, nextState)
    }
  }
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, redoAction)
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, redoAction)
  
  // Handlers para el menú superior (main menu)
  state.on('editorUndo', () => {
    const prevState = historyManager.undo(state.currentFile)
    if (prevState) applyHistoryState(editor, prevState)
  })
  state.on('editorRedo', () => {
    const nextState = historyManager.redo(state.currentFile)
    if (nextState) applyHistoryState(editor, nextState)
  })

  // Timeline Visual: Ctrl+Alt+Z
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
    state.emit('toggleHistoryTimeline')
  })

  // Formatear Documento: Shift+Alt+F
  editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
    editor.getAction('editor.action.formatDocument').run()
  })

  // Registrar Formateador (DocumentFormattingEditProvider)
  monaco.languages.registerDocumentFormattingEditProvider('*', {
    async provideDocumentFormattingEdits(model) {
      const { formatCode } = await import('../utils/formatter.js')
      const formatted = await formatCode(model.getValue(), model.getLanguageId())
      return [{
        range: model.getFullModelRange(),
        text: formatted
      }]
    }
  })

  // Desactivado: interfería con Monaco al aceptar sugerencias, snippets e indentación con Tab.
  editor.onKeyDown(async (e) => {
    if (false && e.keyCode === monaco.KeyCode.Tab && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      const position = editor.getPosition()
      const model = editor.getModel()
      if (!model) return

      const lineContent = model.getLineContent(position.lineNumber)
      if (lineContent.trim().length > 0) {
        // Ejecutar formateo de la acción de Monaco (o nuestro formateador para la línea)
        // Usamos un pequeño delay para dejar que Monaco procese el tab primero o lo hacemos antes
        const { formatCode } = await import('../utils/formatter.js')
        const formatted = await formatCode(lineContent, model.getLanguageId())
        
        if (formatted.trim() !== lineContent.trim()) {
          editor.executeEdits('auto-format', [{
            range: new monaco.Range(position.lineNumber, 1, position.lineNumber, lineContent.length + 1),
            text: formatted
          }])
        }
      }
    }
  })

  function applyHistoryState(ed, hs) {
    // Usar executeEdits para que la operación sea tratada como una sola unidad
    // pero sin que nuestra propia captura de onDidChangeModelContent lo procese de nuevo
    // (HistoryManager ya maneja que si el contenido es igual no duplica)
    const model = ed.getModel()
    if (!model) return

    ed.executeEdits('history-nav', [{
      range: model.getFullModelRange(),
      text: hs.content,
      forceMoveMarkers: true
    }])

    if (hs.cursor) ed.setPosition(hs.cursor)
    if (hs.selection) ed.setSelection(hs.selection)
    ed.revealPositionInCenter(hs.cursor || { lineNumber: 1, column: 1 })
    
    // Emitir cambio para actualizar UI
    state.emit('historyChanged', { 
      filePath: state.currentFile, 
      history: historyManager.getHistory(state.currentFile) 
    })
  }

  // ── Selección → AI (Ctrl+L) ───────────────────────────────────────────
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
    const sel  = editor.getSelection()
    const text = editor.getModel()?.getValueInRange(sel) || ''
    const lang = getLang(state.currentFile)
    state.aiPendingCode = text.trim() ? { code: text, lang, file: state.currentFile, selection: sel } : null
    state.emit('sendToAI', state.aiPendingCode)
    state.aiPanelOpen = true
    state.emit('panelToggle', { panel: 'ai', open: true })
  })

  // ── Inline AI suggest (Ctrl+K) — pide sugerencia de la IA ────────────
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    const sel  = editor.getSelection()
    const code = editor.getModel()?.getValueInRange(sel) || ''
    state.emit('aiInlineRequest', {
      code,
      file: state.currentFile,
      selection: sel,
      fullCode: editor.getValue(),
    })
  })

  // ── Abrir archivo ─────────────────────────────────────────────────────
  state.on('fileOpened', ({ filePath, content }) => {
    const lang = getLang(filePath)
    const uri  = monaco.Uri.parse('inmemory:///' + filePath.replace(/\\/g, '/'))
    let model  = monaco.editor.getModel(uri)
    if (!model) {
      model = monaco.editor.createModel(content, lang, uri)
    } else {
      if (model.getValue() !== content) model.setValue(content)
      monaco.editor.setModelLanguage(model, lang)
    }
    editor.setModel(model)

    lspDidOpenForFile(filePath, model).catch(() => {})
    
    // Configurar el editor específicamente para este lenguaje
    configureEditorForLanguage(editor, lang, filePath)
    
    // Restaurar posición del cursor si existía
    const tab = state.getTab(filePath)
    if (tab?.cursorPos) editor.setPosition(tab.cursorPos)
    editor.focus()

    // Cargar historial persistente
    window.api.historyGet(filePath).then(data => {
      if (data) historyManager.loadHistory(filePath, data)
    })

    // Limpiar decoraciones IA al cambiar de archivo
    clearAIDecorations()

    setTimeout(() => {
      editor.trigger('keyboard', 'editor.action.inlineSuggest.trigger', {})
    }, 100)
  })

  state.on('editorClear', () => {
    editor.setModel(monaco.editor.createModel('', 'plaintext'))
    clearAIDecorations()
  })

  // (Eliminado el onDidChangeModelContent duplicado que solo marcaba dirty)

  // Guardar posición del cursor al cambiar de tab
  editor.onDidChangeCursorPosition(e => {
    const tab = state.getTab(state.currentFile)
    if (tab) tab.cursorPos = e.position
  })

  // ── Aplicar edición de la IA con decoraciones de color ───────────────
  state.on('aiApplyEdit', ({ newCode, selection }) => {
    applyAIEdit(editor, monaco, newCode, selection)
  })

  // ── Actualizar settings ───────────────────────────────────────────────
  state.on('settingsChanged', (s) => {
    editor.updateOptions({
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      tabSize: s.tabSize,
      wordWrap: s.wordWrap,
      minimap: { enabled: s.minimap },
    })
  })
  
  // ── Integración con ThemeManager ────────────────────────────────────────
  if (themeManager) {
    // Escuchar cambios de tema
    themeManager.addThemeChangeListener((themeId, theme) => {
      if (monaco && editor) {
        try {
          monaco.editor.setTheme(theme.monacoTheme)
        } catch (error) {
          console.warn('Error al aplicar tema de Monaco:', error)
          // Fallback a tema por defecto
          monaco.editor.setTheme('vs-dark')
        }
      }
    })
    
    // Aplicar tema actual si ya está cargado
    if (themeManager.currentTheme && themeManager.monacoReady) {
      const currentTheme = themeManager.themes[themeManager.currentTheme]
      if (currentTheme) {
        monaco.editor.setTheme(currentTheme.monacoTheme)
      }
    }
  }

  return editor
}

// ── Funciones de utilidad para gestión de temas ─────────────────────────────

/**
 * Aplica un tema de Monaco al editor
 * @param {Object} editor - Instancia del editor Monaco
 * @param {string} themeId - ID del tema a aplicar
 */
export function applyEditorTheme(editor, themeId) {
  if (!editor || !window.monaco) return
  
  try {
    // Si hay ThemeManager, usarlo
    if (themeManager && themeManager.themes[themeId]) {
      const theme = themeManager.themes[themeId]
      window.monaco.editor.setTheme(theme.monacoTheme)
    } else {
      // Fallback a temas básicos de Monaco
      const fallbackThemes = {
        'dark': 'vs-dark',
        'light': 'vs',
        'high-contrast': 'hc-black'
      }
      window.monaco.editor.setTheme(fallbackThemes[themeId] || 'vs-dark')
    }
  } catch (error) {
    console.error('Error aplicando tema al editor:', error)
  }
}

/**
 * Obtiene el tema actual del editor
 * @param {Object} editor - Instancia del editor Monaco
 * @returns {string} ID del tema actual
 */
export function getCurrentEditorTheme(editor) {
  if (!editor || !window.monaco) return 'dark'
  
  try {
    // Si hay ThemeManager, obtener tema actual
    if (themeManager) {
      return themeManager.currentTheme || 'dark'
    }
    
    // Intentar obtener desde Monaco (no siempre disponible)
    const theme = window.monaco.editor.getTheme()
    return theme || 'dark'
  } catch (error) {
    console.warn('Error obteniendo tema del editor:', error)
    return 'dark'
  }
}

/**
 * Establece el ThemeManager para el editor
 * @param {Object} themeMgr - Instancia de ThemeManager
 */
export function setThemeManager(themeMgr) {
  themeManager = themeMgr
}

// ── Aplicar edición IA con highlight de cambios ────────────────────────────
export function applyAIEdit(editor, monaco, newCode, selection) {
  clearAIDecorations()

  const model = editor.getModel()
  if (!model) return

  let range, oldLines

  if (selection && !isSelectionEmpty(selection)) {
    // Reemplazar solo la selección
    range = new monaco.Range(
      selection.startLineNumber, selection.startColumn,
      selection.endLineNumber,   selection.endColumn
    )
    oldLines = selection.endLineNumber - selection.startLineNumber
  } else {
    // Reemplazar todo el archivo
    const lineCount = model.getLineCount()
    range = new monaco.Range(1, 1, lineCount, model.getLineMaxColumn(lineCount))
    oldLines = lineCount
  }

  // Aplicar edición
  editor.executeEdits('ai-edit', [{ range, text: newCode }])

  // Calcular rango de las líneas nuevas para decorar
  const startLine = range.startLineNumber
  const newLines  = newCode.split('\n').length
  const endLine   = startLine + newLines - 1

  // Decorar líneas modificadas por la IA (verde translúcido)
  const decorations = []
  for (let i = startLine; i <= endLine; i++) {
    decorations.push({
      range: new monaco.Range(i, 1, i, 1),
      options: {
        isWholeLine: true,
        className: 'ai-added-line',
        glyphMarginClassName: 'ai-glyph',
        overviewRuler: { color: '#2ea043aa', position: monaco.editor.OverviewRulerLane.Left },
      },
    })
  }

  aiDecorations = editor.deltaDecorations([], decorations)

  // Auto-limpiar las decoraciones después de 8 segundos
  setTimeout(() => clearAIDecorations(editor), 8000)
}

function clearAIDecorations(editorInst) {
  const ed = editorInst || window.__editorInstance
  if (ed && aiDecorations.length) {
    ed.deltaDecorations(aiDecorations, [])
    aiDecorations = []
  }
}

function isSelectionEmpty(sel) {
  return sel.startLineNumber === sel.endLineNumber && sel.startColumn === sel.endColumn
}

// ── Configuración de TypeScript/JavaScript con JSX ─────────────────────────────
function setupTypeScriptAndJSX(monaco) {
  // Configuración de TypeScript compiler options
  const tsCompilerOptions = {
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    jsx: monaco.languages.typescript.JsxEmit.React,
    jsxFactory: 'React.createElement',
    jsxFragmentFactory: 'React.Fragment',
    allowJs: true,
    checkJs: false,
    strict: true,
    noImplicitAny: false, // Reducir errores para mejor experiencia
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true,
    resolveJsonModule: true,
    isolatedModules: true,
    declaration: false,
    sourceMap: true,
  }

  // Aplicar configuración a TypeScript y JavaScript
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    ...tsCompilerOptions,
    allowJs: true,
    checkJs: false,
  })

  // Agregar tipos de React como extraLibs
  const reactTypes = {
    // React types básicos
    'react.d.ts': `
      declare namespace React {
        interface FunctionComponent<P = {}> {
          (props: P): JSX.Element | null;
          displayName?: string;
        }
        
        interface ComponentClass<P = {}> {
          new (props: P): Component<P>;
          displayName?: string;
        }
        
        interface Component<P = {}> {
          setState<K extends keyof P>(state: ((prevState: Readonly<P>, props: Readonly<P>) => (Pick<P, K> | P | null)) | (Pick<P, K> | P | null), callback?: () => void): void;
          forceUpdate(callback?: () => void): void;
          readonly props: Readonly<P>;
          state: Readonly<P>;
          context: any;
          refs: { [key: string]: ReactInstance };
        }
        
        interface ReactInstance {
          render(): ReactNode;
        }
        
        type ReactNode = ReactElement | string | number | ReactFragment | ReactPortal | boolean | null | undefined;
        
        interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>> {
          type: T;
          props: P;
          key: Key | null;
        }
        
        interface ReactFragment {
          key?: Key | null;
        }
        
        interface ReactPortal {
          key: Key | null;
          children: ReactNode;
        }
        
        type Key = string | number;
        
        interface Attributes {
          key?: Key;
        }
        
        interface DOMAttributes<T> {
          children?: ReactNode;
        }
        
        interface IntrinsicAttributes extends Attributes { }
        interface IntrinsicClassAttributes<T> extends Attributes { }
        
        interface IntrinsicElements {
          [elemName: string]: DOMAttributes<any> & IntrinsicAttributes;
        }
        
        type JSXElementConstructor<P = {}> = 
          | ((props: P) => ReactElement | null)
          | (new (props: P) => Component<P>);
        
        namespace JSX {
          interface IntrinsicAttributes extends Attributes { }
          interface IntrinsicClassAttributes<T> extends Attributes { }
          interface IntrinsicElements {
            [elemName: string]: DOMAttributes<any> & IntrinsicAttributes;
          }
          interface ElementAttributesProperty { props: {}; }
          interface ElementChildrenAttribute { children: {}; }
        }
      }
      
      declare const React: {
        createElement<P extends {}>(
          type: string | FunctionComponent<P> | ComponentClass<P>,
          props?: Attributes & P,
          ...children: ReactNode[]
        ): ReactElement<P>;
        Fragment: ReactFragment;
        Component: ComponentConstructor;
        FunctionComponent: FunctionComponentConstructor;
      };
      
      type ComponentConstructor = new <P = {}>(props: P) => Component<P>;
      type FunctionComponentConstructor = <P = {}>(props: P) => ReactElement<P> | null;
      
      export = React;
    `,
    
    // React DOM types
    'react-dom.d.ts': `
      declare namespace ReactDOM {
        function render(element: React.ReactNode, container: Element): void;
        function hydrate(element: React.ReactNode, container: Element): void;
        function createPortal(children: React.ReactNode, container: Element): React.ReactPortal;
      }
      
      declare const ReactDOM: typeof ReactDOM;
      export = ReactDOM;
    `,
    
    // Global types
    'global.d.ts': `
      declare global {
        namespace JSX {
          interface IntrinsicElements {
            div: React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
            span: React.DetailedHTMLProps<React.HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>;
            button: React.DetailedHTMLProps<React.ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;
            input: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
            form: React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement>;
            a: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>;
            img: React.DetailedHTMLProps<React.ImgHTMLAttributes<HTMLImageElement>, HTMLImageElement>;
            p: React.DetailedHTMLProps<React.HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>;
            h1: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h2: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h3: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h4: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h5: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            h6: React.DetailedHTMLProps<React.HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>;
            ul: React.DetailedHTMLProps<React.HTMLAttributes<HTMLUListElement>, HTMLUListElement>;
            ol: React.DetailedHTMLProps<React.HTMLAttributes<HTMLOListElement>, HTMLOListElement>;
            li: React.DetailedHTMLProps<React.HTMLAttributes<HTMLLIElement>, HTMLLIElement>;
            table: React.DetailedHTMLProps<React.TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>;
            tr: React.DetailedHTMLProps<React.HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>;
            td: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>;
            th: React.DetailedHTMLProps<React.ThHTMLAttributes<HTMLTableHeaderCellElement>, HTMLTableHeaderCellElement>;
            section: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            nav: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            main: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            header: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            footer: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            article: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
            aside: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
          }
        }
      }
      
      export {};
    `
  }

  // Agregar los tipos de React al workspace
  Object.entries(reactTypes).forEach(([filename, content]) => {
    const uri = monaco.Uri.parse(`file:///node_modules/@types/${filename}`)
    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, uri.toString())
    monaco.languages.typescript.javascriptDefaults.addExtraLib(content, uri.toString())
  })

  // Configurar diagnóstico para ignorar ciertos errores comunes
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    // Ignorar errores específicos que son comunes en desarrollo
    diagnosticCodesToIgnore: [
      2307, // Cannot find module
      2304, // Cannot find name
      1378, // '...' cannot be called
      1375, // 'await' expressions are only allowed
      7016, // Could not find a declaration file
    ]
  })

  monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    diagnosticCodesToIgnore: [
      2307, // Cannot find module
      2304, // Cannot find name
      1378, // '...' cannot be called
      1375, // 'await' expressions are only allowed
      7016, // Could not find a declaration file
    ]
  })

  console.log('✅ TypeScript/JavaScript con JSX configurado correctamente')
}

// ── INLINE COMPLETION PROVIDERS (Ghost Text IA) ────────────────────────────
function registerInlineGhostProviders(monaco, state) {
  console.log('[Ghost Text] Registering inline providers...')
  const inlineLanguages = [
    'plaintext', 'javascript', 'typescript', 'python', 'go', 'java', 'php',
    'csharp', 'cpp', 'html', 'css', 'json', 'markdown',
    'shell', 'sql', 'yaml', 'rust', 'javascriptreact', 'typescriptreact'
  ]

  let currentRequest = null
  let debounceTimer = null
  let lastKey = ''
  let lastSuggestion = ''
  let lastRejectKey = ''
  let lastRejectAt = 0

  function modelToFilePath(model) {
    const uri = model?.uri
    if (uri?.scheme === 'inmemory') {
      return decodeURIComponent(uri.path || '').replace(/^\/+/, '').replace(/\//g, '\\')
    }
    return state.currentFile || ''
  }

  function getImmediateContext(model, position) {
    const line = model.getLineContent(position.lineNumber)
    return {
      line,
      beforeCursor: line.slice(0, position.column - 1),
      afterCursor: line.slice(position.column - 1),
    }
  }

  function shouldTriggerGhostText(model, context) {
    const { beforeCursor, afterCursor } = context
    if (!beforeCursor || !beforeCursor.trim()) return false

    const language = model.getLanguageId()
    const trimmed = beforeCursor.trim()
    const prevChar = beforeCursor.slice(-1)
    const nextChar = afterCursor.slice(0, 1)

    if (/^[\]\)\}\>,;]$/.test(prevChar)) return false
    if (trimmed.length < 2 && !/[.\(<{"'`[]/.test(prevChar)) return false
    if (/^\s+$/.test(afterCursor)) return false
    if (language === 'markdown' && /^#{1,6}\s*$/.test(trimmed)) return false
    if (/^\s*(\/\/|#|\*)/.test(trimmed) && !/[=:(,'"`[{.]$/.test(prevChar)) return false
    if (nextChar && /\w/.test(prevChar) && /\w/.test(nextChar)) return false

    return true
  }

  function buildGhostKey(model, position) {
    const totalText = model.getValue()
    const offset = model.getOffsetAt(position)
    const prefix = totalText.slice(Math.max(0, offset - 600), offset)
    const suffix = totalText.slice(offset, Math.min(totalText.length, offset + 180))
    return `${model.getLanguageId()}::${position.lineNumber}:${position.column}::${prefix}@@${suffix}`
  }

  function createInlineResult(insertText, position, detail) {
    return {
      items: [{
        insertText,
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        isInlineCompletion: true,
        kind: monaco.languages.CompletionItemKind.Text,
        detail
      }],
      dispose() {},
    }
  }

  for (const lang of inlineLanguages) {
    monaco.languages.registerInlineCompletionsProvider(lang, {
      provideInlineCompletions: async (model, position, context, token) => {
        try {
          // Evitar peticiones duplicadas para la misma posición
          if (lastPosition && 
              lastPosition.lineNumber === position.lineNumber && 
              lastPosition.column === position.column) {
            if (lastSuggestion) {
              return {
                items: [{
                  insertText: lastSuggestion,
                  range: new monaco.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column
                  ),
                  command: {
                    id: 'editor.action.inlineSuggest.commit',
                    title: 'Accept'
                  },
                  isInlineCompletion: true,
                  kind: monaco.languages.CompletionItemKind.Text,
                  detail: 'AI Suggestion (cached)'
                }],
                dispose() {},
              }
            }
          }

          console.log('[Ghost Text] === AGGRESSIVE AI INLINE COMPLETION ===')
          console.log('[Ghost Text] Language:', model.getLanguageId())
          
          const line = model.getLineContent(position.lineNumber)
          const beforeCursor = line.slice(0, position.column - 1)
          
          console.log('[Ghost Text] Before cursor:', JSON.stringify(beforeCursor))

          // CONDICIONES MÁS PERMISIVAS - Activar con casi cualquier typing
          const shouldTrigger = 
            beforeCursor.trim().length >= 1 && // Mínimo 1 caracter
            !beforeCursor.includes('//') && // No en comentarios
            !beforeCursor.includes('*') && // No en comentarios de bloque
            !isInString(model, position) && // No en strings
            !beforeCursor.match(/^[\s\t]*$/) // No solo whitespace

          if (!shouldTrigger) {
            console.log('[Ghost Text] Should not trigger, skipping')
            return { items: [], dispose() {} }
          }

          // Cancelar petición anterior
          if (currentRequest) {
            currentRequest.cancelled = true
            currentRequest = null
          }

          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }

          // Debounce más corto para mayor agresividad
          return new Promise((resolve) => {
            const debounceMs = model.getLanguageId() === 'html' ? 220 : 150
            debounceTimer = setTimeout(async () => {
              try {
                if (token.isCancellationRequested) {
                  resolve({ items: [], dispose() {} })
                  return
                }

                const totalText = model.getValue()
                const offset = model.getOffsetAt(position)
                const language = model.getLanguageId()

                // Contexto ampliado para mejor IA
                const contextSize = language === 'html' ? 6500 : 4000
                const suffixLen = language === 'html' ? 1200 : 800
                const prefix = totalText.slice(Math.max(0, offset - contextSize), offset)
                const suffix = totalText.slice(offset, Math.min(totalText.length, offset + suffixLen))

                const filePath = state.currentFile || ''

                // Contexto extendido - más líneas
                const currentLineNum = position.lineNumber
                const startLine = Math.max(1, currentLineNum - 45)
                const endLine = Math.min(model.getLineCount(), currentLineNum + 28)
                
                let extendedContext = ''
                for (let i = startLine; i <= endLine; i++) {
                  const lineContent = model.getLineContent(i)
                  extendedContext += lineContent + '\n'
                }

                // Obtener API key
                let apiKey = ''
                const aiModel = state.aiModel || 'deepseek-chat'
                if (aiModel.includes('deepseek')) {
                  apiKey = localStorage.getItem('ide_deepseek_api_key') || ''
                } else if (aiModel.includes('llama') || aiModel.includes('groq')) {
                  apiKey = localStorage.getItem('ide_groq_api_key') || ''
                }

                if (!apiKey) {
                  console.log('[Ghost Text] No API key, skipping')
                  resolve({ items: [], dispose() {} })
                  return
                }

                // Crear objeto de petición
                const requestObj = { cancelled: false }
                currentRequest = requestObj

                console.log('[Ghost Text] Calling AI with extended context...')

                const structuralContext = buildStructuralContext(model, position, language)

                const suggestion = await withTimeout(
                  window.api.aiInlineComplete({
                    model: aiModel,
                    prefix,
                    suffix,
                    extendedContext,
                    language,
                    filePath,
                    currentLine: currentLineNum,
                    beforeCursor,
                    structuralContext,
                    apiKey,
                  }),
                  15000 // 15 segundos para respuestas largas de IA
                )

                // Verificar si la petición fue cancelada
                if (requestObj.cancelled) {
                  console.log('[Ghost Text] Request cancelled')
                  resolve({ items: [], dispose() {} })
                  return
                }

                if (currentRequest === requestObj) {
                  currentRequest = null
                }

                if (token.isCancellationRequested) {
                  console.log('[Ghost Text] Token cancelled')
                  resolve({ items: [], dispose() {} })
                  return
                }

                console.log('[Ghost Text] AI suggestion received:', suggestion?.substring(0, 150))

                if (!suggestion || suggestion.trim().length === 0) {
                  console.log('[Ghost Text] No suggestion, returning empty')
                  resolve({ items: [], dispose() {} })
                  return
                }

                // Validación más permisiva
                if (suggestion.length > 1000) {
                  console.log('[Ghost Text] Suggestion too long, truncating')
                  // Truncar en lugar de rechazar
                  const truncated = suggestion.substring(0, 1000)
                  lastPosition = { ...position }
                  lastSuggestion = truncated
                  
                  resolve({
                    items: [{
                      insertText: truncated,
                      range: new monaco.Range(
                        position.lineNumber,
                        position.column,
                        position.lineNumber,
                        position.column
                      ),
                      command: {
                        id: 'editor.action.inlineSuggest.commit',
                        title: 'Accept'
                      },
                      isInlineCompletion: true,
                      kind: monaco.languages.CompletionItemKind.Text,
                      detail: 'AI Suggestion (truncated)'
                    }],
                    dispose() {},
                  })
                  return
                }

                // Sanitización mejorada
                const cleaned = sanitizeInlineCompletion(
                  suggestion,
                  beforeCursor,
                  language,
                  suffix,
                  structuralContext
                )
                if (!cleaned || cleaned.trim().length === 0) {
                  console.log('[Ghost Text] Sanitization returned empty')
                  resolve({ items: [], dispose() {} })
                  return
                }

                // Guardar para caché
                lastPosition = { ...position }
                lastSuggestion = cleaned

                console.log('[Ghost Text] Final suggestion:', cleaned.substring(0, 100))

                resolve({
                  items: [{
                    insertText: cleaned,
                    range: new monaco.Range(
                      position.lineNumber,
                      position.column,
                      position.lineNumber,
                      position.column
                    ),
                    command: {
                      id: 'editor.action.inlineSuggest.commit',
                      title: 'Accept'
                    },
                    isInlineCompletion: true,
                    kind: monaco.languages.CompletionItemKind.Text,
                    detail: 'AI Suggestion'
                  }],
                  dispose() {},
                })

              } catch (err) {
                console.error('[Ghost Text] Error:', err)
                resolve({ items: [], dispose() {} })
              }
            }, debounceMs) // HTML: un poco más de debounce para alinear con sugerencias del editor
          })

        } catch (err) {
          console.error('[Ghost Text] Provider error:', err)
          return { items: [], dispose() {} }
        }
      },
      
      freeInlineCompletions() {
        // Limpiar caché cuando se liberan completions
        lastPosition = null
        lastSuggestion = ''
      },
    })
  }
}

// ── HTML snippets estilo Emmet básico ────────────────────────────────────
function registerInlineGhostProvidersV2(monaco, state) {
  console.log('[Ghost Text] Registering Cursor-style inline providers...')

  const inlineLanguages = [
    'plaintext', 'javascript', 'typescript', 'python', 'go', 'java', 'php',
    'csharp', 'cpp', 'html', 'css', 'json', 'markdown',
    'shell', 'sql', 'yaml', 'rust', 'javascriptreact', 'typescriptreact'
  ]

  let currentRequest = null
  let debounceTimer = null
  let lastKey = ''
  let lastSuggestion = ''
  let lastRejectKey = ''
  let lastRejectAt = 0

  function modelToFilePath(model) {
    const uri = model?.uri
    if (uri?.scheme === 'inmemory') {
      return decodeURIComponent(uri.path || '').replace(/^\/+/, '').replace(/\//g, '\\')
    }
    return state.currentFile || ''
  }

  function getImmediateContext(model, position) {
    const line = model.getLineContent(position.lineNumber)
    return {
      beforeCursor: line.slice(0, position.column - 1),
      afterCursor: line.slice(position.column - 1),
    }
  }

  function resolveInlineApiKey(aiModel) {
    if (!aiModel) return ''
    if (aiModel.includes('deepseek')) return localStorage.getItem('ide_deepseek_api_key') || ''
    if (aiModel.includes('llama') || aiModel.includes('groq')) return localStorage.getItem('ide_groq_api_key') || ''
    return ''
  }

  function shouldTriggerGhostText(model, context) {
    const { beforeCursor, afterCursor } = context
    if (!beforeCursor || !beforeCursor.trim()) return false

    const language = model.getLanguageId()
    const trimmed = beforeCursor.trim()
    const prevChar = beforeCursor.slice(-1)
    const nextChar = afterCursor.slice(0, 1)

    if (/^[\]\)\}\>,;]$/.test(prevChar)) return false
    if (trimmed.length < 2 && !/[.\(<{"'`[]/.test(prevChar)) return false
    if (/^\s+$/.test(afterCursor)) return false
    if (language === 'markdown' && /^#{1,6}\s*$/.test(trimmed)) return false
    if (/^\s*(\/\/|#|\*)/.test(trimmed) && !/[=:(,'\"`[{.]$/.test(prevChar)) return false
    if (nextChar && /\w/.test(prevChar) && /\w/.test(nextChar)) return false

    return true
  }

  function buildGhostKey(model, position) {
    const totalText = model.getValue()
    const offset = model.getOffsetAt(position)
    const prefix = totalText.slice(Math.max(0, offset - 600), offset)
    const suffix = totalText.slice(offset, Math.min(totalText.length, offset + 180))
    return `${model.getLanguageId()}::${position.lineNumber}:${position.column}::${prefix}@@${suffix}`
  }

  function createInlineResult(insertText, position, detail) {
    return {
      items: [{
        insertText,
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        isInlineCompletion: true,
        kind: monaco.languages.CompletionItemKind.Text,
        detail
      }],
      dispose() {},
    }
  }

  for (const lang of inlineLanguages) {
    monaco.languages.registerInlineCompletionsProvider(lang, {
      provideInlineCompletions: async (model, position, context, token) => {
        try {
          const key = buildGhostKey(model, position)
          if (key === lastKey && lastSuggestion) {
            return createInlineResult(lastSuggestion, position, 'AI Suggestion (cached)')
          }

          if (key === lastRejectKey && (Date.now() - lastRejectAt) < 1200) {
            return { items: [], dispose() {} }
          }

          const immediate = getImmediateContext(model, position)
          if (!shouldTriggerGhostText(model, immediate)) {
            return { items: [], dispose() {} }
          }

          if (currentRequest) {
            currentRequest.cancelled = true
            currentRequest = null
          }
          if (debounceTimer) clearTimeout(debounceTimer)

          return new Promise((resolve) => {
            const language = model.getLanguageId()
            const debounceMs = language === 'html' ? 170 : 110

            debounceTimer = setTimeout(async () => {
              try {
                if (token.isCancellationRequested) {
                  resolve({ items: [], dispose() {} })
                  return
                }

                const totalText = model.getValue()
                const offset = model.getOffsetAt(position)
                const contextSize = language === 'html' ? 6500 : 4500
                const suffixLen = language === 'html' ? 1400 : 900
                const prefix = totalText.slice(Math.max(0, offset - contextSize), offset)
                const suffix = totalText.slice(offset, Math.min(totalText.length, offset + suffixLen))
                const filePath = modelToFilePath(model)
                const currentLineNum = position.lineNumber
                const startLine = Math.max(1, currentLineNum - 45)
                const endLine = Math.min(model.getLineCount(), currentLineNum + 28)

                let extendedContext = ''
                for (let i = startLine; i <= endLine; i++) {
                  extendedContext += model.getLineContent(i) + '\n'
                }

                const aiModel = state.aiModel || 'deepseek-chat'
                const apiKey = resolveInlineApiKey(aiModel)
                if (!apiKey) {
                  lastRejectKey = key
                  lastRejectAt = Date.now()
                  resolve({ items: [], dispose() {} })
                  return
                }

                const structuralContext = buildStructuralContext(model, position, language)
                const requestObj = { cancelled: false, key }
                currentRequest = requestObj

                const suggestion = await withTimeout(
                  window.api.aiInlineComplete({
                    model: aiModel,
                    prefix,
                    suffix,
                    extendedContext,
                    language,
                    filePath,
                    currentLine: currentLineNum,
                    beforeCursor: immediate.beforeCursor,
                    structuralContext,
                    apiKey,
                  }),
                  12000
                )

                if (requestObj.cancelled || token.isCancellationRequested) {
                  resolve({ items: [], dispose() {} })
                  return
                }

                if (currentRequest === requestObj) currentRequest = null

                let cleaned = sanitizeInlineCompletion(
                  suggestion,
                  immediate.beforeCursor,
                  language,
                  suffix,
                  structuralContext
                )

                if (cleaned && cleaned.length > 1200) {
                  cleaned = cleaned.slice(0, 1200)
                }

                if (!cleaned || !cleaned.trim()) {
                  lastRejectKey = key
                  lastRejectAt = Date.now()
                  resolve({ items: [], dispose() {} })
                  return
                }

                lastKey = key
                lastSuggestion = cleaned
                resolve(createInlineResult(cleaned, position, 'AI Suggestion'))
              } catch (err) {
                if (currentRequest?.key === key) currentRequest = null
                lastRejectKey = key
                lastRejectAt = Date.now()
                console.error('[Ghost Text] V2 error:', err)
                resolve({ items: [], dispose() {} })
              }
            }, debounceMs)
          })
        } catch (err) {
          console.error('[Ghost Text] V2 provider error:', err)
          return { items: [], dispose() {} }
        }
      },

      freeInlineCompletions() {
        lastKey = ''
        lastSuggestion = ''
      },
    })
  }
}

function registerHtmlSnippetCompletions(monaco) {
  const htmlSnippets = {
    html: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>$1</title>\n</head>\n<body>\n  $0\n</body>\n</html>',
    p: '<p>$0</p>',
    div: '<div>$0</div>',
    span: '<span>$0</span>',
    h1: '<h1>$0</h1>',
    h2: '<h2>$0</h2>',
    h3: '<h3>$0</h3>',
    ul: '<ul>\n  <li>$0</li>\n</ul>',
    ol: '<ol>\n  <li>$0</li>\n</ol>',
    li: '<li>$0</li>',
    a: '<a href="$1">$0</a>',
    img: '<img src="$1" alt="$0" />',
    button: '<button type="button">$0</button>',
    input: '<input type="$1" name="$2" id="$0" />',
    section: '<section>\n  $0\n</section>',
    article: '<article>\n  $0\n</article>',
    header: '<header>\n  $0\n</header>',
    footer: '<footer>\n  $0\n</footer>',
    main: '<main>\n  $0\n</main>',
    nav: '<nav>\n  $0\n</nav>',
    form: '<form action="$1" method="$2">\n  $0\n</form>',
    label: '<label for="$1">$0</label>',
    textarea: '<textarea name="$1" id="$2" rows="4" cols="50">$0</textarea>',
    script: '<script>\n  $0\n</script>',
    style: '<style>\n  $0\n</style>',
  }

  monaco.languages.registerCompletionItemProvider('html', {
    triggerCharacters: ['<', ' ', '.', '#'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position)
      const range = new monaco.Range(
        position.lineNumber,
        word.startColumn,
        position.lineNumber,
        word.endColumn
      )

      const suggestions = Object.entries(htmlSnippets).map(([key, value]) => ({
        label: key,
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: value,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: `Snippet HTML para <${key}>`,
        range,
      }))

      return { suggestions }
    },
  })
}

function sanitizeInlineCompletion(
  suggestion,
  beforeCursor = '',
  language = 'plaintext',
  suffix = '',
  structuralContext = null
) {
  if (!suggestion) return ''

  console.log('[editor] sanitizeInlineCompletion input:', suggestion.substring(0, 100))

  // Limpiar sugerencia pero PRESERVAR saltos de línea para HTML
  let cleaned = suggestion
    .replace(/^```[\w-]*\n?/gm, '')
    .replace(/```$/gm, '')
    .replace(/^`+|`+$/g, '')
    .trimEnd()

  // Si es HTML, preservar estructura y saltos de línea
  if (cleaned.includes('<!DOCTYPE') || cleaned.includes('<html')) {
    console.log('[editor] HTML detected, preserving structure')
    cleaned = cleaned
      .replace(/>\s+</g, '>\n<') // Asegurar saltos entre etiquetas
      .replace(/([>])\s+/g, '$1\n') // Saltos después de cierre
      .replace(/\s+([<])/g, '\n$1') // Saltos antes de apertura
      .replace(/\n\s*\n/g, '\n') // Reducir múltiples saltos
      .trim()
  } else {
    // Para código normal, limpiar pero mantener saltos de línea lógicos
    cleaned = cleaned
      .replace(/[ \t]+/g, ' ')
      .replace(/^[ \t]+/gm, '')
      .replace(/[ \t]+$/gm, '')
      .trim()
  }

  // El modelo a veces repite desde el inicio de la frase aunque ya esté escrita
  // (ej. antes "viajes a g" y sugiere "viajes a Guatemala" → debe quedar "uatemala").
  cleaned = stripLeadingOverlapWithBeforeCursor(cleaned, beforeCursor)
  if (!cleaned.trim()) return ''

  // Evitar duplicar el prefijo
  if (beforeCursor.endsWith(cleaned.substring(0, Math.min(50, cleaned.length)))) {
    return ''
  }

  // Evitar insertar texto que ya está inmediatamente después del cursor.
  // Esto reduce duplicados típicos como </title></title> o llaves dobles.
  cleaned = stripOverlapWithSuffix(cleaned, suffix)
  if (!cleaned.trim()) return ''
  if (String(suffix).startsWith(cleaned)) return ''

  // En HTML, evitar que cierre repetido de tags ensucie la estructura.
  if (language === 'html' && /^<\/[a-zA-Z][\w-]*>\s*$/.test(cleaned) && suffix.trim().startsWith(cleaned.trim())) {
    return ''
  }

  if (language === 'html') {
    cleaned = enforceStrictHtmlSuggestion(cleaned, beforeCursor, suffix, structuralContext)
    if (!cleaned.trim()) return ''
    cleaned = ensureHtmlTextWordSpacing(beforeCursor, cleaned, structuralContext)
    if (!cleaned.trim()) return ''
  }

  console.log('[editor] sanitizeInlineCompletion output:', cleaned.substring(0, 100))
  return cleaned
}

function stripOverlapWithSuffix(text, suffix = '') {
  if (!text || !suffix) return text
  const normalizedSuffix = String(suffix)
  const max = Math.min(text.length, normalizedSuffix.length)

  for (let overlap = max; overlap > 0; overlap--) {
    const endPart = text.slice(-overlap)
    const startPart = normalizedSuffix.slice(0, overlap)
    if (endPart === startPart) {
      return text.slice(0, -overlap)
    }
  }
  return text
}

/**
 * Si el final de beforeCursor coincide con el inicio de la sugerencia (p. ej. parcial
 * "… g" + "Guatemala" con solapamiento "viajes a g" / "viajes a G…"), recorta el duplicado.
 * Comparación sin distinguir mayúsculas para palabras en español/inglés.
 */
function stripLeadingOverlapWithBeforeCursor(suggestion, beforeCursor) {
  if (!suggestion || !beforeCursor) return suggestion
  const a = String(beforeCursor)
  const s = String(suggestion)
  const max = Math.min(a.length, s.length)
  let best = 0
  for (let i = max; i >= 1; i--) {
    if (a.slice(-i).toLowerCase() === s.slice(0, i).toLowerCase()) {
      // Evitar solapar solo 1 carácter entre dos letras distintas (p. ej. "… j" + "America"
      // no debe consumir "J" y dejar "america" pegado a "j" → "jamerica").
      if (i === 1 && /[a-zA-ZáéíóúÁÉÍÓÚñÑ]$/.test(a) && /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(s)) {
        const ac = a.slice(-1).toLowerCase()
        const sc = s.slice(0, 1).toLowerCase()
        if (ac !== sc) continue
      }
      best = i
      break
    }
  }
  return best ? s.slice(best) : s
}

/** Etiquetas donde el ghost text suele completar prosa (no solo markup). */
const HTML_TEXT_PARENT_TAGS = new Set([
  'p', 'span', 'div', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'title', 'label', 'button', 'a', 'strong', 'em', 'b', 'i', 'small', 'figcaption', 'blockquote',
])

/** Palabras cortas tras las que casi siempre sigue otra palabra nueva (español/inglés básico). */
const HTML_SPACING_STOPWORDS = new Set([
  'un', 'una', 'unas', 'unos', 'el', 'la', 'los', 'las', 'lo', 'al', 'del', 'de', 'y', 'e', 'o', 'u',
  'en', 'con', 'por', 'para', 'que', 'quien', 'cuando', 'donde', 'como', 'sin', 'sobre', 'entre',
  'hacia', 'hasta', 'desde', 'durante', 'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'me', 'te', 'se', 'le', 'les',
  'nuestro', 'nuestra', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquello', 'muy', 'mas', 'más',
  'tan', 'tanto', 'todo', 'toda', 'todos', 'todas', 'algo', 'nada', 'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'from', 'by', 'at', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
])

function getLastTextTokenBeforeCursor(beforeCursor) {
  const t = String(beforeCursor).trimEnd()
  const m = t.match(/([^\s<>]+)$/)
  if (!m) return ''
  return m[1].replace(/[.,;:!?)\]}'"»«]+$/, '')
}

function firstWordOrTagFragment(s) {
  const t = String(s).trimStart()
  if (t.startsWith('<')) return { isTag: true, word: '' }
  const m = t.match(/^([^\s<]+)/)
  return { isTag: false, word: (m && m[1]) ? m[1].replace(/^[,;:.]+/, '') : '' }
}

/**
 * Inserta espacio entre palabras en contenido HTML cuando el modelo olvida el separador
 * ("… de un" + "texto" → "… un texto") o cuando una sola letra + nombre propio en Title Case.
 */
function ensureHtmlTextWordSpacing(beforeCursor, cleaned, structuralContext) {
  if (!cleaned || !beforeCursor) return cleaned
  if (!structuralContext?.inElementContent) return cleaned
  const top = String(structuralContext.openHtmlTags?.[structuralContext.openHtmlTags.length - 1] || '').toLowerCase()
  if (!HTML_TEXT_PARENT_TAGS.has(top)) return cleaned

  const b = String(beforeCursor)
  let s = String(cleaned)
  const { isTag, word: firstW } = firstWordOrTagFragment(s)
  if (isTag || !firstW) return cleaned
  if (/\s$/.test(b) || /^\s/.test(s)) return cleaned
  if (!/[\w\u00c0-\u024fñÑ]$/.test(b)) return cleaned

  const lastTok = getLastTextTokenBeforeCursor(b)
  if (!lastTok) return cleaned
  const lt = lastTok.toLowerCase()
  const fw = firstW.toLowerCase()

  // Continuación de la misma palabra (prefijo ya escrito)
  if (fw.startsWith(lt) && lt.length >= 2 && fw.length > lt.length) return cleaned

  if (HTML_SPACING_STOPWORDS.has(lt)) return ' ' + s

  // "creacion de" + "un texto" o "… de" + "un …": la primera palabra sugerida es artículo/preposición
  if (HTML_SPACING_STOPWORDS.has(fw)) return ' ' + s

  // Una letra minúscula + palabra que empieza en mayúscula (nombre propio): suele ser palabra nueva
  if (lastTok.length === 1 && /^[a-záéíóúñ]$/i.test(lastTok) && /^[A-ZÁÉÍÓÚÑ]/.test(firstW)) return ' ' + s

  return cleaned
}

function buildStructuralContext(model, position, language) {
  const currentLineText = model.getLineContent(position.lineNumber)
  const col = Math.max(0, position.column - 1)
  const lineBeforeCursor = currentLineText.slice(0, col)
  const lineAfterCursor = currentLineText.slice(col)
  const previousNonEmptyLine = getNearestNonEmptyLine(model, position.lineNumber, -1)
  const nextNonEmptyLine = getNearestNonEmptyLine(model, position.lineNumber, 1)
  const indent = currentLineText.match(/^\s*/)?.[0] || ''

  const context = {
    language,
    currentLineText,
    lineBeforeCursor: lineBeforeCursor.slice(-140),
    lineAfterCursor: lineAfterCursor.slice(0, 140),
    previousNonEmptyLine,
    nextNonEmptyLine,
    indentSize: indent.length,
  }

  if (language === 'html') {
    const offset = model.getOffsetAt(position)
    const textBefore = model.getValue().slice(0, offset)
    const openStack = getOpenHtmlTags(textBefore).slice(-14)
    context.openHtmlTags = openStack
    context.openTagsChain = openStack.length ? openStack.join(' > ') : ''
    const inOpeningTag = isInsideOpeningTag(textBefore)
    context.inOpeningTag = inOpeningTag
    context.inElementContent = openStack.length > 0 && !inOpeningTag
    context.inTag = inOpeningTag
    const top = openStack[openStack.length - 1] || ''
    if (top && context.inElementContent) {
      context.completeWithHint = `Dentro de <${top}>: continuar texto o cerrar con </${top}> si corresponde; no anidar otro <${top}>.`
    }
    if (top && inOpeningTag) {
      context.completeWithHint = `Dentro de la apertura de <${top}>: completar atributos o el >; no repetir <${top}>.`
    }
  }

  return context
}

/** True si el cursor está entre el último '<' y el siguiente '>' (atributos / nombre de etiqueta). */
function isInsideOpeningTag(textBefore) {
  const lastLt = textBefore.lastIndexOf('<')
  if (lastLt === -1) return false
  const frag = textBefore.slice(lastLt)
  return !frag.includes('>')
}

function getNearestNonEmptyLine(model, fromLine, direction) {
  const lineCount = model.getLineCount()
  let line = fromLine + direction
  while (line >= 1 && line <= lineCount) {
    const text = model.getLineContent(line).trim()
    if (text) return text
    line += direction
  }
  return ''
}

function getOpenHtmlTags(text) {
  const tags = []
  const tagPattern = /<\/?([a-zA-Z][\w-]*)\b[^>]*>/g
  const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
  let m
  while ((m = tagPattern.exec(text)) !== null) {
    const full = m[0]
    const name = m[1].toLowerCase()
    const isClosing = full.startsWith('</')
    const isSelfClosing = full.endsWith('/>') || voidTags.has(name)
    if (!isClosing && !isSelfClosing) {
      tags.push(name)
    } else if (isClosing) {
      for (let i = tags.length - 1; i >= 0; i--) {
        if (tags[i] === name) {
          tags.splice(i, 1)
          break
        }
      }
    }
  }
  return tags
}

function enforceStrictHtmlSuggestion(suggestion, prefix, suffix, structuralContext) {
  let out = suggestion
  const safePrefix = String(prefix || '')
  const safeSuffix = String(suffix || '')
  const topOpenTag = structuralContext?.openHtmlTags?.[structuralContext.openHtmlTags.length - 1] || ''
  const inElement = structuralContext?.inElementContent === true

  // Solo permitir documento completo al inicio del archivo.
  if (/<!DOCTYPE|<html\b/i.test(out) && safePrefix.trim().length > 0) {
    return ''
  }

  // Dentro del contenido de una etiqueta: no sugerir otra apertura del mismo tag (ej. <a> dentro de <a>).
  if (inElement && topOpenTag) {
    const reOpenSame = new RegExp(`^\\s*<${topOpenTag}\\b[^>]*>`, 'i')
    out = out.replace(reOpenSame, '').trim()
    const dupClose = new RegExp(`(</${topOpenTag}>\\s*){2,}`, 'gi')
    out = out.replace(dupClose, `</${topOpenTag}>`)
    const sandwiched = new RegExp(`</${topOpenTag}>\\s*<${topOpenTag}\\b[^>]*>`, 'gi')
    out = out.replace(sandwiched, `</${topOpenTag}>`)
  }

  // Si estamos escribiendo dentro de una etiqueta, preferir sugerencias de una sola línea.
  if (structuralContext?.inTag || structuralContext?.inOpeningTag) {
    out = out.split('\n')[0].trim()
  }

  // Si la sugerencia solo cierra una etiqueta distinta al tope, descartarla.
  const closeOnly = out.trim().match(/^<\/([a-zA-Z][\w-]*)>\s*$/)
  if (closeOnly) {
    const closeTag = closeOnly[1].toLowerCase()
    if (topOpenTag && closeTag !== String(topOpenTag).toLowerCase()) {
      return ''
    }
    if (safeSuffix.trimStart().startsWith(out.trim())) {
      return ''
    }
  }

  // Nunca cerrar secciones mayores desde ghost text normal
  // (evita casos como </body></html> cuando solo querías otro <p>).
  out = out
    .replace(/<\/head>\s*$/i, '')
    .replace(/<\/body>\s*$/i, '')
    .replace(/<\/html>\s*$/i, '')

  // Si intenta inyectar cierres mayores en medio del texto, cortar ahí.
  const majorCloseIdx = out.search(/<\/(?:head|body|html)>/i)
  if (majorCloseIdx >= 0) {
    out = out.slice(0, majorCloseIdx).trim()
  }

  // Evitar que meta un nuevo documento o <body>/<head> dentro de contenido.
  if (safePrefix.trim().length > 0 && /<(?:html|head|body)\b/i.test(out)) {
    return ''
  }

  // Cuando hay un tag abierto concreto (ej. p, li, div), priorizar solo ese bloque.
  if (topOpenTag) {
    const closingTag = `</${topOpenTag}>`
    const closePos = out.toLowerCase().indexOf(closingTag.toLowerCase())
    if (closePos >= 0) {
      const afterClose = out.slice(closePos + closingTag.length).trim()
      // Si después del cierre quiere agregar más bloques, recortamos.
      if (afterClose) {
        out = out.slice(0, closePos + closingTag.length)
      }
    }
  }

  // Evitar bloques enormes en ghost text HTML si no son explícitamente un documento.
  const lineCount = out.split('\n').length
  if (lineCount > 8 && !/^(\s*html|\s*htm)\s*$/i.test(safePrefix.trim())) {
    out = out.split('\n').slice(0, 8).join('\n')
  }

  return out.trim()
}

// Función helper para detectar si estamos en un string
function isInString(model, position) {
  const line = model.getLineContent(position.lineNumber)
  const beforeCursor = line.slice(0, position.column - 1)
  
  let inString = false
  let stringChar = null
  let escaped = false
  
  for (let i = 0; i < beforeCursor.length; i++) {
    const char = beforeCursor[i]
    
    if (escaped) {
      escaped = false
      continue
    }
    
    if (char === '\\') {
      escaped = true
      continue
    }
    
    if ((char === '"' || char === "'") && !escaped) {
      if (!inString) {
        inString = true
        stringChar = char
      } else if (char === stringChar) {
        inString = false
        stringChar = null
      }
    }
  }
  
  return inString
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise
      .then(v => {
        clearTimeout(t)
        resolve(v)
      })
      .catch(err => {
        clearTimeout(t)
        reject(err)
      })
  })
}
