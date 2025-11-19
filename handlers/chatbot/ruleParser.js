// ============================================================================
// COMMAND DEFINITIONS
// ============================================================================

const COMMANDS = {
  orders: {
    aliases: ['/orders', '/order', '/pending', '/pendingorders'],
    description: 'Show pending orders',
    usage: '/orders [status]',
    examples: ['/orders', '/orders pending', '/orders completed']
  },
  machines: {
    aliases: ['/machines', '/machine', '/machinestatus'],
    description: 'Show machine status',
    usage: '/machines [status]',
    examples: ['/machines', '/machines idle', '/machines running']
  },
  operators: {
    aliases: ['/operators', '/operator', '/staff'],
    description: 'List operators',
    usage: '/operators',
    examples: ['/operators']
  },
  analytics: {
    aliases: ['/analytics', '/stats', '/metrics', '/dashboard'],
    description: 'Show analytics and metrics',
    usage: '/analytics [period]',
    examples: ['/analytics', '/analytics today', '/analytics week']
  },
  remind: {
    aliases: ['/remind', '/reminder', '/remindme'],
    description: 'Set a reminder',
    usage: '/remind [time] [message]',
    examples: ['/remind 3pm check stock', '/remind tomorrow review orders']
  },
  reminders: {
    aliases: ['/reminders', '/myreminders', '/tasks'],
    description: 'List your reminders',
    usage: '/reminders',
    examples: ['/reminders']
  },
  help: {
    aliases: ['/help', '/commands', '/?'],
    description: 'Show available commands',
    usage: '/help',
    examples: ['/help']
  },
  customers: {
    aliases: ['/customers', '/customer', '/clients'],
    description: 'Search customers',
    usage: '/customers [search]',
    examples: ['/customers', '/customers abc company']
  },
  materials: {
    aliases: ['/materials', '/material', '/stock'],
    description: 'Show materials',
    usage: '/materials',
    examples: ['/materials']
  }
};

// ============================================================================
// NATURAL LANGUAGE PATTERNS
// ============================================================================

const NL_PATTERNS = [
  // Orders
  {
    patterns: [
      /show\s*(me\s*)?(all\s*)?(pending\s*)?orders/i,
      /what\s*(are\s*)?(the\s*)?(pending\s*)?orders/i,
      /list\s*(all\s*)?(pending\s*)?orders/i,
      /pending\s*orders/i,
      /order\s*status/i,
      /कितने\s*orders?\s*(pending|बाकी)/i,  // Hindi
      /orders?\s*(दिखाओ|बताओ)/i
    ],
    command: 'orders',
    args: []
  },
  // Machines
  {
    patterns: [
      /show\s*(me\s*)?(all\s*)?machines?/i,
      /machine\s*status/i,
      /which\s*machines?\s*(are\s*)?(available|free|idle)/i,
      /machines?\s*(दिखाओ|status)/i
    ],
    command: 'machines',
    args: []
  },
  // Operators
  {
    patterns: [
      /show\s*(me\s*)?(all\s*)?operators?/i,
      /list\s*operators?/i,
      /who\s*(is|are)\s*(the\s*)?operators?/i,
      /operators?\s*(कौन|दिखाओ)/i
    ],
    command: 'operators',
    args: []
  },
  // Analytics
  {
    patterns: [
      /show\s*(me\s*)?(the\s*)?analytics/i,
      /show\s*(me\s*)?(the\s*)?dashboard/i,
      /today'?s?\s*(stats|metrics|numbers)/i,
      /how\s*(is|are)\s*(the\s*)?(business|production)/i,
      /analytics\s*दिखाओ/i
    ],
    command: 'analytics',
    args: []
  },
  // Reminders
  {
    patterns: [
      /remind\s*me\s*(to\s*)?(.+)/i,
      /set\s*(a\s*)?reminder\s*(for\s*)?(.+)/i,
      /याद\s*दिलाओ\s*(.+)/i
    ],
    command: 'remind',
    extractArgs: (match) => {
      // Extract time and message from the match
      const text = match[2] || match[3] || match[1] || '';
      return [text.trim()];
    }
  },
  // List reminders
  {
    patterns: [
      /show\s*(me\s*)?(my\s*)?reminders?/i,
      /list\s*(my\s*)?reminders?/i,
      /what\s*(are\s*)?(my\s*)?reminders?/i,
      /मेरे\s*reminders?/i
    ],
    command: 'reminders',
    args: []
  },
  // Help
  {
    patterns: [
      /help/i,
      /what\s*can\s*you\s*do/i,
      /commands/i,
      /how\s*do\s*i\s*use/i,
      /क्या\s*कर\s*सकते\s*हो/i
    ],
    command: 'help',
    args: []
  },
  // Customers
  {
    patterns: [
      /show\s*(me\s*)?(all\s*)?customers?/i,
      /list\s*customers?/i,
      /find\s*customer\s*(.+)/i,
      /customers?\s*(दिखाओ|ढूंढो)/i
    ],
    command: 'customers',
    extractArgs: (match) => match[1] ? [match[1].trim()] : []
  }
];

// ============================================================================
// PARSER FUNCTIONS
// ============================================================================

/**
 * Parse command from message
 */
const parseCommand = (message) => {
  const trimmed = message.trim().toLowerCase();

  // Check if it's a direct command (starts with /)
  if (trimmed.startsWith('/')) {
    const parts = trimmed.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    // Find matching command
    for (const [name, config] of Object.entries(COMMANDS)) {
      if (config.aliases.includes(cmd)) {
        return {
          type: 'command',
          command: name,
          args,
          original: message
        };
      }
    }

    // Unknown command
    return {
      type: 'unknown_command',
      command: cmd,
      args,
      original: message
    };
  }

  // Try natural language patterns
  for (const pattern of NL_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = message.match(regex);
      if (match) {
        let args = pattern.args || [];
        if (pattern.extractArgs) {
          args = pattern.extractArgs(match);
        }

        return {
          type: 'natural_language',
          command: pattern.command,
          args,
          original: message,
          matchedPattern: regex.toString()
        };
      }
    }
  }

  // No pattern matched - needs LLM
  return {
    type: 'free_text',
    command: null,
    args: [],
    original: message
  };
};

/**
 * Parse time from reminder text
 */
const parseReminderTime = (text) => {
  const now = new Date();
  let dueDate = new Date(now);
  let message = text;

  // Time patterns
  const timePatterns = [
    // Specific time: "3pm", "3:30pm", "15:00"
    {
      regex: /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
      parse: (match) => {
        let hours = parseInt(match[1]);
        const minutes = match[2] ? parseInt(match[2]) : 0;
        const period = match[3]?.toLowerCase();

        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;

        dueDate.setHours(hours, minutes, 0, 0);
        if (dueDate <= now) {
          dueDate.setDate(dueDate.getDate() + 1);
        }
        return true;
      }
    },
    // Relative: "in 30 minutes", "in 2 hours"
    {
      regex: /in\s+(\d+)\s*(minutes?|mins?|hours?|hrs?)/i,
      parse: (match) => {
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();

        if (unit.startsWith('min')) {
          dueDate.setMinutes(dueDate.getMinutes() + amount);
        } else {
          dueDate.setHours(dueDate.getHours() + amount);
        }
        return true;
      }
    },
    // Tomorrow
    {
      regex: /tomorrow/i,
      parse: () => {
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(9, 0, 0, 0); // Default 9am
        return true;
      }
    },
    // Today
    {
      regex: /today/i,
      parse: () => {
        dueDate.setHours(dueDate.getHours() + 1); // 1 hour from now
        return true;
      }
    },
    // Day names
    {
      regex: /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      parse: (match) => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const targetDay = days.indexOf(match[1].toLowerCase());
        const currentDay = dueDate.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        dueDate.setDate(dueDate.getDate() + daysToAdd);
        dueDate.setHours(9, 0, 0, 0);
        return true;
      }
    }
  ];

  // Try each pattern
  for (const pattern of timePatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      pattern.parse(match);
      // Remove time part from message
      message = text.replace(pattern.regex, '').trim();
      break;
    }
  }

  // If no time found, default to 1 hour from now
  if (message === text) {
    dueDate.setHours(dueDate.getHours() + 1);
  }

  // Clean up message
  message = message
    .replace(/^(to\s+)?/i, '')
    .replace(/^\s*at\s*/i, '')
    .trim();

  return {
    dueDate,
    message: message || 'Reminder'
  };
};

/**
 * Generate help text
 */
const generateHelpText = () => {
  let help = '**Available Commands:**\n\n';

  for (const [name, config] of Object.entries(COMMANDS)) {
    help += `**${config.aliases[0]}** - ${config.description}\n`;
    help += `  Usage: \`${config.usage}\`\n`;
    help += `  Examples: ${config.examples.map(e => `\`${e}\``).join(', ')}\n\n`;
  }

  help += '\n**Tips:**\n';
  help += '- You can also type natural language like "show me pending orders"\n';
  help += '- Commands are not case-sensitive\n';
  help += '- Use /remind to set task reminders\n';

  return help;
};

/**
 * Generate response for unknown command
 */
const generateUnknownCommandResponse = (command) => {
  return `Unknown command: \`${command}\`\n\nType \`/help\` to see available commands.`;
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  COMMANDS,
  NL_PATTERNS,
  parseCommand,
  parseReminderTime,
  generateHelpText,
  generateUnknownCommandResponse
};
