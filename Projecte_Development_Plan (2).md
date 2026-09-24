# Projecte — Comprehensive Development Plan
**AI-Enhanced Entrepreneurship Education Platform**
**Study University: Bayero University Kano (BUK)**
**Version 1.0 | May 2026**

<details>
<summary><strong>About the Creator & Researcher (Ruhullahi Muhammad)</strong> — <em>Click to expand</em></summary>

- **Creator:** Ruhullahi Muhammad
- **Academic:** PhD Student in Electronics, Bayero University Kano (BUK)
- **Ventures:** Cofounder at [atenda.ng](https://atenda.ng), [stika.ng](https://stika.ng)
- **Publications & Works:** Author, *EEP Summary*
- **Focus:** Developer of Education technology products, contextual simulation platforms, and evidence-driven entrepreneurship pedagogies for African university ecosystems.
- **Contact:** [ruhullah@atenda.ng](mailto:ruhullah@atenda.ng)

</details>

---

## Executive Summary

Projecte is an AI-powered entrepreneurship education platform delivering business simulations to university students in Nigeria. Students run contextualised Nigerian business scenarios, make structured decisions under uncertainty, and receive AI-mediated feedback — building entrepreneurial judgment through repeated, consequential experience rather than passive instruction.

The platform targets BUK as its pilot institution, deploying initially to a self-selected cohort of 25–35 students through a direct-to-student model, then transitioning to institutional integration through the Dangote Business School in a second phase. The research output from the pilot supports both academic publication and institutional sales.

---

## 1. Project Identity

| Item | Detail |
|------|--------|
| Project name | Projecte |
| Platform type | Multi-tenant SaaS — EdTech / Simulation |
| Pilot university | Bayero University Kano (BUK) |
| Pilot scenario | Zumunta Logistics |
| Target cohort size | 25–35 students (Phase 1) |
| Pilot duration | 6 weeks |
| Research output | Pre/post behavioural study for academic publication |
| Long-term model | Institutional SaaS licensing to Nigerian universities |

---

## 2. Platform Architecture

### 2.1 Technology Stack

| Layer | Technology | Hosting |
|-------|------------|---------|
| Frontend | Next.js 14 (App Router) — PWA-enabled | Vercel |
| Backend API | Django 5 + Django REST Framework | Railway |
| Database | PostgreSQL via Supabase | Supabase (managed) |
| Async queue | Celery + Redis | Railway (same instance) |
| AI engine | Google Gemini API (gemini-1.5-pro / 2.0-pro Flagship) | Google Cloud / AI Studio |
| Auth | Supabase Auth (magic link) | Supabase (managed) |
| Realtime | Supabase Realtime | Supabase (managed) |
| Storage | Supabase Storage (PDF exports) | Supabase (managed) |

### 2.2 Django Project Structure

```
projecte_backend/
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   └── celery.py
├── apps/
│   ├── accounts/          # User models, roles, auth
│   ├── cohorts/           # Cohort management, enrollment
│   ├── scenarios/         # Scenario, Round, Decision, Event models
│   ├── simulations/       # Session, WorldState, Decision tracking
│   ├── assessments/       # Survey instruments, responses, profiles
│   ├── journals/          # Post-round reflections, MCQ scoring
│   └── reporting/         # Founder's Profile, research exports
├── services/
│   ├── gemini_service.py
│   ├── world_state_engine.py
│   ├── variance_engine.py
│   ├── event_scheduler.py
│   └── behavioral_profile_service.py
├── tasks/
│   └── celery_tasks.py
└── management/
    └── commands/
        └── export_cohort_data.py
```

### 2.3 Architecture Principles

**Single codebase, multiple scenarios.** Every scenario (Zumunta, Voltage, Aunty Bisi, etc.) is a structured dataset in the database — not a separate application. The engine reads scenario data at runtime; no new code is required to add a new scenario after the engine is built.

**Async-first AI integration.** Gemini API calls never block the student UI. Every AI task (situation brief generation, character encounter responses, journal scoring, behavioural classification) is dispatched as a Celery job. Results are pushed to the frontend via Supabase Realtime when ready.

**Offline resilience.** The Next.js PWA caches the current simulation round locally. Decisions queue in IndexedDB if connectivity drops and sync on reconnect. Survey instruments are pre-loaded at cohort enrollment. This is a hard requirement for BUK deployment.

**Variance-per-instance.** Each student receives a deterministically seeded instance of their scenario — same narrative structure, different parametric values. Starting cash, competitor strength, event timing, and event severity all vary within validated bounds. Students can discuss the same scenario in debrief while their individual decision paths diverge.

---

## 3. Core Engine Specifications

### 3.1 WorldState

The WorldState is a structured Python dataclass maintained as a JSONB column in the `simulation_sessions` table. It carries all mutable variables that describe the student's business at any point in time.

**Variable categories:**

- **Financial**: cash, weekly_revenue, weekly_expenses, burn_rate (computed), debt_amount
- **Operations**: rider_count, rider_satisfaction, daily_order_capacity, orders_fulfilled, fulfillment_rate
- **Market**: customer_base, customer_satisfaction, brand_recognition
- **Relationships**: supplier_trust, competitor_threat, family_pressure, local_govt_standing
- **Unlockables**: has_whatsapp_business, has_registered_business, is_in_debt
- **Tracking**: current_round, weeks_remaining, consecutive_negative_rounds, pivot_count

**Variable labels are scenario-specific.** `rider_count` renders as "Kitchen staff" in Aunty Bisi and "Technicians" in Voltage. The underlying variable name is unchanged; the UI label is read from `scenario.variable_labels` JSON.

### 3.2 WorldStateEngine

Responsibilities: initialise state from instance parameters, apply decision impacts, run the interdependency cascade, apply event impacts.

**Cascade order** (runs after every decision and event):

1. Rider satisfaction → fulfillment rate
2. Fulfillment rate → customer satisfaction
3. Customer satisfaction → customer base (churn or organic growth)
4. Supplier trust → daily order capacity ceiling
5. Order capacity → weekly revenue ceiling
6. Competitor threat → passive customer loss
7. Cash position → family pressure adjustment
8. Unlockable bonuses (WhatsApp Business, registration)
9. Cash update for the round (revenue − expenses)
10. Consecutive negative round counter

Cascade thresholds are read from `scenario.cascade_config` JSON — not hardcoded — making the same engine work across all scenarios with different sensitivity configurations.

### 3.3 VarianceEngine

Generates a deterministic instance seed using `md5(student_id + cohort_id)`. Produces an `InstanceParameters` object that overrides base scenario values within validated bounds. A `validate_instance()` method rejects pathological combinations (e.g. maximum competitor aggression + minimum starting cash) before the session begins.

### 3.4 EventScheduler

Maps round numbers to event types for a given scenario, resolving variable-timing events against instance parameters. Fixed events fire on the same round for all students. Variable events (rainfall, social media boost) fire on a round determined by the instance seed.

### 3.5 GeminiService

All Gemini API interaction is centralised in one service class with four methods:

- `generate_situation_brief(round, state, params)` — AI narrator opens each round
- `run_character_encounter(character, state, history, message)` — AI plays characters
- `score_journal_entry(entry)` — scores post-round reflection MCQs on three rubric dimensions
- `classify_reasoning_mode(decisions)` — classifies effectual vs. causal reasoning pattern

All methods are called exclusively from Celery tasks — never synchronously from API views.

---

## 4. Simulation Design

### 4.1 Round Structure

Each round follows a fixed five-phase sequence:

1. **Situation brief** (~150 words, AI-generated, reflecting student's specific world state)
2. **Intelligence gathering** (optional — student selects up to 2 intel options; each reveals a data table or summary; choosing what to learn is itself a measured decision)
3. **Decision phase** (one strategic MCQ + one operational MCQ/checkbox; confidence rating required after each)
4. **AI character encounter** (rounds 2, 4, 6 only — free-form text interaction capped at 2 exchanges and 120 words per AI response)
5. **Consequence reveal** (deterministic state update shown immediately; AI narrative streamed via Supabase Realtime; post-round reflection MCQs)

### 4.2 Input Constraints (v1)

All student inputs are structured — MCQ radio buttons and checkboxes only. No free-text entry anywhere in v1. Rationale: assessment consistency, reduced cognitive load, simpler offline sync, and faster build.

The reasoning layer is preserved through:
- Mandatory confidence selector after every decision
- Post-round reflection MCQs (4–5 forced-choice questions probing metacognition)
- AI character encounter responses (free-form, but capped and structured by character logic)

### 4.3 Visual Data Layer

The simulation UI includes tables and charts throughout. Data visualisations are not decoration — they are decision inputs. Three recurring surfaces:

- **Business dashboard** (visible at round start): financial summary + 4-round trend line chart; relationship health gauges; operations metrics
- **Competitive intelligence table** (unlocked as intel option): side-by-side comparison of student vs. competitor metrics
- **Financial projection table** (shown in financing decisions): scenario comparison across 4 weeks under different choices

Frontend library: Recharts (React-native, already available in the artifact environment).

### 4.4 Pilot Scenario — Zumunta Logistics

**Protagonist**: Aminu, 24, BUK Business Administration graduate. Last-mile delivery business in Kano (Sabon Gari market → Nassarawa GRA and Bompai). 2 okada riders. ₦150k–220k starting cash (instance-variable). Month 6 of a 12-month family loan.

**Core tension**: Kwik, a funded tech startup, has entered the Kano last-mile delivery market with subsidised pricing.

**8-round structure**:

| Round | Title | Key event | AI encounter |
|-------|-------|-----------|--------------|
| 1 | Fuel and Fire | Fuel price increase (+₦8k/week fixed) | None |
| 2 | Kwik Arrives | Kwik expansion (first firing) | Malam Sule — supplier pressure |
| 3 | The Rains Come | Rainfall (30–50% capacity drop, instance-variable timing) | None |
| 4 | The Pressure Builds | Kwik expansion (second firing) | Fatima — angel investor |
| 5 | Signal in the Noise | BUK Instagram boost (conditional on brand recognition) | None |
| 6 | The Councillor | No state event — encounter IS the pressure | Councillor Bello — KGAVAMA |
| 7 | The Tightening | CBN policy (customer base −10%, revenue −12%) | None |
| 8 | The Final Bet | None — dashboard reckoning | None |

**Round 8 options** include a graceful wind-down as an equally valid strategic choice alongside persist, pivot, and merger — deliberately correcting the common curriculum bias that treats persistence as the only legitimate entrepreneurial outcome.

---

## 5. Assessment Framework

### 5.1 Three Measurement Layers

**Layer 1 — Declared (survey)**

Administered pre-pilot, post-pilot, and at 4-week follow-up.

Instruments:
- Entrepreneurial Self-Efficacy (ESE) Scale — 7 items, adapted for Northern Nigerian context
- Entrepreneurial Intention Questionnaire (EIQ) — 6 items, Liñán & Chen validated instrument
- Risk Perception Scale — domain-specific, family financial obligation framing
- Contextual Awareness Index — 8 items, custom, tests operating environment understanding

**Layer 2 — Behavioural (in-simulation, automatic)**

Captured silently from student decision activity. No student effort required.

| Signal | What it measures |
|--------|-----------------|
| Decision latency (ms) | Risk calibration, urgency calibration |
| Information-seeking ratio | Mental model of what matters |
| Pivot threshold | Resilience calibration |
| Resource allocation pattern | Strategic consistency |
| Confidence rating distribution | Self-awareness accuracy |
| Adversarial response quality | Communication under pressure |
| Reasoning mode classification (AI) | Effectual vs. causal thinking |

**Layer 3 — Reflective (post-round MCQs)**

4–5 forced-choice questions after each round. Scored on metacognitive quality dimensions: specificity, causal reasoning, counterfactual thinking. AI scores each response set asynchronously.

### 5.2 Normalised Performance Scoring

Raw outcome scores (e.g. final cash position) are adjusted for instance difficulty before any cross-student comparison. A student who ends round 8 solvent with starting cash of ₦150k and high competitor aggression outperformed one who ended solvent with ₦220k and low competitor aggression — raw scores do not reflect this. The `BehavioralProfileService` computes a difficulty multiplier per instance and applies it to outcome metrics.

### 5.3 Measurement Timeline

```
Week 0        Weeks 1–6           Week 6          Week 10
   │               │                  │                │
Pre-survey    Behavioural data    Post-survey     Follow-up
(Layer 1)     continuously        (Layer 1        intention
              captured            repeat +        check-in
              (Layer 2)           Layer 3
                                  summary)
```

### 5.4 Research Validity Measures

- **Control group**: BUK students in a conventional entrepreneurship lecture series complete pre/post surveys only — no simulation access
- **Inter-rater reliability**: Two independent scorers rate 20% of reflection responses; Cohen's Kappa target ≥ 0.70
- **Instrument adaptation**: Cronbach's alpha reported for each scale; target ≥ 0.75
- **Construct validity**: Factor analysis on pre-survey data to confirm ESE, EIQ, and risk perception load onto distinct factors

### 5.5 Student Output — Founder's Profile

Every student receives a one-page Founder's Profile PDF at cohort end. Content: 8-week behavioural pattern summary, dominant reasoning mode, resource allocation tendencies, self-efficacy change, and 3 personalised development observations. Generated by the reporting engine from behavioral profile data. Format: Supabase Storage PDF, download link via email. This document drives word-of-mouth and serves as a tangible pilot artefact.

---

## 6. Scenario Library Roadmap

All scenarios run on the same engine. Adding a new scenario after the engine is built requires only database content authoring — no new Python or frontend code.

### 6.1 Tier 1 — Near-Zero Engine Work (~4 days per scenario)

| Scenario | Protagonist | Sector | Key tension |
|----------|-------------|--------|-------------|
| Zumunta Logistics *(pilot)* | Aminu, Kano | Last-mile delivery | Funded competitor entry |
| Aunty Bisi's Kitchen | Bisi, Kano GRA | Food / catering | Hotel contract scale-up decision |
| Voltage | Ibrahim, Kano | Solar energy installation | Import competitor, regulatory exposure |
| Campus Connect | Hauwa, BUK | Student services platform | Two-sided market balance, NANS politics |

### 6.2 Tier 2 — Minor Engine Extensions (~1–2 days engine + 4 days content)

| Scenario | New engine concept | Sector |
|----------|--------------------|--------|
| Grains & Data | `inventory_volume`, time-sensitive asset decay | Commodity arbitrage |
| Threads | `production_backlog` → delivery delay cascade | Fashion / tailoring |
| NaijaMeds | `regulatory_compliance_score`, forced shutdown event | Pharmaceutical distribution |

### 6.3 Tier 3 — Meaningful Engine Extensions (Phase 4)

| Scenario | New engine concept | Strategic teaching |
|----------|--------------------|--------------------|
| Stack | `time_budget` non-financial resource | Freelance vs. product tension |
| Harvest Capital | `member_trust` collective variable | Cooperative management, principal-agent dynamics |

### 6.4 Build Sequence

```
Phase 1   Zumunta only — validate engine and assessment pipeline
Phase 2   Aunty Bisi + Voltage — expand to female students and STEM graduates
Phase 3   Campus Connect + Grains & Data — enable cross-scenario research
Phase 4   Stack + Harvest Capital — unlock CS and agricultural faculty markets
```

---

## 7. Development Phases

### Phase 0 — Pre-Build (2 weeks)

**Goal**: Decisions locked, environment ready, scenario script complete before a line of code is written.

| Task | Owner | Duration |
|------|-------|----------|
| Finalise WorldState variable list and cascade rules | Abu | 2 days |
| Author complete Zumunta 8-round script (all decision nodes, impact values, character briefs, event anchors) | Abu | 3 days |
| Design pre/post survey instrument (adapt ESE + EIQ to Northern Nigerian context, draft Contextual Awareness Index items) | Abu | 2 days |
| Set up Django project structure, Railway deployment, Supabase project | Abu | 1 day |
| Set up Next.js project, Vercel deployment, Supabase client | Abu | 1 day |
| Configure Celery + Redis on Railway | Abu | 0.5 day |
| Set Gemini API key, test Gemini API connection | Abu | 0.5 day |
| Seed Zumunta scenario data into database | Abu | 1 day |

**Exit criteria**: Complete scenario script signed off. All environment variables configured. Django admin shows Zumunta scenario data correctly seeded.

---

### Phase 1 — Pilot MVP (Weeks 1–4)

**Goal**: The minimum platform that makes the pilot scientifically valid. One scenario, fully instrumented, 30 students.

#### Week 1 — Data Layer and Auth

- Django models: all apps created, all tables migrated
- Supabase Auth integration — magic link flow
- Student, Cohort, Enrollment models and API endpoints
- Scenario and ScenarioRound models seeded with Zumunta data
- DecisionNode and DecisionOption models seeded
- WorldState dataclass and `from_dict` / `to_dict` methods
- VarianceEngine: seed generation, InstanceParameters, validate_instance()
- Basic Django admin for cohort management

**Deliverable**: Student can register, enroll in a cohort, and the database correctly seeds their instance parameters.

#### Week 2 — Simulation Engine

- WorldStateEngine: `initialize()`, `apply_decision()`, `cascade()`, `apply_event()`
- EventScheduler: round-to-event mapping, variable timing resolution
- SimulationSession creation API endpoint
- StudentDecision model and submission endpoint
- Decision latency capture (client sends timestamp delta)
- `process_round()` — full round pipeline returning before/after states
- GeminiService stub — returns mock narrative for now (real API integrated Week 3)
- Supabase Realtime channel setup per session

**Deliverable**: A round can be submitted via API. World state updates correctly. Before/after states stored. Mock narrative returned via Realtime.

#### Week 3 — AI Integration and Frontend Core

**Backend**:
- Celery tasks: `process_ai_consequence`, `generate_situation_brief`
- GeminiService real integration — situation brief and consequence prompts
- AICharacter model seeded with Zumunta's 3 characters
- Character encounter endpoint — 2-exchange cap, 120-word limit enforced server-side
- IntelligenceOption model and reveal endpoint
- AssessmentEvent logging — decision_made, info_requested, round_completed events

**Frontend**:
- Student auth flow (magic link → session → cohort check)
- Round page layout: dashboard panel, situation brief, intelligence phase, decision phase, consequence panel
- MCQ radio buttons and checkbox components
- Confidence selector component
- Recharts: cash trend line chart, relationship health gauges
- Competitive intelligence table component
- Supabase Realtime subscription — consequence narrative streams in
- Basic PWA setup (manifest, service worker scaffold)

**Deliverable**: A student can play one complete round end-to-end. AI narrative appears asynchronously. Charts render correctly.

#### Week 4 — Survey Engine, Reflection Layer, Hardening

**Backend**:
- SurveyInstrument model — ESE and EIQ instruments seeded
- SurveyResponse model and submission endpoint
- Pre-survey scores computed on submission and stored
- Post-round reflection MCQ model and submission endpoint
- Offline sync: background sync API, pending decision queue handler
- `BehavioralProfileService.compute_profile()` — runs after each completed session

**Frontend**:
- Pre-survey form (renders from SurveyInstrument data — not hardcoded)
- Post-round reflection MCQ UI (appears after consequence reveal)
- PWA service worker — offline decision queuing via IndexedDB
- Error states, loading states, connectivity indicator
- Full 8-round flow — round counter, weeks remaining, end state

**Deliverable**: A student can complete the full 8-round simulation including pre-survey, all decisions, AI encounters, and reflection MCQs. Behavioral profile computes correctly after session completion.

**Phase 1 exit criteria**:
- 3 internal test users complete all 8 rounds without error
- Variance confirmed (different starting states per user)
- AI narratives are contextually accurate and scenario-appropriate
- Decision latency logged correctly for all decisions
- Pre-survey scores stored and computable
- Offline test: disconnect mid-round, reconnect, confirm sync

---

### Phase 2 — Institutional Readiness (Weeks 5–10)

**Goal**: Platform ready for Dangote Business School pitch and semester-long course integration.

#### Week 5–6 — Automated Scoring and Founder's Profile

- Celery task: `score_journal_entry` — AI scores reflection MCQ sets on three rubric dimensions
- Celery task: `classify_reasoning_mode` — effectual vs. causal classification across all decisions
- Normalised performance score computation
- Founder's Profile PDF generation (Supabase Storage, download link via email)
- Post-survey form and follow-up survey scheduling (4-week delayed trigger)
- Pre/post delta computation stored explicitly in BehavioralProfile

#### Week 7–8 — Lecturer Dashboard

- Lecturer role and authentication
- Cohort overview: enrollment count, completion rate, average ESE delta
- Individual student view: behavioral profile, round-by-round decision history, confidence patterns
- Flagging: students with consecutive negative rounds (engagement alert)
- Cohort comparison charts: distribution of reasoning modes, average resource allocation
- CSV export of cohort summary (non-anonymised, for lecturer use)

#### Week 9–10 — Second and Third Scenarios

- Aunty Bisi's Kitchen — full 8-round script authored and seeded
- Voltage — full 8-round script authored and seeded
- Variable labels system validated across all three scenarios
- Cascade config overrides tested for Aunty Bisi (food quality decay) and Voltage (warranty callback rate)
- Scenario selection at cohort creation — lecturer assigns scenario to cohort

**Phase 2 exit criteria**:
- Founder's Profile PDF generated correctly for all test users
- Lecturer dashboard shows accurate cohort data
- Aunty Bisi and Voltage playable end-to-end
- Post-survey and 4-week follow-up survey flow confirmed

---

### Phase 3 — Scale Infrastructure (Weeks 11–16)

**Goal**: Multi-university deployment, research data pipeline, scenario authoring groundwork.

#### Weeks 11–12 — Multi-tenancy and Research Export

- University model — each institution is a tenant
- Cohort isolation confirmed by university_id foreign key
- Research data export management command (pandas → anonymised CSV)
- Cross-scenario behavioral comparison report (for research paper)
- Factor analysis output helper (descriptive statistics per construct)
- Anonymisation pipeline — strips all PII before export

#### Weeks 13–14 — Campus Connect and Grains & Data

- Grains & Data engine extension: `inventory_volume`, `storage_quality` decay cascade, time-sensitive asset logic
- Campus Connect: `platform_listings` and `daily_active_users` as additional world state keys
- Both scenarios authored, seeded, and playtested

#### Weeks 15–16 — Scenario Authoring Tool (Internal)

- Internal Django admin interface for scenario creation
- Decision node builder: stem, options, impact values, assessment signals
- AI character builder: name, role, personality, agenda, opening line
- Event builder: type, fixed or variable round, base impacts
- Variance bounds configuration per scenario
- Cascade config editor with live validation
- One-click scenario duplication (for creating variants)

**Note**: This tool is internal-only in Phase 3. Lecturer-facing authoring is a Phase 4 consideration after validating institutional demand.

**Phase 3 exit criteria**:
- Two universities enrolled as tenants with isolated data
- Research export produces clean anonymised CSV suitable for SPSS/R
- Six scenarios playable end-to-end
- Internal scenario authoring tool creates a new scenario without developer assistance

---

### Phase 4 — Research and Commercial Expansion (Months 5–8)

- Stack and Harvest Capital scenarios (new engine concepts)
- Lecturer-facing scenario authoring tool
- API documentation for potential third-party integrations
- Academic paper submission (target: JASBE, AJBER, or ICSB Africa track)
- Commercial pricing and invoicing infrastructure
- Onboarding flow for new university administrators

---

## 8. Database Schema Overview

### Core tables

```
universities         — tenant isolation
users                — students, lecturers, researchers, admins
cohorts              — scenario assignment, university, dates
enrollments          — user ↔ cohort membership

scenarios            — scenario master record, variable_labels, cascade_config
scenario_rounds      — 8 rounds per scenario, situation_anchor
decision_nodes       — strategic / operational / retrospective per round
decision_options     — A/B/C/D with world_state_impacts and assessment_signal
intelligence_options — available intel per round, reveal_template
ai_characters        — character per round, personality, agenda, opening_line
scenario_events      — fixed or variable-timed events, base_impacts
variance_bounds      — min/max per variable per scenario

simulation_sessions  — one per student per cohort, world_state JSONB, instance_params JSONB
student_decisions    — one per decision node per session, latency_ms, confidence
assessment_events    — raw event log: decision_made, info_requested, round_completed
behavioral_profiles  — aggregated metrics per student per cohort, updated after each session

survey_instruments   — ESE, EIQ, RiskPerception, ContextualAwareness
survey_responses     — raw_responses JSONB, computed_scores JSONB, timing (pre/post/followup)

post_round_reflections — MCQ responses per round, ai_scores JSONB
ai_encounters        — conversation history JSONB per encounter per session
```

---

## 9. Go-to-Market Plan

### 9.1 Phase 1 — Direct to Student Pilot (Months 1–3)

**Recruitment**: BUK Enterprise Development Centre, JCI BUK, past business plan competition participants, final-year students with registered businesses. Target: 25–35 self-selected students.

**Format**: Saturday morning cohort, 6 weeks, 90 minutes per session. Voluntary participation — no grade attached.

**Prof. Sagagi role**: Light introduction to Enterprise Development Centre or student entrepreneurship club. The ask is minimal and low-risk.

**What this produces**:
- Clean product-market fit signal (voluntary participation = honest signal)
- 5–8 student testimonials from BUK's own students
- Preliminary behavioral dataset
- A tested, debugged platform

### 9.2 Phase 2 — Institutional Approach (Months 3–8)

**Target**: Dangote Business School — one course lecturer, not the Dean. Pitch: "We already ran this with 30 of your students. Here's what happened."

**Pitch assets from Phase 1**:
- Student testimonials
- Pre/post ESE and EIQ delta data
- Sample Founder's Profile PDF
- Platform demo with real BUK data

**Integration model**: Platform supplements 4–6 lecture sessions per semester. Simulation performance contributes to continuous assessment scores — which immediately answers the student motivation question.

**Champion management**: Maintain relationships with at least two lecturers per department. One going on sabbatical should not collapse the institutional relationship.

### 9.3 Revenue Model

| Stream | Description | Timing |
|--------|-------------|--------|
| Institutional SaaS license | Per-student annual fee, billed to department | Phase 2 onward |
| Government / donor deployment | NITDA, TETFund, SMEDAN grant framing | Phase 3 |
| Corporate-sponsored scenario tracks | Bank or telco sponsors a sector-specific scenario track | Phase 3 |
| Bootcamp / accelerator licensing | Tony Elumelu Foundation, FATE Foundation cohort programs | Phase 4 |

---

## 10. Research Publication Plan

### 10.1 Study Design

- **Primary cohort**: 25–35 BUK students, 6-week Zumunta simulation pilot
- **Control group**: Matched BUK students in conventional entrepreneurship lectures, survey only
- **Instruments**: ESE Scale, EIQ, Risk Perception Scale, Contextual Awareness Index
- **Behavioural data**: Decision latency, information-seeking ratio, pivot threshold, resource allocation, reasoning mode
- **Timeline**: Pre, post, and 4-week follow-up measurement points

### 10.2 Target Journals and Conferences

- Journal of African Studies in Business Education (JASBE)
- African Journal of Business and Economic Research (AJBER)
- ICSB World Conference — Africa track
- ANZAM / ACERE (for international reach)

### 10.3 Paper Structure (Provisional)

1. Introduction — the gap between entrepreneurship education and entrepreneurial judgment in Nigerian universities
2. Theoretical framework — ESE, effectuation theory, experiential learning
3. Platform design — simulation architecture, variance injection, assessment pipeline
4. Methodology — sample, instruments, validity measures
5. Findings — pre/post deltas, behavioral profile patterns, qualitative observations
6. Discussion — implications for Nigerian entrepreneurship education policy
7. Limitations and future research

---

## 11. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| BUK connectivity disrupts pilot sessions | High | High | PWA offline sync, pre-load round data, test at venue before pilot |
| Voluntary cohort dropout before week 6 | Medium | High | Weekly check-ins, Founder's Profile as completion incentive, peer accountability pairing |
| Gemini API latency disrupts session flow | Medium | Medium | All AI calls async via Celery; student sees state update immediately |
| Scenario feels unrealistic to students | Medium | High | Pre-pilot walkthrough with 3–5 BUK students; iterate scenario before cohort launch |
| Lecturer champion goes on sabbatical | Low | High | Build relationships with minimum 2 lecturers per department from the start |
| Variance produces unwinnable instances | Low | High | `validate_instance()` check at session creation; playtest bounds before pilot |
| Research instrument translation issues | Medium | Medium | Pre-pilot cognitive interview with 8–10 BUK students; compute Cronbach's alpha |
| Admin approval delays institutional phase | High | Medium | Start institutional conversations in parallel with Phase 1 pilot, not after |

---

## 12. Budget Estimate

### Infrastructure (Monthly, Post-Launch)

| Item | Cost |
|------|------|
| Railway (Django + Celery + Redis) | ~$10–20/month |
| Vercel (Next.js) | Free tier sufficient for pilot |
| Supabase (PostgreSQL + Auth + Realtime + Storage) | Free tier sufficient for pilot |
| Google Gemini API (gemini-2.0-flash) | Generous free tier / ~$5–15/month at scale |
| **Total infrastructure** | **~$15–35/month** |

### Development (One-Time)

Platform is a solo build. Primary cost is time — approximately 10–14 weeks of focused development across Phases 0–2. External costs minimal; domain registration and any paid design assets are the only out-of-pocket development expenses.

### Pilot Operations

- Venue (if not on-campus): minimal
- Student communication (SMS/WhatsApp): minimal
- Printing (pre/post survey backup copies): minimal

**The pilot is economically viable on a near-zero direct budget** — the platform itself is the primary investment.

---

## 13. Success Criteria

### Phase 1 Pilot

- ≥75% cohort completion rate (≥20 of 30 students complete all 8 rounds)
- Statistically meaningful pre/post ESE delta (target: 0.4+ points on 7-point scale)
- EIQ improvement in ≥65% of participants
- Behavioral profiles computed cleanly for all completers
- Founder's Profile PDFs generated and distributed
- Zero data loss from offline sync events

### Phase 2 Institutional

- At least one Dangote Business School course formally integrates the platform
- ≥80 students complete a full semester simulation
- Lecturer satisfaction: platform is used for a second semester without re-pitching
- Research paper submitted to a peer-reviewed journal

### Platform

- Scenario engine correctly handles all 8 rounds of Zumunta with zero state corruption
- Variance confirmed across 10+ test instances (distinct starting parameters)
- Gemini API integration produces contextually accurate, Northern Nigeria-specific narratives
- All behavioral signals logged correctly and computable into behavioral profiles

---

## 14. Immediate Next Steps

1. **Lock the Zumunta scenario script** — final review of all 8 rounds, decision impact values, and character briefs
2. **Django project initialisation** — create project, configure settings for dev and production, deploy to Railway
3. **Supabase project setup** — create project, configure auth, set up Realtime channels
4. **Seed Zumunta data** — author all scenario database records and confirm they render correctly in Django admin
5. **Begin Week 1 development** — data layer and auth as specified in Phase 1 plan

---

*Projecte Development Plan v1.0 — compiled from full architecture and design sessions, May 2026*
