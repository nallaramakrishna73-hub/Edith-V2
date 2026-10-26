#!/usr/bin/env python3
"""
EDITH Tactical AI OS - Kali Linux Native Bridge Daemon
Allows EDITH to execute validated actions, perform defensive/offensive assessments,
and access local system tools on your Kali Linux machine under least-privilege principles.
"""

import sys
import os
import time
import json
import socket
import platform
import subprocess
import argparse
import shlex
import urllib.request
import urllib.error

VERSION = "2.0.0-kali-hardened"
MAX_OUTPUT_BYTES = 65536  # 64 KB limit

KNOWN_TOOLS = [
    "nmap", "nikto", "sqlmap", "wireshark", "burpsuite",
    "hydra", "john", "hashcat", "aircrack-ng", "msfconsole",
    "gobuster", "dirb", "netdiscover", "arp-scan", "tshark",
    "uname", "whoami", "hostname", "ip", "ps", "df", "which"
]

def detect_tools():
    available = []
    for tool in KNOWN_TOOLS:
        ret = subprocess.call(["which", tool], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if ret == 0:
            available.append(tool)
    return available

def get_system_info():
    hostname = socket.gethostname()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"

    os_release = "Kali Linux"
    if os.path.exists("/etc/os-release"):
        try:
            with open("/etc/os-release") as f:
                for line in f:
                    if line.startswith("PRETTY_NAME="):
                        os_release = line.split("=")[1].strip().strip('"')
                        break
        except Exception:
            pass

    return {
        "hostname": hostname,
        "osRelease": os_release,
        "kernel": platform.release(),
        "ipAddress": ip,
        "installedTools": detect_tools(),
    }

def resolve_token(token_arg, token_file_arg):
    if token_arg and token_arg.strip():
        return token_arg.strip()

    candidate_files = []
    if token_file_arg:
        candidate_files.append(token_file_arg)
    candidate_files.extend([
        ".bridge_token",
        os.path.join(os.path.dirname(__file__), "..", ".bridge_token"),
        os.path.expanduser("~/.edith_bridge_token")
    ])

    for cf in candidate_files:
        if os.path.exists(cf):
            try:
                with open(cf, "r", encoding="utf-8") as f:
                    tok = f.read().strip()
                    if tok:
                        return tok
            except Exception:
                pass
    return None

def main():
    parser = argparse.ArgumentParser(description="EDITH Kali Linux System Bridge Daemon (Hardened)")
    parser.add_argument("--server", default="http://127.0.0.1:3000", help="EDITH AI OS Server URL (default: http://127.0.0.1:3000)")
    parser.add_argument("--token", default="", help="Authorization bearer token (or read from .bridge_token)")
    parser.add_argument("--token-file", default="", help="Path to token file")
    args = parser.parse_args()

    server_url = args.server.rstrip("/")
    token = resolve_token(args.token, args.token_file)

    print("=" * 65)
    print(" [EDITH] Kali Linux Hardened Bridge Daemon Initializing...")
    print(f" Target Server : {server_url}")
    print(f" Agent Version : {VERSION}")
    print(f" Current User  : {os.getenv('USER') or os.getenv('LOGNAME') or 'unknown'}")
    if os.geteuid() == 0:
        print(" [!] CAUTION: Running as root. Principle of least privilege recommends")
        print("     running EDITH bridge daemon as a standard user.")
    if token:
        print(" [✓] Bridge Token : Authenticated (via secure session token)")
    else:
        print(" [!] WARNING: No bridge token provided or found in .bridge_token.")
        print("     Registration and polling may be rejected by the server.")
    print("=" * 65)

    agent_id = f"kali-{socket.gethostname()}-{int(time.time())}"
    sys_info = get_system_info()
    sys_info["agentId"] = agent_id

    auth_headers = {"Content-Type": "application/json"}
    if token:
        auth_headers["Authorization"] = f"Bearer {token}"

    # Register with server
    reg_payload = json.dumps(sys_info).encode("utf-8")
    try:
        req = urllib.request.Request(
            f"{server_url}/api/kali/register",
            data=reg_payload,
            headers=auth_headers
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            print("[+] Successfully registered with EDITH AI OS!")
            print(f"[+] Detected {len(sys_info['installedTools'])} Kali tools: {', '.join(sys_info['installedTools'][:6])}...")
    except urllib.error.HTTPError as e:
        print(f"[-] Registration failed with HTTP {e.code}: {e.reason}")
        if e.code == 401:
            print("[-] Unauthorized. Verify that your --token matches the EDITH server token.")
        sys.exit(1)
    except Exception as e:
        print(f"[-] Registration failed: {e}")
        print("[-] Ensure EDITH server is running and accessible on loopback.")
        sys.exit(1)

    print("[*] Listening for tactical commands from EDITH... Press Ctrl+C to stop.")

    last_heartbeat = 0

    while True:
        try:
            now = time.time()
            if now - last_heartbeat > 10:
                hb_req = urllib.request.Request(
                    f"{server_url}/api/kali/heartbeat",
                    data=json.dumps({"agentId": agent_id}).encode(),
                    headers=auth_headers
                )
                try:
                    urllib.request.urlopen(hb_req, timeout=5)
                except Exception:
                    pass
                last_heartbeat = now

            # Poll for queued command
            poll_req = urllib.request.Request(
                f"{server_url}/api/kali/poll?agentId={agent_id}",
                headers=auth_headers
            )
            with urllib.request.urlopen(poll_req, timeout=10) as resp:
                data = json.loads(resp.read().decode())
                job = data.get("job")
                if job:
                    job_id = job["id"]
                    cmd_str = job["command"]
                    print(f"\n[>] Executing action from EDITH: {cmd_str}")

                    try:
                        # Split safely into arguments - NEVER use shell=True!
                        cmd_tokens = shlex.split(cmd_str)
                        proc = subprocess.Popen(
                            cmd_tokens,
                            shell=False,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT,
                            text=True
                        )
                        output, _ = proc.communicate(timeout=60)
                        exit_code = proc.returncode
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        output = "[ERROR] Action timed out after 60 seconds."
                        exit_code = 124
                    except Exception as err:
                        output = f"[ERROR] Failed to execute action: {err}"
                        exit_code = 1

                    # Truncate output to MAX_OUTPUT_BYTES
                    if len(output.encode("utf-8")) > MAX_OUTPUT_BYTES:
                        output = output[:MAX_OUTPUT_BYTES] + "\n[... truncated by EDITH agent output limit]"

                    print(f"[<] Exit code: {exit_code} (Output length: {len(output)} bytes)")

                    # Report result back
                    res_payload = json.dumps({
                        "jobId": job_id,
                        "output": output,
                        "exitCode": exit_code
                    }).encode("utf-8")

                    res_req = urllib.request.Request(
                        f"{server_url}/api/kali/result",
                        data=res_payload,
                        headers=auth_headers
                    )
                    urllib.request.urlopen(res_req, timeout=10)

            time.sleep(1.5)
        except KeyboardInterrupt:
            print("\n[*] Stopping EDITH Kali Bridge Daemon. Goodbye Commander.")
            break
        except urllib.error.HTTPError as e:
            if e.code == 401:
                print("[-] Received 401 Unauthorized during polling. Token invalid.")
                time.sleep(5)
            else:
                time.sleep(3)
        except Exception:
            time.sleep(3)

if __name__ == "__main__":
    main()
