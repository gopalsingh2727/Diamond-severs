const connectToDatabase = require('../../config/mongodb/db');
const Reminder = require('../../models/chatbot/reminder');
const {
  withSecurity,
  getCorsHeaders,
  buildRoleBasedFilter,
  validateRequest
} = require('./security');
const {
  createReminderSchema,
  updateReminderSchema,
  reminderIdSchema
} = require('../../models/chatbot/reminder');

// ============================================================================
// CREATE REMINDER
// ============================================================================

/**
 * POST /chat/reminder - Create a new reminder
 */
const createReminder = async (event, context) => {
  try {
    await connectToDatabase();

    const { user, parsedBody } = event;

    // Validate request
    const validation = validateRequest(parsedBody, createReminderSchema.omit({
      userId: true,
      userRole: true,
      branchId: true,
      product27InfinityId: true
    }));

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

    const { title, description, dueDate, priority, relatedOrderId, relatedMachineId } = parsedBody;

    const reminder = new Reminder({
      userId: user.userId,
      userRole: user.userRole,
      branchId: user.branchId,
      product27InfinityId: user.product27InfinityId,
      title,
      description,
      dueDate: new Date(dueDate),
      priority: priority || 'normal',
      relatedOrderId,
      relatedMachineId,
      status: 'pending'
    });

    await reminder.save();

    return {
      statusCode: 201,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Reminder created successfully',
        data: reminder
      })
    };

  } catch (error) {
    console.error('Create reminder error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to create reminder'
      })
    };
  }
};

// ============================================================================
// GET REMINDERS
// ============================================================================

/**
 * GET /chat/reminders - List user's reminders
 */
const getReminders = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;
    const { status = 'pending', limit = 50, page = 1 } = event.queryStringParameters || {};

    const roleFilter = buildRoleBasedFilter(user);

    const query = {
      userId: user.userId,
      ...roleFilter
    };

    if (status !== 'all') {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reminders, total] = await Promise.all([
      Reminder.find(query)
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('relatedOrderId', 'orderId overallStatus')
        .populate('relatedMachineId', 'machineName status')
        .lean(),
      Reminder.countDocuments(query)
    ]);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        data: {
          reminders,
          pagination: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      })
    };

  } catch (error) {
    console.error('Get reminders error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to fetch reminders'
      })
    };
  }
};

// ============================================================================
// GET PENDING REMINDERS (Due Now)
// ============================================================================

/**
 * GET /chat/reminders/pending - Get reminders that are due
 */
const getPendingReminders = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;
    const roleFilter = buildRoleBasedFilter(user);

    const now = new Date();

    // Find reminders that are due and not yet notified
    const dueReminders = await Reminder.find({
      userId: user.userId,
      status: { $in: ['pending', 'snoozed'] },
      notificationSent: false,
      $or: [
        { dueDate: { $lte: now }, status: 'pending' },
        { snoozedUntil: { $lte: now }, status: 'snoozed' }
      ],
      ...roleFilter
    })
      .sort({ dueDate: 1 })
      .populate('relatedOrderId', 'orderId overallStatus')
      .populate('relatedMachineId', 'machineName status')
      .lean();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        data: {
          reminders: dueReminders,
          count: dueReminders.length
        }
      })
    };

  } catch (error) {
    console.error('Get pending reminders error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to fetch pending reminders'
      })
    };
  }
};

// ============================================================================
// UPDATE REMINDER
// ============================================================================

/**
 * PUT /chat/reminder/{id} - Update a reminder
 */
const updateReminder = async (event, context) => {
  try {
    await connectToDatabase();

    const { user, parsedBody } = event;
    const { id } = event.pathParameters;

    // Validate ID
    const idValidation = validateRequest({ id }, reminderIdSchema);
    if (!idValidation.valid) {
      return {
        statusCode: 400,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Invalid reminder ID'
        })
      };
    }

    // Find reminder and verify ownership
    const reminder = await Reminder.findOne({
      _id: id,
      userId: user.userId
    });

    if (!reminder) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Reminder not found'
        })
      };
    }

    // Update fields
    const { title, description, dueDate, priority, status } = parsedBody;

    if (title) reminder.title = title;
    if (description !== undefined) reminder.description = description;
    if (dueDate) reminder.dueDate = new Date(dueDate);
    if (priority) reminder.priority = priority;
    if (status) {
      reminder.status = status;
      if (status === 'completed') {
        reminder.completedAt = new Date();
      }
    }

    await reminder.save();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Reminder updated successfully',
        data: reminder
      })
    };

  } catch (error) {
    console.error('Update reminder error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to update reminder'
      })
    };
  }
};

// ============================================================================
// DELETE REMINDER
// ============================================================================

/**
 * DELETE /chat/reminder/{id} - Delete a reminder
 */
const deleteReminder = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;
    const { id } = event.pathParameters;

    const result = await Reminder.findOneAndDelete({
      _id: id,
      userId: user.userId
    });

    if (!result) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Reminder not found'
        })
      };
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Reminder deleted successfully'
      })
    };

  } catch (error) {
    console.error('Delete reminder error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to delete reminder'
      })
    };
  }
};

// ============================================================================
// MARK REMINDER ACTIONS
// ============================================================================

/**
 * POST /chat/reminder/{id}/complete - Mark reminder as completed
 */
const completeReminder = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;
    const { id } = event.pathParameters;

    const reminder = await Reminder.findOne({
      _id: id,
      userId: user.userId
    });

    if (!reminder) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Reminder not found'
        })
      };
    }

    await reminder.markCompleted();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Reminder marked as completed',
        data: reminder
      })
    };

  } catch (error) {
    console.error('Complete reminder error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to complete reminder'
      })
    };
  }
};

/**
 * POST /chat/reminder/{id}/snooze - Snooze a reminder
 */
const snoozeReminder = async (event, context) => {
  try {
    await connectToDatabase();

    const { user, parsedBody } = event;
    const { id } = event.pathParameters;
    const { minutes = 30 } = parsedBody;

    const reminder = await Reminder.findOne({
      _id: id,
      userId: user.userId
    });

    if (!reminder) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Reminder not found'
        })
      };
    }

    await reminder.snooze(minutes);

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: `Reminder snoozed for ${minutes} minutes`,
        data: reminder
      })
    };

  } catch (error) {
    console.error('Snooze reminder error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to snooze reminder'
      })
    };
  }
};

/**
 * POST /chat/reminder/{id}/dismiss - Dismiss a reminder
 */
const dismissReminder = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;
    const { id } = event.pathParameters;

    const reminder = await Reminder.findOne({
      _id: id,
      userId: user.userId
    });

    if (!reminder) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Reminder not found'
        })
      };
    }

    await reminder.dismiss();

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Reminder dismissed',
        data: reminder
      })
    };

  } catch (error) {
    console.error('Dismiss reminder error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to dismiss reminder'
      })
    };
  }
};

/**
 * POST /chat/reminder/{id}/notified - Mark reminder as notified
 */
const markNotified = async (event, context) => {
  try {
    await connectToDatabase();

    const { user } = event;
    const { id } = event.pathParameters;

    const result = await Reminder.findOneAndUpdate(
      { _id: id, userId: user.userId },
      {
        notificationSent: true,
        notificationSentAt: new Date()
      },
      { new: true }
    );

    if (!result) {
      return {
        statusCode: 404,
        headers: getCorsHeaders(),
        body: JSON.stringify({
          success: false,
          message: 'Reminder not found'
        })
      };
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Reminder marked as notified'
      })
    };

  } catch (error) {
    console.error('Mark notified error:', error);
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        message: 'Failed to mark reminder as notified'
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
  createReminder: withSecurity(securityOptions)(createReminder),
  getReminders: withSecurity(securityOptions)(getReminders),
  getPendingReminders: withSecurity(securityOptions)(getPendingReminders),
  updateReminder: withSecurity(securityOptions)(updateReminder),
  deleteReminder: withSecurity(securityOptions)(deleteReminder),
  completeReminder: withSecurity(securityOptions)(completeReminder),
  snoozeReminder: withSecurity(securityOptions)(snoozeReminder),
  dismissReminder: withSecurity(securityOptions)(dismissReminder),
  markNotified: withSecurity(securityOptions)(markNotified)
};
