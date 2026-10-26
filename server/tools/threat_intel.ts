import dns from 'dns/promises';

export interface IpThreatReport {
  ip: string;
  classification:
    | 'LOOPBACK'
    | 'RFC1918_PRIVATE'
    | 'CARRIER_GRADE_NAT'
    | 'LINK_LOCAL'
    | 'MULTICAST'
    | 'PUBLIC_INTERNET';
  isPrivate: boolean;
  isBogon: boolean;
  reverseHostname?: string;
  threatLevel: 'CLEAN' | 'SUSPICIOUS' | 'HIGH_RISK';
  riskScore: number; // 0 to 100
  tacticalNotes: string[];
}

/**
 * Classify and inspect IP address for threat intelligence
 */
export async function analyzeIpThreat(ipInput: string): Promise<IpThreatReport> {
  const ip = ipInput.trim();

  // Basic IPv4 / IPv6 validation
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const isIpv4 = ipv4Regex.test(ip);

  let classification: IpThreatReport['classification'] = 'PUBLIC_INTERNET';
  let isPrivate = false;
  let isBogon = false;
  const tacticalNotes: string[] = [];

  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') {
    classification = 'LOOPBACK';
    isPrivate = true;
    tacticalNotes.push('Local loopback interface. Host-contained traffic only.');
  } else if (isIpv4) {
    const parts = ip.split('.').map(Number);
    const [p0, p1] = parts;

    // 10.0.0.0/8
    if (p0 === 10) {
      classification = 'RFC1918_PRIVATE';
      isPrivate = true;
      tacticalNotes.push('RFC1918 Class A Private Subnet (10.0.0.0/8). Non-routable on public internet.');
    }
    // 172.16.0.0/12
    else if (p0 === 172 && p1 >= 16 && p1 <= 31) {
      classification = 'RFC1918_PRIVATE';
      isPrivate = true;
      tacticalNotes.push('RFC1918 Class B Private Subnet (172.16.0.0/12). Non-routable on public internet.');
    }
    // 192.168.0.0/16
    else if (p0 === 192 && p1 === 168) {
      classification = 'RFC1918_PRIVATE';
      isPrivate = true;
      tacticalNotes.push('RFC1918 Class C Home/Enterprise LAN (192.168.0.0/16). Non-routable on public internet.');
    }
    // 100.64.0.0/10 Carrier-grade NAT
    else if (p0 === 100 && p1 >= 64 && p1 <= 127) {
      classification = 'CARRIER_GRADE_NAT';
      isPrivate = true;
      tacticalNotes.push('RFC6598 Shared Carrier-Grade NAT address space.');
    }
    // 169.254.0.0/16 Link-local
    else if (p0 === 169 && p1 === 254) {
      classification = 'LINK_LOCAL';
      isPrivate = true;
      isBogon = true;
      tacticalNotes.push('APIPA / Link-Local Unicast. Indicates DHCP discovery failure.');
    }
    // 224.0.0.0/4 Multicast
    else if (p0 >= 224 && p0 <= 239) {
      classification = 'MULTICAST';
      isBogon = true;
      tacticalNotes.push('Multicast group address block.');
    }
    // 0.0.0.0/8 or 240.0.0.0/4 Reserved
    else if (p0 === 0 || p0 >= 240) {
      classification = 'PUBLIC_INTERNET';
      isBogon = true;
      tacticalNotes.push('Reserved or Bogon IP address.');
    }
  }

  // Reverse DNS lookup (PTR)
  let reverseHostname: string | undefined;
  try {
    const hostnames = await dns.reverse(ip);
    if (hostnames.length > 0) {
      reverseHostname = hostnames[0];
      tacticalNotes.push(`PTR record points to ${reverseHostname}`);
    }
  } catch {
    tacticalNotes.push('No PTR reverse DNS record resolved.');
  }

  // Risk Score calculation
  let riskScore = 0;
  let threatLevel: IpThreatReport['threatLevel'] = 'CLEAN';

  if (isBogon) {
    riskScore = 80;
    threatLevel = 'HIGH_RISK';
    tacticalNotes.push('Bogon IP observed in routing table. High likelihood of spoofing.');
  } else if (!isPrivate) {
    // Public IP
    riskScore = 15;
    threatLevel = 'CLEAN';
    tacticalNotes.push('Routable public IP address. Subject to perimeter firewall and threat monitoring.');
  } else {
    // Clean internal
    riskScore = 5;
    threatLevel = 'CLEAN';
  }

  return {
    ip,
    classification,
    isPrivate,
    isBogon,
    reverseHostname,
    threatLevel,
    riskScore,
    tacticalNotes,
  };
}

/**
 * Return tactical defense advisories and IOC signatures
 */
export function getTacticalThreatAdvisories() {
  return {
    threatLandscape: 'ACTIVE DEFENSE POSTURE',
    timestamp: new Date().toISOString(),
    campaigns: [
      {
        name: 'Critical Infrastructure Perimeter Scanning',
        actorTTP: 'T1046 (Network Service Discovery), T1190 (Exploit Public-Facing Application)',
        defense: 'Ensure all management interfaces (SSH, RDP, Webmin) are shielded behind WireGuard VPN with MFA.',
      },
      {
        name: 'Supply Chain Component Poisoning',
        actorTTP: 'T1195.001 (Compromise Software Dependencies)',
        defense: 'Pin dependency hashes via package-lock.json or poetry.lock. Run regular npm audit & static AST analysis.',
      },
      {
        name: 'Credential Stuffing & Token Replay',
        actorTTP: 'T1110.004 (Credential Stuffing), T1528 (Steal Application Access Token)',
        defense: 'Enforce Argon2id / bcrypt password hashing with rate-limiting, device binding, and token rotation.',
      },
    ],
  };
}
