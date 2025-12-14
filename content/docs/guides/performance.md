---
title: "Performance Benchmarks"
description: "Real-world performance metrics for VeilForms encryption - key generation, encryption, and decryption speeds"
type: "pages"
layout: "docs"
css: ["docs.css"]
priority: 0.5
---

# Performance Benchmarks

VeilForms uses client-side encryption for maximum security. This page documents real-world performance characteristics to help you plan your integration.

<div class="callout info">
<strong>Try it yourself:</strong> Visit our <a href="/demo/">interactive demo</a> to run benchmarks in your own browser.
</div>

## Algorithm Overview

VeilForms uses **hybrid encryption** combining asymmetric and symmetric cryptography:

| Component | Algorithm | Key Size | Purpose |
|-----------|-----------|----------|---------|
| Asymmetric | RSA-OAEP | 2048-bit | Key wrapping |
| Symmetric | AES-GCM | 256-bit | Data encryption |
| Hash | SHA-256 | 256-bit | RSA padding |

This approach provides the security of RSA with the speed of AES.

## Benchmark Results

The following benchmarks were measured using the Web Crypto API on modern hardware. Your results may vary based on device capabilities.

### Key Generation

| Device Type | Median | 95th Percentile |
|-------------|--------|-----------------|
| Desktop (M1/M2 Mac) | 50-80ms | 120ms |
| Desktop (Intel i7) | 80-150ms | 200ms |
| Modern Mobile (iPhone 14) | 100-200ms | 300ms |
| Budget Mobile | 200-500ms | 800ms |

**Note:** Key generation is a one-time operation per form. Keys are stored in browser localStorage and reused.

### Encryption Speed

Encryption time depends on payload size:

| Payload Size | Desktop | Mobile |
|--------------|---------|--------|
| 100 bytes | 1-2ms | 2-5ms |
| 1 KB | 2-4ms | 5-10ms |
| 10 KB | 5-10ms | 10-20ms |
| 100 KB | 15-30ms | 30-60ms |
| 1 MB | 100-200ms | 200-400ms |

**Typical form submission (1-5 KB):** 3-8ms encryption time.

### Decryption Speed

Decryption is slightly faster than encryption:

| Payload Size | Desktop | Mobile |
|--------------|---------|--------|
| 100 bytes | 1-2ms | 2-4ms |
| 1 KB | 1-3ms | 3-8ms |
| 10 KB | 3-8ms | 8-15ms |
| 100 KB | 10-25ms | 25-50ms |
| 1 MB | 80-150ms | 150-300ms |

### Payload Overhead

Encryption adds overhead to the payload size:

| Original Size | Encrypted Size | Overhead |
|---------------|----------------|----------|
| 100 bytes | ~500 bytes | ~400% |
| 1 KB | ~1.7 KB | ~70% |
| 10 KB | ~13.7 KB | ~37% |
| 100 KB | ~134 KB | ~34% |

**Note:** The fixed overhead (~500 bytes) comes from:
- Encrypted AES key (256 bytes base64)
- IV/nonce (16 bytes base64)
- GCM authentication tag (16 bytes)
- JSON structure

For small payloads, this is a larger percentage. For larger payloads, it approaches ~33% (base64 encoding).

## User Experience Impact

### Perceived Performance

| Operation | Time | User Perception |
|-----------|------|-----------------|
| < 100ms | 50-100ms | Instant |
| 100-300ms | 100-300ms | Fast |
| 300-1000ms | 300-1000ms | Noticeable but acceptable |
| > 1000ms | > 1s | Consider loading indicator |

For typical form submissions:
- **Key generation:** Show a brief "Generating secure keys..." message
- **Encryption:** Invisible to users (< 10ms)
- **Decryption:** Invisible to users (< 10ms)

### Optimization Recommendations

#### 1. Pre-generate Keys

Generate keys when the user visits the dashboard, not when they create a form:

```javascript
// Pre-generate on page load
if (!localStorage.getItem('veilforms_temp_keypair')) {
  VeilForms.generateKeyPair().then(keys => {
    localStorage.setItem('veilforms_temp_keypair', JSON.stringify(keys));
  });
}
```

#### 2. Lazy Load the SDK

Don't block page render with the SDK:

```html
<!-- Load after page content -->
<script async src="https://veilforms.com/js/veilforms.min.js"></script>
```

#### 3. Stream Large Files

For file uploads, encrypt in chunks:

```javascript
// VeilForms handles this automatically for files > 1MB
VeilForms.init('form-id', {
  chunkSize: 1024 * 1024,  // 1MB chunks
  streamEncryption: true
});
```

#### 4. Use Web Workers

For bulk operations, offload to a Web Worker:

```javascript
// Enable worker mode for batch decryption
VeilForms.init('form-id', {
  useWorker: true
});
```

## Browser Compatibility

The Web Crypto API is supported in all modern browsers:

| Browser | Minimum Version | Support Level |
|---------|-----------------|---------------|
| Chrome | 37+ | Full |
| Firefox | 34+ | Full |
| Safari | 11+ | Full |
| Edge | 12+ | Full |
| Opera | 24+ | Full |
| iOS Safari | 11+ | Full |
| Android Chrome | 37+ | Full |

**Legacy browsers (IE11):** Not supported. Web Crypto API is required.

## Hardware Considerations

### CPU Impact

RSA key generation is CPU-intensive. On low-power devices:
- Key generation may cause brief UI freezing
- Use a loading indicator during generation
- Consider generating keys in a Web Worker

### Memory Usage

| Operation | Peak Memory |
|-----------|-------------|
| Key generation | ~5MB |
| Encrypt 1MB file | ~10MB |
| Decrypt 1MB file | ~10MB |
| Idle SDK | < 1MB |

Memory is released after operations complete.

### Battery Impact

Client-side encryption uses more CPU than server-side:
- **Key generation:** ~0.1% battery on mobile
- **Per submission:** Negligible (< 0.01%)

The impact is minimal for typical form usage.

## Comparison with Alternatives

### VeilForms vs. Server-Side Encryption

| Metric | VeilForms (Client) | Server-Side |
|--------|-------------------|-------------|
| Key generation | 50-150ms | N/A (server) |
| Encryption | 3-10ms | 0ms (client) |
| Network latency | Same | Same |
| Total user wait | +5-15ms | Baseline |
| Security | Keys never leave client | Server has keys |

**Verdict:** ~10ms added latency for dramatically improved security.

### VeilForms vs. No Encryption

| Metric | VeilForms | No Encryption |
|--------|-----------|---------------|
| Form submission | +5-15ms | Baseline |
| Data at rest | Encrypted | Plaintext |
| Server compromise | Data safe | Data exposed |
| Compliance | GDPR-friendly | Requires controls |

**Verdict:** Minimal performance cost for significant security gain.

## Profiling Your Integration

### Measure in Your Environment

```javascript
// Profile key generation
const start = performance.now();
const keys = await VeilForms.generateKeyPair();
console.log('Key generation:', performance.now() - start, 'ms');

// Profile encryption
const encStart = performance.now();
const encrypted = await VeilForms.encrypt(formData, keys.publicKey);
console.log('Encryption:', performance.now() - encStart, 'ms');

// Profile decryption
const decStart = performance.now();
const decrypted = await VeilForms.decrypt(encrypted, keys.privateKey);
console.log('Decryption:', performance.now() - decStart, 'ms');
```

### Performance Monitoring

```javascript
VeilForms.init('form-id', {
  onMetrics: (metrics) => {
    // Send to your analytics
    analytics.track('veilforms_performance', {
      keygenTime: metrics.keygenTime,
      encryptTime: metrics.encryptTime,
      payloadSize: metrics.payloadSize
    });
  }
});
```

## Frequently Asked Questions

**Q: Will encryption slow down my forms?**
A: For typical forms, encryption adds 5-15ms — imperceptible to users.

**Q: What about slow mobile devices?**
A: Even budget phones complete encryption in under 100ms. Key generation may take 500ms on older devices.

**Q: How does this compare to TLS?**
A: TLS encrypts data in transit. VeilForms encrypts data at rest. They solve different problems and should be used together.

**Q: Can I encrypt large files?**
A: Yes. VeilForms automatically chunks files over 1MB. A 10MB file encrypts in ~1-2 seconds.

**Q: Does encryption affect SEO?**
A: No. Encryption happens on form submission, not page load. Search engines see your pages normally.

## Related Resources

- [Interactive Demo](/demo/) — Run benchmarks in your browser
- [SDK Installation](/docs/sdk/installation/) — Get started with the SDK
- [Key Management](/docs/guides/key-management/) — Secure your encryption keys
