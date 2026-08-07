# SKILL.md — AI Agent Orchestration Platform

Project context file for AI coding agents (Antigravity). Read this first, before generating any code for this repo.

---

## Project Summary

Kubernetes-native platform for building/running multi-step LLM agent workflows via visual DAG builder. Node.js backend (Express), React frontend (React Flow), BullMQ/Redis for async execution, PostgreSQL for persistence. Deploys on GKE Autopilot. Solo, 1-month sem5 academic project — Web Technology subject.

## Doc References

Full specs live in `/docs`. **Always consult these before implementing a feature — don't invent schema, endpoints, or architecture not defined here.**

- `docs/PRD.md` — product scope, goals, non-goals, non-functional requirements (perf/scale/security/availability/usability/maintainability)
- `docs/TRD.md` — DB schema (source of truth for all table structures), API endpoint list, auth flow, DAG execution pseudocode, K8s manifests
- `docs/SECURITY.md` — threat model, auth/encryption rules, rate limits, input validation requirements
- `docs/FEATURE_TICKETS.md` — full ticket breakdown by week, use ticket IDs (TICKET-001 etc.) when referencing work

## Tech Stack (do not substitute without asking)

- **Backend:** Node.js + Express
- **Queue:** BullMQ + Redis
- **DB:** PostgreSQL (raw `pg` library + parameterized queries — no ORM unless explicitly requested)
- **Frontend:** React + React Flow
- **LLM providers:** Groq (llama-3.3-70b-versatile) primary, Gemini fallback
- **Validation:** zod
- **Auth:** JWT access (15min) + refresh token rotation (bcrypt for passwords)
- **Deployment:** Docker → Kubernetes (GKE Autopilot), KEDA for queue-depth autoscaling, HPA for CPU-based scaling
- **Testing:** Jest (backend), React Testing Library (frontend)
- **Logging:** Pino, with redaction middleware (never log keys/tokens/passwords)

## Architecture Rules (non-negotiable)

1. **Orchestrator and Workers are separate services** — never merge them into one process. Orchestrator handles API + job dispatch. Workers handle execution only.
2. **Every DB query scoped by `user_id`** — no cross-tenant data access, ever. Check ownership before returning/mutating any resource.
3. **No raw API keys in responses, logs, or error messages** — encrypted at rest (AES-256-GCM), decrypted only in-memory at call time.
4. **Parameterized queries only** — no string concatenation into SQL, ever.
5. **All node types (`llm_call`, `condition`, `tool_call`) follow the execution engine pseudocode in TRD.md section 5** — don't reinvent dispatch logic.
6. **DAG must be cycle-free** — validate at save time, reject cyclic workflow definitions before they hit the DB.
7. **Secrets via K8s Secrets only** — never hardcode, never commit `.env`, never put in ConfigMap.

## Coding Conventions

- Folder structure: `routes/`, `services/`, `models/`, `middleware/`, `workers/`
- Route handlers thin — business logic lives in `services/`, not inline in route files
- Every new endpoint needs: input validation (zod schema), auth middleware, ownership check (if resource-scoped), error handling
- Async/await throughout, no callback-style code
- Error responses: consistent shape `{ error: { message, code } }`
- Every feature ticket implementation should reference its TICKET-ID in the commit message

## When Generating Code

- Check `docs/TRD.md` schema before creating/modifying any DB table or query
- Check `docs/SECURITY.md` before implementing anything touching auth, secrets, or user input
- Check `docs/FEATURE_TICKETS.md` for acceptance criteria before marking a feature "done"
- If a request conflicts with something in `docs/`, flag the conflict — don't silently deviate from the spec
- Prefer editing existing files over creating new ones unless the doc structure calls for a new module

## Out of Scope (do not implement)

- Arbitrary/sandboxed code execution nodes
- Multi-cloud deployment
- Billing/subscription logic
- Automated secret rotation
- SSO/OAuth (JWT email+password only, per PRD)

## Directory Structure (target)

```
/
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   ├── SECURITY.md
│   └── FEATURE_TICKETS.md
├── SKILL.md
├── orchestrator/
│   ├── routes/
│   ├── services/
│   ├── models/
│   ├── middleware/
│   └── server.js
├── worker/
│   ├── executors/
│   ├── llm/
│   └── worker.js
├── frontend/
│   └── src/
├── k8s/
│   ├── orchestrator-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── ingress.yaml
│   ├── pdb.yaml
│   └── networkpolicy.yaml
└── docker/
    ├── Dockerfile.orchestrator
    └── Dockerfile.worker
```
