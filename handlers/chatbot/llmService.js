const http = require('http');
const https = require('https');

// ============================================================================
// CONFIGURATION
// ============================================================================

const OLLAMA_CONFIG = {
  host: process.env.OLLAMA_HOST || 'localhost',
  port: process.env.OLLAMA_PORT || 11434,
  model: process.env.OLLAMA_MODEL || 'tinyllama', // TinyLlama as default
  timeout: 60000, // 60 seconds
  maxRetries: 2
};

// System prompt for the chat agent
const SYSTEM_PROMPT = `You are a helpful manufacturing management assistant. Your name is customizable by the user.

You help managers and admins with:
- Order information and status
- Machine availability and status
- Operator assignments
- Production analytics
- Setting reminders

Important rules:
1. Only provide information relevant to the user's branch (for managers) or product (for admins)
2. Be concise and professional
3. If you don't have specific data, suggest using a command like /orders or /machines
4. Never share sensitive information from other branches
5. Format numbers and dates clearly
6. Use Hindi words if appropriate for Indian context

Available commands you can suggest:
- /orders - Show pending orders
- /machines - Show machine status
- /operators - List operators
- /analytics - Today's metrics
- /remind [time] [message] - Set reminder
- /reminders - List reminders
- /help - Show all commands`;

// ============================================================================
// OLLAMA CLIENT
// ============================================================================

/**
 * Make HTTP request to Ollama API
 */
const makeOllamaRequest = (endpoint, data, timeout = OLLAMA_CONFIG.timeout) => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: OLLAMA_CONFIG.host,
      port: OLLAMA_CONFIG.port,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          // Ollama returns newline-separated JSON for streaming
          const lines = responseData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const parsed = JSON.parse(lastLine);
          resolve(parsed);
        } catch (error) {
          // Try to parse as single JSON
          try {
            resolve(JSON.parse(responseData));
          } catch (e) {
            resolve({ response: responseData });
          }
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Ollama request timeout'));
    });

    req.write(postData);
    req.end();
  });
};

/**
 * Check if Ollama is available
 */
const checkOllamaHealth = async () => {
  try {
    const response = await makeOllamaRequest('/api/tags', {}, 5000);
    return {
      available: true,
      models: response.models || []
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
};

/**
 * Check if TinyLlama model is available
 */
const checkModelAvailable = async (modelName = OLLAMA_CONFIG.model) => {
  try {
    const health = await checkOllamaHealth();
    if (!health.available) {
      return { available: false, reason: 'Ollama not running' };
    }

    const modelExists = health.models.some(m =>
      m.name === modelName || m.name.startsWith(modelName + ':')
    );

    return {
      available: modelExists,
      reason: modelExists ? 'Model ready' : `Model ${modelName} not found. Run: ollama pull ${modelName}`
    };
  } catch (error) {
    return {
      available: false,
      reason: error.message
    };
  }
};

/**
 * Generate chat response using Ollama
 */
const generateResponse = async (userMessage, context = {}) => {
  const {
    conversationHistory = [],
    assistantName = 'Assistant',
    branchName = '',
    userRole = 'manager',
    model = OLLAMA_CONFIG.model
  } = context;

  // Build conversation context
  let contextPrompt = SYSTEM_PROMPT;
  contextPrompt += `\n\nYour name is: ${assistantName}`;
  contextPrompt += `\nUser role: ${userRole}`;
  if (branchName) {
    contextPrompt += `\nUser's branch: ${branchName}`;
  }

  // Build messages array
  const messages = [
    { role: 'system', content: contextPrompt }
  ];

  // Add conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  }

  // Add current user message
  messages.push({ role: 'user', content: userMessage });

  try {
    const response = await makeOllamaRequest('/api/chat', {
      model,
      messages,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 500 // Max tokens to generate
      }
    });

    return {
      success: true,
      response: response.message?.content || response.response || 'I could not generate a response.',
      model,
      tokensUsed: response.eval_count || 0
    };
  } catch (error) {
    console.error('Ollama generate error:', error);
    return {
      success: false,
      error: error.message,
      response: null
    };
  }
};

/**
 * Generate response with data context (for tool results)
 */
const generateResponseWithData = async (userMessage, data, context = {}) => {
  const {
    assistantName = 'Assistant',
    dataType = 'information'
  } = context;

  // Format data as context for LLM
  let dataContext = '';
  if (Array.isArray(data)) {
    dataContext = `Here is the ${dataType} data:\n${JSON.stringify(data, null, 2)}`;
  } else if (typeof data === 'object') {
    dataContext = `Here is the ${dataType}:\n${JSON.stringify(data, null, 2)}`;
  } else {
    dataContext = `Data: ${data}`;
  }

  const prompt = `${userMessage}\n\n${dataContext}\n\nPlease summarize this information in a clear, helpful way for the user.`;

  return generateResponse(prompt, { ...context, assistantName });
};

/**
 * Simple completion (for rule-based fallback enhancement)
 */
const enhanceRuleResponse = async (ruleResponse, context = {}) => {
  const prompt = `The system returned this data: "${ruleResponse}".
Please format this nicely for the user. Keep it brief and professional.`;

  const result = await generateResponse(prompt, context);

  if (result.success) {
    return result.response;
  }

  // Fallback to original response
  return ruleResponse;
};

// ============================================================================
// MODEL MANAGEMENT
// ============================================================================

/**
 * Pull/download model (for auto-download feature)
 */
const pullModel = async (modelName = OLLAMA_CONFIG.model) => {
  try {
    const response = await makeOllamaRequest('/api/pull', {
      name: modelName,
      stream: false
    }, 300000); // 5 minute timeout for download

    return {
      success: true,
      message: `Model ${modelName} pulled successfully`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get model info
 */
const getModelInfo = async (modelName = OLLAMA_CONFIG.model) => {
  try {
    const response = await makeOllamaRequest('/api/show', {
      name: modelName
    });

    return {
      success: true,
      info: response
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Configuration
  OLLAMA_CONFIG,
  SYSTEM_PROMPT,

  // Health checks
  checkOllamaHealth,
  checkModelAvailable,

  // Generation
  generateResponse,
  generateResponseWithData,
  enhanceRuleResponse,

  // Model management
  pullModel,
  getModelInfo
};
