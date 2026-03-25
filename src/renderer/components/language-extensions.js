// Extensiones de lenguaje adicionales para Monaco Editor
// Soporte para lenguajes que no están incluidos por defecto

export function registerLanguageExtensions(monaco) {
  
  // Registrar Terraform (HCL)
  monaco.languages.register({ id: 'terraform' })
  monaco.languages.setMonarchTokensProvider('terraform', {
    tokenizer: {
      root: [
        [/[a-zA-Z_][\w]*/, {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'predefined',
            '@default': 'identifier'
          }
        }],
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],
        [/".*?"/, 'string'],
        [/'[^']*'/, 'string'],
        [/#.*/, 'comment'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/[{}()\[\]]/, '@brackets'],
        [/[<>]=?/, 'operator'],
        [/[+\-*\/=]/, 'operator'],
        [/,/, 'delimiter']
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ]
    },
    keywords: [
      'resource', 'data', 'provider', 'module', 'variable', 'output', 'locals',
      'terraform', 'required_providers', 'backend', 'required_version',
      'for', 'in', 'if', 'else', 'count', 'each', 'depends_on', 'lifecycle'
    ],
    builtins: [
      'aws', 'azure', 'google', 'null_resource', 'local_file', 'template_file',
      'random_id', 'random_pet', 'random_password', 'tls_private_key', 'tls_self_signed_cert'
    ]
  })

  // Registrar Dockerfile
  monaco.languages.register({ id: 'dockerfile' })
  monaco.languages.setMonarchTokensProvider('dockerfile', {
    tokenizer: {
      root: [
        [/^FROM\s+.*/, 'keyword'],
        [/^RUN\s+.*/, 'keyword'],
        [/^CMD\s+.*/, 'keyword'],
        [/^LABEL\s+.*/, 'keyword'],
        [/^EXPOSE\s+.*/, 'keyword'],
        [/^ENV\s+.*/, 'keyword'],
        [/^ADD\s+.*/, 'keyword'],
        [/^COPY\s+.*/, 'keyword'],
        [/^ENTRYPOINT\s+.*/, 'keyword'],
        [/^VOLUME\s+.*/, 'keyword'],
        [/^USER\s+.*/, 'keyword'],
        [/^WORKDIR\s+.*/, 'keyword'],
        [/^ARG\s+.*/, 'keyword'],
        [/^ONBUILD\s+.*/, 'keyword'],
        [/^STOPSIGNAL\s+.*/, 'keyword'],
        [/^HEALTHCHECK\s+.*/, 'keyword'],
        [/^SHELL\s+.*/, 'keyword'],
        [/^MAINTAINER\s+.*/, 'keyword'],
        [/^CROSS_BUILD\s+.*/, 'keyword'],
        [/#.*$/, 'comment'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/[a-zA-Z_][\w]*/, 'identifier'],
        [/[{}()\[\]]/, '@brackets'],
        [/[<>]=?/, 'operator'],
        [/[+\-*\/=]/, 'operator']
      ]
    }
  })

  // Registrar Makefile
  monaco.languages.register({ id: 'makefile' })
  monaco.languages.setMonarchTokensProvider('makefile', {
    tokenizer: {
      root: [
        [/^\s*[a-zA-Z_][\w\$]*\s*:/, 'key'],
        [/^\s*\.PHONY:/, 'keyword'],
        [/^\s*\.SUFFIXES:/, 'keyword'],
        [/^\s*\.DEFAULT:/, 'keyword'],
        [/^\s*\.PRECIOUS:/, 'keyword'],
        [/^\s*\.INTERMEDIATE:/, 'keyword'],
        [/^\s*\.SECONDARY:/, 'keyword'],
        [/^\s*\.SECONDEXPANSION:/, 'keyword'],
        [/^\s*\.DELETE_ON_ERROR:/, 'keyword'],
        [/^\s*\.IGNORE:/, 'keyword'],
        [/^\s*\.LOW_RESOLUTION_TIME:/, 'keyword'],
        [/^\s*\.SILENT:/, 'keyword'],
        [/^\s*\.EXPORT_ALL_VARIABLES:/, 'keyword'],
        [/^\s*\.NOTPARALLEL:/, 'keyword'],
        [/^\s*\.ONESHELL:/, 'keyword'],
        [/^\s*\.POSIX:/, 'keyword'],
        [/#.*$/, 'comment'],
        [/\$[@<?^+*]/, 'variable'],
        [/\$\([a-zA-Z_][\w]*\)/, 'variable'],
        [/\$\{[a-zA-Z_][\w]*\}/, 'variable'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/[\\]/, 'operator'],
        [/[{}()\[\]]/, '@brackets']
      ]
    }
  })

  // Registrar CMake
  monaco.languages.register({ id: 'cmake' })
  monaco.languages.setMonarchTokensProvider('cmake', {
    tokenizer: {
      root: [
        [/[a-zA-Z_][\w]*/, {
          cases: {
            '@keywords': 'keyword',
            '@commands': 'predefined',
            '@variables': 'variable',
            '@default': 'identifier'
          }
        }],
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],
        [/"[^"]*"/, 'string'],
        [/[<>]=?/, 'operator'],
        [/[+\-*\/=]/, 'operator'],
        [/[{}()\[\]]/, '@brackets'],
        [/#.*$/, 'comment'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/\$\{[a-zA-Z_][\w]*\}/, 'variable'],
        [/\$\([a-zA-Z_][\w]*\)/, 'variable']
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ]
    },
    keywords: [
      'if', 'elseif', 'else', 'endif', 'foreach', 'endforeach', 'while', 'endwhile',
      'break', 'continue', 'return', 'macro', 'endmacro', 'function', 'endfunction',
      'block', 'endblock', 'message', 'option', 'cmake_minimum_required',
      'project', 'set', 'unset', 'list', 'find_package', 'add_executable',
      'add_library', 'target_link_libraries', 'target_include_directories',
      'target_compile_definitions', 'target_compile_options', 'install',
      'configure_file', 'file', 'string', 'math', 'add_definitions',
      'add_subdirectory', 'include_directories', 'link_directories',
      'enable_language', 'check_language', 'test_big_endian', 'test_cxx_compiler_flag'
    ],
    commands: [
      'add_custom_command', 'add_custom_target', 'add_definitions', 'add_dependencies',
      'add_executable', 'add_library', 'add_subdirectory', 'add_test', 'aux_source_directory',
      'break', 'build_command', 'cmake_minimum_required', 'cmake_policy', 'configure_file',
      'create_test_sourcelist', 'define_property', 'else', 'elseif', 'enable_language',
      'endfunction', 'endif', 'endmacro', 'endforeach', 'endwhile', 'execute_process',
      'export', 'file', 'find_file', 'find_library', 'find_package', 'find_path',
      'find_program', 'fltk_wrap_ui', 'foreach', 'function', 'get_cmake_property',
      'get_directory_property', 'get_filename_component', 'get_property', 'get_source_file_property',
      'get_target_property', 'get_test_property', 'if', 'include', 'include_directories',
      'include_external_msproject', 'include_regular_expression', 'install', 'link_directories',
      'list', 'load_cache', 'macro', 'mark_as_advanced', 'math', 'message', 'option',
      'output_required_files', 'project', 'qt_wrap_cpp', 'qt_wrap_ui', 'remove_definitions',
      'return', 'separate_arguments', 'set', 'set_directory_properties', 'set_property',
      'set_source_files_properties', 'set_target_properties', 'set_tests_properties',
      'site_name', 'string', 'subdir_depends', 'subdirs', 'target_compile_definitions',
      'target_compile_features', 'target_compile_options', 'target_include_directories',
      'target_link_libraries', 'target_sources', 'try_compile', 'try_run', 'unset',
      'variable_watch', 'while'
    ],
    variables: [
      'CMAKE_AR', 'CMAKE_BINARY_DIR', 'CMAKE_BUILD_TOOL', 'CMAKE_CACHEFILE_DIR',
      'CMAKE_CACHE_MAJOR_VERSION', 'CMAKE_CACHE_MINOR_VERSION', 'CMAKE_CACHE_RELEASE_VERSION',
      'CMAKE_CACHE_VERSION', 'CMAKE_CFG_INTDIR', 'CMAKE_COMMAND', 'CMAKE_CROSSCOMPILING',
      'CMAKE_CTEST_COMMAND', 'CMAKE_CURRENT_BINARY_DIR', 'CMAKE_CURRENT_LIST_DIR',
      'CMAKE_CURRENT_LIST_FILE', 'CMAKE_CURRENT_LIST_LINE', 'CMAKE_CURRENT_SOURCE_DIR',
      'CMAKE_DL_LIBS', 'CMAKE_EDIT_COMMAND', 'CMAKE_EXECUTABLE_SUFFIX',
      'CMAKE_EXTRA_SHARED_LIBRARY_SUFFIXES', 'CMAKE_FIND_APPBUNDLE', 'CMAKE_FIND_FRAMEWORK',
      'CMAKE_FIND_LIBRARY_PATHS', 'CMAKE_FIND_LIBRARY_SUFFIXES', 'CMAKE_FIND_NO_INSTALL_PREFIX',
      'CMAKE_FIND_ROOT_PATH', 'CMAKE_FIND_ROOT_PATH_MODE_INCLUDE', 'CMAKE_FIND_ROOT_PATH_MODE_LIBRARY',
      'CMAKE_FIND_ROOT_PATH_MODE_PROGRAM', 'CMAKE_FRAMEWORK_PATH', 'CMAKE_GENERATOR',
      'CMAKE_GENERATOR_TOOLSET', 'CMAKE_HOME_DIRECTORY', 'CMAKE_INSTALL_PREFIX',
      'CMAKE_LIBRARY_ARCHITECTURE', 'CMAKE_LIBRARY_ARCHITECTURE_REGEX', 'CMAKE_LINKER',
      'CMAKE_MAJOR_VERSION', 'CMAKE_MAKE_PROGRAM', 'CMAKE_MINIMUM_REQUIRED_VERSION',
      'CMAKE_MINOR_VERSION', 'CMAKE_PARENT_LIST_FILE', 'CMAKE_PATCH_VERSION', 'CMAKE_PROJECT_NAME',
      'CMAKE_RANLIB', 'CMAKE_ROOT', 'CMAKE_RULE_MESSAGES', 'CMAKE_SHARED_LIBRARY_PREFIX',
      'CMAKE_SHARED_LIBRARY_SUFFIX', 'CMAKE_SHARED_MODULE_PREFIX', 'CMAKE_SHARED_MODULE_SUFFIX',
      'CMAKE_SIZEOF_VOID_P', 'CMAKE_SKIP_INSTALL_ALL_DEPENDENCY', 'CMAKE_SKIP_INSTALL_RPATH',
      'CMAKE_SKIP_RPATH', 'CMAKE_SOURCE_DIR', 'CMAKE_STATIC_LIBRARY_PREFIX',
      'CMAKE_STATIC_LIBRARY_SUFFIX', 'CMAKE_SYSTEM', 'CMAKE_SYSTEM_NAME', 'CMAKE_SYSTEM_PROCESSOR',
      'CMAKE_SYSTEM_VERSION', 'CMAKE_TOOLCHAIN_FILE', 'CMAKE_TWEAK_VERSION', 'CMAKE_VERBOSE_MAKEFILE',
      'CMAKE_VERSION', 'CMAKE_VISIBILITY_INLINES_HIDDEN', 'CMAKE_VS_DEVENV_COMMAND',
      'CMAKE_VS_MSBUILD_COMMAND', 'CMAKE_VS_NMAKE_COMMAND', 'CMAKE_VS_PLATFORM_NAME',
      'CMAKE_VS_PLATFORM_TOOLSET', 'CMAKE_VS_WINDOWS_VERSION_SIGNING', 'CMAKE_XCODE_PLATFORM_TOOLSET',
      'PROJECT_BINARY_DIR', 'PROJECT_DESCRIPTION', 'PROJECT_HOMEPAGE_URL', 'PROJECT_NAME',
      'PROJECT_SOURCE_DIR', 'PROJECT_VERSION', 'PROJECT_VERSION_MAJOR', 'PROJECT_VERSION_MINOR',
      'PROJECT_VERSION_PATCH', 'PROJECT_VERSION_TWEAK'
    ]
  })

  // Registrar YAML (mejorado)
  monaco.languages.register({ id: 'yaml' })
  monaco.languages.setMonarchTokensProvider('yaml', {
    tokenizer: {
      root: [
        [/^\s*([a-zA-Z_][\w\-]*)\s*:/, ['key', 'delimiter']],
        [/^\s*-\s+/, 'delimiter'],
        [/#.*$/, 'comment'],
        [/".*?"/, 'string'],
        [/'[^']*'/, 'string'],
        [/(true|false|null|undefined)\b/, 'keyword'],
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],
        [/[{}()\[\]]/, '@brackets'],
        [/[<>]=?/, 'operator'],
        [/[+\-*\/=]/, 'operator'],
        [/[,:]/, 'delimiter']
      ]
    }
  })

  // Registrar TOML
  monaco.languages.register({ id: 'toml' })
  monaco.languages.setMonarchTokensProvider('toml', {
    tokenizer: {
      root: [
        [/^\s*([a-zA-Z_][\w\-]*)\s*=/, ['key', 'delimiter']],
        [/^\s*\[([^\]]+)\]/, 'key'],
        [/#.*$/, 'comment'],
        [/".*?"/, 'string'],
        [/'[^']*'/, 'string'],
        [/(true|false)\b/, 'keyword'],
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],
        [/[{}()\[\]]/, '@brackets'],
        [/[<>]=?/, 'operator'],
        [/[+\-*\/=]/, 'operator'],
        [/[,:]/, 'delimiter']
      ]
    }
  })

  // Registrar GraphQL
  monaco.languages.register({ id: 'graphql' })
  monaco.languages.setMonarchTokensProvider('graphql', {
    tokenizer: {
      root: [
        [/[a-zA-Z_][\w]*/, {
          cases: {
            '@keywords': 'keyword',
            '@types': 'type',
            '@default': 'identifier'
          }
        }],
        [/#.*$/, 'comment'],
        [/""".*?"""/, 'string.multiline'],
        [/".*?"/, 'string'],
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],
        [/[{}()\[\]]/, '@brackets'],
        [/[!]/, 'operator'],
        [/[|]/, 'operator'],
        [/[&]/, 'operator'],
        [/[,:]/, 'delimiter']
      ]
    },
    keywords: [
      'query', 'mutation', 'subscription', 'fragment', 'on', 'type',
      'input', 'interface', 'union', 'scalar', 'enum', 'extend',
      'schema', 'implements', 'null'
    ],
    types: [
      'Int', 'Float', 'String', 'Boolean', 'ID', 'DateTime', 'JSON'
    ]
  })

  // Registrar Solidity
  monaco.languages.register({ id: 'solidity' })
  monaco.languages.setMonarchTokensProvider('solidity', {
    tokenizer: {
      root: [
        [/[a-zA-Z_][\w]*/, {
          cases: {
            '@keywords': 'keyword',
            '@types': 'type',
            '@modifiers': 'modifier',
            '@default': 'identifier'
          }
        }],
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/\d+/, 'number'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/[{}()\[\]]/, '@brackets'],
        [/[<>]=?/, 'operator'],
        [/[+\-*\/=]/, 'operator'],
        [/[,:]/, 'delimiter']
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ]
    },
    keywords: [
      'pragma', 'solidity', 'contract', 'library', 'interface', 'function',
      'modifier', 'event', 'struct', 'enum', 'mapping', 'if', 'else',
      'for', 'while', 'do', 'break', 'continue', 'return', 'throw',
      'emit', 'new', 'is', 'delete', 'this', 'super', 'true', 'false',
      'import', 'using', 'assembly'
    ],
    types: [
      'address', 'bool', 'string', 'bytes', 'bytes1', 'bytes2', 'bytes3',
      'bytes4', 'bytes5', 'bytes6', 'bytes7', 'bytes8', 'bytes9', 'bytes10',
      'bytes11', 'bytes12', 'bytes13', 'bytes14', 'bytes15', 'bytes16',
      'bytes17', 'bytes18', 'bytes19', 'bytes20', 'bytes21', 'bytes22',
      'bytes23', 'bytes24', 'bytes25', 'bytes26', 'bytes27', 'bytes28',
      'bytes29', 'bytes30', 'bytes31', 'bytes32', 'uint', 'uint8', 'uint16',
      'uint24', 'uint32', 'uint40', 'uint48', 'uint56', 'uint64', 'uint72',
      'uint80', 'uint88', 'uint96', 'uint104', 'uint112', 'uint120', 'uint128',
      'uint136', 'uint144', 'uint152', 'uint160', 'uint168', 'uint176', 'uint184',
      'uint192', 'uint200', 'uint208', 'uint216', 'uint224', 'uint232', 'uint240',
      'uint248', 'uint256', 'int', 'int8', 'int16', 'int24', 'int32', 'int40',
      'int48', 'int56', 'int64', 'int72', 'int80', 'int88', 'int96', 'int104',
      'int112', 'int120', 'int128', 'int136', 'int144', 'int152', 'int160', 'int168',
      'int176', 'int184', 'int192', 'int200', 'int208', 'int216', 'int224', 'int232',
      'int240', 'int248', 'int256'
    ],
    modifiers: [
      'public', 'private', 'internal', 'external', 'pure', 'view', 'payable',
      'constant', 'immutable', 'anonymous', 'indexed', 'virtual', 'override'
    ]
  })

  // Registrar GDScript (Godot)
  monaco.languages.register({ id: 'gdscript' })
  monaco.languages.setMonarchTokensProvider('gdscript', {
    tokenizer: {
      root: [
        [/[a-zA-Z_][\w]*/, {
          cases: {
            '@keywords': 'keyword',
            '@functions': 'predefined',
            '@types': 'type',
            '@constants': 'variable',
            '@default': 'identifier'
          }
        }],
        [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
        [/\d+/, 'number'],
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        [/#.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/[{}()\[\]]/, '@brackets'],
        [/[<>]=?/, 'operator'],
        [/[+\-*\/=]/, 'operator'],
        [/[,:]/, 'delimiter']
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\/\*/, 'comment', '@push'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment']
      ]
    },
    keywords: [
      'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'pass',
      'return', 'match', 'func', 'class', 'extends', 'is', 'as', 'and',
      'or', 'not', 'in', 'null', 'true', 'false', 'self', 'static',
      'const', 'var', 'export', 'onready', 'tool', 'remote', 'master',
      'puppet', 'sync', 'remotesync', 'mastery', 'puppetsync'
    ],
    functions: [
      'print', 'printerr', 'prints', 'printraw', 'push_error', 'push_warning',
      'assert', 'get_stack', 'str', 'var2str', 'json', 'to_json', 'parse_json',
      'hash', 'Color8', 'ColorN', 'randf', 'randi', 'rand_range', 'seed',
      'rand_seed', 'weakref', 'is_instance_valid', 'yield', 'resume',
      'instance_from_id', 'preload', 'load', 'ResourceLoader', 'ImageLoader',
      'ResourceSaver', 'OS', 'Engine', 'Input', 'InputEvent', 'Node', 'Control',
      'Sprite', 'AudioStreamPlayer', 'AnimationPlayer', 'Tween', 'Timer'
    ],
    types: [
      'bool', 'int', 'float', 'String', 'Vector2', 'Vector3', 'Color', 'Rect2',
      'Transform2D', 'Transform3D', 'Basis', 'Quat', 'AABB', 'Plane', 'RID',
      'NodePath', 'Object', 'Dictionary', 'Array', 'PoolByteArray', 'PoolIntArray',
      'PoolRealArray', 'PoolStringArray', 'PoolVector2Array', 'PoolVector3Array',
      'PoolColorArray', 'Resource', 'Texture', 'Image', 'Font', 'Shader',
      'Material', 'Mesh', 'Animation', 'AudioStream', 'PackedScene'
    ],
    constants: [
      'PI', 'TAU', 'INF', 'NAN', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'VERTICAL',
      'HORIZONTAL', 'KEY_ESCAPE', 'KEY_TAB', 'KEY_BACKSPACE', 'KEY_ENTER',
      'KEY_SHIFT', 'KEY_CONTROL', 'KEY_ALT', 'KEY_META', 'CAPS_LOCK', 'NUM_LOCK',
      'SCROLL_LOCK', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9',
      'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'KP_0', 'KP_1',
      'KP_2', 'KP_3', 'KP_4', 'KP_5', 'KP_6', 'KP_7', 'KP_8', 'KP_9',
      'KP_PERIOD', 'KP_DIVIDE', 'KP_MULTIPLY', 'KP_SUBTRACT', 'KP_ADD',
      'KP_ENTER', 'BUTTON_LEFT', 'BUTTON_RIGHT', 'BUTTON_MIDDLE',
      'BUTTON_WHEEL_UP', 'BUTTON_WHEEL_DOWN', 'BUTTON_WHEEL_LEFT',
      'BUTTON_WHEEL_RIGHT', 'BUTTON_XBUTTON1', 'BUTTON_XBUTTON2'
    ]
  })

  // Configurar temas para los nuevos lenguajes
  const darkTheme = monaco.editor.defineTheme('dark-plus-extended', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '569CD6' },
      { token: 'type', foreground: '4EC9B0' },
      { token: 'predefined', foreground: 'D4D4D4' },
      { token: 'variable', foreground: '9CDCFE' },
      { token: 'identifier', foreground: 'D4D4D4' },
      { token: 'key', foreground: '9CDCFE' },
      { token: 'string', foreground: 'CE9178' },
      { token: 'string.multiline', foreground: 'CE9178' },
      { token: 'number', foreground: 'B5CEA8' },
      { token: 'number.float', foreground: 'B5CEA8' },
      { token: 'number.hex', foreground: 'B5CEA8' },
      { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'D4D4D4' },
      { token: 'operator', foreground: 'D4D4D4' },
      { token: 'modifier', foreground: '569CD6' }
    ],
    colors: {
      'editor.background': '#1E1E1E',
      'editor.foreground': '#D4D4D4',
      'editorCursor.foreground': '#AEAFAD',
      'editor.lineHighlightBackground': '#2D2D30',
      'editor.selectionBackground': '#264F78',
      'editor.inactiveSelectionBackground': '#3A3D41'
    }
  })

  const lightTheme = monaco.editor.defineTheme('light-plus-extended', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '0000FF' },
      { token: 'type', foreground: '267F99' },
      { token: 'predefined', foreground: '795E26' },
      { token: 'variable', foreground: '001080' },
      { token: 'identifier', foreground: '000000' },
      { token: 'key', foreground: '001080' },
      { token: 'string', foreground: 'A31515' },
      { token: 'string.multiline', foreground: 'A31515' },
      { token: 'number', foreground: '098658' },
      { token: 'number.float', foreground: '098658' },
      { token: 'number.hex', foreground: '098658' },
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '000000' },
      { token: 'operator', foreground: '000000' },
      { token: 'modifier', foreground: '0000FF' }
    ],
    colors: {
      'editor.background': '#FFFFFF',
      'editor.foreground': '#000000',
      'editorCursor.foreground': '#000000',
      'editor.lineHighlightBackground': '#F0F0F0',
      'editor.selectionBackground': '#ADD6FF',
      'editor.inactiveSelectionBackground': '#E5EBF1'
    }
  })
}

// Exportar función para registrar todos los lenguajes
export function registerAllLanguages(monaco) {
  registerLanguageExtensions(monaco)
}
