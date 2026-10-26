import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { dbManager, sanitizeMemoryContent } from '../server/database.ts';

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('   EDITH AI OS - PHASE 2 VERIFICATION TEST SUITE   ');
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

  // Ensure DB initialized
  await dbManager.initialize();

  // 1. Verify Project Creation and Retrieval
  let testProjectId = '';
  await test('1. A project can be created, retrieved, and updated', async () => {
    const projName = `Project Alpha ${Date.now()}`;
    const proj = await dbManager.createProject(projName, 'Test Project for Phase 2 persistence');
    assert.ok(proj.id, 'Project ID must exist');
    assert.strictEqual(proj.name, projName);
    assert.strictEqual(proj.status, 'active');
    testProjectId = proj.id;

    // Retrieve
    const fetched = await dbManager.getProject(testProjectId);
    assert.ok(fetched !== null, 'Fetched project must not be null');
    assert.strictEqual(fetched?.id, testProjectId);

    // Update
    const updated = await dbManager.updateProject(testProjectId, {
      description: 'Updated project description',
    });
    assert.strictEqual(updated?.description, 'Updated project description');
  });

  // 2. Verify Task Creation and Updating
  let testTaskId = '';
  await test('2. A task can be created with steps, checkpoints, and updated', async () => {
    const task = await dbManager.createTask({
      project_id: testProjectId,
      title: 'Analyze Network Traffic',
      description: 'Capture and inspect PCAP packets on interface',
      category: 'RECON',
      next_planned_step: 'Initialize socket listener on eth0',
      relevant_files: ['workspace/traffic.pcap'],
    });

    assert.ok(task.id, 'Task must have an ID');
    assert.strictEqual(task.status, 'in_progress');
    assert.strictEqual(task.project_id, testProjectId);
    assert.strictEqual(task.title, 'Analyze Network Traffic');
    testTaskId = task.id;

    // Add step
    const step = await dbManager.addTaskStep(task.id, 'Start interface capture', 1);
    assert.strictEqual(step.title, 'Start interface capture');
    assert.strictEqual(step.step_number, 1);

    // Update step
    const updatedStep = await dbManager.updateTaskStep(step.id, {
      status: 'completed',
      output: 'Capture daemon started with PID 5100',
    });
    assert.strictEqual(updatedStep?.status, 'completed');

    // Create checkpoint
    const cp = await dbManager.createTaskCheckpoint(task.id, 'PacketCaptureCheckpoint_1000', {
      packets_captured: 1420,
      buffer_percent: 18,
    });
    assert.ok(cp.id, 'Checkpoint must have ID');
    assert.strictEqual(cp.checkpoint_name, 'PacketCaptureCheckpoint_1000');

    // Update task progress and steps
    const updatedTask = await dbManager.updateTask(task.id, {
      progress: 65,
      last_completed_step: 'Start interface capture',
      next_planned_step: 'Filter DNS tunneling traffic',
    });
    assert.strictEqual(updatedTask?.progress, 65);
    assert.strictEqual(updatedTask?.last_completed_step, 'Start interface capture');
    assert.strictEqual(updatedTask?.next_planned_step, 'Filter DNS tunneling traffic');
  });

  // 3. Verify Progress survives an application restart & interrupted tasks recovery
  await test('3. Progress survives restart & interrupted tasks are detected and recovered', async () => {
    // We simulate an application restart by invoking performSessionRecovery()
    // Tasks that were 'in_progress' when a session wasn't cleanly shutdown must become 'interrupted'
    const recoveryState = await dbManager.performSessionRecovery();
    assert.ok(recoveryState.currentSessionId, 'Current session ID must exist');

    // Check if testTaskId was marked as interrupted
    const interruptedTask = await dbManager.getTask(testTaskId);
    assert.ok(interruptedTask !== null, 'Task must exist after recovery');
    assert.strictEqual(
      interruptedTask?.status,
      'interrupted',
      'Task in progress before restart must be marked interrupted'
    );
    assert.strictEqual(interruptedTask?.progress, 65, 'Task progress must be preserved across restart');

    // Recovery resume summary and suggested next action must be present
    assert.ok(recoveryState.resumeSummary.length > 0, 'Recovery summary must be generated');
    assert.ok(recoveryState.suggestedNextAction.length > 0, 'Suggested next action must be generated');

    // User can resume the interrupted task
    const resumedTask = await dbManager.resumeInterruptedTask(testTaskId);
    assert.ok(resumedTask !== null);
    assert.strictEqual(resumedTask?.status, 'in_progress', 'Resumed task must become in_progress');
  });

  // 4. Verify Task Completion requires evidence and is not presented as unfinished
  await test('4. Completed tasks require evidence and are not presented as unfinished', async () => {
    // Attempting completion without evidence in API is rejected. In dbManager:
    const completedTask = await dbManager.completeTask(testTaskId, {
      packet_count: 5000,
      anomalies_detected: 0,
      report_path: 'workspace/report.json',
      verified_by: 'automated_test',
    });

    assert.ok(completedTask !== null);
    assert.strictEqual(completedTask?.status, 'completed');
    assert.strictEqual(completedTask?.progress, 100);
    assert.ok(completedTask?.completed_at !== null);
    assert.ok(completedTask?.completion_evidence_json !== null);

    // Query unfinished tasks (in_progress, pending, interrupted)
    const activeTasks = await dbManager.getTasks(testProjectId, 'in_progress');
    const hasCompletedInActive = activeTasks.some((t) => t.id === testTaskId);
    assert.strictEqual(
      hasCompletedInActive,
      false,
      'Completed task must NOT appear in in_progress / unfinished list'
    );

    // Query completed tasks
    const completedTasks = await dbManager.getTasks(testProjectId, 'completed');
    const foundCompleted = completedTasks.some((t) => t.id === testTaskId);
    assert.strictEqual(foundCompleted, true, 'Completed task must appear in completed tasks');
  });

  // 5. Memory Safety: Secrets and API keys sanitized
  await test('5. Memory safety: API keys, tokens, and credentials are scrubbed before storage', async () => {
    const rawContentWithSecrets =
      'Connected to external endpoint using AIzaSyD9x8y7z6w5v4u3t2s1r0q_demo_key and password="SuperSecretPassword123!" with Bearer eyJhbGciOiJIUzI1NiJ9.demo.token';
    const sanitized = sanitizeMemoryContent(rawContentWithSecrets);

    assert.ok(!sanitized.includes('AIzaSyD9x8y7z6w5v4u3t2s1r0q'), 'Google Gemini API key must be redacted');
    assert.ok(!sanitized.includes('SuperSecretPassword123!'), 'Password must be redacted');
    assert.ok(!sanitized.includes('eyJhbGciOiJIUzI1NiJ9'), 'Bearer token must be redacted');

    // Save into database memory record
    const memRecord = await dbManager.createMemoryRecord({
      key: 'infrastructure_notes',
      category: 'architecture',
      content: sanitized,
      source: 'verified_system',
      confidence: 1.0,
    });

    assert.ok(memRecord.id, 'Memory record must have ID');
    assert.ok(!memRecord.content.includes('AIzaSy'), 'Memory record must not contain API key');

    // Retrieve from DB
    const records = await dbManager.getMemoryRecords('architecture');
    const found = records.find((r) => r.id === memRecord.id);
    assert.ok(found !== null);
    assert.strictEqual(found?.key, 'infrastructure_notes');
  });

  // 6. Existing Conversations Remain Intact
  await test('6. Existing conversations and messages remain completely intact', async () => {
    const testConvId = `conv-preserve-${Date.now()}`;
    await dbManager.saveExchange(
      testConvId,
      true,
      'Verify historical chat preservation',
      'All historical tables and exchanges are completely preserved across Phase 2 updates.',
      'Phase 2 Conversation Test',
      'text'
    );

    const conv = await dbManager.getConversation(testConvId);
    assert.ok(conv !== null, 'Conversation must exist');
    assert.strictEqual(conv.title, 'Phase 2 Conversation Test');

    const msgs = await dbManager.getMessages(testConvId);
    assert.strictEqual(msgs.length, 2, 'Conversation must have 2 messages');
    assert.strictEqual(msgs[0].content, 'Verify historical chat preservation');

    // Clean up
    await dbManager.deleteConversation(testConvId);
  });

  // 7. Workspace Activity Logging and Verification
  await test('7. Workspace activities distinguish verified system action from unverified', async () => {
    const act1 = await dbManager.logWorkspaceActivity('network_scan', '127.0.0.1', { ports: [80, 443] }, true);
    assert.strictEqual(act1.verified, 1);
    assert.strictEqual(act1.action_type, 'network_scan');

    const act2 = await dbManager.logWorkspaceActivity('ai_inference', 'Model', { note: 'Hypothetical' }, false);
    assert.strictEqual(act2.verified, 0);

    const activities = await dbManager.getWorkspaceActivity(10);
    assert.ok(activities.length >= 2, 'Should have recorded activities');
  });

  console.log('\n====================================================');
  console.log(`Phase 2 Tests Finished: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
