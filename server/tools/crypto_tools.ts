import crypto from 'crypto';

export interface HashIdentity {
  input: string;
  identifiedAlgorithms: Array<{
    name: string;
    bitLength: number;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    standardUsage: string;
    securityStatus: 'SECURE' | 'DEPRECATED' | 'COMPROMISED' | 'PASSWORD_HASH';
    notes: string;
  }>;
  length: number;
  entropyBits: number;
  charset: string;
}

export interface EntropyReport {
  dataLength: number;
  entropyBits: number; // 0.0 to 8.0 bits per byte
  maxPossibleEntropy: number;
  entropyPercentage: number;
  classification:
    | 'LOW_ENTROPY_REPETITIVE'
    | 'NORMAL_PLAINTEXT'
    | 'HIGH_ENTROPY_CODE'
    | 'EXTREME_ENTROPY_COMPRESSED_OR_ENCRYPTED';
  verdict: string;
}

/**
 * Calculate Shannon Entropy (bits per byte, 0 - 8)
 */
export function calculateShannonEntropy(data: string | Buffer): EntropyReport {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
  if (buf.length === 0) {
    return {
      dataLength: 0,
      entropyBits: 0,
      maxPossibleEntropy: 8,
      entropyPercentage: 0,
      classification: 'LOW_ENTROPY_REPETITIVE',
      verdict: 'Empty dataset. No entropy.',
    };
  }

  const frequencies = new Map<number, number>();
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
  }

  let entropy = 0;
  const len = buf.length;
  for (const count of frequencies.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  const entropyBits = Math.round(entropy * 1000) / 1000;
  const entropyPercentage = Math.round((entropy / 8) * 100);

  let classification: EntropyReport['classification'] = 'NORMAL_PLAINTEXT';
  let verdict = 'Standard text or source code.';

  if (entropyBits < 3.0) {
    classification = 'LOW_ENTROPY_REPETITIVE';
    verdict = 'Low entropy. Highly repetitive, padded, or sparse data.';
  } else if (entropyBits >= 3.0 && entropyBits < 4.8) {
    classification = 'NORMAL_PLAINTEXT';
    verdict = 'Normal plaintext language or structured JSON/XML.';
  } else if (entropyBits >= 4.8 && entropyBits < 7.2) {
    classification = 'HIGH_ENTROPY_CODE';
    verdict = 'High density data: compiled bytecode, base64 strings, or obfuscated code.';
  } else {
    classification = 'EXTREME_ENTROPY_COMPRESSED_OR_ENCRYPTED';
    verdict = 'Cryptographically pseudo-random data: AES ciphertext, compressed zip, or cryptographic key.';
  }

  return {
    dataLength: len,
    entropyBits,
    maxPossibleEntropy: 8,
    entropyPercentage,
    classification,
    verdict,
  };
}

/**
 * Identify cryptographic hash algorithm from given digest
 */
export function identifyHash(rawInput: string): HashIdentity {
  const input = rawInput.trim();
  const len = input.length;
  const entropy = calculateShannonEntropy(input).entropyBits;

  // Determine character set
  let charset = 'Unknown';
  if (/^[0-9a-fA-F]+$/.test(input)) {
    charset = 'Hexadecimal (0-9, a-f)';
  } else if (/^[A-Za-z0-9+/=]+$/.test(input)) {
    charset = 'Base64';
  } else if (input.startsWith('$2a$') || input.startsWith('$2b$') || input.startsWith('$2y$')) {
    charset = 'bcrypt modular crypt format';
  } else if (input.startsWith('$argon2')) {
    charset = 'Argon2 modular crypt format';
  }

  const identified: HashIdentity['identifiedAlgorithms'] = [];

  // Bcrypt ($2a$, $2b$, $2y$)
  if (/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(input)) {
    identified.push({
      name: 'bcrypt',
      bitLength: 184,
      confidence: 'HIGH',
      standardUsage: 'Secure salted and stretched password hashing',
      securityStatus: 'PASSWORD_HASH',
      notes: 'Contains cost factor and 128-bit salt. Resistant to GPU/ASIC rainbow table attacks.',
    });
  }

  // Argon2
  if (input.startsWith('$argon2')) {
    identified.push({
      name: 'Argon2 (Argon2id/Argon2i/Argon2d)',
      bitLength: 256,
      confidence: 'HIGH',
      standardUsage: 'Password Hashing Competition (PHC) winning memory-hard algorithm',
      securityStatus: 'PASSWORD_HASH',
      notes: 'State-of-the-art memory-hard key derivation function.',
    });
  }

  // Hexadecimal lengths
  if (/^[0-9a-fA-F]+$/.test(input)) {
    if (len === 32) {
      identified.push(
        {
          name: 'MD5 (Message Digest 5)',
          bitLength: 128,
          confidence: 'HIGH',
          standardUsage: 'Legacy checksums (DO NOT USE FOR PASSWORDS OR SIGNATURES)',
          securityStatus: 'COMPROMISED',
          notes: 'Vulnerable to practical collision attacks and pre-computed rainbow tables.',
        },
        {
          name: 'NTLM (Windows NT LAN Manager)',
          bitLength: 128,
          confidence: 'MEDIUM',
          standardUsage: 'Active Directory and Windows authentication digest (MD4 of UTF-16LE)',
          securityStatus: 'COMPROMISED',
          notes: 'Vulnerable to pass-the-hash attacks and rapid GPU cracking.',
        }
      );
    } else if (len === 40) {
      identified.push({
        name: 'SHA-1 (Secure Hash Algorithm 1)',
        bitLength: 160,
        confidence: 'HIGH',
        standardUsage: 'Git commit digests, legacy TLS/SSH fingerprints',
        securityStatus: 'COMPROMISED',
        notes: 'Shattered & Shambles attacks proved practical collision vulnerabilities.',
      });
    } else if (len === 64) {
      identified.push(
        {
          name: 'SHA-256 (SHA-2 Family)',
          bitLength: 256,
          confidence: 'HIGH',
          standardUsage: 'Industry standard for digital signatures, TLS, Bitcoin PoW, and HMAC',
          securityStatus: 'SECURE',
          notes: 'No practical collision attacks known. NIST approved.',
        },
        {
          name: 'BLAKE2s-256',
          bitLength: 256,
          confidence: 'MEDIUM',
          standardUsage: 'High-speed secure hashing in WireGuard, libsodium',
          securityStatus: 'SECURE',
          notes: 'Faster than SHA-256 with comparable or better cryptographic margins.',
        }
      );
    } else if (len === 96) {
      identified.push({
        name: 'SHA-384 (SHA-2 Family)',
        bitLength: 384,
        confidence: 'HIGH',
        standardUsage: 'High-security TLS cipher suites and US Federal Suite B',
        securityStatus: 'SECURE',
        notes: 'Truncated SHA-512 with resistance to length-extension attacks.',
      });
    } else if (len === 128) {
      identified.push(
        {
          name: 'SHA-512 (SHA-2 Family)',
          bitLength: 512,
          confidence: 'HIGH',
          standardUsage: 'High-margin hashing, HMAC, modern certificate chains',
          securityStatus: 'SECURE',
          notes: 'Optimal performance on 64-bit architectures with 256-bit collision resistance.',
        },
        {
          name: 'Whirlpool',
          bitLength: 512,
          confidence: 'LOW',
          standardUsage: 'NESSIE recommended block-cipher based hash function',
          securityStatus: 'SECURE',
          notes: 'Based on modified AES (W) cipher.',
        }
      );
    } else if (len === 8) {
      identified.push({
        name: 'CRC32 (Cyclic Redundancy Check)',
        bitLength: 32,
        confidence: 'HIGH',
        standardUsage: 'Error detection in network packets and ZIP archives (NOT CRYPTOGRAPHIC)',
        securityStatus: 'COMPROMISED',
        notes: 'Linear function with trivial collision generation.',
      });
    }
  }

  if (identified.length === 0) {
    identified.push({
      name: 'Unrecognized / Custom Digest',
      bitLength: len * 4,
      confidence: 'LOW',
      standardUsage: 'Custom cryptographic hash or encoded token',
      securityStatus: 'DEPRECATED',
      notes: `Length is ${len} characters. Check for base64 encoding or non-standard salt formats.`,
    });
  }

  return {
    input,
    identifiedAlgorithms: identified,
    length: len,
    entropyBits: entropy,
    charset,
  };
}

/**
 * Generate cryptographic digests for a given payload
 */
export function generateDigests(data: string, secretKey?: string) {
  const md5 = crypto.createHash('md5').update(data).digest('hex');
  const sha1 = crypto.createHash('sha1').update(data).digest('hex');
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const sha512 = crypto.createHash('sha512').update(data).digest('hex');

  let hmacSha256: string | undefined;
  if (secretKey && secretKey.length > 0) {
    hmacSha256 = crypto.createHmac('sha256', secretKey).update(data).digest('hex');
  }

  return {
    inputLengthBytes: Buffer.byteLength(data),
    md5,
    sha1,
    sha256,
    sha512,
    hmacSha256: hmacSha256 || null,
  };
}

/**
 * Tactical multi-format encoder and decoder
 */
export function tacticalEncodeDecode(
  input: string,
  mode: 'encode' | 'decode',
  format: 'base64' | 'hex' | 'url' | 'binary'
) {
  try {
    if (mode === 'encode') {
      if (format === 'base64') {
        return { result: Buffer.from(input, 'utf-8').toString('base64'), status: 'SUCCESS' };
      }
      if (format === 'hex') {
        return { result: Buffer.from(input, 'utf-8').toString('hex'), status: 'SUCCESS' };
      }
      if (format === 'url') {
        return { result: encodeURIComponent(input), status: 'SUCCESS' };
      }
      if (format === 'binary') {
        const bin = Array.from(Buffer.from(input, 'utf-8'))
          .map((b) => b.toString(2).padStart(8, '0'))
          .join(' ');
        return { result: bin, status: 'SUCCESS' };
      }
    } else {
      // Decode
      if (format === 'base64') {
        return { result: Buffer.from(input, 'base64').toString('utf-8'), status: 'SUCCESS' };
      }
      if (format === 'hex') {
        const cleanHex = input.replace(/\s+/g, '');
        return { result: Buffer.from(cleanHex, 'hex').toString('utf-8'), status: 'SUCCESS' };
      }
      if (format === 'url') {
        return { result: decodeURIComponent(input), status: 'SUCCESS' };
      }
      if (format === 'binary') {
        const cleanBin = input.replace(/\s+/g, '');
        const bytes: number[] = [];
        for (let i = 0; i < cleanBin.length; i += 8) {
          bytes.push(parseInt(cleanBin.slice(i, i + 8), 2));
        }
        return { result: Buffer.from(bytes).toString('utf-8'), status: 'SUCCESS' };
      }
    }
    return { result: '', status: 'INVALID_FORMAT', error: 'Unsupported format' };
  } catch (err: unknown) {
    return {
      result: '',
      status: 'DECODE_ERROR',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
