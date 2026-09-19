# ChainShield AI — Threat Model & Security Architecture

**Document Version:** 1.0  
**Classification:** Internal & Security Audit  
**Methodology:** Microsoft STRIDE & OWASP ASVS 4.0  

---

## 1. System Overview & Architecture

ChainShield AI is an automated, AI-augmented smart contract vulnerability auditing and verification platform. It analyzes Solidity source code bundles, runs static analysis, AI detector rules, and verification checks, and anchors immutable cryptographic report hashes on the Ethereum blockchain.

### 1.1 Architecture & Trust Boundaries

```
[ External User / Browser ]
         │  HTTPS / WSS / JWT Session Cookie
         ▼
[ Ingress / TLS Reverse Proxy ]
         │
         ▼
[ ChainShield API (Express + tRPC) ] ── (Prometheus /metrics & Sentry Error Sink)
   ├── Rate Limiting (Redis cluster)
   ├── Auth & RBAC (MySQL Workspace/Project Isolation)
   ├── Archive Extraction & Bomb Filter (Streaming yauzl / tar parser)
   └── Cryptographic Report Anchoring (EVM Web3 Wallet / Viem)
         │                                       │
         ▼ (Sandboxed HTTP/Token)                ▼ (JSON-RPC)
[ Compiler / Slither Worker ]          [ Ethereum Sepolia EVM ]
  (Isolated container, ephemeral FS)    (ChainShieldAnchor.sol)
```

---

## 2. Key Assets & Classification

| Asset | Classification | Description |
|---|---|---|
| **User Smart Contract Source Code** | Confidential | Proprietary Solidity source code uploaded for auditing. Must never leak or train external models. |
| **Audit Findings & Reports** | Confidential / Integrity | Vulnerability discoveries, severity scores, suggested fixes, and verification test outputs. |
| **Session JWT Secret & Cookies** | Secret | Signs authentication tokens. Compromise allows total session forgery. |
| **Worker Secret Token** | Secret | Shared secret authenticating API-to-Worker communication. |
| **Ethereum Hot Wallet Key** | Secret / Low-Balance | Private key used exclusively to broadcast report anchoring hashes to Sepolia testnet. |
| **Database Credentials** | Secret | MySQL connection string and DB access permissions. |

---

## 3. Attack Surface Map

1. **Public Web API (`/healthz`, `/readyz`, `/metrics`, `/api/trpc`)**:
   - Exposed to public internet. Protected by Redis rate limiting and CORS/CSP headers.
2. **OAuth Callback Flow (`/api/oauth/callback`)**:
   - Exchanges authorization code with identity provider.
3. **File & Archive Upload (`trpc.analysis.uploadSourceBundle`)**:
   - Ingests user-supplied zip files and source strings.
4. **Sandboxed Worker Endpoint (`/execute`)**:
   - Internal boundary for compiling Solidity contracts and executing analysis binaries.
5. **Blockchain Anchoring Provider (`ANCHOR_RPC_URL`)**:
   - Outbound JSON-RPC communication for anchoring report hashes on-chain.

---

## 4. STRIDE Threat Analysis

### 4.1 Spoofing (Identity & Authenticity)
| Threat ID | Threat Description | Affected Component | Implemented Mitigation |
|---|---|---|---|
| **S-01** | Attacker crafts a forged JWT session cookie to impersonate users | Authentication Layer | JWT signed with HMAC-SHA256 (`jose`), strictly bound to secret (`JWT_SECRET`), stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies. |
| **S-02** | Rogue service impersonates the Compiler Sandbox Worker | Analysis Pipeline | Worker requests require `Authorization: Bearer <CHAINSHIELD_WORKER_TOKEN>` constant-time token check. |
| **S-03** | Attacker spoofs Request IDs to bypass audit logs | Logging & Security | `requestIdMiddleware` generates cryptographically random UUIDv4 server-side unless header is valid. |

### 4.2 Tampering (Data Integrity)
| Threat ID | Threat Description | Affected Component | Implemented Mitigation |
|---|---|---|---|
| **T-01** | Modification of security audit report after publication | Reporting Layer | Canonical SHA-256 report payload hash computed and anchored on EVM testnet (`ChainShieldAnchor.sol`). Anyone can independently verify hash immutability. |
| **T-02** | Path traversal in uploaded archive files (`../../etc/passwd`) | Archive Processor | Strict path normalization and regex assertion (`assertSafeSourcePath` rejects `..`, absolute paths, and illegal characters). |
| **T-03** | In-flight tampering of analysis results between Worker and API | Pipeline Boundary | Response payloads include source hash verification and cryptographic evidence signatures. |

### 4.3 Repudiation (Non-Denial of Actions)
| Threat ID | Threat Description | Affected Component | Implemented Mitigation |
|---|---|---|---|
| **R-01** | User claims they did not initiate a scan or delete a project | Audit Log | All critical operations append immutable audit event records to `auditEvents` table with actorId, workspaceId, timestamp, and metadata. |
| **R-02** | Auditor denies finding review status changes | Review Workflow | Finding status updates require maintainer signature and log reviewer ID to `findingReviews`. |

### 4.4 Information Disclosure (Confidentiality)
| Threat ID | Threat Description | Affected Component | Implemented Mitigation |
|---|---|---|---|
| **I-01** | Cross-tenant project access (IDOR / BOLA) | Database Layer | All tRPC queries enforce SQL workspace owner/membership predicates (`userWorkspaces` join). Unauthorized access returns `FORBIDDEN`. |
| **I-02** | Accidental leak of private keys or secrets via Sentry error tracking | Telemetry / Sentry | Sentry `beforeSend` sanitizes `-----BEGIN PRIVATE KEY-----`, authorization tokens, and session cookies before transport. |
| **I-03** | Source code uploaded containing embedded secrets / seed phrases | Upload Validator | `assertNoPrivateMaterial()` actively scans file contents for private key and mnemonic patterns and rejects immediately. |

### 4.5 Denial of Service (Availability)
| Threat ID | Threat Description | Affected Component | Implemented Mitigation |
|---|---|---|---|
| **D-01** | Archive decompression bomb (Zip Bomb / Tar Bomb) | Upload Ingestion | Streaming decompression via `yauzl` with dual limits: Max 100 files, max 750 KiB per file, max 10 MiB aggregate extraction limit. |
| **D-02** | API endpoint flooding / resource starvation | Express API | Distributed Redis rate limiter (`apiRateLimit`) enforcing bounded requests per IP/path per 60-second window. |
| **D-03** | Compiler CPU/Memory exhaustion via recursive contract macros | Sandbox Worker | Sandboxed worker runs with strict timeout limits (30s) and bounded memory per run. |

### 4.6 Elevation of Privilege (Authorization)
| Threat ID | Threat Description | Affected Component | Implemented Mitigation |
|---|---|---|---|
| **E-01** | Workspace `viewer` attempting to run scans or delete projects | RBAC Middleware | `owner/maintainer` permission gates enforced on mutation procedures in `server/routers.ts`. |
| **E-02** | Normal user calling admin maintenance routes | tRPC Router | `adminProcedure` middleware validates `user.role === 'admin'`. |

---

## 5. Residual Risks & Operational Hardening

1. **Worker Isolation**: In production, the compiler worker should run in an isolated container without internet egress.
2. **EVM Key Rotation**: Sepolia hot wallet key must only contain minimal testnet gas and never hold mainnet assets.
3. **Log Sinks**: Production deployment must aggregate logs to an external SIEM/Datadog sink with alerting on rate-limit breaches.
