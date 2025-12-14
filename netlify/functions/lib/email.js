import { Resend } from 'resend';

// Initialize email provider
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@veilforms.com';
const FROM_NAME = 'VeilForms';
const BASE_URL = process.env.URL || 'https://veilforms.com';

// Password reset email template
function getPasswordResetEmailHtml(resetUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #27272a;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #fafafa;">
                <span style="color: #6366f1;">Veil</span>Forms
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #fafafa;">Reset your password</h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #a1a1aa;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #6366f1; text-decoration: none; border-radius: 8px;">Reset Password</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: #71717a;">
                This link will expire in <strong style="color: #a1a1aa;">1 hour</strong>.
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 22px; color: #71717a;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #27272a;">
              <p style="margin: 0; font-size: 12px; color: #52525b;">
                VeilForms &bull; Privacy-first form builder
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getPasswordResetEmailText(resetUrl) {
  return `
Reset your password

We received a request to reset your password for VeilForms.

Click the link below to choose a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
VeilForms - Privacy-first form builder
  `.trim();
}

// Welcome email template
function getWelcomeEmailHtml(email) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #27272a;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #fafafa;">
                <span style="color: #6366f1;">Veil</span>Forms
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #fafafa;">Welcome to VeilForms!</h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #a1a1aa;">
                You've just joined the privacy-first form revolution. Your users' data is now encrypted before it even leaves their browser.
              </p>
              <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #fafafa;">Quick Start:</h3>
              <ol style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; line-height: 24px; color: #a1a1aa;">
                <li>Create your first form in the dashboard</li>
                <li>Save your private key securely (we can't recover it!)</li>
                <li>Embed the form on your website</li>
                <li>View encrypted submissions only you can decrypt</li>
              </ol>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${BASE_URL}/dashboard/" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #6366f1; text-decoration: none; border-radius: 8px;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0; font-size: 14px; line-height: 22px; color: #71717a;">
                Need help? Check out our <a href="${BASE_URL}/docs/" style="color: #6366f1; text-decoration: none;">documentation</a>.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #27272a;">
              <p style="margin: 0; font-size: 12px; color: #52525b;">
                VeilForms &bull; Privacy-first form builder
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getWelcomeEmailText() {
  return `
Welcome to VeilForms!

You've just joined the privacy-first form revolution. Your users' data is now encrypted before it even leaves their browser.

Quick Start:
1. Create your first form in the dashboard
2. Save your private key securely (we can't recover it!)
3. Embed the form on your website
4. View encrypted submissions only you can decrypt

Go to Dashboard: ${BASE_URL}/dashboard/

Need help? Check out our documentation: ${BASE_URL}/docs/

---
VeilForms - Privacy-first form builder
  `.trim();
}

// Send email via Resend
async function sendViaResend(to, subject, html, text) {
  if (!resend) {
    throw new Error('Resend not configured');
  }

  const { data, error } = await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: [to],
    subject,
    html,
    text
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return { provider: 'resend', id: data.id };
}

// Send password reset email
export async function sendPasswordResetEmail(email, resetUrl) {
  const subject = 'Reset your password - VeilForms';
  const html = getPasswordResetEmailHtml(resetUrl);
  const text = getPasswordResetEmailText(resetUrl);

  if (resend) {
    try {
      const result = await sendViaResend(email, subject, html, text);
      console.log(`Password reset email sent to ${email}`);
      return result;
    } catch (error) {
      console.error('Email send failed:', error.message);
      throw error;
    }
  }

  // No email provider configured - log for development
  console.log(`[DEV] Would send password reset email to ${email}`);
  console.log(`[DEV] Reset URL: ${resetUrl}`);
  return { provider: 'dev', id: 'dev-' + Date.now() };
}

// Send welcome email
export async function sendWelcomeEmail(email) {
  const subject = 'Welcome to VeilForms!';
  const html = getWelcomeEmailHtml(email);
  const text = getWelcomeEmailText();

  if (resend) {
    try {
      const result = await sendViaResend(email, subject, html, text);
      console.log(`Welcome email sent to ${email}`);
      return result;
    } catch (error) {
      console.error('Welcome email send failed:', error.message);
      // Don't throw - welcome email failure shouldn't block registration
      return null;
    }
  }

  // No email provider configured - log for development
  console.log(`[DEV] Would send welcome email to ${email}`);
  return { provider: 'dev', id: 'dev-' + Date.now() };
}

// Email verification template
function getEmailVerificationHtml(verifyUrl) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #27272a;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #fafafa;">
                <span style="color: #6366f1;">Veil</span>Forms
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #fafafa;">Verify your email</h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #a1a1aa;">
                Thanks for signing up! Please verify your email address to get started with VeilForms.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #10b981; text-decoration: none; border-radius: 8px;">Verify Email</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: #71717a;">
                This link will expire in <strong style="color: #a1a1aa;">24 hours</strong>.
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 22px; color: #71717a;">
                If you didn't create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #27272a;">
              <p style="margin: 0; font-size: 12px; color: #52525b;">
                VeilForms &bull; Privacy-first form builder
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getEmailVerificationText(verifyUrl) {
  return `
Verify your email

Thanks for signing up for VeilForms! Please verify your email address to get started.

Click the link below to verify your email:
${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

---
VeilForms - Privacy-first form builder
  `.trim();
}

// Send email verification
export async function sendEmailVerification(email, verifyUrl) {
  const subject = 'Verify your email - VeilForms';
  const html = getEmailVerificationHtml(verifyUrl);
  const text = getEmailVerificationText(verifyUrl);

  if (resend) {
    try {
      const result = await sendViaResend(email, subject, html, text);
      console.log(`Verification email sent to ${email}`);
      return result;
    } catch (error) {
      console.error('Verification email send failed:', error.message);
      throw error;
    }
  }

  // No email provider configured - log for development
  console.log(`[DEV] Would send verification email to ${email}`);
  console.log(`[DEV] Verify URL: ${verifyUrl}`);
  return { provider: 'dev', id: 'dev-' + Date.now() };
}

// Form submission notification template
function getSubmissionNotificationHtml(formName, submissionId, timestamp, dashboardUrl, includeData, data) {
  const formattedDate = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  let dataPreviewHtml = '';
  if (includeData && data) {
    const fields = Object.entries(data)
      .map(([key, value]) => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #a1a1aa; font-size: 14px; font-weight: 600;">
            ${escapeHtml(key)}
          </td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #27272a; color: #fafafa; font-size: 14px;">
            ${escapeHtml(String(value))}
          </td>
        </tr>
      `).join('');

    dataPreviewHtml = `
      <div style="margin-top: 24px; padding: 16px; background-color: #09090b; border: 1px solid #27272a; border-radius: 8px;">
        <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #fafafa; text-transform: uppercase; letter-spacing: 0.5px;">Submission Data</h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          ${fields}
        </table>
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #27272a;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #fafafa;">
                <span style="color: #6366f1;">Veil</span>Forms
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <div style="display: inline-block; padding: 6px 12px; background-color: #10b981; color: #ffffff; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">
                New Submission
              </div>
              <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #fafafa;">${escapeHtml(formName)}</h2>
              <p style="margin: 0 0 24px; font-size: 14px; color: #71717a;">
                ${formattedDate}
              </p>
              <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span style="font-size: 14px; color: #71717a;">Submission ID</span>
                  <code style="font-size: 12px; color: #a1a1aa; font-family: 'Courier New', monospace; background-color: #18181b; padding: 2px 6px; border-radius: 4px;">${submissionId.substring(0, 8)}...${submissionId.substring(submissionId.length - 8)}</code>
                </div>
              </div>
              ${dataPreviewHtml}
              ${!includeData ? `
              <div style="padding: 16px; background-color: #18181b; border: 1px solid #3f3f46; border-radius: 8px; margin-top: 24px;">
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #a1a1aa;">
                  <strong style="color: #fafafa;">Note:</strong> Submission data is encrypted. Log in to your dashboard to view and decrypt submissions.
                </p>
              </div>
              ` : ''}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 24px 0 0;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #6366f1; text-decoration: none; border-radius: 8px;">View in Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #27272a;">
              <p style="margin: 0 0 8px; font-size: 12px; color: #52525b;">
                VeilForms &bull; Privacy-first form builder
              </p>
              <p style="margin: 0; font-size: 11px; color: #3f3f46;">
                You're receiving this because notifications are enabled for this form.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getSubmissionNotificationText(formName, submissionId, timestamp, dashboardUrl, includeData, data) {
  const formattedDate = new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  let dataText = '';
  if (includeData && data) {
    dataText = '\n\nSubmission Data:\n' + Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  } else {
    dataText = '\n\nNote: Submission data is encrypted. Log in to your dashboard to view and decrypt submissions.';
  }

  return `
New Submission Received

Form: ${formName}
Received: ${formattedDate}
Submission ID: ${submissionId}
${dataText}

View in Dashboard: ${dashboardUrl}

---
VeilForms - Privacy-first form builder
You're receiving this because notifications are enabled for this form.
  `.trim();
}

// Helper to escape HTML
function escapeHtml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Resume progress email template
function getResumeEmailHtml(resumeUrl, formName, expiryHours) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 480px; background-color: #18181b; border-radius: 12px; border: 1px solid #27272a;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #27272a;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #fafafa;">
                <span style="color: #6366f1;">Veil</span>Forms
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #fafafa;">Continue your form</h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #a1a1aa;">
                Your progress on <strong style="color: #fafafa;">${escapeHtml(formName)}</strong> has been saved. Click the button below to pick up where you left off.
              </p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 0 0 24px;">
                    <a href="${resumeUrl}" style="display: inline-block; padding: 12px 32px; font-size: 16px; font-weight: 600; color: #ffffff; background-color: #6366f1; text-decoration: none; border-radius: 8px;">Continue Form</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: #71717a;">
                This link will expire in <strong style="color: #a1a1aa;">${expiryHours} hours</strong>.
              </p>
              <p style="margin: 0; font-size: 14px; line-height: 22px; color: #71717a;">
                If you didn't request this link, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #27272a;">
              <p style="margin: 0; font-size: 12px; color: #52525b;">
                VeilForms &bull; Privacy-first form builder
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getResumeEmailText(resumeUrl, formName, expiryHours) {
  return `
Continue your form

Your progress on "${formName}" has been saved. Click the link below to pick up where you left off:
${resumeUrl}

This link will expire in ${expiryHours} hours.

If you didn't request this link, you can safely ignore this email.

---
VeilForms - Privacy-first form builder
  `.trim();
}

// Send resume progress email
export async function sendResumeEmail(email, resumeUrl, formName, expiryHours) {
  const subject = `Continue your form: ${formName}`;
  const html = getResumeEmailHtml(resumeUrl, formName, expiryHours);
  const text = getResumeEmailText(resumeUrl, formName, expiryHours);

  if (resend) {
    try {
      const result = await sendViaResend(email, subject, html, text);
      console.log(`Resume email sent to ${email}`);
      return result;
    } catch (error) {
      console.error('Resume email send failed:', error.message);
      throw error;
    }
  }

  // No email provider configured - log for development
  console.log(`[DEV] Would send resume email to ${email}`);
  console.log(`[DEV] Resume URL: ${resumeUrl}`);
  return { provider: 'dev', id: 'dev-' + Date.now() };
}

// Send submission notification email
export async function sendSubmissionNotification(recipients, formName, formId, submissionId, timestamp, includeData = false, data = null) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('At least one recipient email is required');
  }

  const dashboardUrl = `${BASE_URL}/dashboard/#form-${formId}`;
  const subject = `New submission: ${formName}`;
  const html = getSubmissionNotificationHtml(formName, submissionId, timestamp, dashboardUrl, includeData, data);
  const text = getSubmissionNotificationText(formName, submissionId, timestamp, dashboardUrl, includeData, data);

  if (resend) {
    try {
      const results = await Promise.allSettled(
        recipients.map(email => sendViaResend(email, subject, html, text))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      console.log(`Submission notifications sent: ${successful} succeeded, ${failed} failed`);

      return {
        provider: 'resend',
        successful,
        failed,
        total: recipients.length
      };
    } catch (error) {
      console.error('Notification email send failed:', error.message);
      throw error;
    }
  }

  // No email provider configured - log for development
  console.log(`[DEV] Would send notification emails to: ${recipients.join(', ')}`);
  console.log(`[DEV] Form: ${formName}, Submission: ${submissionId}`);
  return { provider: 'dev', id: 'dev-' + Date.now(), total: recipients.length };
}
