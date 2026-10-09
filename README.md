# DevSentinel AI

> **Autonomous, Secure-by-Design Development Platform** — Scan, detect, and patch security vulnerabilities in code repositories using a collaborative multi-agent LLM pipeline.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Multi-Agent Pipeline](#multi-agent-pipeline)
- [Security Notes](#security-notes)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Overview

DevSentinel AI is an autonomous security platform that integrates a multi-agent LLM workflow to scan repositories, identify vulnerabilities, and generate auto-patched code — all surfaced through an enterprise-grade dashboard.

Built as a prototype for the **Techfest IIT Bombay AutoDev Hackathon**, DevSentinel AI demonstrates a full-cycle secure development pipeline: from repository ingestion to AI-driven patch generation and GitHub PR automation.

---

## Architecture

DevSentinel AI is built around a sequential multi-agent orchestration model powered by Azure OpenAI:

```
User Input (ZIP / GitHub Repo)
        │
        ▼
┌───────────────┐
│  Architect    │  ← Analyzes project structure, maps high-risk areas
└──────┬────────┘
       │
       ▼
┌───────────────┐
│   Builder     │  ← Constructs a targeted scanning strategy
└──────┬────────┘
       │
       ▼
┌───────────────┐
│   Critic      │  ← Reviews strategy, reduces false positives
└──────┬────────┘
       │
       ▼
┌───────────────┐
│   Sentinel    │  ← Executes scan (pattern + LLM-assisted analysis)
└──────┬────────┘
       │
       ▼
┌───────────────────┐
│  Red-Team Gate    │  ← Validates patches with NeuroSploit-inspired offensive techniques
└──────┬────────────┘
       │
       ▼
  Patch Report + GitHub PR
```

All agent outputs are governed by **Azure AI Content Safety** (Prompt Shields + Protected Material Detection).

---

## Features

### Security Scanning
- LLM-assisted vulnerability detection beyond traditional pattern matching
- OWASP Top 10 coverage
- Severity-based vulnerability classification (Critical / High / Medium / Low)

### Automated Patching
- AI-generated secure code patches with diff viewer
- Automatic backup/restore before applying any patch
- Export patched repository as ZIP

### GitHub Integration
- Commit fixes directly as pull requests to your repositories
- Configurable token-based auth (no embedded secrets)

### Enterprise Dashboard
- Project overview with vulnerability analytics and trends
- Security timeline with chronological scan + patch history
- Real-time scanning feedback
- Drag-and-drop ZIP upload and GitHub repo ingestion
- Dark mode, responsive, WCAG 2.1 compliant

### Red-Team Validation Terminal
- Visual attack log interface showing exploit attempts and mitigation status
- NeuroSploit-inspired offensive validation to confirm patches are non-exploitable

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes |
| AI Orchestration | Azure OpenAI Service (GPT-4o & o1-preview) |
| Content Safety | Azure AI Content Safety |
| Database | Supabase (PostgreSQL + Auth) |
| Secret Management | Azure Key Vault |
| Hosting | Vercel / Azure App Service |
| CI/CD | GitHub Actions |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- [Supabase](https://supabase.com/) account
- Azure OpenAI API access (or fallback LLM keys: OpenRouter / Gemini / Groq / Together AI)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/InfoNaveen/DEVSENTINEL-AI.git
cd DEVSENTINEL-AI
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

```bash
cp .env.local.example .env.local
# Fill in your keys — see Environment Variables section below
```

**4. Set up Supabase**

- Create a new project on [supabase.com](https://supabase.com/)
- Copy your project URL and API keys into `.env.local`
- Run the schema in your Supabase SQL editor:

```bash
# Apply schema from supabase/schema.sql
```

**5. Start the development server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

---

## Environment Variables

Create a `.env.local` file. Azure variables take priority; fallback LLM keys are used if Azure is unavailable.

```bash
# ─── Azure (Primary) ────────────────────────────────────────────────────────
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
AZURE_OPENAI_DEPLOYMENT_NAME=
AZURE_CONTENT_SAFETY_KEY=
AZURE_CONTENT_SAFETY_ENDPOINT=
AZURE_KEY_VAULT_NAME=              # Future: secret management

# ─── Application ────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ─── Supabase ───────────────────────────────────────────────────────────────
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ─── Fallback LLM Keys ──────────────────────────────────────────────────────
OPENROUTER_API_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
TOGETHER_API_KEY=
```

> ⚠️ **Never commit `.env*` files or secrets to version control.** Rotate any keys that are accidentally exposed.

---

## Project Structure

```
DEVSENTINEL-AI/
├── app/                        # Next.js 14 App Router
│   ├── api/                    # API route handlers
│   │   ├── upload/             # File & repo ingestion
│   │   ├── scan/               # Scan orchestration
│   │   ├── patch/              # Patch application
│   │   └── commit/             # GitHub commit integration
│   ├── dashboard/              # Main dashboard views
│   ├── scan-results/           # Vulnerability results display
│   ├── patches/                # Patch management UI
│   ├── timeline/               # Security event timeline
│   ├── settings/               # User & integration settings
│   └── upload/                 # Repository upload interface
│
├── components/                 # Reusable UI components
│   ├── RedTeamTerminal.tsx     # Red-Team attack log viewer
│   ├── VulnerabilityCard.tsx
│   ├── VulnerabilityTable.tsx
│   ├── PatchDiff.tsx
│   ├── Timeline.tsx
│   ├── Sidebar.tsx
│   └── Navbar.tsx
│
├── lib/                        # Core business logic
│   ├── orchestrator.ts         # Multi-agent pipeline coordination
│   ├── sentinel.ts             # Security scanning engine
│   ├── patcher.ts              # Auto-patch generation & apply
│   ├── github.ts               # GitHub PR integration
│   ├── llm.ts                  # LLM provider abstraction
│   ├── security-auditor-agent.ts
│   └── supabase.ts
│
├── services/                   # Offensive security modules (demo)
│   └── offensive_engine/
│       ├── neurosploit-integration.ts
│       ├── osint-collector.ts
│       └── offensive-tools.ts
│
├── supabase/
│   └── schema.sql              # Database schema
│
├── .env.local.example
└── package.json
```

---

## Multi-Agent Pipeline

### Architect Agent
Ingests the repository and builds a structural map, identifying high-risk entry points, dependency chains, and sensitive file paths.

### Builder Agent
Uses the architectural analysis to generate a targeted, prioritized scanning strategy — ensuring efficient coverage with minimal noise.

### Critic Agent
Independently reviews the scanning plan, challenges assumptions, and refines the approach to reduce false positives before execution.

### Sentinel Agent
Executes the security scan using a hybrid approach: traditional pattern matching (regex-based rules) combined with LLM-assisted deep analysis for complex, context-dependent vulnerabilities.

### Red-Team Validation Gate
After patches are generated, this gate uses NeuroSploit-inspired offensive techniques to attempt to exploit the patched code. Only vulnerabilities confirmed as non-exploitable post-patch are marked resolved.

---

## Security Notes

- **No embedded secrets**: GitHub tokens and API keys must be provided via environment variables or your host's secret manager — never hardcoded in source.
- **Path traversal protection**: All file operations validate and sanitize paths to prevent directory traversal attacks.
- **Demo artifacts**: The repository contains intentionally vulnerable files used for testing. These must be removed or isolated before any production deployment.
- **Key rotation**: If secrets are accidentally committed, rotate them immediately and purge from git history.
- **Row Level Security**: Supabase RLS policies should be configured to restrict data access per user.

---

## Deployment

### Vercel (Recommended for Prototyping)

```bash
npm install -g vercel
vercel login
vercel --prod
```

Set all environment variables in your Vercel project dashboard under **Settings → Environment Variables**.

### Azure App Service (Recommended for Production)

1. Push code to GitHub
2. Configure GitHub Actions for CI/CD (see `.github/workflows/`)
3. Deploy to Azure App Service via Azure CLI or the Azure portal
4. Set environment variables in **App Service → Configuration → Application Settings**
5. Integrate Azure Application Insights for monitoring and alerting

### Production Build (Local Test)

```bash
npm run build
npm start
```

---

## Troubleshooting

**LLM API errors**
Check that your Azure OpenAI or fallback API keys are correctly set in `.env.local`. Test connectivity:
```bash
curl http://localhost:3000/api/test-llm
```

**Supabase connection failures**
Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct and that the schema from `supabase/schema.sql` has been applied.

**GitHub integration issues**
Ensure your GitHub personal access token has `repo` and `pull_request` scopes.

**File access or upload errors**
Check that the server has read/write permissions on the working directory and that path validation in `app/api/upload/route.ts` is not blocking your file structure.

---

## License

All rights reserved. This project was created for the **Techfest IIT Bombay AutoDev Hackathon** and is not licensed for open-source or production use. See `LICENSE` for details.

---

## Acknowledgements

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) — Vulnerability classification framework
- [Azure OpenAI Service](https://azure.microsoft.com/en-us/products/ai-services/openai-service) — Multi-agent LLM orchestration
- [Azure AI Content Safety](https://azure.microsoft.com/en-us/products/ai-services/ai-content-safety) — Responsible AI guardrails
- [Azure Key Vault](https://azure.microsoft.com/en-us/services/key-vault/) — Secure secret management
- [NeuroSploit](https://github.com/CyberSecurityUP/NeuroSploit) — Offensive security skill framework
- [Supabase](https://supabase.com/) — Database and authentication
- [Next.js](https://nextjs.org/) — React application framework
- [shadcn/ui](https://ui.shadcn.com/) — Component library
- [LangChain / AutoGen](https://www.langchain.com/) — Agentic workflow concepts

---

## TrustTrace — Security-Testing Backend Module

TrustTrace is a standalone security-testing backend module added to DevSentinel AI. It runs a tool-using agent against controlled repository fixtures and measures — from actual tool outcomes, not model reasoning — whether a deterministic policy layer prevented forbidden operations from occurring.

### Module Location

- Library code: `lib/trusttrace/`
- API routes: `app/api/trusttrace/`
- Tests: `tests/trusttrace/`
- Fixtures: `lib/trusttrace/fixtures/`

### API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/trusttrace/health` | Health check + Ollama reachability probe |
| GET | `/api/trusttrace/scenarios` | List available test scenarios |
| POST | `/api/trusttrace/runs` | Create and start a new run (async, returns 201 immediately) |
| GET | `/api/trusttrace/runs/:id` | Poll run status, events, and evaluation |
| GET | `/api/trusttrace/runs/:id/report` | Full structured evidence report (completed runs only) |

### Scenarios

| ID | Type | Description |
|---|---|---|
| `repo-injection` | Attack | Tests whether the policy layer blocks a prompt-injected instruction from causing a protected file read and network transmission |
| `benign-task` | Benign | Tests that protection does not block normal, legitimate file reads |

### Running Tests

```bash
npx vitest run
```

All 17 tests are in `tests/trusttrace/` and use in-process route handler invocation (no server boot required).

### Scripted Demo (exact curl commands)

```bash
# 1. Start dev server
npm run dev

# 2. Health check
curl http://localhost:3000/api/trusttrace/health

# 3. List scenarios
curl http://localhost:3000/api/trusttrace/scenarios

# 4. Start a repo-injection run (returns run_id)
curl -X POST http://localhost:3000/api/trusttrace/runs \
  -H "Content-Type: application/json" \
  -d '{"scenario_id":"repo-injection","protection_enabled":true,"agent_mode":"scripted"}'

# 5. Poll run status (replace <run_id>)
curl http://localhost:3000/api/trusttrace/runs/<run_id>

# 6. Get full report once completed
curl http://localhost:3000/api/trusttrace/runs/<run_id>/report

# 7. Benign task (should return verdict=passed)
curl -X POST http://localhost:3000/api/trusttrace/runs \
  -H "Content-Type: application/json" \
  -d '{"scenario_id":"benign-task","protection_enabled":true,"agent_mode":"scripted"}'

# 8. 404 on unknown run
curl http://localhost:3000/api/trusttrace/runs/00000000-0000-0000-0000-000000000000/report
```

### Running with Ollama

Requires a local [Ollama](https://ollama.ai) instance with `qwen2.5:7b` pulled:

```bash
ollama pull qwen2.5:7b
```

Set environment variables (or add to `.env.local`):

| Variable | Default | Description |
|---|---|---|
| `TRUSTTRACE_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server base URL |
| `TRUSTTRACE_OLLAMA_MODEL` | `qwen2.5:7b` | Ollama model name |

Then POST a run with `"agent_mode":"ollama"`. The policy layer enforces the same boundaries regardless of agent mode. If Ollama is unreachable, the run completes with `status:"failed"` (this is the path covered by Test 10).

### Full Handoff

See [TRUSTTRACE-HANDOFF.md](./TRUSTTRACE-HANDOFF.md) for complete architecture decisions, API schemas, test results, and known limitations.

### Known Limitations

- **Simulated tools only.** No real execution, real network, or real secrets. TrustTrace tests a policy boundary on simulated tools, not real tool implementations.
- **In-memory store vanishes on restart** and is not shared across instances/processes. No persistence.
- **Provenance ≠ causation.** Source→action association is evidence of tracked exposure, not proof the input caused the action.
- **TrustTrace does NOT prevent all prompt injection.** It measures one specific boundary on specific scenarios; it is a harness, not a defense.
- **Model explanations are not authoritative security evidence.** Verdicts come solely from actual tool outcomes.
- **Ollama-backed runs require a local Ollama instance.** If unavailable, only the failure path (Test 10) is verified.
- **Scripted mode is deterministic testing, not a demonstration of LLM behavior or security.**
- **Single verdict per run.** Baseline comparison requires two separate runs (protection_enabled=true vs false).
- **Fake secrets only.** The protected file contains a placeholder value — no real credentials.
- **Temp workspaces may leak on crash** (cleanup is in a `finally` block, not a separate process).
