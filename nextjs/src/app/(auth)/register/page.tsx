/**
 * VeilForms - Register Page
 */

"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useAuth,
  validatePassword,
  checkPasswordStrength,
} from "@/hooks/useAuth";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  // Update password strength on input
  useEffect(() => {
    setPasswordStrength(checkPasswordStrength(password));
  }, [password]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      setError("Password requirements: " + passwordCheck.errors.join(", "));
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register(email, password);

      if (result.error) {
        let message = result.error;
        if (result.details && result.details.length) {
          message = result.details.join(". ");
        }
        setError(message);
        setIsSubmitting(false);
        return;
      }

      // Redirect to verify page (email not verified yet)
      router.push("/verify");
    } catch (err) {
      setError((err as Error).message || "Registration failed");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="subtitle">Start building privacy-first forms</p>

        <ul className="feature-list">
          <li>Client-side encryption</li>
          <li>Automatic PII detection</li>
          <li>Free tier - no credit card</li>
        </ul>

        {error && <div className="error-message">{error}</div>}

        <OAuthButtons mode="register" disabled={isSubmitting} />

        <div className="auth-divider">
          <span>or sign up with email</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={12}
            />
            <div className="password-strength">
              <small className="text-muted">Password must have:</small>
              <ul className="password-requirements">
                <li className={passwordStrength.length ? "valid" : ""}>
                  12+ characters
                </li>
                <li className={passwordStrength.uppercase ? "valid" : ""}>
                  Uppercase letter
                </li>
                <li className={passwordStrength.lowercase ? "valid" : ""}>
                  Lowercase letter
                </li>
                <li className={passwordStrength.number ? "valid" : ""}>
                  Number
                </li>
              </ul>
            </div>
          </div>

          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-links">
          <p>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
