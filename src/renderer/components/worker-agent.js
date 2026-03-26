import { AIAgent } from "./ai-agent.js";

export class WorkerAgent extends AIAgent {
  constructor(options) {
    super(options);
  }

  buildSystemPrompt() {
    const basePrompt = super.buildSystemPrompt();
    return `${basePrompt}

== MODO TRABAJADOR ==
Eres un TRABAJADOR especializado. Tu tarea es ejecutar una subtarea específica asignada por el Planificador.
Enfócate ÚNICAMENTE en la tarea asignada y sé extremadamente eficiente.`;
  }
}
