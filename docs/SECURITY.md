# Security Document
## AI Agent Orchestration Platform

**Version:** 1.0
**Author:** Saras Bari
**Date:** August 2026
**Subject:** Web Technology — Sem 5 Mini Project

---

## 1. Threat Model

| Threat | Vector | Impact | Mitigation |
|---|---|---|---|
| Credential theft | Stolen JWT / leaked API key | Account takeover, LLM key abuse | Short-lived access tokens (15 min), encrypted-at-rest provider keys, refresh token rotation |
| Cross-tenant data leak | Missing user_id scoping on queries | User A sees User B's workflows/keys | Every query filtered by `user_id` from JWT claim, enforced at DB query layer, not just API layer |
| LLM prompt injection | Malicious input in workflow node feeds into tool_call | Unauthorized tool execution (e.g. arbitrary email send) | Tool allowlist per workflow, no dynamic tool selection from LLM output, param validation before tool execution |
| Excessive LLM spend | Compromised account or bug triggers loop | Cost blowout on provider API | Per-user token-usage rate limit, max node execution count per run, no unbounded loops in DAG (cycle detection at save time) |
| Secrets exposure | Hardcoded keys, committed `.env`, logged secrets | Full account compromise | K8s Secrets only, `.gitignore` for env files, log scrubbing middleware (redact fields matching `key|token|password|secret`) |
| SQL injection | String-concatenated queries | DB compromise | Parameterized queries only (`pg` library), input validation via `zod` before DB layer |
| DDoS / brute force | Repeated login attempts, API flooding | Service degradation, account lockout bypass | Rate limiting (`express-rate-limit`), exponential backoff on failed login, K8s HPA absorbs legitimate traffic spikes |
| Man-in-the-middle | Unencrypted traffic | Credential/token interception | TLS via Ingress (GKE-managed cert), HSTS header, no plain HTTP endpoint exposed |
| Insecure direct object reference | Guessable workflow/run IDs | Unauthorized access to other users' data | UUIDs (not sequential integers) for all resource IDs, ownership check on every fetch |

---

## 2. Authentication & Authorization

- **Password storage:** bcrypt, cost factor 12, never plaintext, never reversible
- **Access token:** JWT, HS256, 15 min expiry, claims: `{ sub: user_id, iat, exp }`
- **Refresh token:** random 256-bit token, stored hashed (SHA-256) in `refresh_tokens` table, httpOnly + Secure + SameSite=Strict cookie, 7 day expiry
- **Token rotation:** every refresh invalidates the old refresh token and issues a new one — stolen refresh tokens become useless after first legitimate use (reuse detection: if an already-rotated token is presented again, revoke entire session family)
- **Authorization:** every resource endpoint checks `resource.user_id === req.user.id` before returning/mutating data — no exceptions, enforced in middleware layer, not per-route

## 3. Secrets Management

- All secrets (`JWT_SECRET`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`) live in K8s Secrets, injected as env vars
- User-provided provider API keys (stored in `api_keys` table) encrypted with AES-256-GCM before insert, decrypted only in-memory at LLM-call time, never logged, never returned in API responses
- `ENCRYPTION_KEY` itself stored as K8s Secret, rotated manually if compromised (documented rotation runbook, not automated for v1)
- No secrets in Docker images, no secrets in git history (`.env` in `.gitignore`, verified via `git-secrets` pre-commit hook)

## 4. Network Security

- Ingress terminates TLS (GKE-managed certificate via Google-managed cert or cert-manager + Let's Encrypt)
- Internal service-to-service traffic (orchestrator → Redis → workers → Postgres) stays within cluster network, ClusterIP Services only (no external exposure for Redis/Postgres)
- K8s NetworkPolicy restricting Postgres/Redis ingress to only orchestrator + worker pod labels — nothing else in cluster can reach the DB
- CORS: `Access-Control-Allow-Origin` locked to deployed frontend domain only, credentials mode restricted

## 5. Input Validation

- All request bodies validated against `zod` schemas before touching business logic
- DAG definition validated for: cycle detection (reject cyclic graphs at save time), max node count (prevent resource-exhaustion workflows), valid node types only
- Tool call parameters validated against per-tool schema before execution (e.g. `send_email` requires valid email format, subject/body length limits)

## 6. Rate Limiting

| Scope | Limit |
|---|---|
| Login attempts | 5 per 15 min per IP |
| API requests (authenticated) | 100 per 15 min per user |
| Workflow runs triggered | 10 per hour per user (configurable) |
| LLM token usage | Daily cap per user, tracked in Redis counter, resets at UTC midnight |

## 7. Dependency & Supply Chain Security

- `npm audit` run in CI pipeline, build fails on high/critical vulnerabilities
- Dependencies pinned via `package-lock.json`, no floating versions in `package.json`
- Base Docker images: official `node:20-alpine`, rebuilt weekly to pick up OS patches
- No `eval()`, no dynamic `require()` of user-influenced strings anywhere in codebase

## 8. Logging & Auditing

- Structured logs (Pino), redaction middleware strips fields matching `/key|token|password|secret/i` before write
- Auth events logged: login success/failure, token refresh, logout — with user_id + timestamp, no PII beyond that
- No prompt/response content logged by default (avoids storing potentially sensitive user data in logs) — only metadata (node_id, status, duration, token count)

## 9. Incident Response (Scoped for Academic Project)

- If `ENCRYPTION_KEY` compromise suspected: rotate key, force re-entry of all user API keys, invalidate all refresh tokens (mass logout)
- If DB breach suspected: rotate `POSTGRES_PASSWORD`, audit `api_keys` table access logs, notify users to rotate their own LLM provider keys

## 10. Out of Scope (v1)

- SOC 2 / compliance certification
- Automated secret rotation
- WAF (Web Application Firewall) — GKE Ingress default protections only
- Penetration testing (documented as future work in final report)
