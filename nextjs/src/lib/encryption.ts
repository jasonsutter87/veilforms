/**
 * VeilForms - Encryption Utilities
 * RSA key pair generation for form encryption
 */

/**
 * Generate RSA key pair for form encryption
 */
export async function generateKeyPair(): Promise<{
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  return { publicKey, privateKey };
}
