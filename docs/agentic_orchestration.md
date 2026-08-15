# HORUS — Agentic Orchestration

## MVP Architecture

**Version:** 0.1  
**Status:** MVP Architecture  
**Purpose:** Define the agentic workflow, responsibilities, state transitions, and orchestration rules for HORUS.

---

## 1. Objective

HORUS is designed to identify local businesses with a strong website opportunity, evaluate whether they are worth pursuing, generate a tailored website, verify the result, and prepare personalized outreach.

The MVP should demonstrate one core capability:

> **HORUS can discover a business opportunity and move it through the entire workflow with minimal human intervention.**

The goal is not to maximize the number of agents. The goal is to create a reliable autonomous workflow.

---

## 2. MVP Agent Architecture

The MVP uses:

- **1 Orchestrator**
- **5 specialized agents**

```text
                         HORUS
                           │
                    ORCHESTRATOR
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   DISCOVERY          QUALIFICATION        WEBSITE
     AGENT                AGENT              AGENT
        │                  │                  │
        └──────────────────┼──────────────────┘
                           ▼
                        QA AGENT
                           │
                           ▼
                     OUTREACH AGENT
```

The Orchestrator is the control layer. It is not counted as a specialized worker agent.

---

# 3. Orchestrator

## Responsibility

The Orchestrator controls the entire workflow.

It should:

- Create and manage workflow runs.
- Dispatch tasks to agents.
- Validate agent outputs.
- Persist state.
- Decide the next workflow step.
- Handle failures and retries.
- Prevent unnecessary agent execution.
- Enforce scoring thresholds.
- Stop or pause workflows when human approval is required.

The Orchestrator should **not** perform specialized business logic that belongs to an agent.

---

## 4. Agent 01 — Discovery Agent

### Objective

Find potential local business opportunities.

### Responsibilities

Collect publicly available business information such as:

- Business name
- Business category
- Location
- Website
- Phone number
- Public contact information
- Review count
- Review rating
- Online presence
- Other useful business signals

### Output

The Discovery Agent creates a preliminary lead record.

Example:

```json
{
  "business_name": "Example Business",
  "category": "Physical Therapy",
  "location": "Stamford, CT",
  "website": "https://example.com",
  "phone": "...",
  "email": "...",
  "review_count": 127,
  "rating": 4.7,
  "discovered_at": "2026-08-11T00:00:00Z"
}
```

### State

```text
DISCOVERED
```

---

# 5. Agent 02 — Qualification Agent

## Objective

Determine whether a discovered business represents a worthwhile opportunity.

This is one of the most important agents in the MVP.

### Evaluation Criteria

The agent may evaluate:

- Website existence
- Website quality
- Mobile experience
- Visual quality
- Content quality
- Technical problems
- Age/outdated signals
- Business reputation
- Review volume
- Business activity
- Online presence
- Potential commercial value
- Likelihood of needing a new website

### Opportunity Score

The agent produces a normalized score:

```text
Opportunity Score: 0–100
```

Example:

```json
{
  "opportunity_score": 87,
  "qualified": true,
  "reasons": [
    "Website has poor mobile UX",
    "Business has strong review reputation",
    "Website content appears outdated",
    "Clear opportunity for improved conversion"
  ]
}
```

### Decision

```text
Score >= threshold
        │
        ▼
    QUALIFIED

Score < threshold
        │
        ▼
     REJECTED
```

The threshold should be configurable rather than hard-coded.

### States

```text
QUALIFIED
REJECTED
```

Rejected leads should not continue into website generation.

---

# 6. Agent 03 — Website Agent

## Objective

Generate a website or website preview specifically tailored to the qualified business.

### Workflow

The Website Agent can internally execute multiple steps without requiring separate agents.

```text
Research
   ↓
Strategy
   ↓
Content
   ↓
Design
   ↓
Implementation
   ↓
Deployment / Preview
```

### Important Design Principle

Do **not** split every website task into a separate agent during the MVP.

Avoid unnecessary architecture such as:

```text
Research Agent
Design Agent
Content Agent
Builder Agent
```

Instead, keep these as internal stages of the Website Agent.

### Input

The Website Agent receives:

- Business profile
- Qualification score
- Qualification reasons
- Existing website information
- Business category
- Location
- Relevant public business information

### Output

A website preview/deployment and metadata describing the generated result.

Example:

```json
{
  "preview_url": "...",
  "business_name": "Example Business",
  "generation_status": "completed",
  "version": 1
}
```

### State

```text
WEBSITE_GENERATED
```

---

# 7. Agent 04 — QA Agent

## Objective

Evaluate the generated website before it reaches the outreach stage.

The QA Agent should act as an independent evaluator rather than assuming the Website Agent succeeded.

### Evaluation Areas

```text
Visual Quality
Business Specificity
Content Quality
Mobile UX
CTA Quality
Conversion Potential
Technical Quality
Consistency
```

### Result

The QA Agent returns:

```text
PASS
```

or

```text
FAIL
```

with actionable feedback.

Example:

```json
{
  "status": "FAIL",
  "issues": [
    "Hero CTA is not sufficiently prominent",
    "Mobile spacing is inconsistent",
    "Business-specific content is too generic"
  ],
  "severity": "medium"
}
```

### Correction Loop

If QA fails:

```text
QA FAIL
   ↓
Feedback
   ↓
Website Agent
   ↓
New Website Version
   ↓
QA
```

The MVP should limit correction cycles.

Recommended:

```text
MAX_QA_RETRIES = 2
```

If the website still fails after the maximum retries, the workflow should stop and flag the lead for review.

### States

```text
QA_FAILED
QA_PASSED
```

---

# 8. Agent 05 — Outreach Agent

## Objective

Prepare personalized outreach for qualified businesses with a successfully generated website.

### Inputs

The Outreach Agent can use:

- Business name
- Business category
- Website problems discovered
- Opportunity score
- Business strengths
- Generated website URL
- Public contact information
- Qualification reasoning

### Output

The agent generates personalized outreach.

Example:

```json
{
  "subject": "...",
  "body": "...",
  "recipient": "...",
  "preview_url": "...",
  "status": "ready"
}
```

### MVP Safety Model

The initial MVP should use:

```text
HORUS
  ↓
Generate Outreach
  ↓
Human Approval
  ↓
Send
```

Automatic sending can be added later.

### State

```text
OUTREACH_READY
```

---

# 9. Lead State Machine

The lead lifecycle should be explicit.

```text
DISCOVERED
    │
    ▼
QUALIFYING
    │
    ├──────────────► REJECTED
    │
    ▼
QUALIFIED
    │
    ▼
WEBSITE_GENERATING
    │
    ▼
WEBSITE_GENERATED
    │
    ▼
QA
   /   /   FAIL   PASS
 │       │
 ▼       ▼
FIX    QA_PASSED
 │       │
 └──►────┘
         │
         ▼
   OUTREACH_READY
         │
         ▼
      APPROVED
         │
         ▼
       SENT
```

---

# 10. Recommended Lead Statuses

Use explicit states rather than relying on implicit conditions.

```text
DISCOVERED
QUALIFYING
REJECTED
QUALIFIED
WEBSITE_GENERATING
WEBSITE_GENERATED
QA_IN_PROGRESS
QA_FAILED
QA_PASSED
OUTREACH_READY
APPROVED
SENT
FAILED
```

---

# 11. Orchestration Rules

## Rule 1 — Do not generate websites for unqualified leads

```text
IF opportunity_score < threshold
THEN reject lead
```

This prevents unnecessary LLM and infrastructure costs.

---

## Rule 2 — QA must be independent

The QA Agent should not simply trust the Website Agent's output.

It must evaluate the actual generated result.

---

## Rule 3 — Limit retries

Every agent should have bounded retries.

Example:

```text
MAX_AGENT_RETRIES = 2
MAX_QA_RETRIES = 2
```

The exact values should remain configurable.

---

## Rule 4 — Persist state after every major step

The system should be able to recover from:

- API failures
- Network failures
- Process crashes
- Rate limits
- Partial website generation
- Deployment failures

A workflow should resume from the last successful state instead of restarting from the beginning.

---

# 12. Cost Control

LLM calls should be concentrated where they provide the most value.

Recommended flow:

```text
Discovery
   ↓
Cheap/fast filtering
   ↓
Qualification
   ↓
Only qualified leads
   ↓
Website generation
   ↓
QA
   ↓
Outreach
```

Do not run expensive website generation against every discovered business.

The Qualification Agent acts as the main cost-control gate.

---

# 13. Human-in-the-Loop

The MVP should minimize human intervention without removing it completely.

Recommended approval point:

```text
Discovery
    ↓
Qualification
    ↓
Website
    ↓
QA
    ↓
Outreach Draft
    ↓
──── HUMAN APPROVAL ────
    ↓
Send
```

This provides a safer path while validating the core autonomous workflow.

---

# 14. Failure Handling

Every agent should return structured results.

Example:

```json
{
  "success": false,
  "error": {
    "type": "API_ERROR",
    "message": "Provider request failed",
    "retryable": true
  }
}
```

The Orchestrator decides whether to:

1. Retry
2. Skip
3. Roll back
4. Pause
5. Mark the workflow as failed

Agents should not independently control the global workflow.

---

# 15. Agent Communication

Agents should communicate through structured data rather than long natural-language conversations.

Preferred:

```json
{
  "lead_id": "lead_123",
  "status": "QUALIFIED",
  "opportunity_score": 87,
  "next_action": "GENERATE_WEBSITE"
}
```

Avoid:

```text
"I looked at the website and I think this is probably
a good candidate because..."
```

Natural-language reasoning can be stored for inspection, but machine-readable fields should drive orchestration.

---

# 16. Suggested MVP Workflow

The complete MVP workflow should be:

```text
1. Discovery Agent
       ↓
2. Qualification Agent
       ↓
3. Opportunity Score
       ↓
4. Website Agent
       ↓
5. QA Agent
       ↓
6. Correction Loop (if necessary)
       ↓
7. Outreach Agent
       ↓
8. Human Approval
       ↓
9. Send
```

---

# 17. What NOT to Build in the MVP

Avoid adding unnecessary agents or infrastructure before the core workflow works.

Do not initially build:

- Separate research agent
- Separate design agent
- Separate content agent
- Separate SEO agent
- Separate email agent + follow-up agent
- Separate phone agent
- Complex multi-agent conversations
- Autonomous sales negotiation
- Large-scale campaign management
- Advanced long-term memory system

These can be added after the core pipeline is reliable.

---

# 18. MVP Success Criteria

HORUS should be considered successful when it can:

```text
Discover a real business
        ↓
Correctly identify an opportunity
        ↓
Generate a business-specific website
        ↓
Evaluate its own output
        ↓
Correct major problems
        ↓
Produce personalized outreach
```

with minimal human intervention.

The key metric is not:

> "How many agents does HORUS have?"

The key metric is:

> **"How much human work does HORUS eliminate between finding a business and producing a credible sales opportunity?"**

---

# 19. Future Expansion

Once the MVP is stable, the architecture can expand.

Potential future agents:

```text
Research Agent
SEO Agent
Performance Agent
Follow-Up Agent
CRM Agent
Sales Agent
Analytics Agent
Lead Enrichment Agent
Phone/Voice Agent
```

These should only be introduced when they solve a demonstrated bottleneck.

---

# 20. Final Architecture

```text
                         ┌───────────────┐
                         │     HORUS     │
                         │ ORCHESTRATOR  │
                         └───────┬───────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
                 ▼               ▼               ▼
           ┌───────────┐   ┌────────────┐  ┌───────────┐
           │DISCOVERY  │   │QUALIFICATION│  │  WEBSITE  │
           │   AGENT   │   │    AGENT   │  │   AGENT   │
           └───────────┘   └────────────┘  └─────┬─────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  QA AGENT   │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  OUTREACH   │
                                          │    AGENT    │
                                          └──────┬──────┘
                                                 │
                                                 ▼
                                           HUMAN APPROVAL
                                                 │
                                                 ▼
                                               SEND
```

**Architecture principle:**

> Keep the number of agents small, keep responsibilities clear, and let the Orchestrator control the workflow.
