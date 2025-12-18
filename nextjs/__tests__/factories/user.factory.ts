let userCounter = 0;

export interface TestUser {
  id: string;
  email: string;
  passwordHash: string | null;
  createdAt: string;
  subscription: string;
  forms: string[];
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  oauthProvider?: string;
  oauthProviderId?: string;
  stripeCustomerId?: string;
}

interface CreateUserOptions {
  email?: string;
  subscription?: string;
  emailVerified?: boolean;
  oauthProvider?: string;
}

/**
 * Create a test user object
 */
export function createTestUser(options: CreateUserOptions = {}): TestUser {
  userCounter++;
  const id = `test_user_${Date.now()}_${userCounter}`;

  return {
    id,
    email: options.email || `test${userCounter}_${Date.now()}@example.com`,
    passwordHash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.S2FJ/H3P.3J.1K', // "TestPassword123"
    createdAt: new Date().toISOString(),
    subscription: options.subscription || 'free',
    forms: [],
    emailVerified: options.emailVerified ?? false,
    emailVerifiedAt: options.emailVerified ? new Date().toISOString() : null,
    oauthProvider: options.oauthProvider,
  };
}

/**
 * Create a test OAuth user
 */
export function createOAuthUser(provider: string, options: CreateUserOptions = {}): TestUser {
  const user = createTestUser(options);
  return {
    ...user,
    passwordHash: null,
    oauthProvider: provider,
    oauthProviderId: `${provider}_id_${Date.now()}`,
    emailVerified: true,
    emailVerifiedAt: new Date().toISOString(),
  };
}

/**
 * Reset the counter (useful between test suites)
 */
export function resetUserCounter(): void {
  userCounter = 0;
}
