# EDITH AI OS - System Architecture

## 1. System Overview
EDITH (Enhanced Digital Intelligence & Tactical Helper) is an autonomous, multi-tasking AI Operating System environment built for security analysis, defensive workflows, system administration, and conversational assistance on Kali Linux.

```
+-------------------------------------------------------------------------+
|                           CLIENT LAYER (React 19)                       |
|  - Command Cockpit (Dashboard)     - Tactical AI Chat (SSE Stream)     |
|  - Kali Linux Bridge Console       - Multi-Task Manager                 |
|  - Cyber Terminal (Bash Emulation) - File Vault Workspace               |
|  - Voice Console (STT/TTS)         - System Parameters & Settings       |
+-------------------------------------------------------------------------+
                                     |
                       REST & SSE HTTP / WebSocket
                                     |
+-------------------------------------------------------------------------+
|                           BACKEND LAYER (Express)                       |
|  - Request Routing & Validation   - Bounded Context Engine              |
|  - Rate Limiter & Security CORS   - Indian Standard Time (IST) Context  |
|  - Server-Sent Events (SSE) Stream - Error Handling & Telemetry         |
+-------------------------------------------------------------------------+
         |                        |                       |
         v                        v                       v
+------------------+    +-------------------+    +--------------------+
| PERSISTENCE      |    | PERMISSION ENGINE |    | AI PROVIDER        |
| - SQLite/sql.js  |    | - Risk Analysis   |    | - Google Gemini    |
| - edith.db       |    | - Confirmation    |    |   Flash Models     |
| - Firebase Cloud |    | - Tool Registry   |    | - Search Grounding |
+------------------+    +-------------------+    +--------------------+
                                  |
                                  v
+-------------------------------------------------------------------------+
|                           KALI LINUX HOST LAYER                         |
|  - Local Process Launchers (which, spawn, xdg-open)                     |
|  - Socket Port Probing & Network Diagnostic Telemetry                   |
|  - edith-agent.py (Bidirectional Host Command Execution Daemon)         |
|  - Real Host Tool Arsenal (nmap, wireshark, gobuster, etc.)             |
+-------------------------------------------------------------------------+
```

## 2. Core Subsystems

### 2.1 Permission & Safety Engine
- **Risk Classifications:**
  - `READ_ONLY`: Autonomous execution without confirmation (`get_system_status`, `web_search`, `list_active_tasks`, `list_workspace_files`, `read_workspace_file`).
  - `LOW_RISK`: Autonomous execution with audit logging (`open_application`, `open_folder`, `create_note`, `spawn_multitask`, `run_code_simulation`).
  - `REQUIRES_CONFIRMATION`: Prompts user with structured impact notice (`delete_files`, `run_security_scan`).
  - `BLOCKED_BY_DEFAULT`: Strictly blocked by design constitution (`raw_terminal_shell`).

### 2.2 Truthful Execution Protocol
Every tool invocation checks environment capabilities:
- Checks binary availability on host using `which` or `fs.existsSync`.
- If GUI is absent (headless server mode), reports lack of `DISPLAY` rather than claiming the window opened.
- Real TCP socket connections for port audits rather than synthetic response arrays.
- Real interpreter execution for code simulations with strict 5-second process limits.

### 2.3 Indian Standard Time (IST) Engine
- Operating system temporal awareness anchored to `Asia/Kolkata` (UTC+05:30).
- Automatic greetings based on exact Indian hours (e.g. 12 AM - 3:59 AM = "Good late night", 4 AM - 5:59 AM = "Good early morning", etc.).
