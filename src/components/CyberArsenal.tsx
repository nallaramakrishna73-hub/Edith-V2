import React, { useState } from 'react';
import {
  Shield,
  Radio,
  Search,
  Key,
  Code2,
  Globe,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Cpu,
  Lock,
  RefreshCw,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { api } from '../services/api.ts';

type CyberTab = 'recon' | 'vuln' | 'crypto' | 'code' | 'threat';

export const CyberArsenal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CyberTab>('recon');
  const [loading, setLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Tab 1: Recon State
  const [reconTarget, setReconTarget] = useState('127.0.0.1');
  const [reconReport, setReconReport] = useState<any>(null);
  const [dnsDomain, setDnsDomain] = useState('google.com');
  const [dnsReport, setDnsReport] = useState<any>(null);
  const [interfacesReport, setInterfacesReport] = useState<any>(null);

  // Tab 2: Vuln & Headers State
  const [auditUrl, setAuditUrl] = useState('http://localhost:3000');
  const [headersReport, setHeadersReport] = useState<any>(null);
  const [cveQuery, setCveQuery] = useState('all');
  const [cveResults, setCveResults] = useState<any[]>([]);

  // Tab 3: Crypto State
  const [hashInput, setHashInput] = useState('5d41402abc4b2a76b9719d911017c592'); // "hello" MD5
  const [hashReport, setHashReport] = useState<any>(null);
  const [cryptoPayload, setCryptoPayload] = useState('EDITH_TACTICAL_AUTH_2026');
  const [secretKey, setSecretKey] = useState('edith-secure-key');
  const [digestsReport, setDigestsReport] = useState<any>(null);
  const [entropyInput, setEntropyInput] = useState('Hello world! Secure password test: @#$98741');
  const [entropyReport, setEntropyReport] = useState<any>(null);
  const [codecInput, setCodecInput] = useState('TACTICAL_MISSION_OBJECTIVE');
  const [codecMode, setCodecMode] = useState<'encode' | 'decode'>('encode');
  const [codecFormat, setCodecFormat] = useState<'base64' | 'hex' | 'url' | 'binary'>('base64');
  const [codecResult, setCodecResult] = useState<string>('');

  // Tab 4: Code Security State
  const [codeSnippet, setCodeSnippet] = useState(
    `// Sample Vulnerable Code
const userId = req.query.id;
const query = "SELECT * FROM users WHERE id = " + userId;
db.execute(query);

const userPayload = req.body.data;
eval(userPayload);

const apiKey = "sk-live-9948271038592019482";
`
  );
  const [codeAuditReport, setCodeAuditReport] = useState<any>(null);

  // Tab 5: Threat Intel State
  const [threatIp, setThreatIp] = useState('8.8.8.8');
  const [threatReport, setThreatReport] = useState<any>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Actions
  const handleRunRecon = async () => {
    setLoading(true);
    try {
      const res = await api.runCyberPortScan(reconTarget);
      setReconReport(res);
    } catch (e: any) {
      alert(`Recon failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDnsLookup = async () => {
    setLoading(true);
    try {
      const res = await api.runCyberDnsLookup(dnsDomain);
      setDnsReport(res);
    } catch (e: any) {
      alert(`DNS lookup failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchInterfaces = async () => {
    setLoading(true);
    try {
      const res = await api.getCyberInterfaces();
      setInterfacesReport(res);
    } catch (e: any) {
      alert(`Interfaces fetch failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAuditHeaders = async () => {
    setLoading(true);
    try {
      const res = await api.runCyberHeadersAudit(auditUrl);
      setHeadersReport(res);
    } catch (e: any) {
      alert(`Headers audit failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCve = async () => {
    setLoading(true);
    try {
      const res = await api.searchCyberCve(cveQuery);
      setCveResults(res.advisories || []);
    } catch (e: any) {
      alert(`CVE search failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeHash = async () => {
    setLoading(true);
    try {
      const res = await api.analyzeCyberHash(hashInput);
      setHashReport(res);
    } catch (e: any) {
      alert(`Hash analysis failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDigests = async () => {
    setLoading(true);
    try {
      const res = await api.generateCyberDigests(cryptoPayload, secretKey);
      setDigestsReport(res);
    } catch (e: any) {
      alert(`Digests generation failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateEntropy = async () => {
    setLoading(true);
    try {
      const res = await api.calculateCyberEntropy(entropyInput);
      setEntropyReport(res);
    } catch (e: any) {
      alert(`Entropy calculation failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCodecTransform = async () => {
    try {
      const res = await api.tacticalCodec(codecInput, codecMode, codecFormat);
      setCodecResult(res.result || res.error || '');
    } catch (e: any) {
      setCodecResult(`Error: ${e.message}`);
    }
  };

  const handleAuditCode = async () => {
    setLoading(true);
    try {
      const res = await api.auditCodeSecurity(codeSnippet, 'audit_target.js');
      setCodeAuditReport(res);
    } catch (e: any) {
      alert(`Code audit failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleThreatIntel = async () => {
    setLoading(true);
    try {
      const res = await api.getCyberThreatIntel(threatIp);
      setThreatReport(res);
    } catch (e: any) {
      alert(`Threat intel failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080d16] text-gray-200 overflow-hidden">
      {/* Tactical Cyber Header */}
      <div className="px-6 py-4 bg-[#0c1424] border-b border-cyan-500/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-950/80 border border-cyan-500/40 rounded-lg text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-wider text-cyan-300 uppercase font-mono">
                EDITH Cyber Arsenal
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono tracking-wider uppercase bg-cyan-900/40 text-cyan-400 border border-cyan-500/30 rounded">
                v2.5 Tactical
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono">
              Defensive Reconnaissance, Cryptography & Static Security Operations
            </p>
          </div>
        </div>

        {/* Defense Posture Indicator */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/30 rounded text-xs font-mono text-emerald-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>POSTURE: ACTIVE MONITORING</span>
          </div>
          <div className="px-3 py-1.5 bg-gray-900 border border-gray-700/60 rounded text-xs font-mono text-gray-300">
            HOST: KALI-AMD64
          </div>
        </div>
      </div>

      {/* Arsenal Tabs Navigation */}
      <div className="flex items-center px-6 bg-[#0a101d] border-b border-gray-800 gap-1 overflow-x-auto text-xs font-mono">
        <button
          onClick={() => setActiveTab('recon')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'recon'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          Network Recon & Ports
        </button>

        <button
          onClick={() => setActiveTab('vuln')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'vuln'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Vulnerability & Headers
        </button>

        <button
          onClick={() => setActiveTab('crypto')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'crypto'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          Cryptography & Hashes
        </button>

        <button
          onClick={() => setActiveTab('code')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'code'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          Code Security Auditor
        </button>

        <button
          onClick={() => setActiveTab('threat')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'threat'
              ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-semibold'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Threat Intelligence
        </button>
      </div>

      {/* Main Tab Panels */}
      <div className="flex-1 p-6 overflow-y-auto">
        {/* ============================================================== */}
        {/* TAB 1: NETWORK RECON & PORTS                                   */}
        {/* ============================================================== */}
        {activeTab === 'recon' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div className="p-5 bg-[#0e1728] border border-cyan-500/20 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-cyan-200 font-mono uppercase">
                    TCP Port Reconnaissance & Latency Probe
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setReconTarget('127.0.0.1')}
                    className="px-2 py-1 text-[11px] font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700"
                  >
                    Localhost
                  </button>
                  <button
                    onClick={() => setReconTarget('localhost')}
                    className="px-2 py-1 text-[11px] font-mono bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700"
                  >
                    Loopback Host
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={reconTarget}
                  onChange={(e) => setReconTarget(e.target.value)}
                  placeholder="Target host or IP (e.g., 127.0.0.1, localhost)"
                  className="flex-1 bg-black/60 border border-gray-700 focus:border-cyan-400 rounded-lg px-4 py-2 text-sm text-gray-200 font-mono outline-none"
                />
                <button
                  onClick={handleRunRecon}
                  disabled={loading}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono text-xs font-semibold rounded-lg transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                  Execute Recon Probe
                </button>
              </div>

              {reconReport && (
                <div className="mt-4 p-4 bg-black/50 border border-cyan-500/30 rounded-lg space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="text-cyan-400 font-bold">RECON REPORT: {reconReport.target}</span>
                    <span className="text-gray-400">Duration: {reconReport.scanDurationMs}ms</span>
                  </div>
                  <p className="text-gray-300">{reconReport.summary}</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-400 text-[11px]">
                          <th className="py-2">PORT</th>
                          <th className="py-2">SERVICE</th>
                          <th className="py-2">STATE</th>
                          <th className="py-2">LATENCY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconReport.openPorts.map((p: any) => (
                          <tr key={p.port} className="border-b border-gray-900 text-gray-300">
                            <td className="py-2 text-cyan-300 font-bold">{p.port}</td>
                            <td className="py-2 text-gray-300">{p.service}</td>
                            <td className="py-2">
                              <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-500/30 rounded text-[10px]">
                                OPEN
                              </span>
                            </td>
                            <td className="py-2 text-emerald-400 font-mono">{p.latencyMs}ms</td>
                          </tr>
                        ))}
                        {reconReport.openPorts.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-3 text-center text-gray-500 italic">
                              No common open ports detected on target host.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Sub-panels: DNS & Interfaces */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* DNS Resolver */}
              <div className="p-5 bg-[#0e1728] border border-gray-800 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-300 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    DNS Record Inspection
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dnsDomain}
                    onChange={(e) => setDnsDomain(e.target.value)}
                    placeholder="Domain (e.g. google.com)"
                    className="flex-1 bg-black/60 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none"
                  />
                  <button
                    onClick={handleDnsLookup}
                    className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-300 rounded border border-gray-700"
                  >
                    Resolve
                  </button>
                </div>
                {dnsReport && (
                  <pre className="p-3 bg-black/70 border border-gray-800 rounded text-[11px] text-gray-300 overflow-x-auto max-h-48">
                    {JSON.stringify(dnsReport.records, null, 2)}
                  </pre>
                )}
              </div>

              {/* Local Network Interfaces */}
              <div className="p-5 bg-[#0e1728] border border-gray-800 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-300 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    Host Network Interfaces
                  </span>
                  <button
                    onClick={handleFetchInterfaces}
                    className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-cyan-300 rounded border border-gray-700 text-[11px]"
                  >
                    Inspect
                  </button>
                </div>
                {interfacesReport ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {interfacesReport.interfaces?.map((itf: any, idx: number) => (
                      <div key={idx} className="p-2 bg-black/60 border border-gray-800 rounded text-[11px]">
                        <div className="flex justify-between font-bold text-cyan-300">
                          <span>{itf.name} ({itf.family})</span>
                          <span className="text-gray-400">{itf.mac}</span>
                        </div>
                        <div className="text-gray-300 mt-1">IP: {itf.address} / {itf.netmask}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">Click inspect to enumerate host adapters.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: VULNERABILITY & HEADERS                                 */}
        {/* ============================================================== */}
        {activeTab === 'vuln' && (
          <div className="space-y-6 max-w-5xl mx-auto font-mono text-xs">
            {/* Header Audit Card */}
            <div className="p-5 bg-[#0e1728] border border-cyan-500/20 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-cyan-200 uppercase">
                    HTTP Security Headers & Posture Audit
                  </h2>
                </div>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={auditUrl}
                  onChange={(e) => setAuditUrl(e.target.value)}
                  placeholder="URL to audit (e.g. http://localhost:3000)"
                  className="flex-1 bg-black/60 border border-gray-700 focus:border-cyan-400 rounded-lg px-4 py-2 text-sm text-gray-200 outline-none"
                />
                <button
                  onClick={handleAuditHeaders}
                  disabled={loading}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Audit URL
                </button>
              </div>

              {headersReport && (
                <div className="p-4 bg-black/60 border border-cyan-500/30 rounded-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                    <div>
                      <span className="text-sm font-bold text-gray-200">{headersReport.targetUrl}</span>
                      <div className="text-[11px] text-gray-400 mt-0.5">Server: {headersReport.serverBanner}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-400 uppercase">Security Score</div>
                        <div className="text-lg font-bold text-cyan-400">{headersReport.securityScore}/100</div>
                      </div>
                      <div className="px-3 py-1 bg-cyan-950 border border-cyan-500 text-cyan-300 font-bold text-sm rounded">
                        GRADE {headersReport.grade}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {headersReport.checks.map((c: any) => (
                      <div
                        key={c.header}
                        className="p-3 bg-gray-900/80 border border-gray-800 rounded flex flex-col md:flex-row md:items-center justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {c.status === 'PASS' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span className="font-bold text-gray-200">{c.header}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                c.status === 'PASS'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {c.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400">{c.impact}</p>
                          {c.status !== 'PASS' && (
                            <p className="text-[11px] text-amber-300/90 font-mono">
                              Fix: {c.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CVE Advisory Lookup */}
            <div className="p-5 bg-[#0e1728] border border-gray-800 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-semibold text-gray-200 uppercase">
                    CVE Threat Knowledge Base
                  </h2>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={cveQuery}
                  onChange={(e) => setCveQuery(e.target.value)}
                  placeholder="Search CVE ID or software (e.g. xz-utils, log4j, libwebp)"
                  className="flex-1 bg-black/60 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none"
                />
                <button
                  onClick={handleSearchCve}
                  className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-300 rounded border border-gray-700"
                >
                  Search Advisories
                </button>
              </div>

              {cveResults.length > 0 && (
                <div className="space-y-3">
                  {cveResults.map((cve) => (
                    <div key={cve.cveId} className="p-4 bg-black/60 border border-gray-800 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-300 text-sm">{cve.cveId} - {cve.title}</span>
                        <span className="px-2 py-0.5 bg-rose-950 border border-rose-500/40 text-rose-400 rounded text-[10px] font-bold">
                          CVSS {cve.cvssScore} ({cve.severity})
                        </span>
                      </div>
                      <p className="text-gray-300 text-[11px]">{cve.description}</p>
                      <div className="pt-2 border-t border-gray-800/80 text-[11px] text-emerald-400 font-mono">
                        Remediation: {cve.remediation}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: CRYPTOGRAPHY & HASHES                                   */}
        {/* ============================================================== */}
        {activeTab === 'crypto' && (
          <div className="space-y-6 max-w-5xl mx-auto font-mono text-xs">
            {/* Hash Identifier */}
            <div className="p-5 bg-[#0e1728] border border-cyan-500/20 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-cyan-200 uppercase">
                  Cryptographic Hash Identifier & Audit
                </h2>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  placeholder="Paste hash (MD5, SHA256, bcrypt, etc.)"
                  className="flex-1 bg-black/60 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none"
                />
                <button
                  onClick={handleAnalyzeHash}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold"
                >
                  Analyze Hash
                </button>
              </div>

              {hashReport && (
                <div className="p-4 bg-black/60 border border-gray-800 rounded-lg space-y-3">
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Length: {hashReport.length} chars</span>
                    <span>Entropy: {hashReport.entropyBits} bits/byte</span>
                    <span>Charset: {hashReport.charset}</span>
                  </div>
                  <div className="space-y-2">
                    {hashReport.identifiedAlgorithms?.map((alg: any, idx: number) => (
                      <div key={idx} className="p-3 bg-gray-900 border border-gray-800 rounded space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-cyan-300 text-sm">{alg.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              alg.securityStatus === 'SECURE' || alg.securityStatus === 'PASSWORD_HASH'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {alg.securityStatus}
                          </span>
                        </div>
                        <p className="text-gray-300 text-[11px]">{alg.standardUsage}</p>
                        <p className="text-gray-400 text-[10px] italic">{alg.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Hash Generator & HMAC */}
            <div className="p-5 bg-[#0e1728] border border-gray-800 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-gray-200 uppercase">
                  Multi-Digest Hash & HMAC Generator
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={cryptoPayload}
                  onChange={(e) => setCryptoPayload(e.target.value)}
                  placeholder="Input payload string to hash"
                  className="bg-black/60 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none"
                />
                <input
                  type="text"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="HMAC secret key (optional)"
                  className="bg-black/60 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none"
                />
              </div>
              <button
                onClick={handleGenerateDigests}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-cyan-300 rounded border border-gray-700"
              >
                Compute Digests
              </button>

              {digestsReport && (
                <div className="space-y-2 p-3 bg-black/60 border border-gray-800 rounded-lg">
                  {['sha256', 'md5', 'sha1', 'sha512', 'hmacSha256'].map((algo) => (
                    <div key={algo} className="flex items-center justify-between p-2 bg-gray-900 rounded">
                      <div className="truncate pr-2">
                        <span className="text-[10px] text-cyan-400 font-bold uppercase">{algo}: </span>
                        <span className="text-gray-300 text-[11px]">{digestsReport[algo] || 'N/A'}</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(digestsReport[algo], algo)}
                        className="p-1 hover:text-cyan-300 text-gray-400 shrink-0"
                      >
                        {copiedKey === algo ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Shannon Entropy & Codec */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Shannon Entropy */}
              <div className="p-5 bg-[#0e1728] border border-gray-800 rounded-xl space-y-3">
                <h3 className="font-semibold text-gray-200">Shannon Entropy Calculator</h3>
                <textarea
                  value={entropyInput}
                  onChange={(e) => setEntropyInput(e.target.value)}
                  rows={3}
                  className="w-full bg-black/60 border border-gray-700 rounded p-2 text-xs text-gray-200 outline-none"
                />
                <button
                  onClick={handleCalculateEntropy}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-cyan-300 rounded border border-gray-700 text-[11px]"
                >
                  Analyze Entropy
                </button>
                {entropyReport && (
                  <div className="p-3 bg-black/60 border border-gray-800 rounded space-y-1">
                    <div className="flex justify-between">
                      <span>Entropy Score:</span>
                      <span className="font-bold text-cyan-300">{entropyReport.entropyBits} / 8.0 bits</span>
                    </div>
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-cyan-500 h-full transition-all"
                        style={{ width: `${entropyReport.entropyPercentage}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{entropyReport.verdict}</p>
                  </div>
                )}
              </div>

              {/* Tactical Codec */}
              <div className="p-5 bg-[#0e1728] border border-gray-800 rounded-xl space-y-3">
                <h3 className="font-semibold text-gray-200">Tactical Multi-Codec</h3>
                <input
                  type="text"
                  value={codecInput}
                  onChange={(e) => setCodecInput(e.target.value)}
                  className="w-full bg-black/60 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none"
                />
                <div className="flex gap-2">
                  <select
                    value={codecFormat}
                    onChange={(e: any) => setCodecFormat(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                  >
                    <option value="base64">Base64</option>
                    <option value="hex">Hexadecimal</option>
                    <option value="url">URL Encoding</option>
                    <option value="binary">Binary Bits</option>
                  </select>
                  <select
                    value={codecMode}
                    onChange={(e: any) => setCodecMode(e.target.value)}
                    className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200"
                  >
                    <option value="encode">Encode</option>
                    <option value="decode">Decode</option>
                  </select>
                  <button
                    onClick={handleCodecTransform}
                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold text-[11px]"
                  >
                    Run
                  </button>
                </div>
                {codecResult && (
                  <div className="p-2 bg-black/60 border border-gray-800 rounded font-mono text-[11px] break-all text-cyan-300">
                    {codecResult}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: CODE SECURITY AUDITOR                                   */}
        {/* ============================================================== */}
        {activeTab === 'code' && (
          <div className="space-y-6 max-w-5xl mx-auto font-mono text-xs">
            <div className="p-5 bg-[#0e1728] border border-cyan-500/20 rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-semibold text-cyan-200 uppercase">
                    Static AST Security Auditor (OWASP Top 10)
                  </h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setCodeSnippet(`const query = "SELECT * FROM accounts WHERE user = '" + req.query.name + "'";\ndb.raw(query);`)
                    }
                    className="px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700 text-[10px]"
                  >
                    Sample SQLi
                  </button>
                  <button
                    onClick={() =>
                      setCodeSnippet(`const cmd = req.query.cmd;\nchild_process.exec("ping -c 4 " + cmd);`)
                    }
                    className="px-2 py-1 bg-gray-800 text-gray-300 rounded border border-gray-700 text-[10px]"
                  >
                    Sample Command Injection
                  </button>
                </div>
              </div>

              <textarea
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
                rows={8}
                className="w-full bg-black/70 border border-gray-700 focus:border-cyan-400 rounded-lg p-3 text-xs text-gray-200 outline-none font-mono"
              />

              <button
                onClick={handleAuditCode}
                disabled={loading}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Audit Source Code
              </button>

              {codeAuditReport && (
                <div className="p-4 bg-black/60 border border-cyan-500/30 rounded-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="font-bold text-gray-200">
                      Overall Risk: {codeAuditReport.overallRisk}
                    </span>
                    <span className="text-gray-400">
                      {codeAuditReport.totalVulnerabilities} Findings across {codeAuditReport.scannedLines} Lines
                    </span>
                  </div>

                  <div className="space-y-3">
                    {codeAuditReport.vulnerabilities?.map((vuln: any) => (
                      <div
                        key={vuln.id}
                        className="p-3 bg-gray-900 border border-gray-800 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-rose-950 border border-rose-500/40 text-rose-400 rounded text-[10px] font-bold">
                              {vuln.severity}
                            </span>
                            <span className="font-bold text-gray-200">{vuln.title}</span>
                          </div>
                          <span className="text-gray-400 text-[11px]">Line {vuln.lineNumber}</span>
                        </div>
                        <div className="p-2 bg-black/80 rounded text-rose-300 font-mono text-[11px] overflow-x-auto">
                          {vuln.matchedSnippet}
                        </div>
                        <p className="text-gray-400 text-[11px]">{vuln.description}</p>
                        <p className="text-emerald-400 text-[11px] font-mono">
                          Remediation: {vuln.recommendation}
                        </p>
                      </div>
                    ))}
                    {codeAuditReport.vulnerabilities.length === 0 && (
                      <p className="text-emerald-400 text-center py-4">
                        Zero OWASP security vulnerabilities identified in inspected snippet!
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: THREAT INTELLIGENCE                                     */}
        {/* ============================================================== */}
        {activeTab === 'threat' && (
          <div className="space-y-6 max-w-5xl mx-auto font-mono text-xs">
            <div className="p-5 bg-[#0e1728] border border-cyan-500/20 rounded-xl space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-cyan-200 uppercase">
                  IP Threat Intelligence & Reputation
                </h2>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={threatIp}
                  onChange={(e) => setThreatIp(e.target.value)}
                  placeholder="Target IP address (e.g. 8.8.8.8, 192.168.1.1)"
                  className="flex-1 bg-black/60 border border-gray-700 rounded px-3 py-1.5 text-xs text-gray-200 outline-none"
                />
                <button
                  onClick={handleThreatIntel}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-semibold"
                >
                  Analyze IP
                </button>
              </div>

              {threatReport && (
                <div className="p-4 bg-black/60 border border-gray-800 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div className="p-2 bg-gray-900 rounded">
                      <div className="text-[10px] text-gray-400">CLASSIFICATION</div>
                      <div className="text-cyan-300 font-bold mt-1">{threatReport.classification}</div>
                    </div>
                    <div className="p-2 bg-gray-900 rounded">
                      <div className="text-[10px] text-gray-400">THREAT LEVEL</div>
                      <div className="text-emerald-400 font-bold mt-1">{threatReport.threatLevel}</div>
                    </div>
                    <div className="p-2 bg-gray-900 rounded">
                      <div className="text-[10px] text-gray-400">RISK SCORE</div>
                      <div className="text-cyan-300 font-bold mt-1">{threatReport.riskScore}/100</div>
                    </div>
                    <div className="p-2 bg-gray-900 rounded">
                      <div className="text-[10px] text-gray-400">BOGON CHECK</div>
                      <div className="text-gray-300 font-bold mt-1">{threatReport.isBogon ? 'YES (SPOOF)' : 'NO'}</div>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-900 rounded space-y-1">
                    <span className="text-[11px] font-bold text-gray-300">Tactical Observations:</span>
                    <ul className="list-disc list-inside text-gray-400 text-[11px] space-y-1">
                      {threatReport.tacticalNotes?.map((n: string, i: number) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* MITRE ATT&CK Active Defense Matrix */}
            <div className="p-5 bg-[#0e1728] border border-gray-800 rounded-xl space-y-3">
              <h3 className="font-semibold text-gray-200 uppercase">MITRE ATT&CK Active Defense Protocols</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-black/60 border border-gray-800 rounded space-y-1">
                  <div className="text-cyan-400 font-bold">T1046: Network Recon</div>
                  <p className="text-[11px] text-gray-400">Defend perimeter with port knockers, wireguard tunnel, and rate-limiting.</p>
                </div>
                <div className="p-3 bg-black/60 border border-gray-800 rounded space-y-1">
                  <div className="text-cyan-400 font-bold">T1190: Public Exploit</div>
                  <p className="text-[11px] text-gray-400">Enforce strict CSP, HSTS, WAF filtering, and rapid vulnerability patching.</p>
                </div>
                <div className="p-3 bg-black/60 border border-gray-800 rounded space-y-1">
                  <div className="text-cyan-400 font-bold">T1110: Brute Force</div>
                  <p className="text-[11px] text-gray-400">Deploy bcrypt/Argon2id password hashing with multi-factor tokens.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
