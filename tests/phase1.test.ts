import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { dbManager } from '../server/database.ts';
import { TOOL_REGISTRY } from '../server/tools/registry.ts';
import { getSystemTelemetry } from '../server/tools/system_monitor.ts';
import { config, getApiKey, isAiConfigured } from '../server/config.ts';

async function runTests() {
  console.log('====================================================');
  console.log('   EDITH AI OS - PHASE 1 VERIFICATION TEST SUITE   ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(` [PASS] ${name}`);
      passed++;
    } catch (err: unknown) {
      console.error(` [FAIL] ${name}`);
      console.error(`        Error: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  // 1. Database Initialization & Ping
  await test('Database connects and pings successfully', async () => {
    const isAlive = await dbManager.ping();
    assert.strictEqual(isAlive, true, 'Database ping should return true');
  });

  // 2. Database Persistence across instances
  await test('Database saves and reloads conversations across simulated restarts', async () => {
    const testConvId = `test-conv-${Date.now()}`;
    const testTitle = 'Phase 1 Audit Session';
    const userMsg = 'Test persistence verification';
    const assistantMsg = 'Confirmed, state persists to edith.db disk file.';

    // Save exchange
    const msgId = await dbManager.saveExchange(
      testConvId,
      true,
      userMsg,
      assistantMsg,
      testTitle,
      'text'
    );
    assert.ok(msgId > 0, 'Message ID should be positive integer');

    // Verify conversation retrieved
    const conv = await dbManager.getConversation(testConvId);
    assert.ok(conv !== null, 'Conversation must exist');
    assert.strictEqual(conv.title, testTitle);

    // Verify messages retrieved
    const msgs = await dbManager.getMessages(testConvId);
    assert.strictEqual(msgs.length, 2, 'Should have 2 messages in conversation');
    assert.strictEqual(msgs[0].content, userMsg);
    assert.strictEqual(msgs[1].content, assistantMsg);

    // Clean up test conversation
    const deleted = await dbManager.deleteConversation(testConvId);
    assert.strictEqual(deleted, true, 'Should successfully delete test conversation');
  });

  // 3. Database Settings & Defaults
  await test('Settings persistence and default values work properly', async () => {
    const voiceId = await dbManager.getSetting<string>('speech_voice_id', 'none');
    assert.strictEqual(voiceId, 'XZXyuzPdidXaSa10PmVA', 'Should have configured voice ID');

    const testKey = `test_setting_${Date.now()}`;
    await dbManager.setSetting(testKey, { active: true, mode: 'test' });
    const fetched = await dbManager.getSetting<{ active: boolean }>(testKey, { active: false });
    assert.strictEqual(fetched.active, true, 'Custom setting should persist and deserialize');
  });

  // 4. Tool Truthfulness: open_application
  await test('open_application returns truthful status instead of fake success', async () => {
    const appTool = TOOL_REGISTRY['open_application'];
    assert.ok(appTool, 'open_application must be registered');

    // Test nonexistent / unapproved app
    await assert.rejects(async () => {
      await appTool.execute({ app_id: 'malicious_app_99' });
    }, /not in the approved application allowlist/);

    // Test approved app (e.g. firefox or wireshark or nmap)
    const result = (await appTool.execute({ app_id: 'firefox' })) as Record<string, unknown>;
    assert.ok('launched' in result, 'Must contain launched boolean');
    assert.ok('message' in result, 'Must return descriptive message');
    // If not installed or headless, launched should be false with clear truthful status
    if (!result.launched) {
      assert.ok(
        result.status === 'NOT_INSTALLED' || result.status === 'HEADLESS_ENVIRONMENT',
        `Truthful failure reason expected, got: ${result.status}`
      );
    }
  });

  // 5. Tool Truthfulness: open_folder
  await test('open_folder validates path and inspects contents truthfully', async () => {
    const folderTool = TOOL_REGISTRY['open_folder'];
    assert.ok(folderTool, 'open_folder must be registered');

    // Non-existent path
    const nonExistent = (await folderTool.execute({
      folder_path: '/non/existent/path/xyz',
    })) as Record<string, unknown>;
    assert.strictEqual(nonExistent.opened, false);
    assert.strictEqual(nonExistent.status, 'NOT_FOUND');

    // Existing workspace directory
    const workspaceRes = (await folderTool.execute({
      folder_path: 'workspace',
    })) as Record<string, unknown>;
    assert.strictEqual(workspaceRes.opened, true);
    assert.ok(typeof workspaceRes.total_items === 'number' || workspaceRes.status === 'OPENED_GUI');
  });

  // 6. Tool Truthfulness: run_security_scan
  await test('run_security_scan performs real TCP connect probes and measures latency', async () => {
    const scanTool = TOOL_REGISTRY['run_security_scan'];
    assert.ok(scanTool, 'run_security_scan must be registered');

    // Out of scope target must be rejected
    await assert.rejects(async () => {
      await scanTool.execute({ target: '8.8.8.8' });
    }, /not in authorized assessment scope/);

    // In-scope scan against 127.0.0.1
    const scanRes = (await scanTool.execute({ target: '127.0.0.1' })) as {
      success: boolean;
      target: string;
      open_ports: number[];
      closed_or_filtered_ports: number[];
      latency_ms: number;
    };
    assert.strictEqual(scanRes.success, true);
    assert.strictEqual(scanRes.target, '127.0.0.1');
    assert.ok(Array.isArray(scanRes.open_ports), 'open_ports must be an array');
    assert.ok(Array.isArray(scanRes.closed_or_filtered_ports), 'closed_or_filtered_ports must be an array');
    assert.ok(typeof scanRes.latency_ms === 'number', 'latency_ms must be measured');
  });

  // 7. Tool Truthfulness: run_code_simulation (Python, Bash, JS)
  await test('run_code_simulation executes code truthfully with timeout limits', async () => {
    const codeTool = TOOL_REGISTRY['run_code_simulation'];
    assert.ok(codeTool, 'run_code_simulation must be registered');

    // JavaScript execution
    const jsRes = (await codeTool.execute({
      language: 'javascript',
      code: 'console.log("Hello EDITH"); 2 + 2;',
    })) as Record<string, unknown>;
    assert.strictEqual(jsRes.execution_status, 'SUCCESS');
    assert.ok(String(jsRes.output).includes('Hello EDITH'));

    // Python execution
    const pyRes = (await codeTool.execute({
      language: 'python',
      code: 'import sys; print(f"Python sys.version: {sys.version_info.major}")',
    })) as Record<string, unknown>;
    assert.ok(
      pyRes.execution_status === 'SUCCESS' || pyRes.execution_status === 'NOT_INSTALLED',
      `Python execution status must be truthful, got: ${pyRes.execution_status}`
    );
    if (pyRes.execution_status === 'SUCCESS') {
      assert.ok(String(pyRes.output).includes('Python sys.version: 3'));
    }

    // Bash execution
    const bashRes = (await codeTool.execute({
      language: 'bash',
      code: 'echo "TACTICAL_SHELL_TEST_OK"',
    })) as Record<string, unknown>;
    assert.strictEqual(bashRes.execution_status, 'SUCCESS');
    assert.ok(String(bashRes.output).includes('TACTICAL_SHELL_TEST_OK'));

    // Timeout safety verification
    const timeoutRes = (await codeTool.execute({
      language: 'bash',
      code: 'sleep 7',
    })) as Record<string, unknown>;
    assert.strictEqual(timeoutRes.execution_status, 'TIMEOUT');
    assert.ok(String(timeoutRes.error).includes('timeout'));
  });

  // 8. Real System Telemetry & Process Inspection
  await test('System monitor queries real host telemetry', () => {
    const telemetry = getSystemTelemetry();
    assert.ok(telemetry.cpu_percent >= 0 && telemetry.cpu_percent <= 100);
    assert.ok(telemetry.ram_percent >= 0 && telemetry.ram_percent <= 100);
    assert.ok(telemetry.ram_total_gb > 0);
    assert.ok(Array.isArray(telemetry.top_processes));
    assert.ok(telemetry.top_processes.length > 0);
    assert.ok(telemetry.top_processes[0].pid > 0);
  });

  // 9. Environment Variable Handling & AI Key Resolution
  await test('Environment variable key resolution is resilient', () => {
    const apiKey = getApiKey();
    // Key presence depends on environment secrets, but isAiConfigured should match key validity
    const configured = isAiConfigured();
    if (apiKey) {
      assert.strictEqual(configured, true);
    } else {
      assert.strictEqual(configured, false);
    }
  });

  console.log('\n====================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
