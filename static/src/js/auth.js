// VeilForms Authentication JavaScript

// Check if user is already logged in
function checkAuth() {
  const token = localStorage.getItem('veilforms_token');
  if (token) {
    window.location.href = '/dashboard/';
  }
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
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
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

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.classList.remove('show');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (password.length < 8) {
      errorMessage.textContent = 'Password must be at least 8 characters';
      errorMessage.classList.add('show');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
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

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  if (!token) {
    errorMessage.textContent = 'Invalid reset link. Please request a new one.';
    errorMessage.classList.add('show');
    form.style.display = 'none';
    return;
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

    if (password.length < 8) {
      errorMessage.textContent = 'Password must be at least 8 characters';
      errorMessage.classList.add('show');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Resetting...';

    try {
      const response = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Reset failed');
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
