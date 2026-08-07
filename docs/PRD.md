# Product Requirements Document
## AI Agent Orchestration Platform

**Version:** 1.0
**Author:** Saras Bari
**Date:** August 2026
**Subject:** Web Technology — Sem 5 Mini Project

---

## 1. Overview

A Kubernetes-native platform enabling users to design, execute, and monitor multi-step AI agent workflows through a visual DAG (Directed Acyclic Graph) builder. Users chain LLM calls, conditionals, and tool integrations (email, web search, DB query) into automated pipelines. Backend built on Node.js with a decoupled orchestrator/worker architecture, deployed on GKE (Google Kubernetes Engine) Autopilot.

## 2. Problem Statement

Automating multi-step AI-assisted tasks (e.g., "summarize this, check a condition, then send an email") currently requires either manual chaining of separate tool calls or heavyweight platforms (n8n, Zapier) not built for LLM-native workflows — no native retry-on-LLM-failure, no token-spend control, no agent-specific node types. This project builds a lightweight, LLM-first workflow orchestration engine addressing that gap, while independently demonstrating distributed systems fundamentals (queueing, autoscaling, fault tolerance) required for the course.

## 3. Goals

- Enable users to visually construct and execute LLM-driven workflows without writing code
- Demonstrate independently-scaling backend services (orchestrator vs. workers) under Kubernetes
- Support multiple LLM providers (Groq, Gemini) with automatic fallback on provider failure
- Provide real-time visibility into workflow execution status
- Satisfy all six non-functional pillars: Performance, Scalability, Security, Availability, Usability, Maintainability

## 4. Non-Goals

- Arbitrary/sandboxed code execution nodes
- Multi-cloud or hybrid-cloud deployment
- Billing, subscriptions, or usage-based payment
- Support for on-prem/self-hosted LLMs (cloud API only, v1)

## 5. User Stories

- As a user, I can create a new workflow by adding nodes (LLM call, condition, tool call) and connecting them in a DAG.
- As a user, I can trigger a workflow run and see live status of each node (pending/running/success/failed).
- As a user, I can retry a single failed node without re-running the entire workflow.
- As a user, I can view execution history for past runs.
- As a user, my API keys and workflow data are isolated from other users.

## 6. Functional Requirements

1. Visual DAG-based workflow builder (React Flow)
2. Workflow CRUD API (create, read, update, delete, list)
3. Async execution engine — jobs queued and processed by worker pods
4. Node types: `llm_call`, `condition`, `tool_call`
5. Tool integrations: send_email (SendGrid), web_search (Serper API), db_query
6. Real-time execution status via Server-Sent Events (SSE)
7. Execution history log per user
8. Retry-failed-node capability
9. Multi-provider LLM support: Groq (primary), Gemini (fallback)
10. User authentication (JWT-based signup/login)

## 7. Non-Functional Requirements

| Pillar | Requirement |
|---|---|
| **Performance** | SSE streaming for live updates; Redis caching for repeated prompts; connection pooling to LLM APIs |
| **Scalability** | Orchestrator and Worker services scale independently via K8s HPA; Worker autoscaling keyed on BullMQ queue depth |
| **Security** | JWT auth; per-user encrypted API key storage; rate limiting on LLM token usage; input validation on all endpoints |
| **Availability** | Circuit breaker on LLM provider calls (Groq → Gemini fallback); liveness/readiness probes; multi-replica deployments; pod disruption budgets |
| **Usability** | Drag-and-drop DAG builder; live execution trace view; clear error messaging on failed nodes |
| **Maintainability** | Clear service boundaries (Gateway / Orchestrator / Workers); structured logging (Pino); versioned workflow schema; documented API (OpenAPI spec) |

## 8. High-Level Architecture

```
Client (React + React Flow)
        ↓
API Gateway / Orchestrator (Node.js, Express)
        ↓
Redis (BullMQ job queue + execution state)
        ↓
Agent Workers (Node.js, separate K8s Deployment)
        ↓
Postgres (workflow defs, run history, users)
```

## 9. Tech Stack

- **Backend:** Node.js, Express
- **Queue:** BullMQ + Redis
- **DB:** PostgreSQL (Supabase or self-hosted on GKE)
- **Frontend:** React, React Flow
- **LLM Providers:** Groq (llama-3.3-70b-versatile), Gemini
- **Deployment:** Docker, Kubernetes (GKE Autopilot)
- **Autoscaling:** HPA (CPU-based) + KEDA (queue-depth-based, for Workers)
- **Observability:** Pino (logging), OpenTelemetry (tracing) — stretch goal

## 10. Milestones (1-Month Timeline)

| Week | Deliverable |
|---|---|
| 1 | Orchestrator API + workflow schema + Postgres models |
| 2 | Agent Workers + BullMQ integration + Groq/Gemini LLM calls |
| 3 | React Flow DAG builder UI + SSE live status |
| 4 | Dockerize, write K8s manifests, deploy to GKE, HPA setup, security hardening, docs, demo prep |

## 11. Success Metrics

- Workflow executes end-to-end without manual intervention
- Worker pods observably autoscale under load (demo: trigger 20+ concurrent workflow runs)
- System recovers automatically from a simulated LLM provider outage (Groq → Gemini fallback works)
- All 6 non-functional pillars demonstrable in final presentation

## 12. Risks

- **Scope risk:** Full DAG builder + cloud K8s + multi-provider LLM in 1 month, solo — tight. Mitigation: simplify DAG builder to basic node-chaining UI if week 3 runs behind.
- **Cost risk:** GKE free tier/credits may expire before demo. Mitigation: use GKE Autopilot free tier, tear down cluster when not actively developing.
- **LLM API rate limits:** Groq free tier has request limits. Mitigation: Gemini fallback doubles as rate-limit overflow handling.
