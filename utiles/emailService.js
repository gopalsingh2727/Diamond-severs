/**
 * Email Service Utility
 * Supports multiple email providers: Nodemailer, AWS SES, or Console logging
 * Configure via environment variables
 */

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console'; // 'nodemailer', 'ses', or 'console'

// Initialize email provider based on configuration
let emailTransporter = null;

if (EMAIL_PROVIDER === 'nodemailer') {
  try {
    const nodemailer = require('nodemailer');
    emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } catch (error) {
    console.warn('Nodemailer not installed. Falling back to console logging.');
  }
} else if (EMAIL_PROVIDER === 'ses') {
  try {
    const AWS = require('aws-sdk');
    AWS.config.update({
      region: process.env.AWS_REGION || 'ap-south-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    });
    emailTransporter = new AWS.SES({ apiVersion: '2010-12-01' });
  } catch (error) {
    console.warn('AWS SES not configured. Falling back to console logging.');
  }
}

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text content
 * @param {string} options.html - HTML content
 * @returns {Promise<Object>} Result of email send
 */
async function sendEmail({ to, subject, text, html }) {
  const from = process.env.EMAIL_FROM || 'noreply@27manufacturing.com';

  // Console logging mode (for development)
  if (!emailTransporter || EMAIL_PROVIDER === 'console') {
    console.log('\n========== EMAIL ==========');
    console.log('From:', from);
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('----------------------------');
    console.log(text || html);
    console.log('===========================\n');
    return { success: true, mode: 'console' };
  }

  // Nodemailer mode
  if (EMAIL_PROVIDER === 'nodemailer') {
    try {
      const info = await emailTransporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      console.log('Email sent via Nodemailer:', info.messageId);
      return { success: true, messageId: info.messageId, mode: 'nodemailer' };
    } catch (error) {
      console.error('Nodemailer error:', error);
      throw new Error('Failed to send email via Nodemailer');
    }
  }

  // AWS SES mode
  if (EMAIL_PROVIDER === 'ses') {
    try {
      const params = {
        Source: from,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: html
            ? { Html: { Data: html } }
            : { Text: { Data: text } },
        },
      };
      const result = await emailTransporter.sendEmail(params).promise();
      console.log('Email sent via SES:', result.MessageId);
      return { success: true, messageId: result.MessageId, mode: 'ses' };
    } catch (error) {
      console.error('SES error:', error);
      throw new Error('Failed to send email via SES');
    }
  }

  throw new Error('No email provider configured');
}

/**
 * Send email verification link
 */
async function sendVerificationEmail(email, token, managerName) {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  const subject = 'Verify Your Email - 27 Manufacturing';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>27 Manufacturing</h1>
        </div>
        <div class="content">
          <h2>Verify Your Email Address</h2>
          <p>Hello ${managerName || 'Manager'},</p>
          <p>Thank you for registering with 27 Manufacturing. Please verify your email address to activate your account.</p>
          <p>Click the button below to verify your email:</p>
          <a href="${verificationUrl}" class="button">Verify Email</a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #2563eb;">${verificationUrl}</p>
          <p><strong>This link will expire in 24 hours.</strong></p>
          <p>If you didn't create this account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} 27 Manufacturing (Diamond Polymers). All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Verify Your Email - 27 Manufacturing

    Hello ${managerName || 'Manager'},

    Thank you for registering with 27 Manufacturing. Please verify your email address to activate your account.

    Click this link to verify your email:
    ${verificationUrl}

    This link will expire in 24 hours.

    If you didn't create this account, please ignore this email.

    © ${new Date().getFullYear()} 27 Manufacturing (Diamond Polymers). All rights reserved.
  `;

  return await sendEmail({ to: email, subject, text, html });
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, token, managerName) {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const subject = 'Password Reset Request - 27 Manufacturing';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
        .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>27 Manufacturing</h1>
        </div>
        <div class="content">
          <h2>Password Reset Request</h2>
          <p>Hello ${managerName || 'Manager'},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #dc2626;">${resetUrl}</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul>
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this, please ignore this email</li>
              <li>Your password will not change unless you click the link and create a new password</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} 27 Manufacturing (Diamond Polymers). All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    Password Reset Request - 27 Manufacturing

    Hello ${managerName || 'Manager'},

    We received a request to reset your password. Click this link to create a new password:
    ${resetUrl}

    Security Notice:
    - This link will expire in 1 hour
    - If you didn't request this, please ignore this email
    - Your password will not change unless you click the link and create a new password

    © ${new Date().getFullYear()} 27 Manufacturing (Diamond Polymers). All rights reserved.
  `;

  return await sendEmail({ to: email, subject, text, html });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
