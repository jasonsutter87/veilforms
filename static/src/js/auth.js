// VeilForms Authentication JavaScript

// Password requirements (must match server)
const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true
};

// Validate password client-side
function validatePassword(password) {
  const errors = [];

  if (!password || password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`At least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('One uppercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('One lowercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('One number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Check if user is already logged in
function checkAuth() {
  const token = localStorage.getItem('veilforms_token');
  if (token) {
    window.location.href = '/dashboard/';
  }
}

// Logout function
async function logout() {
  const token = localStorage.getItem('veilforms_token');

  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  localStorage.removeItem('veilforms_token');
  localStorage.removeItem('veilforms_user');
  window.location.href = '/login/';
}

// Login Form Handler
function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  const errorMessage = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        let message = data.error || 'Login failed';
        if (data.attemptsRemaining) {
          message += ` (${data.attemptsRemaining} attempts remaining)`;
        }
        if (data.lockedMinutes) {
          message = `Account locked. Try again in ${data.lockedMinutes} minutes.`;
        }
        throw new Error(message);
      }

      localStorage.setItem('veilforms_token', data.token);
      localStorage.setItem('veilforms_user', JSON.stringify(data.user));
      window.location.href = '/dashboard/';
    } catch (err) {
      errorMessage.textContent = err.message;
      errorMessage.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
}

// Register Form Handler
function initRegisterForm() {
  const form = document.getElementById('register-form');
  if (!form) return;

  const errorMessage = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');
  const passwordInput = document.getElementById('password');

  // Add password strength indicator
  if (passwordInput) {
    const strengthIndicator = document.createElement('div');
    strengthIndicator.className = 'password-strength';
    strengthIndicator.innerHTML = `
      <small class="text-muted">Password must have:</small>
      <ul class="password-requirements">
        <li data-req="length">12+ characters</li>
        <li data-req="upper">Uppercase letter</li>
        <li data-req="lower">Lowercase letter</li>
        <li data-req="number">Number</li>
      </ul>
    `;
    passwordInput.parentNode.appendChild(strengthIndicator);

    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      document.querySelector('[data-req="length"]').classList.toggle('valid', val.length >= 12);
      document.querySelector('[data-req="upper"]').classList.toggle('valid', /[A-Z]/.test(val));
      document.querySelector('[data-req="lower"]').classList.toggle('valid', /[a-z]/.test(val));
      document.querySelector('[data-req="number"]').classList.toggle('valid', /[0-9]/.test(val));
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      errorMessage.textContent = 'Password requirements: ' + passwordCheck.errors.join(', ');
      errorMessage.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        let message = data.error || 'Registration failed';
        if (data.details && data.details.length) {
          message = data.details.join('. ');
        }
        throw new Error(message);
      }

      localStorage.setItem('veilforms_token', data.token);
      localStorage.setItem('veilforms_user', JSON.stringify(data.user));
      window.location.href = '/dashboard/';
    } catch (err) {
      errorMessage.textContent = err.message;
      errorMessage.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}

// Forgot Password Form Handler
function initForgotForm() {
  const form = document.getElementById('forgot-form');
  if (!form) return;

  const errorMessage = document.getElementById('error-message');
  const successMessage = document.getElementById('success-message');
  const submitBtn = document.getElementById('submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.classList.remove('show');
    successMessage.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const email = document.getElementById('email').value;

    try {
      const response = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed');
      }

      successMessage.textContent = 'If an account with that email exists, we sent a password reset link. Check your inbox.';
      successMessage.classList.add('show');
      form.style.display = 'none';
    } catch (err) {
      errorMessage.textContent = err.message;
      errorMessage.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reset Link';
    }
  });
}

// Reset Password Form Handler
function initResetForm() {
  const form = document.getElementById('reset-form');
  if (!form) return;

  const errorMessage = document.getElementById('error-message');
  const successMessage = document.getElementById('success-message');
  const submitBtn = document.getElementById('submit-btn');
  const passwordInput = document.getElementById('password');

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    errorMessage.textContent = 'Invalid reset link. Please request a new one.';
    errorMessage.classList.add('show');
    form.style.display = 'none';
    return;
  }

  // Add password strength indicator
  if (passwordInput) {
    const strengthIndicator = document.createElement('div');
    strengthIndicator.className = 'password-strength';
    strengthIndicator.innerHTML = `
      <small class="text-muted">Password must have:</small>
      <ul class="password-requirements">
        <li data-req="length">12+ characters</li>
        <li data-req="upper">Uppercase letter</li>
        <li data-req="lower">Lowercase letter</li>
        <li data-req="number">Number</li>
      </ul>
    `;
    passwordInput.parentNode.appendChild(strengthIndicator);

    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      document.querySelector('[data-req="length"]').classList.toggle('valid', val.length >= 12);
      document.querySelector('[data-req="upper"]').classList.toggle('valid', /[A-Z]/.test(val));
      document.querySelector('[data-req="lower"]').classList.toggle('valid', /[a-z]/.test(val));
      document.querySelector('[data-req="number"]').classList.toggle('valid', /[0-9]/.test(val));
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.classList.remove('show');
    successMessage.classList.remove('show');

    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
      errorMessage.textContent = 'Passwords do not match';
      errorMessage.classList.add('show');
      return;
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      errorMessage.textContent = 'Password requirements: ' + passwordCheck.errors.join(', ');
      errorMessage.classList.add('show');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';

    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        let message = data.error || 'Reset failed';
        if (data.details && data.details.length) {
          message = data.details.join('. ');
        }
        throw new Error(message);
      }

      successMessage.textContent = 'Password reset successfully! Redirecting to login...';
      successMessage.classList.add('show');
      form.style.display = 'none';

      setTimeout(() => {
        window.location.href = '/login/';
      }, 2000);
    } catch (err) {
      errorMessage.textContent = err.message;
      errorMessage.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Reset Password';
    }
  });
}

// Initialize auth forms on page load
document.addEventListener('DOMContentLoaded', function() {
  initLoginForm();
  initRegisterForm();
  initForgotForm();
  initResetForm();
});
