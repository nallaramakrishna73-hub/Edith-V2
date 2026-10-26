import { runNetworkRecon } from '../server/tools/network_recon.ts';
import { auditSecurityHeaders, queryCveAdvisories } from '../server/tools/vulnerability_analyzer.ts';
import { identifyHash, calculateShannonEntropy, generateDigests, tacticalEncodeDecode } from '../server/tools/crypto_tools.ts';
import { analyzeIpThreat } from '../server/tools/threat_intel.ts';
import { auditCodeSecurity } from '../server/tools/code_security_auditor.ts';
import { assistantService } from '../server/assistant.ts';

async function runCyberTests() {
  console.log('====================================================');
  console.log('   EDITH AI OS - CYBERSECURITY & VOICE VERIFICATION');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
      passed++;
    } else {
      console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
      failed++;
    }
  }

  // 1. Network Recon & Port Scanning
  try {
    const report = await runNetworkRecon('127.0.0.1', [80, 443, 3000, 9999]);
    assert(report.target === '127.0.0.1', 'Network recon resolves target host');
    assert(report.scannedPorts === 4, 'Network recon scans requested ports');
    assert(typeof report.scanDurationMs === 'number', 'Network recon records probe duration');
  } catch (e: any) {
    assert(false, `Network recon threw error: ${e.message}`);
  }

  // 2. Cryptography: Hash Identification
  try {
    const md5Result = identifyHash('5d41402abc4b2a76b9719d911017c592');
    assert(
      md5Result.identifiedAlgorithms.some((a) => a.name.includes('MD5')),
      'Hash analyzer identifies 32-character hexadecimal MD5 hash'
    );

    const sha256Result = identifyHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert(
      sha256Result.identifiedAlgorithms.some((a) => a.name.includes('SHA-256')),
      'Hash analyzer identifies 64-character SHA-256 hash'
    );

    const bcryptResult = identifyHash('$2a$12$e8cr0ym4xN7m8z0F93/yeeUf3484/4.c3a9f0f9b31d3f9b20b22a');
    assert(
      bcryptResult.identifiedAlgorithms.some((a) => a.name.includes('bcrypt')),
      'Hash analyzer identifies bcrypt modular format'
    );
  } catch (e: any) {
    assert(false, `Hash identification threw error: ${e.message}`);
  }

  // 3. Cryptography: Entropy Calculation & Digests
  try {
    const lowEntropy = calculateShannonEntropy('AAAAAAAAAAAAAA');
    assert(lowEntropy.entropyBits < 1.0, 'Calculates low entropy on repetitive text');

    const highEntropy = calculateShannonEntropy('k3$pL9@#vXz81!qWp92$m');
    assert(highEntropy.entropyBits > 3.5, 'Calculates high entropy on random string');

    const digests = generateDigests('test payload', 'secret');
    assert(Boolean(digests.sha256 && digests.md5 && digests.hmacSha256), 'Generates SHA-256, MD5, and HMAC');

    const encoded = tacticalEncodeDecode('EDITH', 'encode', 'base64');
    assert(encoded.result === 'RURJVEg=', 'Encodes to Base64 accurately');

    const decoded = tacticalEncodeDecode('RURJVEg=', 'decode', 'base64');
    assert(decoded.result === 'EDITH', 'Decodes Base64 accurately');
  } catch (e: any) {
    assert(false, `Entropy & digests threw error: ${e.message}`);
  }

  // 4. Code Security Auditor: OWASP Vulnerability Detection
  try {
    const vulnCode = `
      const id = req.query.id;
      const sql = "SELECT * FROM users WHERE id = " + id;
      eval(untrustedInput);
      const secret = "sk-live-1234567890abcdef1234";
    `;
    const audit = auditCodeSecurity(vulnCode, 'test.js');
    assert(audit.totalVulnerabilities >= 3, 'Code auditor detects SQLi, eval, and hardcoded secrets');
    assert(audit.overallRisk === 'CRITICAL', 'Assigns CRITICAL overall risk to high-severity vulnerabilities');
    assert(
      audit.vulnerabilities.some((v) => v.cwe === 'CWE-89'),
      'Identifies CWE-89 SQL Injection tag'
    );
  } catch (e: any) {
    assert(false, `Code security audit threw error: ${e.message}`);
  }

  // 5. Threat Intelligence: IP Classification
  try {
    const loopback = await analyzeIpThreat('127.0.0.1');
    assert(loopback.classification === 'LOOPBACK', 'Classifies 127.0.0.1 as loopback');

    const privateIp = await analyzeIpThreat('192.168.1.100');
    assert(privateIp.isPrivate && privateIp.classification === 'RFC1918_PRIVATE', 'Classifies 192.168.x.x as RFC1918 private');
  } catch (e: any) {
    assert(false, `Threat intel threw error: ${e.message}`);
  }

  // 6. Vulnerability & CVE Knowledge Base
  try {
    const cves = queryCveAdvisories('xz-utils');
    assert(cves.length > 0 && cves[0].cveId === 'CVE-2024-3094', 'Queries CVE knowledge base for XZ Utils backdoor');
  } catch (e: any) {
    assert(false, `CVE lookup threw error: ${e.message}`);
  }

  // 7. Autonomous Tactical Engine: Always responds to messages
  try {
    const reply1 = await assistantService.executeAutonomousTacticalBrain('hi edith');
    assert(reply1.reply.length > 0, 'Autonomous Tactical Engine responds to greeting without failure');

    const reply2 = await assistantService.executeAutonomousTacticalBrain('what is the current time in IST?');
    assert(reply2.reply.includes('Indian Standard Time'), 'Autonomous Tactical Engine answers IST time query');

    const reply3 = await assistantService.executeAutonomousTacticalBrain('scan localhost ports');
    assert(reply3.reply.includes('Network reconnaissance') || reply3.toolCall?.tool === 'network_recon', 'Autonomous Tactical Engine executes network scan command');
  } catch (e: any) {
    assert(false, `Autonomous tactical engine threw error: ${e.message}`);
  }

  console.log('====================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runCyberTests().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
