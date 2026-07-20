/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import nodemailer from 'nodemailer';
import { Shop, User } from '../../types.ts';

// Main email sender helper with fallback to console logs when SMTP is unconfigured or fails
export async function sendEmail({
  to,
  subject,
  html,
  text
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || '"Cobult Stocks" <no-reply@cobultstocks.com>';

  const emailSummary = `
========================================================================
📬 [EMAIL DISPATCHED]
To: ${to}
Subject: ${subject}
------------------------------------------------------------------------
${text || html.replace(/<[^>]*>/g, '')}
========================================================================
  `;

  if (!host || !user || !pass) {
    console.log('[Email Service] SMTP configuration missing. Falling back to stdout log:');
    console.log(emailSummary);
    return { success: true, fallback: true };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
    console.log(`[Email Service] Email sent successfully via SMTP: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email Service] SMTP delivery failed. Logging content as fallback:', error);
    console.log(emailSummary);
    return { success: false, error };
  }
}

// 1. Send Welcome Email to Shop Owner
export async function sendShopProvisionedEmail(shop: Shop, owner: User, temporaryPassword: string) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const loginUrl = `${appUrl}/login`;

  const subject = `Welcome to Cobult Stocks - Your Shop "${shop.shopName}" is Ready!`;
  const text = `
Dear ${owner.fullname},

Welcome to Cobult Stocks! Your enterprise tenant sandbox has been successfully provisioned.

Here are your Shop and Login details:
- Shop Name: ${shop.shopName}
- Tenant ID: ${shop.id}
- Subscription: ${shop.subscriptionPlan} Plan (Expires: ${shop.expiryDate})
- Login Email / Username: ${owner.email} (Username: ${owner.username})
- Temporary Password: ${temporaryPassword}

Please log in here to initialize your terminal: ${loginUrl}
We strongly recommend changing your password in the Settings panel immediately after logging in.

Best regards,
The Cobult Stocks Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0F1115; color: #E2E8F0; margin: 0; padding: 20px; }
        .container { max-width: 580px; margin: 0 auto; bg-color: #16191F; border: 1px solid #2D3139; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .header { background-color: #1A1D23; padding: 30px; text-align: center; border-bottom: 2px solid #2563EB; }
        .logo { font-size: 20px; font-weight: bold; color: #FFFFFF; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 30px; background-color: #16191F; }
        h1 { font-size: 20px; margin-top: 0; color: #FFFFFF; font-weight: 700; }
        p { font-size: 13px; line-height: 1.6; color: #94A3B8; }
        .credentials-box { background-color: #1A1D23; border: 1px solid #2D3139; border-radius: 12px; padding: 20px; margin: 25px 0; font-family: monospace; font-size: 12px; }
        .cred-item { margin-bottom: 10px; color: #CBD5E1; }
        .cred-item strong { color: #94A3B8; text-transform: uppercase; display: inline-block; width: 140px; }
        .cred-val { color: #38BDF8; font-weight: bold; }
        .temp-pass { color: #F59E0B; font-weight: bold; }
        .btn-container { text-align: center; margin: 30px 0 15px; }
        .btn { display: inline-block; background-color: #2563EB; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; transition: background-color 0.2s; }
        .footer { background-color: #1A1D23; padding: 20px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid #2D3139; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Cobult Stocks</div>
        </div>
        <div class="content">
          <h1>Welcome to the Platform!</h1>
          <p>Hello ${owner.fullname},</p>
          <p>Your multi-tenant store sandbox has been successfully provisioned. You now have complete access to the warehouse ledger, transaction reporting, and point-of-sale terminals.</p>
          
          <div class="credentials-box">
            <div class="cred-item"><strong>Shop Name:</strong> <span class="cred-val">${shop.shopName}</span></div>
            <div class="cred-item"><strong>Tenant ID:</strong> <span class="cred-val">${shop.id}</span></div>
            <div class="cred-item"><strong>Billing Plan:</strong> <span class="cred-val">${shop.subscriptionPlan} (Expires ${shop.expiryDate})</span></div>
            <div class="cred-item"><strong>Login Email:</strong> <span class="cred-val">${owner.email}</span></div>
            <div class="cred-item"><strong>Username:</strong> <span class="cred-val">${owner.username}</span></div>
            <div class="cred-item"><strong>Access Key:</strong> <span class="temp-pass">${temporaryPassword}</span></div>
          </div>
          
          <div class="btn-container">
            <a href="${loginUrl}" class="btn">Initialize Session</a>
          </div>
          
          <p style="font-size: 11px; color: #F59E0B; text-align: center;">
            ⚠️ For security, please navigate to Settings and update your password immediately after logging in.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Cobult Stocks Inc. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: owner.email, subject, html, text });
}

// 2. Send Invitation Email to New Staff User (Manager/Cashier)
export async function sendUserProvisionedEmail(shopName: string, user: User, temporaryPassword: string) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const loginUrl = `${appUrl}/login`;

  const subject = `Welcome to ${shopName} - Your Cobult Stocks Account is Ready`;
  const text = `
Dear ${user.fullname},

An account has been created for you at "${shopName}" as a ${user.role}.

Here are your account credentials:
- Shop Name: ${shopName}
- Username: ${user.username}
- Email: ${user.email}
- Assigned Role: ${user.role}
- Assigned Branch: ${user.branchId}
- Temporary Password: ${temporaryPassword}

Log in here to get started: ${loginUrl}
We recommend changing your password in the Settings panel immediately after logging in.

Best regards,
The Management Team
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0F1115; color: #E2E8F0; margin: 0; padding: 20px; }
        .container { max-width: 580px; margin: 0 auto; bg-color: #16191F; border: 1px solid #2D3139; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .header { background-color: #1A1D23; padding: 30px; text-align: center; border-bottom: 2px solid #2563EB; }
        .logo { font-size: 20px; font-weight: bold; color: #FFFFFF; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 30px; background-color: #16191F; }
        h1 { font-size: 20px; margin-top: 0; color: #FFFFFF; font-weight: 700; }
        p { font-size: 13px; line-height: 1.6; color: #94A3B8; }
        .credentials-box { background-color: #1A1D23; border: 1px solid #2D3139; border-radius: 12px; padding: 20px; margin: 25px 0; font-family: monospace; font-size: 12px; }
        .cred-item { margin-bottom: 10px; color: #CBD5E1; }
        .cred-item strong { color: #94A3B8; text-transform: uppercase; display: inline-block; width: 140px; }
        .cred-val { color: #38BDF8; font-weight: bold; }
        .temp-pass { color: #F59E0B; font-weight: bold; }
        .btn-container { text-align: center; margin: 30px 0 15px; }
        .btn { display: inline-block; background-color: #2563EB; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; transition: background-color 0.2s; }
        .footer { background-color: #1A1D23; padding: 20px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid #2D3139; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">${shopName}</div>
        </div>
        <div class="content">
          <h1>Account Provisioned!</h1>
          <p>Hello ${user.fullname},</p>
          <p>An administrator has created a user profile for you to access the store point-of-sale (POS) terminal, register sales, or manage stock.</p>
          
          <div class="credentials-box">
            <div class="cred-item"><strong>Store:</strong> <span class="cred-val">${shopName}</span></div>
            <div class="cred-item"><strong>Role:</strong> <span class="cred-val">${user.role}</span></div>
            <div class="cred-item"><strong>Assigned Branch:</strong> <span class="cred-val">${user.branchId}</span></div>
            <div class="cred-item"><strong>Username:</strong> <span class="cred-val">${user.username}</span></div>
            <div class="cred-item"><strong>Email:</strong> <span class="cred-val">${user.email}</span></div>
            <div class="cred-item"><strong>Access Key:</strong> <span class="temp-pass">${temporaryPassword}</span></div>
          </div>
          
          <div class="btn-container">
            <a href="${loginUrl}" class="btn">Launch Terminal</a>
          </div>
          
          <p style="font-size: 11px; color: #F59E0B; text-align: center;">
            ⚠️ Please log in and change your temporary access key in the Settings page as soon as possible.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Cobult Stocks. Powered by Cobult SaaS.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: user.email, subject, html, text });
}

// 3. Send Password Reset Notification
export async function sendPasswordResetEmail(user: User, newPassword: string) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const loginUrl = `${appUrl}/login`;

  const subject = `Cobult Stocks - Password Reset Notification`;
  const text = `
Dear ${user.fullname},

The Super Administrator has reset the login credentials for your Cobult Stocks account.

Your updated access details are:
- Username: ${user.username}
- Email: ${user.email}
- New Temporary Password: ${newPassword}

Log in to your dashboard here: ${loginUrl}
Please change your password immediately after logging in.

Best regards,
SaaS Platform Administration
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #0F1115; color: #E2E8F0; margin: 0; padding: 20px; }
        .container { max-width: 580px; margin: 0 auto; bg-color: #16191F; border: 1px solid #2D3139; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .header { background-color: #1A1D23; padding: 30px; text-align: center; border-bottom: 2px solid #D97706; }
        .logo { font-size: 20px; font-weight: bold; color: #FFFFFF; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 30px; background-color: #16191F; }
        h1 { font-size: 20px; margin-top: 0; color: #FFFFFF; font-weight: 700; }
        p { font-size: 13px; line-height: 1.6; color: #94A3B8; }
        .credentials-box { background-color: #1A1D23; border: 1px solid #2D3139; border-radius: 12px; padding: 20px; margin: 25px 0; font-family: monospace; font-size: 12px; }
        .cred-item { margin-bottom: 10px; color: #CBD5E1; }
        .cred-item strong { color: #94A3B8; text-transform: uppercase; display: inline-block; width: 140px; }
        .cred-val { color: #38BDF8; font-weight: bold; }
        .temp-pass { color: #F59E0B; font-weight: bold; }
        .btn-container { text-align: center; margin: 30px 0 15px; }
        .btn { display: inline-block; background-color: #D97706; color: #FFFFFF; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; transition: background-color 0.2s; }
        .footer { background-color: #1A1D23; padding: 20px; text-align: center; font-size: 11px; color: #64748B; border-top: 1px solid #2D3139; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Cobult SaaS Admin</div>
        </div>
        <div class="content">
          <h1>Security: Password Reset</h1>
          <p>Hello ${user.fullname},</p>
          <p>A platform administrator has reset the password for your store owner account.</p>
          
          <div class="credentials-box">
            <div class="cred-item"><strong>Username:</strong> <span class="cred-val">${user.username}</span></div>
            <div class="cred-item"><strong>Email:</strong> <span class="cred-val">${user.email}</span></div>
            <div class="cred-item"><strong>New Password:</strong> <span class="temp-pass">${newPassword}</span></div>
          </div>
          
          <div class="btn-container">
            <a href="${loginUrl}" class="btn">Access Dashboard</a>
          </div>
          
          <p style="font-size: 11px; color: #F59E0B; text-align: center;">
            ⚠️ Please log in and change your temporary password immediately in the Settings tab.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Cobult Stocks. Powered by Cobult SaaS.
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to: user.email, subject, html, text });
}
