/**
 * VeilForms - Custom Domains Library
 * Domain validation, DNS verification, SSL tracking, and domain-to-user mapping
 *
 * Note: DNS verification uses Node.js dns module which is only available
 * in API routes, not in Edge Runtime (middleware).
 */

import { getStore } from "@netlify/blobs";
import { createLogger } from "./logger";
import { retryStorage } from "./retry";

const domainsLogger = createLogger("domains");

// DNS module is dynamically imported only when needed (not available in Edge Runtime)
let resolveTxt: ((hostname: string) => Promise<string[][]>) | null = null;

async function getDnsResolver() {
  if (resolveTxt) return resolveTxt;

  // Dynamic import for Node.js environment only
  try {
    const dns = await import("dns");
    const { promisify } = await import("util");
    resolveTxt = promisify(dns.resolveTxt);
    return resolveTxt;
  } catch {
    // DNS not available (Edge Runtime)
    return null;
  }
}

// Store name
const DOMAINS_STORE = "vf-domains";

// Type definitions
export interface CustomDomain {
  domain: string;
  userId: string;
  status: "pending" | "verifying" | "active" | "failed";
  verificationToken: string;
  verifiedAt?: number;
  sslStatus: "pending" | "provisioning" | "active" | "expired";
  sslExpiresAt?: number;
  createdAt: number;
  lastCheckedAt: number;
  failureReason?: string;
}

// Get store instance
function store() {
  return getStore({ name: DOMAINS_STORE, consistency: "strong" });
}

/**
 * Validate and sanitize a domain name
 */
export function validateDomain(domain: string): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  if (!domain || typeof domain !== "string") {
    return { valid: false, error: "Domain is required" };
  }

  // Remove protocol, www, trailing slashes, whitespace
  let sanitized = domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  // Basic domain format validation
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;
  if (!domainRegex.test(sanitized)) {
    return { valid: false, error: "Invalid domain format" };
  }

  // Must have at least one dot (no TLDs only)
  if (!sanitized.includes(".")) {
    return { valid: false, error: "Domain must include a TLD (e.g., .com, .org)" };
  }

  // Check length (max 253 characters per RFC 1035)
  if (sanitized.length > 253) {
    return { valid: false, error: "Domain name too long (max 253 characters)" };
  }

  // Disallow localhost, internal domains, and special TLDs
  const disallowedPatterns = [
    /^localhost$/,
    /\.local$/,
    /\.internal$/,
    /\.test$/,
    /\.example$/,
    /^127\./,
    /^192\.168\./,
    /^10\./,
  ];

  for (const pattern of disallowedPatterns) {
    if (pattern.test(sanitized)) {
      return { valid: false, error: "Domain not allowed" };
    }
  }

  return { valid: true, sanitized };
}

/**
 * Generate a unique verification token
 */
export function generateVerificationToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `vf_verify_${timestamp}_${random}`;
}

/**
 * Get the TXT record name for domain verification
 */
export function getVerificationRecordName(domain: string): string {
  return `_veilforms-verify.${domain}`;
}

/**
 * Verify DNS TXT record for domain
 * Note: This function requires Node.js runtime (not available in Edge)
 */
export async function verifyDnsTxtRecord(
  domain: string,
  expectedToken: string
): Promise<{ verified: boolean; error?: string }> {
  try {
    const resolver = await getDnsResolver();
    if (!resolver) {
      domainsLogger.warn({ domain }, "DNS verification not available in Edge Runtime");
      return { verified: false, error: "DNS verification not available in this environment" };
    }

    const recordName = getVerificationRecordName(domain);
    domainsLogger.debug({ domain, recordName }, "Checking DNS TXT record");

    const records = await resolver(recordName);

    // Flatten TXT records (they come as arrays of strings)
    const flatRecords = records.map((r) => r.join(""));

    domainsLogger.debug({ domain, records: flatRecords }, "DNS records found");

    // Check if any record matches the expected token
    const verified = flatRecords.some((record) => record === expectedToken);

    if (verified) {
      domainsLogger.info({ domain }, "Domain verification successful");
      return { verified: true };
    } else {
      domainsLogger.warn({ domain, expected: expectedToken, found: flatRecords }, "Verification token mismatch");
      return { verified: false, error: "Verification token not found in DNS records" };
    }
  } catch (error) {
    // DNS lookup failures are expected when record doesn't exist yet
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === "ENOTFOUND" || errorCode === "ENODATA") {
      domainsLogger.debug({ domain, errorCode }, "DNS record not found");
      return { verified: false, error: "DNS record not found" };
    }

    domainsLogger.error({ domain, error }, "DNS verification error");
    return { verified: false, error: "DNS lookup failed" };
  }
}

/**
 * Create a new custom domain
 */
export async function createCustomDomain(
  domain: string,
  userId: string
): Promise<CustomDomain> {
  const validation = validateDomain(domain);
  if (!validation.valid || !validation.sanitized) {
    throw new Error(validation.error || "Invalid domain");
  }

  const sanitizedDomain = validation.sanitized;
  const domains = store();

  // Check if domain already exists
  const existing = await getCustomDomain(sanitizedDomain);
  if (existing) {
    throw new Error("Domain already registered");
  }

  const verificationToken = generateVerificationToken();
  const now = Date.now();

  const customDomain: CustomDomain = {
    domain: sanitizedDomain,
    userId,
    status: "pending",
    verificationToken,
    sslStatus: "pending",
    createdAt: now,
    lastCheckedAt: now,
  };

  // Store domain by domain name
  await domains.setJSON(sanitizedDomain, customDomain);

  // Store domain-to-user mapping for quick lookups
  await domains.setJSON(`domain:${sanitizedDomain}`, { userId });

  // Add to user's domain list
  const userDomainsKey = `user_domains_${userId}`;
  let userDomains: string[] = [];
  try {
    userDomains =
      ((await domains.get(userDomainsKey, { type: "json" })) as string[] | null) || [];
  } catch {
    userDomains = [];
  }
  userDomains.push(sanitizedDomain);
  await domains.setJSON(userDomainsKey, userDomains);

  domainsLogger.info({ domain: sanitizedDomain, userId }, "Custom domain created");

  return customDomain;
}

/**
 * Get custom domain by domain name
 */
export async function getCustomDomain(domain: string): Promise<CustomDomain | null> {
  return retryStorage(async () => {
    const domains = store();
    try {
      const domainData = (await domains.get(domain, { type: "json" })) as CustomDomain | null;
      domainsLogger.debug({ domain, found: !!domainData }, "Domain lookup");
      return domainData;
    } catch (error) {
      domainsLogger.warn({ domain, error }, "Domain lookup failed");
      return null;
    }
  }, "getCustomDomain");
}

/**
 * Get user ID by domain name
 */
export async function getUserIdByDomain(domain: string): Promise<string | null> {
  return retryStorage(async () => {
    const domains = store();
    try {
      const mapping = (await domains.get(`domain:${domain}`, { type: "json" })) as {
        userId: string;
      } | null;
      return mapping?.userId || null;
    } catch (error) {
      domainsLogger.warn({ domain, error }, "Domain-to-user lookup failed");
      return null;
    }
  }, "getUserIdByDomain");
}

/**
 * Get all domains for a user
 */
export async function getUserDomains(userId: string): Promise<CustomDomain[]> {
  return retryStorage(async () => {
    const domains = store();
    const userDomainsKey = `user_domains_${userId}`;

    try {
      const domainNames =
        ((await domains.get(userDomainsKey, { type: "json" })) as string[] | null) || [];
      const domainDetails = await Promise.all(
        domainNames.map((domain) => getCustomDomain(domain))
      );
      const validDomains = domainDetails.filter((d): d is CustomDomain => d !== null);
      domainsLogger.debug({ userId, count: validDomains.length }, "User domains lookup");
      return validDomains;
    } catch (error) {
      domainsLogger.warn({ userId, error }, "User domains lookup failed");
      return [];
    }
  }, "getUserDomains");
}

/**
 * Update custom domain
 */
export async function updateCustomDomain(
  domain: string,
  updates: Partial<CustomDomain>
): Promise<CustomDomain | null> {
  const domains = store();
  const domainData = await getCustomDomain(domain);
  if (!domainData) return null;

  const updated: CustomDomain = {
    ...domainData,
    ...updates,
    lastCheckedAt: Date.now(),
  };

  await domains.setJSON(domain, updated);
  domainsLogger.info({ domain, updates }, "Domain updated");

  return updated;
}

/**
 * Trigger DNS verification for a domain
 */
export async function triggerDomainVerification(
  domain: string
): Promise<{ success: boolean; domain?: CustomDomain; error?: string }> {
  const domainData = await getCustomDomain(domain);
  if (!domainData) {
    return { success: false, error: "Domain not found" };
  }

  // Mark as verifying
  await updateCustomDomain(domain, { status: "verifying" });

  // Perform DNS verification
  const verification = await verifyDnsTxtRecord(domain, domainData.verificationToken);

  if (verification.verified) {
    // Mark as active
    const updated = await updateCustomDomain(domain, {
      status: "active",
      verifiedAt: Date.now(),
      sslStatus: "provisioning", // SSL provisioning would be handled by platform
    });

    return { success: true, domain: updated || domainData };
  } else {
    // Mark as failed
    const updated = await updateCustomDomain(domain, {
      status: "failed",
      failureReason: verification.error,
    });

    return { success: false, error: verification.error, domain: updated || domainData };
  }
}

/**
 * Delete a custom domain
 */
export async function deleteCustomDomain(
  domain: string,
  userId: string
): Promise<boolean> {
  const domains = store();
  const domainData = await getCustomDomain(domain);

  if (!domainData) {
    return false;
  }

  // Verify ownership
  if (domainData.userId !== userId) {
    throw new Error("Unauthorized: Domain belongs to different user");
  }

  // Delete domain data
  await domains.delete(domain);
  await domains.delete(`domain:${domain}`);

  // Remove from user's domain list
  const userDomainsKey = `user_domains_${userId}`;
  let userDomains: string[] = [];
  try {
    userDomains =
      ((await domains.get(userDomainsKey, { type: "json" })) as string[] | null) || [];
  } catch {
    userDomains = [];
  }
  userDomains = userDomains.filter((d) => d !== domain);
  await domains.setJSON(userDomainsKey, userDomains);

  domainsLogger.info({ domain, userId }, "Custom domain deleted");

  return true;
}

/**
 * Check if a domain is verified and active
 */
export async function isDomainActive(domain: string): Promise<boolean> {
  const domainData = await getCustomDomain(domain);
  return domainData?.status === "active";
}
