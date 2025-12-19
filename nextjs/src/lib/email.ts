/**
 * VeilForms - Email Service
 * Send transactional emails via Resend
 */

// Note: Install resend with `npm install resend` when ready to use
// import { Resend } from 'resend';

import { apiLogger } from "./logger";

const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@veilforms.com";
const FROM_NAME = "VeilForms";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://veilforms.com";

interface EmailResult {
  provider: string;
  id: string;
}

/**
 * Send email verification
 */
export async function sendEmailVerification(
  email: string,
  verifyUrl: string
): Promise<EmailResult> {
  // TODO: Implement with Resend when API key is configured
  apiLogger.debug({ to: email, type: 'verification', verifyUrl }, "Would send verification email (dev mode)");
  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<EmailResult> {
  // TODO: Implement with Resend when API key is configured
  apiLogger.debug({ to: email, type: 'password-reset', resetUrl }, "Would send password reset email (dev mode)");
  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  email: string
): Promise<EmailResult | null> {
  // TODO: Implement with Resend when API key is configured
  apiLogger.debug({ to: email, type: 'welcome' }, "Would send welcome email (dev mode)");
  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Send submission notification to form owner
 */
export async function sendSubmissionNotification(
  formOwnerEmail: string,
  formName: string,
  submissionId: string,
  dashboardUrl: string,
  timestamp: number,
  additionalRecipients?: string[]
): Promise<EmailResult> {
  const recipients = [formOwnerEmail, ...(additionalRecipients || [])];
  const submissionDate = new Date(timestamp).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const subject = `New submission to ${formName}`;
  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .info-box { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4f46e5; }
          .info-row { margin: 10px 0; }
          .label { font-weight: 600; color: #6b7280; }
          .value { color: #111827; }
          .button { display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">VeilForms</h1>
          </div>
          <div class="content">
            <h2 style="margin-top: 0; color: #111827;">New Form Submission</h2>
            <p>You have received a new submission to your form <strong>${formName}</strong>.</p>

            <div class="info-box">
              <div class="info-row">
                <span class="label">Submission ID:</span><br>
                <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 13px;">${submissionId}</code>
              </div>
              <div class="info-row">
                <span class="label">Received:</span><br>
                <span class="value">${submissionDate}</span>
              </div>
            </div>

            <p style="color: #6b7280; font-style: italic;">
              Note: Form data is end-to-end encrypted. To view the submission, use your private key in the dashboard.
            </p>

            <a href="${dashboardUrl}" class="button">View in Dashboard</a>

            <div class="footer">
              <p>This email was sent by VeilForms<br>
              <a href="${BASE_URL}" style="color: #4f46e5;">veilforms.com</a></p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const textBody = `
VeilForms - New Form Submission

You have received a new submission to your form "${formName}".

Submission ID: ${submissionId}
Received: ${submissionDate}

Note: Form data is end-to-end encrypted. To view the submission, use your private key in the dashboard.

View in Dashboard: ${dashboardUrl}

---
VeilForms
${BASE_URL}
  `.trim();

  // TODO: Implement with Resend when API key is configured
  apiLogger.debug(
    {
      to: recipients,
      type: 'submission-notification',
      formName,
      submissionId
    },
    "Would send submission notification email (dev mode)"
  );

  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Send confirmation email to form respondent
 */
export async function sendSubmissionConfirmation(
  respondentEmail: string,
  formName: string
): Promise<EmailResult> {
  const subject = `Thank you for your submission to ${formName}`;
  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
          .checkmark { font-size: 48px; text-align: center; color: #10b981; margin: 20px 0; }
          .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 24px;">VeilForms</h1>
          </div>
          <div class="content">
            <div class="checkmark">✓</div>
            <h2 style="margin-top: 0; color: #111827; text-align: center;">Submission Received</h2>
            <p style="text-align: center;">Thank you for your submission to <strong>${formName}</strong>.</p>
            <p style="text-align: center; color: #6b7280;">
              Your response has been securely received and encrypted.
            </p>

            <div class="footer">
              <p>This form is powered by VeilForms<br>
              <a href="${BASE_URL}" style="color: #10b981;">Privacy-first form submissions</a></p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const textBody = `
VeilForms - Submission Received

Thank you for your submission to "${formName}".

Your response has been securely received and encrypted.

---
This form is powered by VeilForms
Privacy-first form submissions
${BASE_URL}
  `.trim();

  // TODO: Implement with Resend when API key is configured
  apiLogger.debug(
    {
      to: respondentEmail,
      type: 'submission-confirmation',
      formName
    },
    "Would send submission confirmation email (dev mode)"
  );

  return { provider: "dev", id: "dev-" + Date.now() };
}

/**
 * Generic email sending function
 */
export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const { to, subject, text, html } = options;

  // TODO: Implement with Resend when API key is configured
  apiLogger.debug(
    {
      to,
      subject,
      type: 'generic'
    },
    "Would send email (dev mode)"
  );

  return { provider: "dev", id: "dev-" + Date.now() };
}

export { FROM_EMAIL, FROM_NAME, BASE_URL };
