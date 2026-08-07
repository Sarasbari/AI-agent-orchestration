# Feature Ticket List
## AI Agent Orchestration Platform

**Version:** 1.0
**Author:** Saras Bari
**Date:** August 2026
**Subject:** Web Technology — Sem 5 Mini Project

Format: Jira-style. Fields — ID | Title | Type | Priority | Week | Description | Acceptance Criteria

---

### WEEK 1 — Orchestrator API + Schema + DB

**TICKET-001**
- **Title:** Project scaffolding & repo setup
- **Type:** Task | **Priority:** P0 | **Week:** 1
- **Description:** Initialize Node.js/Express repo, ESLint/Prettier config, folder structure (routes/services/models), Docker base setup.
- **Acceptance Criteria:** Repo runs locally with `npm run dev`, hits a `/health` endpoint returning 200.

**TICKET-002**
- **Title:** PostgreSQL schema implementation
- **Type:** Task | **Priority:** P0 | **Week:** 1
- **Description:** Create migration files for `users`, `api_keys`, `workflows`, `workflow_runs`, `node_executions`, `refresh_tokens` per TRD schema.
- **Acceptance Criteria:** All tables created via migration tool (e.g. `node-pg-migrate`), indexes applied, rollback tested.

**TICKET-003**
- **Title:** Auth: signup/login endpoints
- **Type:** Feature | **Priority:** P0 | **Week:** 1
- **Description:** Implement `/api/auth/signup`, `/api/auth/login` with bcrypt password hashing, JWT access token issuance.
- **Acceptance Criteria:** Valid signup creates user + returns tokens; invalid login returns 401; passwords never stored in plaintext.

**TICKET-004**
- **Title:** Auth: refresh token flow
- **Type:** Feature | **Priority:** P0 | **Week:** 1
- **Description:** Implement `/api/auth/refresh` and `/api/auth/logout`, refresh token rotation + reuse detection per SECURITY doc.
- **Acceptance Criteria:** Expired access token + valid refresh token returns new access token; reused old refresh token revokes session family.

**TICKET-005**
- **Title:** Workflow CRUD endpoints
- **Type:** Feature | **Priority:** P0 | **Week:** 1
- **Description:** Implement `POST/GET/PUT/DELETE /api/workflows`, ownership scoping enforced (user can only access own workflows).
- **Acceptance Criteria:** All endpoints functional, unauthorized cross-user access returns 403, DAG JSON validated on save (cycle detection).

**TICKET-006**
- **Title:** API key vault endpoints
- **Type:** Feature | **Priority:** P1 | **Week:** 1
- **Description:** Implement `POST/GET/DELETE /api/keys` with AES-256-GCM encryption before storage.
- **Acceptance Criteria:** Raw key never returned in any response; encrypted value verified in DB directly.

**TICKET-007**
- **Title:** Unit tests — auth & workflow CRUD
- **Type:** Test | **Priority:** P1 | **Week:** 1
- **Description:** Jest test suite covering auth flows and workflow CRUD, including negative cases.
- **Acceptance Criteria:** ≥80% coverage on `routes/auth`, `routes/workflows`; all tests pass in CI.

---

### WEEK 2 — Workers + BullMQ + LLM Integration

**TICKET-008**
- **Title:** Redis + BullMQ queue setup
- **Type:** Task | **Priority:** P0 | **Week:** 2
- **Description:** Configure BullMQ queue (`execute-node`), connect to Redis, basic job add/process wiring.
- **Acceptance Criteria:** Job enqueued from orchestrator is picked up and logged by a worker process.

**TICKET-009**
- **Title:** Worker service scaffolding
- **Type:** Task | **Priority:** P0 | **Week:** 2
- **Description:** Separate Node.js service/process for workers, independent from orchestrator, shares DB access.
- **Acceptance Criteria:** Worker runs as standalone process, connects to Postgres + Redis independently of orchestrator.

**TICKET-010**
- **Title:** DAG execution engine — node dispatch logic
- **Type:** Feature | **Priority:** P0 | **Week:** 2
- **Description:** Implement `triggerRun`, entry-node detection, next-node dispatch per TRD pseudocode.
- **Acceptance Criteria:** Triggering a 3-node linear workflow executes nodes in correct order, updates `node_executions` status at each step.

**TICKET-011**
- **Title:** LLM call node — Groq integration
- **Type:** Feature | **Priority:** P0 | **Week:** 2
- **Description:** Implement `llm_call` node type calling Groq API (llama-3.3-70b-versatile).
- **Acceptance Criteria:** Node executes, output stored in `node_executions.output`, errors caught and retried.

**TICKET-012**
- **Title:** LLM fallback — Gemini integration
- **Type:** Feature | **Priority:** P1 | **Week:** 2
- **Description:** Circuit breaker logic — on Groq provider failure, fallback to Gemini automatically.
- **Acceptance Criteria:** Simulated Groq failure (mocked 503) triggers successful Gemini call, logged as fallback event.

**TICKET-013**
- **Title:** Condition node implementation
- **Type:** Feature | **Priority:** P1 | **Week:** 2
- **Description:** Implement `condition` node type, evaluates expression against upstream node output.
- **Acceptance Criteria:** True/false branches correctly route execution to the right next node.

**TICKET-014**
- **Title:** Tool call nodes — send_email, web_search, db_query
- **Type:** Feature | **Priority:** P1 | **Week:** 2
- **Description:** Implement 3 stub tool integrations (SendGrid, Serper API, direct DB query) with param validation.
- **Acceptance Criteria:** Each tool executes successfully with valid params, rejects invalid params per SECURITY doc schema.

**TICKET-015**
- **Title:** Retry logic with exponential backoff
- **Type:** Feature | **Priority:** P1 | **Week:** 2
- **Description:** Failed node executions retry up to 3 times with exponential backoff before marking run failed.
- **Acceptance Criteria:** Forced failure retries 3x with increasing delay, then correctly marks node + run as failed.

**TICKET-016**
- **Title:** Unit + integration tests — execution engine
- **Type:** Test | **Priority:** P1 | **Week:** 2
- **Description:** Test suite for DAG dispatch, node types, retry logic, fallback logic.
- **Acceptance Criteria:** ≥75% coverage on worker execution logic, integration test for full 3-node workflow run passes.

---

### WEEK 3 — Frontend DAG Builder + SSE

**TICKET-017**
- **Title:** React app scaffolding + auth pages
- **Type:** Task | **Priority:** P0 | **Week:** 3
- **Description:** Set up React app, login/signup pages, token storage, protected routes.
- **Acceptance Criteria:** User can sign up, log in, and reach an authenticated dashboard view.

**TICKET-018**
- **Title:** React Flow DAG builder — canvas & node palette
- **Type:** Feature | **Priority:** P0 | **Week:** 3
- **Description:** Drag-and-drop canvas with node types (llm_call, condition, tool_call), connect nodes with edges.
- **Acceptance Criteria:** User can build a valid multi-node DAG visually and save it via `POST /api/workflows`.

**TICKET-019**
- **Title:** Node configuration panels
- **Type:** Feature | **Priority:** P0 | **Week:** 3
- **Description:** Per-node-type config forms (prompt text for llm_call, expression for condition, tool params for tool_call).
- **Acceptance Criteria:** Each node type has a working config form, values persist into `dag_definition` JSON on save.

**TICKET-020**
- **Title:** SSE live execution status view
- **Type:** Feature | **Priority:** P0 | **Week:** 3
- **Description:** Subscribe to `GET /api/runs/:id/stream`, update node visual state (pending/running/success/failed) live on canvas.
- **Acceptance Criteria:** Triggering a run visibly updates node colors in real time without page refresh.

**TICKET-021**
- **Title:** Run history & retry UI
- **Type:** Feature | **Priority:** P1 | **Week:** 3
- **Description:** List of past runs per workflow, click to view node-level detail, retry-failed-node button.
- **Acceptance Criteria:** User can view a past run's full status breakdown and retry any failed node from the UI.

**TICKET-022**
- **Title:** API key management UI
- **Type:** Feature | **Priority:** P2 | **Week:** 3
- **Description:** Settings page to add/remove provider API keys.
- **Acceptance Criteria:** User can add a Groq/Gemini key, see masked confirmation, delete a key.

**TICKET-023**
- **Title:** Frontend component tests
- **Type:** Test | **Priority:** P2 | **Week:** 3
- **Description:** React Testing Library tests for DAG builder canvas, config panels, SSE status updates.
- **Acceptance Criteria:** Core components covered, tests pass in CI.

---

### WEEK 4 — K8s Deployment + Hardening + Docs + Demo

**TICKET-024**
- **Title:** Dockerize orchestrator & worker services
- **Type:** Task | **Priority:** P0 | **Week:** 4
- **Description:** Multi-stage Dockerfiles for both services, minimize image size.
- **Acceptance Criteria:** Both images build successfully, run correctly via `docker run` locally.

**TICKET-025**
- **Title:** K8s manifests — Deployments, Services, HPA
- **Type:** Task | **Priority:** P0 | **Week:** 4
- **Description:** Apply orchestrator-deployment.yaml, worker-deployment.yaml, Services, HPA per TRD.
- **Acceptance Criteria:** Both services deployed to GKE, HPA visible via `kubectl get hpa`, pods pass readiness checks.

**TICKET-026**
- **Title:** KEDA setup — queue-depth autoscaling
- **Type:** Task | **Priority:** P1 | **Week:** 4
- **Description:** Install KEDA on cluster, apply ScaledObject for worker pods keyed on BullMQ queue depth.
- **Acceptance Criteria:** Triggering 20+ concurrent runs observably scales worker pod count up, then back down after queue drains.

**TICKET-027**
- **Title:** ConfigMap, Secrets, Ingress setup
- **Type:** Task | **Priority:** P0 | **Week:** 4
- **Description:** Apply configmap.yaml, secret.yaml (base64 values), ingress.yaml with TLS.
- **Acceptance Criteria:** App reachable via public HTTPS URL through Ingress, secrets not visible in any manifest committed to repo.

**TICKET-028**
- **Title:** NetworkPolicy + PodDisruptionBudget
- **Type:** Task | **Priority:** P1 | **Week:** 4
- **Description:** Restrict Postgres/Redis access to orchestrator+worker pods only; apply PDB for orchestrator.
- **Acceptance Criteria:** `kubectl describe networkpolicy` shows restricted ingress; PDB prevents full outage during a simulated node drain.

**TICKET-029**
- **Title:** Rate limiting + input validation hardening
- **Type:** Task | **Priority:** P1 | **Week:** 4
- **Description:** Apply `express-rate-limit` and `zod` validation across all remaining unprotected endpoints per SECURITY doc.
- **Acceptance Criteria:** Rate limit triggers 429 after threshold; malformed request bodies rejected with 400 on every endpoint.

**TICKET-030**
- **Title:** Deployment runbook documentation
- **Type:** Docs | **Priority:** P1 | **Week:** 4
- **Description:** Write step-by-step deploy guide (GKE cluster creation, `kubectl apply` order, KEDA install, DNS/Ingress setup).
- **Acceptance Criteria:** A fresh GKE cluster can be fully provisioned by following the doc alone, no undocumented manual steps.

**TICKET-031**
- **Title:** README + architecture diagram
- **Type:** Docs | **Priority:** P1 | **Week:** 4
- **Description:** Repo README covering setup, tech stack, architecture diagram, local dev instructions.
- **Acceptance Criteria:** New reader can understand system architecture and run project locally from README alone.

**TICKET-032**
- **Title:** Demo script & load test for HPA/KEDA proof
- **Type:** Task | **Priority:** P0 | **Week:** 4
- **Description:** Prepare live demo flow — build workflow, trigger 20+ concurrent runs, show pod autoscaling + Groq→Gemini fallback live.
- **Acceptance Criteria:** Demo runs end-to-end without manual intervention, autoscaling visibly captured (screenshot/screen recording as backup).

**TICKET-033**
- **Title:** Final report compilation
- **Type:** Docs | **Priority:** P0 | **Week:** 4
- **Description:** Compile PRD, TRD, Security Doc, this ticket list, and final results into submission-ready report.
- **Acceptance Criteria:** Report covers all 6 non-functional pillars with evidence (screenshots, metrics) per submission form requirements.

---

## Summary

| Week | Ticket Count | Focus |
|---|---|---|
| 1 | 7 | Orchestrator API, DB schema, auth |
| 2 | 9 | Workers, BullMQ, LLM integration, execution engine |
| 3 | 7 | Frontend DAG builder, SSE, run history |
| 4 | 10 | K8s deploy, hardening, docs, demo |
| **Total** | **33** | |
