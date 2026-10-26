import net from 'net';
import dns from 'dns/promises';
import os from 'os';

export interface PortScanResult {
  host: string;
  port: number;
  service: string;
  isOpen: boolean;
  latencyMs?: number;
  banner?: string;
}

export interface NetworkReconReport {
  target: string;
  resolvedIp?: string;
  scanDurationMs: number;
  scannedPorts: number;
  openPorts: PortScanResult[];
  closedPortsCount: number;
  summary: string;
}

// Common ports and standard services
export const COMMON_PORTS: Record<number, string> = {
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  443: 'HTTPS',
  445: 'SMB',
  1433: 'MSSQL',
  1521: 'Oracle',
  3000: 'Dev HTTP / Node',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  6379: 'Redis',
  8000: 'HTTP-Alt',
  8080: 'HTTP-Proxy / Alt',
  8443: 'HTTPS-Alt',
  9000: 'SonarQube / PHP-FPM',
  27017: 'MongoDB',
};

/**
 * Perform a real TCP socket probe to verify open port and measure connection latency
 */
export async function probePort(
  host: string,
  port: number,
  timeoutMs = 1500
): Promise<PortScanResult> {
  const service = COMMON_PORTS[port] || 'Unknown Service';
  const start = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isFinished = false;

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      isFinished = true;
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({
        host,
        port,
        service,
        isOpen: true,
        latencyMs,
      });
    });

    socket.once('timeout', () => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        resolve({
          host,
          port,
          service,
          isOpen: false,
        });
      }
    });

    socket.once('error', () => {
      if (!isFinished) {
        isFinished = true;
        socket.destroy();
        resolve({
          host,
          port,
          service,
          isOpen: false,
        });
      }
    });

    try {
      socket.connect(port, host);
    } catch {
      resolve({
        host,
        port,
        service,
        isOpen: false,
      });
    }
  });
}

/**
 * Scan a list of ports or default common ports on target host
 */
export async function runNetworkRecon(
  target = '127.0.0.1',
  portsToScan?: number[]
): Promise<NetworkReconReport> {
  const cleanTarget = target.trim() || '127.0.0.1';
  const startTime = Date.now();

  let resolvedIp: string | undefined;
  try {
    const lookup = await dns.lookup(cleanTarget);
    resolvedIp = lookup.address;
  } catch {
    resolvedIp = cleanTarget;
  }

  const ports = portsToScan && portsToScan.length > 0
    ? portsToScan
    : [21, 22, 53, 80, 443, 3000, 3306, 5432, 6379, 8080, 8443];

  // Run probes concurrently in batches of 5 to avoid socket exhaustion
  const results: PortScanResult[] = [];
  const batchSize = 6;
  for (let i = 0; i < ports.length; i += batchSize) {
    const batch = ports.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((p) => probePort(cleanTarget, p))
    );
    results.push(...batchResults);
  }

  const openPorts = results.filter((r) => r.isOpen);
  const duration = Date.now() - startTime;

  return {
    target: cleanTarget,
    resolvedIp,
    scanDurationMs: duration,
    scannedPorts: ports.length,
    openPorts,
    closedPortsCount: ports.length - openPorts.length,
    summary: `Recon completed on ${cleanTarget} (${resolvedIp}). Found ${openPorts.length} open ports out of ${ports.length} probed in ${duration}ms.`,
  };
}

/**
 * Perform real DNS record inspection for a given domain
 */
export async function performDnsLookup(domain: string) {
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].trim();
  const records: Record<string, unknown> = {};

  try {
    records.A = await dns.resolve4(cleanDomain).catch(() => []);
  } catch {}

  try {
    records.AAAA = await dns.resolve6(cleanDomain).catch(() => []);
  } catch {}

  try {
    records.MX = await dns.resolveMx(cleanDomain).catch(() => []);
  } catch {}

  try {
    records.TXT = await dns.resolveTxt(cleanDomain).catch(() => []);
  } catch {}

  try {
    records.NS = await dns.resolveNs(cleanDomain).catch(() => []);
  } catch {}

  return {
    domain: cleanDomain,
    records,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Enumerate local network interfaces
 */
export function getLocalNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const report: Array<{
    name: string;
    family: string;
    address: string;
    netmask: string;
    mac: string;
    internal: boolean;
  }> = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (addrs) {
      for (const addr of addrs) {
        report.push({
          name,
          family: addr.family,
          address: addr.address,
          netmask: addr.netmask,
          mac: addr.mac,
          internal: addr.internal,
        });
      }
    }
  }

  return {
    total_interfaces: report.length,
    hostname: os.hostname(),
    interfaces: report,
  };
}
