# ChainShield AI — External Penetration Testing Guide & Rules of Engagement

**Target System:** ChainShield AI Platform  
**Target Environment:** Staging / Dedicated Pre-Production Instance  
**Standard Reference:** OWASP ASVS v4.0 / NIST SP 800-115 / PTES  

---

## 1. Rules of Engagement (RoE)

### 1.1 Authorization & Safe Harbor
Security researchers and external audit teams conducting authorized penetration testing on ChainShield AI staging environments agree to:
- Conduct testing only on designated in-scope staging endpoints.
- Avoid any testing that leads to physical disruption of third-party infrastructure (e.g. public Ethereum RPCs, Google OAuth infrastructure).
- Not exfiltrate, delete, or modify real user data. Use dedicated test accounts.
- Cease testing immediately and report if critical remote code execution (RCE) or complete database compromise is discovered.

---

## 2. Testing Scope

### 2.1 In-Scope Targets
| Component | Scope Description | Protocol / Interface |
|---|---|---|
| **API Endpoints** | All tRPC procedures and Express REST routes (`/api/trpc/*`, `/healthz`, `/readyz`, `/metrics`) | HTTPS / JSON / tRPC |
| **Authentication & RBAC** | Session handling, OAuth callback flow, JWT validation, Workspace/Project isolation | HTTP / Cookie / Bearer |
| **File Ingestion Engine** | ZIP archive extraction, source bundle parser, secret detection filter | File Upload / Buffers |
| **Worker Boundary Adapter** | API-to-Worker communication, token authentication, sandboxed executor contract | HTTP / JSON |
| **Report Anchoring Module** | EVM testnet report hash anchoring pipeline | Viem / JSON-RPC |
| **Frontend Web App** | React/Vite client, XSS attack surface, DOM manipulation, CSRF protection | HTTPS / Browser DOM |

### 2.2 Out-of-Scope Targets
- Distributed Denial of Service (DDoS) attacks saturating network uplink bandwidth.
- Third-party OAuth servers (e.g., `accounts.google.com`).
- Public Ethereum nodes and testnet miners/faucets.
- Social engineering, phishing, or physical attacks against maintainers.

---

## 3. Test Personas & Role Matrix

External testers should request or configure accounts for each of the following roles:

| Persona | Workspace Role | Expected Capabilities & Access Restrictions |
|---|---|---|
| **Anonymous** | Unauthenticated | Can access `/healthz`, `/readyz`, `/metrics`, and public login page. All `/api/trpc` protected routes must return `UNAUTHORIZED`. |
| **Viewer** | `viewer` | Read-only access to workspaces, projects, scan history, and security reports. Cannot initiate scans, upload bundles, or delete projects. |
| **Member** | `reviewer` | Read-write access to finding reviews and status annotations. Cannot run full compiler analysis or delete projects. |
| **Maintainer** | `maintainer` | Can trigger scans, upload bundles, anchor reports on-chain, and modify project configurations. Cannot delete workspace. |
| **Owner** | `owner` | Full administrative control over workspace, billing, membership invitations, and project deletion. |
| **Admin** | System `admin` | Global administrative procedures (`adminProcedure`). |

---

## 4. Key Attack Scenarios to Assess

### 4.1 Broken Object-Level Authorization (BOLA / IDOR)
- **Objective:** Verify that a user in Workspace A cannot access or mutate projects, runs, findings, or audit events in Workspace B.
- **Key Routes:**
  - `analysis.project` (query by ID)
  - `analysis.run` (query by ID)
  - `analysis.startScan` (initiating scan on target project)
  - `analysis.anchorReport` (anchoring reports on unauthorized projects)
- **Expected Result:** Procedures return `FORBIDDEN` or `NOT_FOUND` when target ID does not belong to the user's active workspace.

### 4.2 Archive Decompression Bombs & Path Traversal
- **Objective:** Attempt to cause memory exhaustion, CPU starvation, or arbitrary file overwrite using maliciously crafted ZIP files.
- **Test Vectors:**
  - Highly compressed null-byte zip files ("Zip Bombs").
  - Nested archives containing >100 files or individual files >750 KiB.
  - Path traversal filenames (`../../evil.sol`, `/etc/passwd`, `C:\Windows\System32`).
- **Expected Result:** `extractZipSafely()` in `server/analysis/archive.ts` aborts extraction stream with `PAYLOAD_TOO_LARGE` or `BAD_REQUEST` without crashing the process.

### 4.3 Worker Sandbox Escape & Command Injection
- **Objective:** Verify that malicious Solidity source payloads cannot execute arbitrary shell commands inside the worker host.
- **Test Vectors:**
  - Compiler pragma injection (`pragma solidity ^0.8.0; /* shell payload */`).
  - Import path manipulation (`import "../../../etc/shadow";`).
- **Expected Result:** Worker executes solely within an isolated subprocess/container with strict timeout (30s), egress disabled, and read-only source mounts.

### 4.4 Secret & Sensitive Material Leakage
- **Objective:** Confirm that source code uploaded containing secrets is stopped, and errors do not leak database or private key details.
- **Test Vectors:**
  - Source files containing test Ethereum private keys or API keys.
  - Triggering 500 errors to inspect error bodies and Sentry telemetry payloads.
- **Expected Result:** Upload rejected with `SOURCE_SECRET_REJECTED`. Error responses return generic messages and sanitized request IDs.

---

## 5. Vulnerability Severity & Disclosure SLA

Vulnerabilities will be rated using the **Common Vulnerability Scoring System (CVSS v3.1)**:

| Severity | CVSS v3.1 Score | Remediation SLA |
|---|---|---|
| **Critical** | 9.0 – 10.0 | 24 - 48 Hours |
| **High** | 7.0 – 8.9 | 5 Business Days |
| **Medium** | 4.0 – 6.9 | 14 Business Days |
| **Low** | 0.1 – 3.9 | 30 Business Days |

### Reporting Format
Please submit reports to the security team with:
1. Vulnerability title and CVSS v3.1 vector.
2. Step-by-step reproduction instructions.
3. Proof-of-concept (PoC) payload or request transcript.
4. Impact assessment and suggested remediation.
