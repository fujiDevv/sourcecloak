/**
 * Default monitored domains for Community edition (AI chat & builder surfaces).
 * Supports exact hostnames and `*.suffix` wildcards (see isDomainMatch).
 */
export const COMMUNITY_AI_CHAT_DOMAINS = [
  // OpenAI / ChatGPT
  'chatgpt.com',
  '*.openai.com',

  // Anthropic
  '*.claude.ai',

  // Google AI
  'gemini.google.com',
  'notebooklm.google.com',
  'aistudio.google.com',

  // Microsoft
  '*.copilot.microsoft.com',

  // xAI
  'grok.com',

  // Search & general assistants
  '*.perplexity.ai',
  '*.you.com',
  'pi.ai',
  'duck.ai',
  'phind.com',

  // Multi-model chat
  'poe.com',
  '*.character.ai',
  '*.openrouter.ai',

  // Regional / China
  'yiyan.baidu.com',
  'chat.deepseek.com',
  'chat.qwen.ai',
  'kimi.com',
  'chat.z.ai',

  // Model providers
  'chat.mistral.ai',
  'meta.ai',

  // AI builders / IDEs
  'bolt.new',
  'cursor.com',
  'replit.com',
  'lovable.dev',
  'windsurf.com',
  'v0.dev',

  // Gateways & self-hosted UIs
  'genspark.ai',
  'openwebui.com',
  'librechat.ai',
  'huggingface.co',

  // Enterprise / vertical AI
  'jasper.ai',
  'harvey.ai',
  'glean.com',
  'aisera.com',
  'sierra.ai',
] as const;