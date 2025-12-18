/**
 * VeilForms - Login Page
 */

"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await login(email, password);

      if (result.error) {
        // Handle email not verified
        if (result.emailNotVerified && result.email) {
          localStorage.setItem("veilforms_pending_email", result.email);
          router.push("/verify");
          return;
        }

        let message = result.error;
        if (result.attemptsRemaining) {
          message += ` (${result.attemptsRemaining} attempts remaining)`;
        }
        if (result.lockedMinutes) {
          message = `Account locked. Try again in ${result.lockedMinutes} minutes.`;
        }
        setError(message);
        setIsSubmitting(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError((err as Error).message || "Login failed");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="subtitle">Sign in to your VeilForms account</p>

        {error && <div className="error-message">{error}</div>}

        <OAuthButtons mode="login" disabled={isSubmitting} />

        <div className="auth-divider">
          <span>or sign in with email</span>
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
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-links">
          <p>
            <Link href="/forgot">Forgot your password?</Link>
          </p>
          <p>
            Don&apos;t have an account? <Link href="/register">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
