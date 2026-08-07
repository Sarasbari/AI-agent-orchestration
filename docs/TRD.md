# Technical Requirements Document
## AI Agent Orchestration Platform

**Version:** 1.0
**Author:** Saras Bari
**Date:** August 2026
**Subject:** Web Technology — Sem 5 Mini Project

---

## 1. System Architecture

```
Client (React + React Flow)
        ↓ HTTPS
API Gateway / Orchestrator (Node.js, Express) — Deployment: orchestrator
        ↓
Redis (BullMQ job queue + execution state) — Deployment: redis
        ↓
Agent Workers (Node.js) — Deployment: workers (independently scaled)
        ↓
PostgreSQL — StatefulSet or managed (Supabase)
```

Services communicate internally via K8s ClusterIP Services. External access via Ingress (`/api/*` → orchestrator Service).

---

## 2. Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Encrypted per-user API keys (for LLM providers, tools)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,        -- 'groq', 'gemini', 'sendgrid', etc.
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Workflow definitions
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  dag_definition JSONB NOT NULL,        -- { nodes: [...], edges: [...] }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Execution runs
CREATE TABLE workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/running/success/failed
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT
);

-- Per-node execution status within a run
CREATE TABLE node_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  node_id VARCHAR(50) NOT NULL,          -- matches node id in dag_definition
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0
);

-- Refresh tokens (for JWT rotation)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workflows_user ON workflows(user_id);
CREATE INDEX idx_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_node_exec_run ON node_executions(run_id);
```

---

## 3. API Endpoints

**Auth**
- `POST /api/auth/signup` — { email, password } → { user, accessToken, refreshToken }
- `POST /api/auth/login` — { email, password } → { accessToken, refreshToken }
- `POST /api/auth/refresh` — { refreshToken } → { accessToken }
- `POST /api/auth/logout` — { refreshToken } → 204

**Workflows**
- `POST /api/workflows` — { name, dag_definition } → workflow
- `GET /api/workflows` — → workflow[]
- `GET /api/workflows/:id` — → workflow
- `PUT /api/workflows/:id` — { name?, dag_definition? } → workflow
- `DELETE /api/workflows/:id` — → 204

**Execution**
- `POST /api/workflows/:id/run` — → { run_id }
- `GET /api/runs/:id` — → run + node_executions[]
- `GET /api/runs/:id/stream` — SSE endpoint, live node status updates
- `POST /api/runs/:id/nodes/:nodeId/retry` — → { status }
- `GET /api/workflows/:id/runs` — run history for a workflow

**API Keys**
- `POST /api/keys` — { provider, key } → 201 (encrypts before storing)
- `GET /api/keys` — → [{ provider, created_at }] (never returns raw key)
- `DELETE /api/keys/:provider` — → 204

---

## 4. Auth Flow (Access + Refresh JWT)

- Access token: 15 min expiry, signed JWT, sent as `Authorization: Bearer <token>`
- Refresh token: 7 day expiry, stored hashed in `refresh_tokens` table, sent via httpOnly cookie
- On access token expiry, client calls `/api/auth/refresh` with refresh token → new access token issued
- Refresh token rotation: each refresh issues a new refresh token, old one invalidated (prevents replay)
- Logout invalidates refresh token server-side (delete row)

---

## 5. DAG Execution Engine — Pseudocode

**Orchestrator: on workflow run trigger**
```
function triggerRun(workflowId):
  workflow = db.getWorkflow(workflowId)
  run = db.createRun(workflowId, status='pending')
  entryNodes = findNodesWithNoIncomingEdges(workflow.dag_definition)
  for node in entryNodes:
    queue.add('execute-node', { runId: run.id, nodeId: node.id })
  return run.id
```

**Worker: process node job**
```
function processNode(job):
  { runId, nodeId } = job.data
  run = db.getRun(runId)
  workflow = db.getWorkflow(run.workflow_id)
  node = workflow.dag_definition.nodes.find(n => n.id == nodeId)

  db.updateNodeExecution(runId, nodeId, status='running')

  try:
    inputs = gatherInputsFromParentNodes(runId, nodeId, workflow.dag_definition)

    switch node.type:
      case 'llm_call':
        output = callLLM(node.prompt, inputs, provider='groq', fallback='gemini')
      case 'condition':
        output = evaluateCondition(node.if, inputs)
      case 'tool_call':
        output = executeTool(node.tool, inputs)

    db.updateNodeExecution(runId, nodeId, status='success', output=output)
    sse.publish(runId, { nodeId, status: 'success', output })

    nextNodes = findNextNodes(workflow.dag_definition, nodeId, output)
    for next in nextNodes:
      if allParentsComplete(runId, next.id):
        queue.add('execute-node', { runId, nodeId: next.id })

    if noMoreNodesInProgress(runId):
      db.updateRun(runId, status='success', completed_at=now())

  catch error:
    retryCount = db.getRetryCount(runId, nodeId)
    if retryCount < 3:
      db.incrementRetry(runId, nodeId)
      queue.add('execute-node', { runId, nodeId }, { delay: exponentialBackoff(retryCount) })
    else:
      db.updateNodeExecution(runId, nodeId, status='failed', error=error.message)
      db.updateRun(runId, status='failed', error=error.message)
      sse.publish(runId, { nodeId, status: 'failed', error: error.message })
```

**LLM call with fallback**
```
function callLLM(prompt, inputs, provider, fallback):
  try:
    return groqClient.complete(prompt, inputs)
  catch (error):
    if isProviderError(error):
      log.warn('Groq failed, falling back to Gemini')
      return geminiClient.complete(prompt, inputs)
    throw error
```

---

## 6. Kubernetes Manifests

**orchestrator-deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orchestrator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: orchestrator
  template:
    metadata:
      labels:
        app: orchestrator
    spec:
      containers:
        - name: orchestrator
          image: gcr.io/PROJECT_ID/orchestrator:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
---
apiVersion: v1
kind: Service
metadata:
  name: orchestrator-svc
spec:
  selector:
    app: orchestrator
  ports:
    - port: 80
      targetPort: 3000
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: orchestrator-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: orchestrator
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

**worker-deployment.yaml**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agent-worker
  template:
    metadata:
      labels:
        app: agent-worker
    spec:
      containers:
        - name: agent-worker
          image: gcr.io/PROJECT_ID/agent-worker:latest
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
          livenessProbe:
            exec:
              command: ["node", "healthcheck.js"]
            initialDelaySeconds: 10
            periodSeconds: 20
          resources:
            requests:
              cpu: "200m"
              memory: "256Mi"
            limits:
              cpu: "1"
              memory: "512Mi"
---
# KEDA ScaledObject (queue-depth-based autoscaling)
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: worker-scaledobject
spec:
  scaleTargetRef:
    name: agent-worker
  minReplicaCount: 1
  maxReplicaCount: 10
  triggers:
    - type: redis
      metadata:
        address: redis-svc:6379
        listName: bull:execute-node:wait
        listLength: "5"
```

**configmap.yaml**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: "production"
  REDIS_HOST: "redis-svc"
  REDIS_PORT: "6379"
  POSTGRES_HOST: "postgres-svc"
```

**secret.yaml** (values base64-encoded, not committed to repo)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
data:
  JWT_SECRET: <base64>
  GROQ_API_KEY: <base64>
  GEMINI_API_KEY: <base64>
  POSTGRES_PASSWORD: <base64>
  ENCRYPTION_KEY: <base64>
```

**ingress.yaml**
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: app-ingress
  annotations:
    kubernetes.io/ingress.class: "gce"
spec:
  rules:
    - http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: orchestrator-svc
                port:
                  number: 80
```

**pdb.yaml** (Pod Disruption Budget — availability)
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: orchestrator-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: orchestrator
```

---

## 7. Security Notes

- API keys encrypted at rest (AES-256, key from `ENCRYPTION_KEY` secret, never logged)
- All secrets via K8s Secrets, not ConfigMaps, not hardcoded
- Rate limiting: `express-rate-limit`, 100 req/15min per user on `/api/*`
- Input validation: `zod` or `joi` schema validation on all POST/PUT bodies
- CORS restricted to frontend origin only
- SQL injection: parameterized queries only (pg library, no string concat)

---

## 8. Next Docs
- Security Doc (threat model, deeper auth/encryption detail)
- Feature ticket list (sprint breakdown by week)
