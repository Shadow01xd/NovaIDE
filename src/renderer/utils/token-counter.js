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
  
  // Rule of thumb: ~4 characters per token
  return Math.ceil(totalChars / 4);
}

export function isContextFull(messages, limit = 32000, threshold = 0.8) {
  const tokens = estimateTokens(messages);
  return tokens >= limit * threshold;
}
