/**
 * STRANGERS INTO FRIENDS - Authentication Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if session expired query param is present
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('expired')) {
    Utils.showToast('Session Expired', 'Please sign in again to continue.', 'error');
  }

  // If already authenticated and visiting login/signup, redirect to dashboard
  if (API.getToken() && (window.location.pathname.includes('login') || window.location.pathname.includes('signup'))) {
    window.location.href = 'dashboard.html';
    return;
  }

  // --- REGISTRATION FORM ---
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    const avatarInput = document.getElementById('profilePicture');
    const avatarImg = document.getElementById('avatar-preview-img');
    const fullNameInput = document.getElementById('fullName');

    // Live avatar preview when name changes
    if (fullNameInput && avatarImg) {
      fullNameInput.addEventListener('input', () => {
        if (!avatarInput || !avatarInput.value) {
          const name = encodeURIComponent(fullNameInput.value.trim() || 'Stranger');
          avatarImg.src = `https://ui-avatars.com/api/?name=${name}&background=7c3aed&color=fff&bold=true`;
        }
      });
    }

    if (avatarInput && avatarImg) {
      avatarInput.addEventListener('input', () => {
        if (avatarInput.value.trim()) {
          avatarImg.src = avatarInput.value.trim();
        }
      });
    }

    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = signupForm.querySelector('button[type="submit"]');
      const errorBox = document.getElementById('auth-error-box');
      if (errorBox) errorBox.style.display = 'none';

      const formData = {
        fullName: document.getElementById('fullName').value.trim(),
        username: document.getElementById('username').value.trim(),
        mobile: document.getElementById('mobile').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        dateOfBirth: document.getElementById('dateOfBirth').value,
        gender: document.getElementById('gender').value,
        profilePicture: avatarInput ? avatarInput.value.trim() : '',
        bio: document.getElementById('bio') ? document.getElementById('bio').value.trim() : '',
        location: document.getElementById('location') ? document.getElementById('location').value.trim() : ''
      };

      // Client-side validations
      if (formData.password.length < 6) {
        showError('Password must be at least 6 characters.');
        return;
      }

      // Check 18+ birthdate
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

      if (age < 18) {
        showError('You must be at least 18 years old to join Strangers Into Friends.');
        return;
      }

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="status-dot online"></span> Creating Account...';

        const res = await API.auth.register(formData);
        API.setToken(res.token);
        API.setCurrentUser(res.user);

        Utils.showToast('Account Created!', 'Welcome to Strangers Into Friends!', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 800);
      } catch (err) {
        showError(err.message || 'Registration failed. Please verify your details.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Account';
      }
    });
  }

  // --- LOGIN FORM ---
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const errorBox = document.getElementById('auth-error-box');
      if (errorBox) errorBox.style.display = 'none';

      const identifier = document.getElementById('identifier').value.trim();
      const password = document.getElementById('password').value;

      try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="status-dot online"></span> Signing In...';

        const res = await API.auth.login({ identifier, password });
        API.setToken(res.token);
        API.setCurrentUser(res.user);

        Utils.showToast('Welcome back!', 'Signed in successfully.', 'success');

        setTimeout(() => {
          if (res.user.Role === 'admin') {
            window.location.href = 'admin.html';
          } else {
            window.location.href = 'dashboard.html';
          }
        }, 700);
      } catch (err) {
        showError(err.message || 'Invalid username or password.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Sign In';
      }
    });
  }

  // --- FORGOT PASSWORD MODAL FLOW ---
  const forgotModal = document.getElementById('forgot-modal');
  const forgotBtn = document.getElementById('btn-forgot-password');
  const closeForgotBtn = document.getElementById('close-forgot-modal');
  const sendResetCodeBtn = document.getElementById('btn-send-reset-code');
  const resetForm = document.getElementById('reset-password-form');

  if (forgotBtn && forgotModal) {
    forgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      forgotModal.classList.add('open');
    });

    if (closeForgotBtn) {
      closeForgotBtn.addEventListener('click', () => {
        forgotModal.classList.remove('open');
      });
    }

    if (sendResetCodeBtn) {
      sendResetCodeBtn.addEventListener('click', async () => {
        const email = document.getElementById('reset-email').value.trim();
        if (!email) {
          alert('Please enter your email address.');
          return;
        }

        try {
          sendResetCodeBtn.disabled = true;
          sendResetCodeBtn.textContent = 'Generating...';
          const res = await API.auth.forgotPassword(email);
          Utils.showToast('Reset Code', res.message, 'info');

          // If demo token returned, auto-fill it for convenience
          if (res.resetToken) {
            document.getElementById('reset-code').value = res.resetToken;
          }

          document.getElementById('reset-step-1').style.display = 'none';
          document.getElementById('reset-step-2').style.display = 'block';
        } catch (err) {
          alert(err.message || 'Error generating reset code.');
        } finally {
          sendResetCodeBtn.disabled = false;
          sendResetCodeBtn.textContent = 'Get Reset Code';
        }
      });
    }

    if (resetForm) {
      resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value.trim();
        const resetCode = document.getElementById('reset-code').value.trim();
        const newPassword = document.getElementById('new-password').value;

        try {
          const res = await API.auth.resetPassword({ email, resetCode, newPassword });
          Utils.showToast('Success!', res.message, 'success');
          forgotModal.classList.remove('open');
        } catch (err) {
          alert(err.message || 'Failed to reset password.');
        }
      });
    }
  }

  function showError(msg) {
    const errorBox = document.getElementById('auth-error-box');
    if (errorBox) {
      errorBox.textContent = msg;
      errorBox.style.display = 'block';
    } else {
      Utils.showToast('Error', msg, 'error');
    }
  }
});
