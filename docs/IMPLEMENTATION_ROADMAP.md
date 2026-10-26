# EDITH AI OS - Implementation Roadmap & Engineering Plan

## Roadmap Overview
- **Phase 1: Stabilization, Truthful Tool Execution, and Host Grounding (COMPLETED)**
- **Phase 2: Persistent Memory, Project Spaces, and Session Recovery (COMPLETED)**
- **Phase 3: Defensive Security Hardening, Loopback Binding, Action Registry & Token Auth (COMPLETED)**
- **Phase 4: Kali Linux XFCE Native Desktop Integration, Voice Pipeline & Kiosk Deployment (In Progress)**
- **Phase 5: Advanced Hardware Instrumentation, Wireless Arsenal & Production Packaging (Future Scope)**

---

## Phase 3: Defensive Security Hardening & Zero-Trust Architecture (COMPLETED)

### Objectives
Harden EDITH's local execution boundary against arbitrary shell injection, unauthenticated bridge interaction, timing attacks, path traversal, and unauthenticated administrative operations before expanding operating system privileges.

### Deliverables & Task Tracker
- [x] **3.1 Loopback Interface Binding (`server/config.ts`, `server.ts`):**
  - Added `config.HOST` configuration parameter anchored to `127.0.0.1` by default.
  - Bound both Express backend server and Vite SPA dev server to `127.0.0.1`.
  - Enforced strict CORS origin validation against allowlisted domains (`config.CORS_ORIGINS`).
- [x] **3.2 Cryptographic Session Token Authentication (`server/kali/bridge.ts`, `server.ts`):**
  - Generated cryptographically secure 32-byte (64-character hex) random tokens upon initialization.
  - Stored token in local `.bridge_token` file with restricted `0600` file permissions. Added `.bridge_token` to `.gitignore`.
  - Implemented timing-safe token verification function `verifyToken` using `crypto.timingSafeEqual`.
  - Protected all `/api/kali/*` endpoints (`/register`, `/heartbeat`, `/poll`, `/result`, `/exec`) behind `requireBridgeAuth` middleware.
  - Added loopback-restricted `/api/kali/token` endpoint for local UI and daemon discovery.
- [x] **3.3 Validated Action Registry & Shell Injection Elimination (`server/kali/bridge.ts`, `public/edith-agent.py`):**
  - Established `ALLOWED_BRIDGE_EXECUTABLES` allowlist: `nmap`, `wireshark`, `tshark`, `gobuster`, `nikto`, `sqlmap`, `hydra`, `arp-scan`, `netdiscover`, `uname`, `whoami`, `hostname`, `ip`, `ps`, `df`, `which`, `ping`, `dig`, `traceroute`.
  - Built `validateBridgeCommand()` to strictly reject dangerous shell metacharacters: `;`, `&`, `|`, `` ` ``, `$`, `>`, `<`, `\n`, `\r`, `(`, `)`.
  - Disallowed access to sensitive system paths (`/etc/shadow`, `/etc/sudoers`, `/root/.ssh`, `id_rsa`) in command arguments.
  - Upgraded Python agent `public/edith-agent.py` to use `shlex.split()` and `subprocess.Popen(..., shell=False)`.
  - Replaced hardcoded default credential `edith-kali-secret` with dynamic session token authorization via `Authorization: Bearer <token>`.
  - Enforced 64KB maximum output truncation limit on command results to protect memory buffers.
- [x] **3.4 Path Traversal Elimination in File Tools (`server/tools/registry.ts`):**
  - Enforced boundary allowlist in `open_folder` restricting access to `workspace/`, `Downloads/`, `Documents/`, and user home directories.
  - Blocked access to system directories (`/etc`, `/root`, `/proc`, `/sys`).
- [x] **3.5 Sandbox Isolation & Code Simulation Safety (`server/tools/registry.ts`):**
  - Replaced unsafe `new Function` with Node.js isolated `vm.createContext` and `vm.Script` with 3000ms execution timeout and zero access to `process` or `require`.
  - Elevated `run_code_simulation` risk classification from `LOW_RISK` to `REQUIRES_CONFIRMATION`.
- [x] **3.6 Truthful Task Engine Spawners (`server/tasks/engine.ts`):**
  - Replaced static mocked open ports `[22, 80, 443, 3000]` in `spawnSecurityAuditTask` with real socket-based network recon (`runNetworkRecon`).
  - Replaced hardcoded `securityScore: '98/100'` in `spawnCodeAnalysisTask` with real static OWASP security analysis (`auditCodeSecurity`).
- [x] **3.7 Automated Security Regression Suite (`tests/security.test.ts`):**
  - 12 automated unit and regression tests verifying loopback binding, token auth, timing-safe checks, action registry allowlisting, metacharacter blocking, argument path filtering, path traversal protection, VM isolation, and output truncation.

---

## Phase 4: Kali Linux XFCE Desktop Integration & Voice Pipeline (CURRENT)

### Objectives
Integrate EDITH with native Kali Linux XFCE desktop controls, provide continuous background operation via systemd user services, and configure hotkey activation.

### Implementation Tasks

#### 4.1 Existing Code to Preserve
- Complete React 19 HUD interface, theme styles (`src/index.css`), and animations.
- Central Permission Engine (`server/permissions/engine.ts`).
- SQLite persistence engine (`server/database.ts`) and existing `edith.db` tables.
- Bounded context and IST temporal awareness (`server/assistant.ts`).
- Cybersecurity Skills Arsenal (`server/tools/`).
- Validated action registry and bridge token authentication.

#### 4.2 XFCE Desktop Launcher (`~/.local/share/applications/edith.desktop`)
- Create XDG compliant launcher entry pointing to local Node.js service.
- Attach official EDITH vector icon (`public/edith_logo.png`).
- Define secondary action for launching bridge daemon in unprivileged background terminal.

#### 4.3 Systemd User Service Configuration
- File: `~/.config/systemd/user/edith.service`
- Starts Node.js backend automatically upon user graphical login.
- Sets `Restart=on-failure`, `Environment=HOST=127.0.0.1`, `PORT=3000`.

#### 4.4 Global Desktop Shortcut
- Configure XFCE application shortcut (`xfce4-keyboard-shortcuts.xml`).
- Bind `Super+E` to focus/launch the EDITH Cockpit in browser app mode (`chromium --app=http://127.0.0.1:3000` or `firefox --new-window http://127.0.0.1:3000`).

#### 4.5 Audio & Speech Pipeline Calibration
- Verify PipeWire / PulseAudio input levels on Kali Linux.
- Support continuous listening with background wake phrase (`"hey edith"`).
- Add audio feedback chime upon command acknowledgment.

---

## Phase 5: Hardware Instrumentation & Packaging (Future Scope)

### Objectives
Direct hardware wireless adapter injection, live packet inspection, and native `.deb` packaging for Kali Linux repositories.

### Scope
- Monitor mode switching (`airmon-ng start wlan0`) with dedicated root approval card.
- Live wireless deauth & beacon frame analysis through authenticated Kali bridge.
- Standalone Debian packaging (`dpkg-buildpackage`) producing `edith-ai-os_amd64.deb`.

---

## Verification & Acceptance Criteria

| Subsystem | Requirement | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Network Security** | Bind strictly to 127.0.0.1 | `netstat -tlpn` / `tests/security.test.ts` (Test 1) | **VERIFIED** |
| **Bridge Authentication** | Cryptographic session tokens | `tests/security.test.ts` (Tests 2, 3) | **VERIFIED** |
| **Command Injection** | Metacharacters `; & \| \` $` blocked | `tests/security.test.ts` (Test 5) | **VERIFIED** |
| **Executable Restriction**| Only allowlisted binaries executed | `tests/security.test.ts` (Tests 4, 6) | **VERIFIED** |
| **Path Traversal** | Block `/etc`, `/root`, `/proc` access | `tests/security.test.ts` (Test 8) | **VERIFIED** |
| **VM Sandboxing** | No `process` or `require` leakage | `tests/security.test.ts` (Test 10) | **VERIFIED** |
| **Truthful Operations** | Real port scans & AST audits | `tests/security.test.ts` (Test 11), `tests/cyber.test.ts` | **VERIFIED** |
| **Memory Persistence** | Projects, tasks & checkpoints survive restart | `tests/phase2.test.ts` (7 tests) | **VERIFIED** |
| **TypeScript Typing** | 0 compilation errors | `npm run lint` (`tsc --noEmit`) | **VERIFIED** |
| **Production Build** | Optimized client bundle | `npm run build` (`vite build`) | **VERIFIED** |

---

## Rollback & Failure Recovery Procedures

1. **Bridge Authentication Rollback:**
   - If bridge daemon cannot reach server, inspect `.bridge_token` in project root.
   - Run `python3 public/edith-agent.py --token $(cat .bridge_token)`.
2. **Database Schema Rollback:**
   - Database backups are preserved automatically in `edith.db`.
   - If table migrations fail, restore from backup: `cp edith.db.bak edith.db`.
3. **Loopback Binding Reconfiguration:**
   - If access from a remote trusted device is needed, set `HOST=0.0.0.0` in `.env` and specify allowed origins in `CORS_ORIGINS`.
