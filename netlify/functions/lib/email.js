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
