/**
 * Simple token estimation utility.
 * A rough approximation for GPT/DeepSeek/Llama models.
 */

export function estimateTokens(messages) {
  let totalChars = 0;
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      totalChars += msg.content.length;
    } else {
      totalChars += JSON.stringify(msg.content).length;
    }
    // Roles and metadata overhead
    totalChars += 20; 
  }
  
  // Rule of thumb: ~3.5 characters per token for code-heavy context
  return Math.ceil(totalChars / 3.5);
}

export function isContextFull(messages, limit = 32000, threshold = 0.8) {
  const tokens = estimateTokens(messages);
  return tokens >= limit * threshold;
}
