import { dbManager, DbPendingAction } from '../database.ts';

export type RiskLevel =
  | 'READ_ONLY'
  | 'LOW_RISK'
  | 'REQUIRES_CONFIRMATION'
  | 'BLOCKED_BY_DEFAULT';

export interface ToolDefinition {
  name: string;
  description: string;
  risk: RiskLevel;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[]; items?: { type: string } }>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  formatImpact?: (args: Record<string, unknown>) => string;
}

export class PermissionEngine {
  public async evaluateAndExecute(
    toolDef: ToolDefinition,
    args: Record<string, unknown>,
    bypassConfirmation = false
  ): Promise<{
    status: 'EXECUTED' | 'REQUIRES_CONFIRMATION' | 'BLOCKED';
    result?: Record<string, unknown>;
    pendingAction?: DbPendingAction;
    message?: string;
  }> {
    // 1. Blocked by default check
    if (toolDef.risk === 'BLOCKED_BY_DEFAULT') {
      await dbManager.addAuditLog('ai', 'TOOL_BLOCKED', {
        tool: toolDef.name,
        args,
        reason: 'Restricted high-risk capability blocked by security constitution.',
      });
      return {
        status: 'BLOCKED',
        message: `Action '${toolDef.name}' is blocked by default under the EDITH security policy.`,
      };
    }

    // 2. Check if confirmation is required
    if (toolDef.risk === 'REQUIRES_CONFIRMATION' && !bypassConfirmation) {
      const impactText = toolDef.formatImpact
        ? toolDef.formatImpact(args)
        : `Execute ${toolDef.name} with parameters: ${JSON.stringify(args)}`;

      const pendingAction = await dbManager.createPendingAction(
        toolDef.name,
        args,
        impactText,
        60
      );

      return {
        status: 'REQUIRES_CONFIRMATION',
        pendingAction,
        message: `This action requires your confirmation: ${impactText}`,
      };
    }

    // 3. Execution for READ_ONLY or LOW_RISK or approved action
    try {
      const startTime = Date.now();
      const result = await toolDef.execute(args);
      const durationMs = Date.now() - startTime;

      await dbManager.addAuditLog('system', 'TOOL_EXECUTED', {
        tool: toolDef.name,
        args,
        duration_ms: durationMs,
        risk: toolDef.risk,
      });

      return {
        status: 'EXECUTED',
        result,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await dbManager.addAuditLog('system', 'TOOL_ERROR', {
        tool: toolDef.name,
        args,
        error: errorMsg,
      });
      throw err;
    }
  }
}

export const permissionEngine = new PermissionEngine();
