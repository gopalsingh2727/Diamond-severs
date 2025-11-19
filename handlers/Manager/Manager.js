const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const connect = require('../../config/mongodb/db');
const Manager = require('../../models/Manager/Mannager');
const Branch = require('../../models/Branch/Branch');
const verifyToken = require('../../utiles/verifyToken');
const { verifyTokenWithSession } = require('../../utiles/verifyToken');
const mongoose = require('mongoose');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../../utiles/emailService');

const respond = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

const checkApiKey = (event) => {
  const apiKey = event.headers['x-api-key'];
  return apiKey === process.env.API_KEY;
};



module.exports.managerLogin = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const { email, password } = JSON.parse(event.body);
    if (!email || !password) {
      return respond(400, { message: 'Email and password are required' });
    }

    // Select password explicitly (it may have select: false in schema)
    const manager = await Manager.findOne({ email }).select('+password');

    // Check if manager exists
    if (!manager) {
      return respond(401, { message: 'Invalid credentials' });
    }

    // Check if account is locked
    if (manager.isLocked) {
      return respond(423, {
        message: 'Account is locked due to multiple failed login attempts. Please try again later or contact support.',
        lockUntil: manager.lockUntil
      });
    }

    // Check if account is active
    if (!manager.isActive) {
      return respond(403, { message: 'Account is deactivated. Please contact your administrator.' });
    }

    // Check if email is verified (using emailVerified field to match MasterAdminBackend)
    // TEMPORARILY DISABLED - Allow login without email verification
    // if (manager.emailVerified === false) {
    //   return respond(403, {
    //     message: 'Email not verified. Please check your email for the verification link or request a new one.',
    //     requiresVerification: true,
    //     email: manager.email
    //   });
    // }

    // Verify password
    const isPasswordValid = await manager.comparePassword(password);
    if (!isPasswordValid) {
      // Increment failed login attempts
      await manager.incLoginAttempts();
      return respond(401, { message: 'Invalid credentials' });
    }

    // Reset login attempts on successful login
    if (manager.loginAttempts > 0) {
      await manager.resetLoginAttempts();
    }

    // Generate unique session token for single-device login
    const sessionToken = crypto.randomBytes(32).toString('hex');

    // Update last login and session token
    manager.lastLogin = new Date();
    manager.activeSessionToken = sessionToken;
    await manager.save();

    // Generate JWT token
    const token = jwt.sign({
      id: manager._id,
      email: manager.email,
      username: manager.username,
      role: 'manager',
      branchId: manager.branchId,
      sessionToken: sessionToken // Include session token in JWT
    }, process.env.JWT_SECRET, { expiresIn: '1d' });

    return respond(200, {
      token,
      manager: {
        id: manager._id,
        email: manager.email,
        username: manager.username,
        branchId: manager.branchId,
        lastLogin: manager.lastLogin
      }
    });
  } catch (err) {
    console.error('Manager Login Error:', err);
    return respond(500, { message: 'Internal server error' });
  }
};





module.exports.getMyBranch = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    let user;
    try {
      user = await verifyTokenWithSession(authHeader);
    } catch (err) {
      // Check if session expired due to login on another device
      if (err.message.includes('Session expired')) {
        return respond(401, { message: err.message, sessionExpired: true });
      }
      return respond(401, { message: 'Invalid token' });
    }

    if (user.role !== 'manager') {
      return respond(403, { message: 'Only managers can access this route' });
    }

    if (!user.branchId) {
      return respond(400, { message: 'Branch ID missing in token' });
    }

    const branch = await Branch.findById(user.branchId).lean();
    if (!branch) {
      return respond(404, { message: 'Branch not found' });
    }

    return respond(200, {
      branchId: branch._id,
      name: branch.name,
      location: branch.location,
    });
  } catch (err) {
    console.error('Get My Branch Error:', err);
    return respond(500, { message: 'Internal server error' });
  }
};

// Send Email Verification
module.exports.sendEmailVerification = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return respond(400, { message: 'Email is required' });
    }

    const manager = await Manager.findOne({ email });
    if (!manager) {
      // Don't reveal if email exists or not for security
      return respond(200, {
        message: 'If the email exists, a verification link has been sent.',
      });
    }

    if (manager.emailVerified) {
      return respond(400, { message: 'Email is already verified' });
    }

    // Generate verification token
    const verificationToken = manager.generateEmailVerificationToken();
    await manager.save();

    // Send verification email
    try {
      await sendVerificationEmail(email, verificationToken, manager.username);
      console.log(`Verification email sent to: ${email}`);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // Don't fail the request if email fails, token is still generated
    }

    return respond(200, {
      message: 'Verification email sent. Please check your inbox.',
      email: email,
    });
  } catch (err) {
    console.error('Send Email Verification Error:', err);
    return respond(500, { message: 'Internal server error' });
  }
};

// Verify Email with Token
module.exports.verifyEmail = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const { token } = event.queryStringParameters || {};

    if (!token) {
      return respond(400, { message: 'Verification token is required' });
    }

    const manager = await Manager.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!manager) {
      return respond(400, {
        message: 'Invalid or expired verification token',
        expired: true,
      });
    }

    if (manager.emailVerified) {
      return respond(400, { message: 'Email is already verified' });
    }

    // Mark email as verified
    manager.emailVerified = true;
    manager.emailVerificationToken = undefined;
    manager.emailVerificationExpires = undefined;
    await manager.save();

    console.log(`Email verified for manager: ${manager.email}`);

    return respond(200, {
      message: 'Email verified successfully! You can now log in.',
      email: manager.email,
      verified: true,
    });
  } catch (err) {
    console.error('Verify Email Error:', err);
    return respond(500, { message: 'Internal server error' });
  }
};

// Request Password Reset
module.exports.requestPasswordReset = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const { email } = JSON.parse(event.body);

    if (!email) {
      return respond(400, { message: 'Email is required' });
    }

    const manager = await Manager.findOne({ email });
    if (!manager) {
      // Don't reveal if email exists or not for security
      return respond(200, {
        message: 'If the email exists, a password reset link has been sent.',
      });
    }

    if (!manager.isActive) {
      return respond(403, { message: 'Account is deactivated' });
    }

    // Generate password reset token
    const resetToken = manager.generatePasswordResetToken();
    await manager.save();

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, resetToken, manager.username);
      console.log(`Password reset email sent to: ${email}`);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
    }

    return respond(200, {
      message: 'Password reset link sent. Please check your inbox.',
    });
  } catch (err) {
    console.error('Request Password Reset Error:', err);
    return respond(500, { message: 'Internal server error' });
  }
};

// Reset Password with Token
module.exports.resetPassword = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  await connect();

  if (!checkApiKey(event)) return respond(403, { message: 'Invalid API key' });

  try {
    const { token, newPassword } = JSON.parse(event.body);

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

    const manager = await Manager.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!manager) {
      return respond(400, {
        message: 'Invalid or expired password reset token',
        expired: true,
      });
    }

    // Reset password
    manager.password = newPassword;
    manager.passwordResetToken = undefined;
    manager.passwordResetExpires = undefined;

    // Reset any account locks and login attempts
    manager.loginAttempts = 0;
    manager.lockUntil = undefined;

    await manager.save();

    console.log(`Password reset successfully for manager: ${manager.email}`);

    return respond(200, {
      message: 'Password reset successfully! You can now log in with your new password.',
      email: manager.email,
    });
  } catch (err) {
    console.error('Reset Password Error:', err);
    return respond(500, { message: 'Internal server error' });
  }
};

