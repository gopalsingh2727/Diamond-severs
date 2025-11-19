require('dotenv').config();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const connectDB = require('../../config/mongodb/db');
const Admin = require('../../models/Admin/Admin');

const { Product27Infinity } = require('../../models/Product27InfinitySchema/Product27InfinitySchema');

// Helper functions
const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(body)
});

const checkApiKey = (event) => {
  const headers = event.headers || {};
  const apiKey = headers['x-api-key'] || headers['X-API-Key'];
  return apiKey && apiKey === process.env.API_KEY;
};

// Send password reset email (placeholder - implement with your email service)
const sendPasswordResetEmail = async (email, token, username) => {
  // TODO: Implement with your email service (SendGrid, AWS SES, etc.)
  console.log(`Password reset email would be sent to: ${email}`);
  console.log(`Reset token: ${token}`);
  console.log(`Reset link: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`);
  // For now, just log the token. In production, send actual email.
};

module.exports.loginAdmin = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const headers = event.headers || {};
    const apiKey = headers['x-api-key'] || headers['X-API-Key'];
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Forbidden: Invalid API key' })
      };
    }

    await connectDB();

    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Request body is required' })
      };
    }

    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Email and password are required' })
      };
    }

    // Find admin by email
    const admin = await Admin.findOne({ email })
      .populate('product27InfinityId');

    if (!admin) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    const passwordMatch = await admin.comparePassword(password);
    if (!passwordMatch) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }

    // ✅ Check product only for role = 'admin'
    if (admin.role === 'admin') {
      const product = admin.product27InfinityId;
      if (!product || !product.isActive || product.status !== 'active') {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Product is inactive or not accessible'
          })
        };
      }
    }

    // ✅ Allow master_admin login without product check

    // Generate unique session token for single-device login
    const sessionToken = crypto.randomBytes(32).toString('hex');

    const token = jwt.sign(
      {
        id: admin._id,
        userId: admin._id.toString(), // ✅ Add userId for consistency with other handlers
        role: admin.role,
        sessionToken: sessionToken // Include session token in JWT
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Store session token in database (invalidates previous sessions)
    admin.activeSessionToken = sessionToken;
    await admin.save();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        token,
        admin: {
          id: admin._id,
          username: admin.username,
          role: admin.role,
          product: admin.product27InfinityId ? {
            id: admin.product27InfinityId._id,
            Product27InfinityId: admin.product27InfinityId.Product27InfinityId,
            name: admin.product27InfinityId.name
          } : null
        }
      })
    };

  } catch (error) {
    console.error('❌ Admin login error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

// Request Password Reset
module.exports.requestPasswordReset = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    await connectDB();

    const { email } = JSON.parse(event.body || '{}');

    if (!email) {
      return respond(400, { message: 'Email is required' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      // Don't reveal if email exists or not for security
      return respond(200, {
        message: 'If the email exists, a password reset link has been sent.',
      });
    }

    // Generate password reset token
    const resetToken = admin.generatePasswordResetToken();
    await admin.save();

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetToken, admin.username);
      console.log(`Password reset email sent to: ${email}`);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
    }

    return respond(200, {
      message: 'Password reset link sent. Please check your inbox.',
      // In development, return token for testing
      ...(process.env.NODE_ENV === 'development' && { resetToken })
    });
  } catch (error) {
    console.error('Request Password Reset Error:', error);
    return respond(500, { message: 'Internal server error' });
  }
};

// Reset Password with Token
module.exports.resetPassword = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  if (!checkApiKey(event)) {
    return respond(403, { message: 'Invalid API key' });
  }

  try {
    await connectDB();

    const { token, newPassword } = JSON.parse(event.body || '{}');

    if (!token || !newPassword) {
      return respond(400, {
        message: 'Token and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return respond(400, {
        message: 'Password must be at least 8 characters long',
      });
    }

    const admin = await Admin.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!admin) {
      return respond(400, {
        message: 'Invalid or expired password reset token',
        expired: true,
      });
    }

    // Reset password
    admin.password = newPassword;
    admin.passwordResetToken = undefined;
    admin.passwordResetExpires = undefined;

    await admin.save();

    console.log(`Password reset successfully for admin: ${admin.email}`);

    return respond(200, {
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return respond(500, { message: 'Internal server error' });
  }
};