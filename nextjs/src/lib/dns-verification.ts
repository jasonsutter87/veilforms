/**
 * VeilForms - DNS Verification (Node.js only)
 * This module uses Node.js dns module and must only be imported
 * from API routes, NOT from middleware or Edge Runtime code.
 */

import dns from "dns";
import { promisify } from "util";
import { createLogger } from "./logger";

const resolveTxt = promisify(dns.resolveTxt);
const dnsLogger = createLogger("dns");

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
    const recordName = getVerificationRecordName(domain);
    dnsLogger.debug({ domain, recordName }, "Checking DNS TXT record");

    const records = await resolveTxt(recordName);

    // Flatten TXT records (they come as arrays of strings)
    const flatRecords = records.map((r) => r.join(""));

    dnsLogger.debug({ domain, records: flatRecords }, "DNS records found");

    // Check if any record matches the expected token
    const verified = flatRecords.some((record) => record === expectedToken);

    if (verified) {
      dnsLogger.info({ domain }, "Domain verification successful");
      return { verified: true };
    } else {
      dnsLogger.warn({ domain, expected: expectedToken, found: flatRecords }, "Verification token mismatch");
      return { verified: false, error: "Verification token not found in DNS records" };
    }
  } catch (error) {
    // DNS lookup failures are expected when record doesn't exist yet
    const errorCode = (error as NodeJS.ErrnoException).code;
    if (errorCode === "ENOTFOUND" || errorCode === "ENODATA") {
      dnsLogger.debug({ domain, errorCode }, "DNS record not found");
      return { verified: false, error: "DNS record not found" };
    }

    dnsLogger.error({ domain, error }, "DNS verification error");
    return { verified: false, error: "DNS lookup failed" };
  }
}
