# Rollout Strategy: Cohort-Based Evaluation Engine Deployment

**Document Version:** 1.0.0  
**Date:** March 2026  
**Status:** Active

---

## Table of Contents

1. [Overview](#1-overview)
2. [Rollout Phases](#2-rollout-phases)
3. [Cohort Assignment Strategy](#3-cohort-assignment-strategy)
4. [Configuration Examples](#4-configuration-examples)
5. [Success Metrics and KPIs](#5-success-metrics-and-kpis)
6. [Monitoring Checklist](#6-monitoring-checklist)
7. [Rollback Procedure](#7-rollback-procedure)
8. [Criteria for Phase Progression](#8-criteria-for-phase-progression)
9. [Criteria for Rollback](#9-criteria-for-rollback)
10. [Risk Assessment and Mitigation](#10-risk-assessment-and-mitigation)
11. [Communication Plan](#11-communication-plan)
12. [Timeline](#12-timeline)
13. [Post-Rollout Review Checklist](#13-post-rollout-review-checklist)

---

## 1. Overview

This document describes the gradual cohort-based rollout strategy for the new LLM-based Evaluation Engine (`LessonEvaluatorUseCase`) in Pixel Mentor. The rollout follows a phased approach starting with internal testers (alpha), expanding to a controlled beta group, and eventually reaching full production deployment.

### Current State

- **Legacy Engine**: `GeminiComprehensionEvaluatorAdapter` — keyword-based evaluation with basic fallback
- **New Engine**: `LessonEvaluatorUseCase` — LLM-based rubric evaluation with semantic understanding
- **Feature Flag Service**: `FeatureFlagService` in `apps/api/src/config/evaluation-flags.ts`

### Rollout Objective

Deploy the new evaluation engine with minimal risk by:

- Controlling user exposure through cohort-based routing
- Monitoring quality metrics before full rollout
- Maintaining rollback capability at each phase
- Ensuring zero disruption to student learning experience

---

## 2. Rollout Phases

### Phase 1: Alpha (Internal Testing)

| Attribute           | Value                                |
| ------------------- | ------------------------------------ |
| **Duration**        | 2 weeks                              |
| **Start Date**      | Day 1 of rollout                     |
| **User Percentage** | ~10% of users                        |
| **Cohort Name**     | `alpha-10`                           |
| **Target Users**    | Internal team members, test accounts |
| **Evaluator Type**  | `llm`                                |

**Objectives:**

- Validate technical integration
- Test cohort routing logic
- Verify feature flag service
- Baseline metrics collection

### Phase 2: Beta (Controlled Rollout)

| Attribute           | Value                                |
| ------------------- | ------------------------------------ |
| **Duration**        | 2-4 weeks                            |
| **Start Date**      | After alpha criteria met             |
| **User Percentage** | ~50% of users                        |
| **Cohort Name**     | `beta-50`                            |
| **Target Users**    | Selected pilot users, early adopters |
| **Evaluator Type**  | `llm`                                |

**Objectives:**

- Validate with real students
- Collect feedback on evaluation quality
- Compare with legacy engine metrics
- Stress test under production load

### Phase 3: Full Rollout (100%)

| Attribute           | Value                   |
| ------------------- | ----------------------- |
| **Duration**        | Ongoing                 |
| **Start Date**      | After beta criteria met |
| **User Percentage** | 100%                    |
| **Cohort Name**     | `default`               |
| **Target Users**    | All users               |
| **Evaluator Type**  | `llm`                   |

**Objectives:**

- Complete migration
- Decommission legacy engine
- Establish ongoing monitoring

---

## 3. Cohort Assignment Strategy

### 3.1 Assignment Methods

#### Option A: Random Assignment (Recommended for Phases 1-2)

Use the student's `id` hash for deterministic but pseudo-random assignment:

```typescript
function assignCohortByHash(userId: string, cohortPercentages: Record<string, number>): string {
  // Simple hash-based assignment
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bucket = hash % 100;

  let cumulative = 0;
  for (const [cohort, percentage] of Object.entries(cohortPercentages)) {
    cumulative += percentage;
    if (bucket < cumulative) {
      return cohort;
    }
  }
  return 'default';
}

// Usage
const cohort = assignCohortByHash(studentId, {
  'alpha-10': 10,
  'beta-50': 50,
  // remaining 40% goes to 'default' (legacy)
});
```

#### Option B: Admin Assignment (For Specific Testing)

Update the `cohort` field directly in the database:

```sql
-- Assign specific users to alpha cohort
UPDATE users SET cohort = 'alpha-10' WHERE id IN ('uuid1', 'uuid2');

-- Assign pilot users to beta cohort
UPDATE users SET cohort = 'beta-50' WHERE email LIKE '%@pixelmentor.edu%';
```

#### Option C: A/B Testing Framework Integration

For production A/B testing, integrate with an external service:

```typescript
interface ABTestConfig {
  experimentId: string;
  variations: {
    name: string;
    weight: number; // 0-100
  }[];
}

// Example: LaunchDarkly or Optimizely integration
async function getCohortFromABTest(userId: string, config: ABTestConfig): Promise<string> {
  const client = await getABTestClient();
  const variation = await client.variation(config.experimentId, userId, 'control');
  return variation;
}
```

### 3.2 Student ID Mapping (Current Implementation)

The system currently reads the `cohort` field from the `User` model:

```typescript
// From orchestrate-recipe.use-case.ts
private async getStudentCohort(studentId?: string): Promise<string> {
  if (!studentId) {
    return USER_DEFAULT_COHORT; // 'default'
  }
  const student = await this.userRepo.findById(studentId);
  return student?.cohort ?? USER_DEFAULT_COHORT;
}
```

**Database Schema** (`prisma/schema.prisma`):

```prisma
model User {
  // ...
  cohort String @default("default") @db.VarChar(100)
  // ...
}
```

### 3.3 Cohort Assignment by Phase

| Phase | Method              | Description                                  |
| ----- | ------------------- | -------------------------------------------- |
| Alpha | Admin Assignment    | Manually assign internal team accounts       |
| Beta  | Random Hash + Admin | 50% random assignment + specific pilot users |
| Full  | All Users           | Set `default` cohort to use new engine       |

---

## 4. Configuration Examples

### 4.1 Alpha Phase Configuration (10%)

**Environment Variable:**

```bash
EVALUATION_FLAGS='{
  "useNewEvaluatorEngine": false,
  "cohorts": {
    "alpha-10": {
      "evaluatorType": "llm",
      "parameters": {
        "modelName": "gpt-4o-mini",
        "timeoutMs": 15000,
        "detailedScoring": true
      },
      "useTemplateEngine": false,
      "autoExtractKeywords": true
    }
  }
}'
```

**Config File** (`config/evaluation-flags.json`):

```json
{
  "useNewEvaluatorEngine": false,
  "cohorts": {
    "alpha-10": {
      "evaluatorType": "llm",
      "parameters": {
        "modelName": "gpt-4o-mini",
        "timeoutMs": 15000,
        "detailedScoring": true
      },
      "useTemplateEngine": false,
      "autoExtractKeywords": true
    }
  },
  "templateEngine": {
    "allowConditionals": false,
    "maxDepth": 5
  },
  "keywordExtraction": {
    "enabled": true,
    "domain": {
      "minLength": 3,
      "maxKeywords": 20,
      "useTfIdf": false
    }
  }
}
```

### 4.2 Beta Phase Configuration (50%)

**Environment Variable:**

```bash
EVALUATION_FLAGS='{
  "useNewEvaluatorEngine": false,
  "cohorts": {
    "alpha-10": {
      "evaluatorType": "llm",
      "parameters": {
        "modelName": "gpt-4o-mini",
        "timeoutMs": 15000,
        "detailedScoring": true
      }
    },
    "beta-50": {
      "evaluatorType": "llm",
      "parameters": {
        "modelName": "gpt-4o",
        "timeoutMs": 10000,
        "detailedScoring": true
      },
      "useTemplateEngine": false,
      "autoExtractKeywords": true
    }
  }
}'
```

### 4.3 Full Rollout Configuration (100%)

**Environment Variable:**

```bash
EVALUATION_FLAGS='{
  "useNewEvaluatorEngine": true,
  "cohorts": {
    "alpha-10": {
      "evaluatorType": "llm",
      "parameters": {
        "modelName": "gpt-4o"
      }
    },
    "beta-50": {
      "evaluatorType": "llm",
      "parameters": {
        "modelName": "gpt-4o"
      }
    }
  }
}'
```

**Or simpler for full rollout:**

```bash
USE_NEW_EVALUATOR_ENGINE=true
```

### 4.4 Rollback Configuration

**Revert to Legacy Engine:**

```bash
# Option 1: Disable globally
USE_NEW_EVALUATOR_ENGINE=false

# Option 2: Remove cohort configs
EVALUATION_FLAGS='{"useNewEvaluatorEngine": false, "cohorts": {}}'

# Option 3: Set default cohort to legacy
EVALUATION_FLAGS='{
  "useNewEvaluatorEngine": false,
  "cohorts": {
    "default": {
      "evaluatorType": "keyword"
    }
  }
}'
```

---

## 5. Success Metrics and KPIs

### 5.1 Primary Metrics

| Metric                      | Description                                 | Target | Threshold |
| --------------------------- | ------------------------------------------- | ------ | --------- |
| **Evaluation Accuracy**     | % of evaluations matching expert assessment | > 85%  | > 80%     |
| **Response Latency**        | Average time to return evaluation           | < 3s   | < 5s      |
| **Error Rate**              | % of evaluations failing with fallback      | < 2%   | < 5%      |
| **Student Completion Rate** | % of activities completed                   | > 70%  | > 60%     |
| **Positive Feedback Rate**  | % of positive student feedback              | > 75%  | > 65%     |

### 5.2 Cohort-Specific Metrics

| Metric                        | Alpha Target        | Beta Target        |
| ----------------------------- | ------------------- | ------------------ |
| **New Engine Usage**          | 100% of alpha users | 100% of beta users |
| **Fallback Rate**             | < 1%                | < 2%               |
| **Average Latency (P95)**     | < 5s                | < 4s               |
| **Schema Validation Success** | > 99%               | > 99.5%            |
| **Prompt Injection Blocked**  | 100%                | 100%               |

### 5.3 Comparison Metrics (New vs Legacy)

| Metric                     | New Engine | Legacy Engine | Delta Target       |
| -------------------------- | ---------- | ------------- | ------------------ |
| **Evaluation Correctness** | Track      | Track         | +5% improvement    |
| **Feedback Quality Score** | Track      | Track         | +10% improvement   |
| **Average Latency**        | Track      | Track         | Within 2x baseline |
| **Retry Rate**             | Track      | Track         | Similar or better  |

### 5.4 Data Collection

Metrics are automatically collected via `EvaluationMetricsCollector`:

```typescript
// From eval-metrics.ts
interface EvaluationMetricsSnapshot {
  engines: Record<EngineType, MetricCounter>;
  outcomes: Record<EvaluationOutcome, MetricCounter>;
  latencies: MetricHistogram;
  errors: Record<EvaluationErrorType, MetricCounter>;
  cohorts: Record<string, MetricCounter>;
  requestId: string;
  timestamp: number;
}
```

**Log Output Format:**

```
[EVAL ENGINE: new] cohort=beta-50 requestId=abc-123
[EVAL COMPLETE] engine=new outcome=correct latency=2340ms cohort=beta-50 requestId=abc-123
[EVAL ERROR] engine=new error=llm_error latency=5000ms cohort=alpha-10 requestId=def-456
```

---

## 6. Monitoring Checklist

### 6.1 Logs to Watch

#### Application Logs (stdout/stderr)

```bash
# Filter for evaluation engine logs
grep -E '\[EVAL (ENGINE|COMPLETE|ERROR)\]' app.log

# Monitor error frequency
grep '\[EVAL ERROR\]' app.log | awk '{print $5}' | sort | uniq -c

# Check latency distribution
grep '\[EVAL COMPLETE\]' app.log | grep -oP 'latency=\d+' | cut -d= -f2 | histogram
```

**Key Log Patterns:**

| Pattern              | Meaning                          | Action                 |
| -------------------- | -------------------------------- | ---------------------- |
| `[EVAL ENGINE: new]` | New engine activated for request | Info only              |
| `[EVAL COMPLETE]`    | Successful evaluation            | Info only              |
| `[EVAL ERROR]`       | Evaluation failed                | Investigate error type |
| `cohort=alpha-10`    | Alpha cohort user                | Expected during alpha  |
| `latency=XXXXms`     | Response time                    | Alert if > 10s         |

#### Error Log Patterns

```bash
# Track error types
[EVAL ERROR] error=llm_error        # LLM provider issue
[EVAL ERROR] error=timeout_error    # Request timeout
[EVAL ERROR] error=validation_error # Schema validation failed
[EVAL ERROR] error=network_error   # Network connectivity
```

### 6.2 Metrics Dashboards

#### Prometheus/Grafana Metrics

If using Prometheus metrics endpoint (`/metrics`):

```promql
# Evaluation rate by engine
rate(evaluation_total{engine="new"}[5m])

# Latency histogram
histogram_quantile(0.95, rate(evaluation_latency_seconds_bucket{engine="new"}[5m]))

# Error rate
rate(evaluation_errors_total{engine="new"}[5m])

# Cohort distribution
evaluation_total{cohort=~".+"}
```

#### Custom Dashboard Panels

Create a Grafana dashboard with these panels:

1. **Evaluation Volume by Engine**
   - Query: `sum by (engine) (rate(evaluation_total[5m]))`

2. **Latency Distribution (P50, P95, P99)**
   - Query: `histogram_quantile(0.95, rate(evaluation_latency_seconds_bucket[5m]))`

3. **Error Rate by Type**
   - Query: `sum by (error_type) (rate(evaluation_errors_total[5m]))`

4. **Cohort Distribution**
   - Query: `sum by (cohort) (evaluation_total)`

5. **Outcome Distribution**
   - Query: `sum by (outcome) (rate(evaluation_outcome_total[5m]))`

### 6.3 Alerts to Configure

| Alert                      | Condition                       | Severity | Action                   |
| -------------------------- | ------------------------------- | -------- | ------------------------ |
| **High Error Rate**        | Error rate > 5% over 5 min      | Critical | Page on-call             |
| **High Latency**           | P95 latency > 10s over 5 min    | Warning  | Investigate              |
| **New Engine Down**        | New engine 0% success for 2 min | Critical | Rollback                 |
| **Fallback Storm**         | Fallback rate > 10%             | Warning  | Investigate LLM provider |
| **Cohort Routing Failure** | Undefined cohort > 1%           | Warning  | Check cohort config      |

### 6.4 Database Monitoring

```sql
-- Check cohort distribution
SELECT cohort, COUNT(*) FROM users GROUP BY cohort;

-- Monitor evaluation activity
SELECT
  DATE(created_at) as date,
  COUNT(*) as evaluations,
  AVG(latency_ms) as avg_latency
FROM evaluation_logs
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Track fallback usage
SELECT
  cohort,
  COUNT(*) FILTER (WHERE used_fallback = true) as fallbacks,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE used_fallback = true) / COUNT(*), 2) as fallback_rate
FROM evaluation_logs
GROUP BY cohort;
```

### 6.5 Health Check Endpoint

Access the evaluation health check:

```bash
curl http://localhost:3001/health | jq '.evaluation'
```

**Expected Response:**

```json
{
  "healthy": true,
  "engineActive": true,
  "useNewEngine": true,
  "configuredCohorts": ["alpha-10", "beta-50"],
  "warnings": []
}
```

---

## 7. Rollback Procedure

### 7.1 Immediate Rollback (Emergency)

**Step 1: Disable new engine globally**

```bash
# Option A: Environment variable
export USE_NEW_EVALUATOR_ENGINE=false

# Option B: Empty cohorts
export EVALUATION_FLAGS='{"useNewEvaluatorEngine": false, "cohorts": {}}'

# Option C: Force legacy via file
# Edit config/evaluation-flags.json to remove cohort configs
```

**Step 2: Restart service**

```bash
# Kubernetes
kubectl rollout restart deployment/api

# Docker Compose
docker-compose restart api

# PM2
pm2 restart api
```

**Step 3: Verify rollback**

```bash
# Check logs - should show [EVAL ENGINE: old]
tail -f app.log | grep '\[EVAL ENGINE'

# Check health endpoint
curl http://localhost:3001/health | jq '.evaluation'
```

### 7.2 Gradual Rollback (Planned)

**Step 1: Reduce cohort percentages**

Move users back to legacy in batches:

```bash
# Remove beta-50 cohort
EVALUATION_FLAGS='{
  "useNewEvaluatorEngine": false,
  "cohorts": {
    "alpha-10": {
      "evaluatorType": "llm",
      "parameters": {"modelName": "gpt-4o-mini"}
    }
  }
}'
```

**Step 2: Monitor for 1 hour**

- Check error rates
- Verify user feedback
- Monitor latency

**Step 3: Complete rollback**

```bash
# Remove all cohort configs
EVALUATION_FLAGS='{"useNewEvaluatorEngine": false, "cohorts": {}}'
```

### 7.3 Rollback Verification Checklist

- [ ] Health check shows `engineActive: false`
- [ ] Logs show `[EVAL ENGINE: old]` for all requests
- [ ] Error rates return to baseline
- [ ] Latency returns to baseline
- [ ] No student-facing impact reported
- [ ] Stakeholders notified

---

## 8. Criteria for Phase Progression

### 8.1 Alpha to Beta Criteria

All must be met before proceeding to Beta:

| Criterion                     | Threshold        | Measurement Period |
| ----------------------------- | ---------------- | ------------------ |
| **Error Rate**                | < 2%             | 7 days             |
| **P95 Latency**               | < 5s             | 7 days             |
| **Schema Validation Success** | > 99%            | 7 days             |
| **No Critical Bugs**          | 0 critical bugs  | 7 days             |
| **Code Review Approved**      | All PRs merged   | Day 14             |
| **Documentation Complete**    | All docs updated | Day 14             |

### 8.2 Beta to Full Rollout Criteria

All must be met before proceeding to Full Rollout:

| Criterion                  | Threshold             | Measurement Period |
| -------------------------- | --------------------- | ------------------ |
| **Error Rate**             | < 1%                  | 14 days            |
| **P95 Latency**            | < 3s                  | 14 days            |
| **Evaluation Accuracy**    | > 85% vs expert       | 14 days            |
| **Student Feedback Score** | > 4/5                 | 14 days            |
| **No Critical/High Bugs**  | 0 critical, 0 high    | 14 days            |
| **Latency Delta**          | Within 2x legacy      | 14 days            |
| **Load Test Passed**       | 1000 concurrent users | Pre-launch         |

### 8.3 Decision Matrix

```
Alpha → Beta:  [x] Error OK + [x] Latency OK + [x] No bugs + [x] Docs done
Beta → Full:   [x] Error OK + [x] Latency OK + [x] Accuracy OK + [x] Feedback OK + [x] Load OK
Any → Rollback: [ ] Error > 10% OR [ ] P95 Latency > 15s OR [ ] Critical bug
```

---

## 9. Criteria for Rollback

### 9.1 Automatic Triggers (Immediate Rollback)

| Metric                | Threshold             | Action         |
| --------------------- | --------------------- | -------------- |
| **Error Rate**        | > 10% sustained 5 min | Auto-rollback  |
| **P99 Latency**       | > 30s sustained 5 min | Auto-rollback  |
| **LLM Provider Down** | 0% success for 2 min  | Auto-rollback  |
| **Data Corruption**   | Invalid data returned | Immediate stop |

### 9.2 Manual Triggers (Decide within 1 hour)

| Metric                         | Threshold              | Action                  |
| ------------------------------ | ---------------------- | ----------------------- |
| **Error Rate**                 | > 5% sustained 30 min  | Manual rollback         |
| **P95 Latency**                | > 10s sustained 30 min | Manual rollback         |
| **Student Complaints**         | > 10 in 1 hour         | Investigate then decide |
| **Schema Validation Failures** | > 3%                   | Investigate             |

### 9.3 Rollback Decision Tree

```
Is error rate > 10%?
├── YES → Immediate rollback
└── NO → Continue monitoring
    Is P95 latency > 10s?
    ├── YES → Investigate (15 min timeout)
    │   └── Still > 10s → Rollback
    └── NO → Continue monitoring
        Any critical bug discovered?
        ├── YES → Immediate rollback
        └── NO → Continue
```

---

## 10. Risk Assessment and Mitigation

### 10.1 Risk Matrix

| Risk                           | Probability | Impact   | Risk Level | Mitigation                                |
| ------------------------------ | ----------- | -------- | ---------- | ----------------------------------------- |
| LLM Provider Outage            | Medium      | High     | **HIGH**   | Graceful fallback to legacy engine        |
| Prompt Injection Attack        | Low         | Critical | **MEDIUM** | SafePromptBuilder with delimiter escaping |
| Unexpected Latency Spike       | Medium      | Medium   | **MEDIUM** | Timeout (10s) + fallback + monitoring     |
| Evaluation Quality Degradation | Low         | High     | **MEDIUM** | Accuracy monitoring + human review        |
| Schema Validation Failure      | Low         | Medium   | **LOW**    | Retry logic + fallback                    |
| Cohort Routing Bug             | Low         | High     | **MEDIUM** | Cohort validation in staging              |
| Database Connection Issues     | Low         | High     | **MEDIUM** | Connection pooling + retry                |

### 10.2 Specific Mitigations

#### LLM Provider Outage

**Risk**: LLM API (OpenAI/Gemini) becomes unavailable.

**Mitigation**:

```typescript
// From orchestrator-recipe.use-case.ts
private async evaluateAnswer(params): Promise<ComprehensionEvaluation> {
  try {
    // ... evaluation logic
  } catch (error) {
    // Return graceful fallback
    return {
      result: 'incorrect',
      confidence: 0,
      hint: params.script.hint,
      shouldEscalate: false,
    };
  }
}
```

**Fallback Response**:

```json
{
  "result": "incorrect",
  "feedback": "¡Sigue intentando! Cada respuesta es una oportunidad de aprendizaje.",
  "confidence": 0,
  "hint": "... existing hint from activity"
}
```

#### Prompt Injection

**Risk**: Malicious user input attempts to manipulate LLM behavior.

**Mitigation**:

```typescript
// From safe-prompt-builder.ts
const safePrompt = buildSafePrompt('Student said: {{answer}}. Question: {{question}}', {
  answer: userInput, // Automatically escaped
  question: teacherQuestion,
});
// Result: Student said: <student_input>malicious</student_input>
```

#### Latency Variability

**Risk**: LLM responses are slower than keyword matching.

**Mitigation**:

- Timeout: 10 seconds (configurable per cohort)
- Retry with exponential backoff
- Graceful fallback on timeout
- Monitoring dashboard for latency trends

### 10.3 Contingency Plans

| Scenario          | Contingency Action                 |
| ----------------- | ---------------------------------- |
| LLM provider down | Fallback to keyword evaluator      |
| Quality issues    | Increase human review sampling     |
| Latency spike     | Scale horizontally, enable caching |
| Security incident | Disable LLM, audit logs            |
| Data issue        | Pause rollout, investigate         |

---

## 11. Communication Plan

### 11.1 Internal Stakeholders

| Stakeholder      | Role              | Notification Method | Timing            |
| ---------------- | ----------------- | ------------------- | ----------------- |
| Engineering Team | Implementation    | Slack #eng-alerts   | Real-time         |
| Product Manager  | Decision maker    | Email + Slack       | Phase transitions |
| QA Team          | Testing           | Slack #qa-alerts    | Before each phase |
| DevOps           | Infrastructure    | PagerDuty           | Critical issues   |
| Leadership       | Executive updates | Email               | Weekly summary    |

### 11.2 External Stakeholders

| Stakeholder        | Notification Method | Timing              |
| ------------------ | ------------------- | ------------------- |
| Teachers/Educators | In-app notice       | Beta launch         |
| Parents            | Email newsletter    | Full rollout        |
| Students           | In-app notice       | Beta + Full rollout |

### 11.3 Communication Templates

#### Phase Transition Announcement

```markdown
## Evaluation Engine Update - Phase [X] Launch

**What's changing**: We are expanding access to our new AI-powered evaluation system.

**What this means for you**:

- More detailed and helpful feedback on activities
- Improved understanding of student responses
- Enhanced learning experience

**What to do**: Continue using the platform as normal.

**Questions?** Contact [support email]
```

#### Rollback Notification

```markdown
## Temporary Revert - Evaluation Engine

We have temporarily reverted to our previous evaluation system due to [reason].

**Impact**: None - your learning continues normally.

**Status**: We are investigating and will update within [timeframe].

**Questions?** Contact [support email]
```

### 11.4 Escalation Path

```
Issue Detected
    ↓
On-call Engineer (5 min)
    ↓
Engineering Lead (15 min if unresolved)
    ↓
Product Manager (30 min if business impact)
    ↓
CTO/Executive (1 hour if major incident)
```

---

## 12. Timeline

### 12.1 Phase Timeline

```
Week 1-2: ALPHA PHASE
├── Day 1-2:   Infrastructure setup, config deployment
├── Day 3-4:   Internal team onboarding
├── Day 5-7:   Alpha testing with internal accounts
└── Day 8-14:  Monitoring, bug fixes, iteration

Week 3-4: BETA PHASE
├── Day 15:    Beta cohort configuration
├── Day 16-18: Beta launch to pilot users
├── Day 19-25: Beta monitoring and feedback collection
└── Day 26-28: Beta analysis and decision

Week 5+: FULL ROLLOUT
├── Day 29:    Full rollout preparation
├── Day 30:    Gradual 100% rollout (canary → 100%)
├── Day 31-35: Post-launch monitoring
└── Ongoing:   Legacy engine decommission (if applicable)
```

### 12.2 Milestone Dates

| Milestone          | Target Date        | Owner                 |
| ------------------ | ------------------ | --------------------- |
| Alpha Start        | Week 1, Monday     | Engineering           |
| Alpha Complete     | Week 2, Friday     | Engineering + QA      |
| Beta Start         | Week 3, Monday     | Product               |
| Beta Complete      | Week 4, Friday     | Product + Engineering |
| Full Rollout Start | Week 5, Monday     | Engineering           |
| Post-Launch Review | Week 6, Monday     | Product               |
| Legacy Deprecation | Week 8 (if stable) | Engineering           |

### 12.3 Dependencies

| Dependency           | Owner       | Due Date |
| -------------------- | ----------- | -------- |
| Feature Flag Service | Engineering | Complete |
| Evaluation Metrics   | Engineering | Complete |
| Staging Validation   | Engineering | Complete |
| Monitoring Dashboard | DevOps      | Week 1   |
| Load Testing         | QA          | Week 2   |
| Documentation        | Engineering | Week 2   |
| Rollback Procedure   | Engineering | Week 2   |

---

## 13. Post-Rollout Review Checklist

### 13.1 Success Criteria Review

- [ ] **Error Rate**: Final error rate < 1% (target: < 0.5%)
- [ ] **Latency**: P95 latency < 3s, P99 < 8s
- [ ] **Accuracy**: Evaluation accuracy > 85% vs expert review
- [ ] **Student Satisfaction**: > 80% positive feedback
- [ ] **Technical Stability**: No critical bugs in production
- [ ] **Monitoring**: All dashboards operational
- [ ] **Documentation**: All docs updated

### 13.2 Technical Review

- [ ] **Metrics Collection**: All metrics captured and visible
- [ ] **Alerting**: All alerts configured and tested
- [ ] **Rollback**: Rollback procedure tested and documented
- [ ] **Feature Flags**: Cleanup of unused cohort configs
- [ ] **Code Quality**: Code review completed, no tech debt
- [ ] **Security**: Security audit passed
- [ ] **Performance**: Load test passed at 2x expected traffic

### 13.3 Process Review

- [ ] **Communication**: All stakeholders notified
- [ ] **Runbooks**: Runbooks updated with new procedures
- [ ] **On-call**: On-call team trained on new system
- [ ] **Knowledge Transfer**: Team knowledge transfer completed
- [ ] **Lessons Learned**: Documented and shared

### 13.4 Future Considerations

- [ ] **Legacy Deprecation**: Plan for legacy engine removal
- [ ] **Feature Enhancements**: Backlog prioritized based on beta feedback
- [ ] **A/B Testing**: Permanent A/B testing framework evaluation
- [ ] **Scaling**: Plan for 10x traffic growth
- [ ] **Cost Analysis**: LLM API cost analysis completed

### 13.5 Sign-Off

| Role             | Name | Date | Signature |
| ---------------- | ---- | ---- | --------- |
| Engineering Lead |      |      |           |
| Product Manager  |      |      |           |
| QA Lead          |      |      |           |
| DevOps Lead      |      |      |           |
| CTO              |      |      |           |

---

## Appendix A: Quick Reference

### Configuration Cheat Sheet

```bash
# 1. Check current config
curl http://localhost:3001/health | jq '.evaluation'

# 2. Enable alpha cohort (10%)
export EVALUATION_FLAGS='{"cohorts":{"alpha-10":{"evaluatorType":"llm","parameters":{"modelName":"gpt-4o-mini"}}}}'

# 3. Enable beta cohort (50%)
export EVALUATION_FLAGS='{"cohorts":{"alpha-10":{"evaluatorType":"llm"},"beta-50":{"evaluatorType":"llm"}}}'

# 4. Full rollout
export USE_NEW_EVALUATOR_ENGINE=true

# 5. Complete rollback
export USE_NEW_EVALUATOR_ENGINE=false
export EVALUATION_FLAGS='{"cohorts":{}}'
```

### Key Commands

```bash
# Restart API
kubectl rollout restart deployment/api

# Check logs
kubectl logs -f deployment/api | grep '\[EVAL'

# Check metrics
curl http://localhost:3001/metrics

# Manual cohort assignment
psql $DATABASE_URL -c "UPDATE users SET cohort='alpha-10' WHERE id='user-uuid';"
```

### Emergency Contacts

| Role                 | Contact        | Available      |
| -------------------- | -------------- | -------------- |
| Engineering On-Call  | See PagerDuty  | 24/7           |
| Product Manager      | [email]        | Business hours |
| DevOps               | [email]        | 24/7           |
| LLM Provider Support | OpenAI: [link] | 24/7           |

---

## Appendix B: Related Documentation

- [Evaluation Engine Documentation](./api/evaluation-engine.md)
- [Feature Flag Service Source](./apps/api/src/config/evaluation-flags.ts)
- [Evaluation Metrics Source](./apps/api/src/monitoring/eval-metrics.ts)
- [Staging Validation Source](./apps/api/src/monitoring/staging-validation.ts)
- [Architecture & Stack](./01-architecture-and-stack.md)
- [Coding Standards](./02-coding-standards.md)

---

**Document Owner**: Engineering Team  
**Last Updated**: March 2026  
**Version**: 1.0.0
