// VeilForms Email Verification JavaScript

// Show a specific status section
function showStatus(id) {
  document.querySelectorAll('.verify-status').forEach(el => {
    el.style.display = 'none';
  });
  document.getElementById(id).style.display = 'block';
}

// Verify email token
async function verifyToken(token) {
  try {
    const response = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    const data = await response.json();

    if (!response.ok) {
      if (data.expired) {
        showStatus('verify-error');
        document.getElementById('verify-error-message').textContent =
          'This verification link has expired. Please request a new one.';
      } else {
        showStatus('verify-error');
        document.getElementById('verify-error-message').textContent =
          data.error || 'Verification failed. The link may be invalid.';
      }
      return;
    }

    if (data.alreadyVerified) {
      showStatus('verify-already');
    } else {
      showStatus('verify-success');
    }
  } catch (err) {
    console.error('Verification error:', err);
    showStatus('verify-error');
    document.getElementById('verify-error-message').textContent =
      'An error occurred. Please try again.';
  }
}

// Resend verification email
async function resendVerification(email) {
  try {
    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error(data.error || 'Too many requests. Please wait before trying again.');
      }
      throw new Error(data.error || 'Failed to resend verification email');
    }

    if (data.alreadyVerified) {
      // Email is already verified, redirect to login
      window.location.href = '/login/';
      return;
    }

    return true;
  } catch (err) {
    throw err;
  }
}

// Initialize verification page
function initVerifyPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (token) {
    // We have a token, verify it
    showStatus('verify-loading');
    verifyToken(token);
  } else {
    // No token, show "check your email" page
    showStatus('verify-no-token');

    // Pre-fill email from localStorage if available
    const pendingEmail = localStorage.getItem('veilforms_pending_email');
    const emailInput = document.getElementById('email');
    if (pendingEmail && emailInput) {
      emailInput.value = pendingEmail;
    }
  }

  // Handle resend form
  const resendForm = document.getElementById('resend-form');
  if (resendForm) {
    const submitBtn = document.getElementById('resend-submit-btn');
    const successMessage = document.getElementById('resend-success');
    const errorMessage = document.getElementById('resend-error');

    resendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      successMessage.style.display = 'none';
      errorMessage.style.display = 'none';

      const email = document.getElementById('email').value;

      try {
        await resendVerification(email);
        successMessage.style.display = 'block';
        submitBtn.textContent = 'Email sent!';
        // Reset after 3 seconds
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Resend verification email';
        }, 3000);
      } catch (err) {
        errorMessage.textContent = err.message;
        errorMessage.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Resend verification email';
      }
    });
  }

  // Handle resend button on error page
  const resendBtn = document.getElementById('resend-btn');
  if (resendBtn) {
    resendBtn.addEventListener('click', () => {
      // Switch to the no-token view with resend form
      showStatus('verify-no-token');
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initVerifyPage);
