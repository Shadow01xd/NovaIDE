import { AIAgent } from "./ai-agent.js";

export class PlannerAgent extends AIAgent {
  constructor(options) {
    super(options);
    this.workerAgents = new Map();
  }

  buildSystemPrompt() {
    const basePrompt = super.buildSystemPrompt();
    return `${basePrompt}

== MODO PLANIFICADOR ==
Eres el PLANIFICADOR. Tu tarea no es escribir todo el código, sino DESCOMPONER tareas complejas en subtareas más pequeñas.
Para cada subtarea, puedes:
1. Pensar en los pasos necesarios.
2. Decidir qué archivos deben ser creados o modificados.
3. Usar tus herramientas normales O bien, delegar en trabajadores (simulado en esta versión mediante pensamientos estructurados).

Divide tu plan en:
- ✅ Fase 1: [Nombre]
- ✅ Fase 2: [Nombre]
...
Muestra siempre el progreso actual de las subtareas en tu respuesta.`;
  }

  // Lógica específica para coordinar trabajadores podría ir aquí
}
