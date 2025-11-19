const connectToDatabase = require('../../config/mongodb/db');
const ChatSettings = require('../../models/chatbot/chatSettings');
const {
  withSecurity,
  getCorsHeaders,
  validateRequest,
  CHAT_RULES
} = require('./security');
const { updateChatSettingsSchema } = require('../../models/chatbot/chatSettings');

// ============================================================================
// GET SETTINGS
// ============================================================================

/**
 * GET /chat/settings - Get user's chat settings
 */
const getSettings = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;

    const settings = await ChatSettings.getOrCreate({
      userId: user.userId,
      userRole: user.userRole,
      branchId: user.branchId,
      product27InfinityId: user.product27InfinityId
    });

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        data: settings
      })
    };

  } catch (error) {
    console.error('Get settings error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to get settings'
      })
    };
  }
};

// ============================================================================
// UPDATE SETTINGS
// ============================================================================

/**
 * PUT /chat/settings - Update user's chat settings
 */
const updateSettings = async (event, context) => {
  try {
    await connectToDatabase();

    const { user, parsedBody } = event;

    // Validate request
    const validation = validateRequest(parsedBody, updateChatSettingsSchema);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Validation failed',
          errors: validation.errors
        })
      };
    }

    // Get or create settings
    let settings = await ChatSettings.findOne({ userId: user.userId });

    if (!settings) {
      settings = new ChatSettings({
        userId: user.userId,
        userRole: user.userRole,
        branchId: user.branchId,
        product27InfinityId: user.product27InfinityId
      });
    }

    // Update fields
    const {
      isEnabled,
      assistantName,
      voiceGender,
      language,
      autoSpeak,
      speechRate,
      theme
    } = parsedBody;

    if (isEnabled !== undefined) settings.isEnabled = isEnabled;
    if (assistantName) settings.assistantName = assistantName;
    if (voiceGender) settings.voiceGender = voiceGender;
    if (language) settings.language = language;
    if (autoSpeak !== undefined) settings.autoSpeak = autoSpeak;
    if (speechRate) settings.speechRate = speechRate;
    if (theme) {
      if (theme.primaryColor) settings.theme.primaryColor = theme.primaryColor;
      if (theme.position) {
        settings.theme.position = theme.position;
      }
    }

    await settings.save();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Settings updated successfully',
        data: settings
      })
    };

  } catch (error) {
    console.error('Update settings error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to update settings'
      })
    };
  }
};

// ============================================================================
// UPDATE POSITION
// ============================================================================

/**
 * PUT /chat/settings/position - Update chat widget position
 */
const updatePosition = async (event, context) => {
  try {
    await connectToDatabase();

    const { user, parsedBody } = event;
    const { x, y } = parsedBody;

    const settings = await ChatSettings.findOne({ userId: user.userId });

    if (!settings) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Settings not found'
        })
      };
    }

    await settings.updatePosition(x, y);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Position updated',
        data: { position: settings.theme.position }
      })
    };

  } catch (error) {
    console.error('Update position error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to update position'
      })
    };
  }
};

// ============================================================================
// UPDATE HARDWARE INFO
// ============================================================================

/**
 * PUT /chat/settings/hardware - Update hardware info
 */
const updateHardware = async (event, context) => {
  try {
    await connectToDatabase();

    const { user, parsedBody } = event;
    const { ramGB } = parsedBody;

    const settings = await ChatSettings.findOne({ userId: user.userId });

    if (!settings) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Settings not found'
        })
      };
    }

    await settings.updateHardwareInfo(ramGB);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Hardware info updated',
        data: {
          hardwareInfo: settings.hardwareInfo,
          canRunLocalLLM: settings.hardwareInfo.canRunLocalLLM
        }
      })
    };

  } catch (error) {
    console.error('Update hardware error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to update hardware info'
      })
    };
  }
};

// ============================================================================
// ACCEPT RULES
// ============================================================================

/**
 * POST /chat/settings/accept-rules - Accept chat rules
 */
const acceptRules = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;

    const settings = await ChatSettings.findOne({ userId: user.userId });

    if (!settings) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Settings not found'
        })
      };
    }

    await settings.acceptRules();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Rules accepted',
        data: {
          rulesAccepted: true,
          rulesAcceptedAt: settings.rulesAcceptedAt
        }
      })
    };

  } catch (error) {
    console.error('Accept rules error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to accept rules'
      })
    };
  }
};

// ============================================================================
// GET RULES
// ============================================================================

/**
 * GET /chat/rules - Get chat rules and regulations
 */
const getRules = async (event, context) => {
  return {
    statusCode: 200,
    headers: getCorsHeaders(),
    body: JSON.stringify({
      success: true,
      data: CHAT_RULES
    })
  };
};

// ============================================================================
// GET STATS
// ============================================================================

/**
 * GET /chat/settings/stats - Get user's chat statistics
 */
const getStats = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;

    const settings = await ChatSettings.findOne({ userId: user.userId });

    if (!settings) {
      return {
        statusCode: 200,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: true,
          data: {
            totalMessages: 0,
            totalReminders: 0,
            lastUsed: null
          }
        })
      };
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        data: settings.stats
      })
    };

  } catch (error) {
    console.error('Get stats error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to get statistics'
      })
    };
  }
};

// ============================================================================
// RESET SETTINGS
// ============================================================================

/**
 * POST /chat/settings/reset - Reset settings to default
 */
const resetSettings = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;

    await ChatSettings.findOneAndUpdate(
      { userId: user.userId },
      {
        isEnabled: true,
        assistantName: 'Assistant',
        voiceGender: 'female',
        language: 'en-IN',
        autoSpeak: true,
        speechRate: 1.0,
        'theme.primaryColor': '#FF6B00',
        'theme.position': { x: null, y: null }
      },
      { new: true }
    );

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Settings reset to default'
      })
    };

  } catch (error) {
    console.error('Reset settings error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to reset settings'
      })
    };
  }
};

// ============================================================================
// EXPORTS WITH SECURITY WRAPPER
// ============================================================================

const securityOptions = {
  requireAuth: true,
  rateLimit: true,
  sanitize: true,
  allowedRoles: ['manager', 'admin', 'master-admin']
};

module.exports = {
  getSettings: withSecurity(securityOptions)(getSettings),
  updateSettings: withSecurity(securityOptions)(updateSettings),
  updatePosition: withSecurity(securityOptions)(updatePosition),
  updateHardware: withSecurity(securityOptions)(updateHardware),
  acceptRules: withSecurity(securityOptions)(acceptRules),
  getRules: withSecurity({ requireAuth: false, rateLimit: false })(getRules),
  getStats: withSecurity(securityOptions)(getStats),
  resetSettings: withSecurity(securityOptions)(resetSettings)
};
