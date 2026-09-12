# GitHub Achievement & OSS Growth Automation Design

**Project:** AunoForge  
**Repository:** `dhtoan/AunoForge`  
**Owner profile:** `dhtoan`  
**Date:** 2026-09-12  
**Status:** Approved design, pending implementation-plan review

## 1. Purpose

Design a continuous, legitimate automation system that increases AunoForge's open-source credibility while maximizing the number of real GitHub achievement opportunities available to `dhtoan`.

The system must optimize for useful open-source activity, not synthetic GitHub events.

Core principle:

> **Maximize legitimate opportunities, not synthetic GitHub events.**

A second operating principle governs automation behavior:

> **Automate discovery, diagnosis, tracking, and preparation aggressively. Automate public activity conservatively.**

GitHub achievements are treated as downstream signals. The system must never assume that meeting a community-reported numeric threshold guarantees that GitHub will issue a badge.

---

## 2. Goals

### 2.1 Primary goals

1. Build AunoForge into a credible, discoverable OSS maintainer tool.
2. Create a repeatable contributor funnel that can attract real external contributors.
3. Increase the number of meaningful merged PRs authored by `dhtoan` in AunoForge and external OSS projects.
4. Create legitimate opportunities for GitHub achievements such as Pull Shark, Pair Extraordinaire, Galaxy Brain, and Starstruck.
5. Improve AunoForge's security, release, Marketplace, documentation, and community posture.
6. Maintain factual OSS evidence suitable for future open-source program applications.

### 2.2 Non-goals

The system will not:

- create fake accounts;
- buy, trade, or automate fake stars;
- create fake contributors;
- open empty or meaningless PRs;
- split one meaningful change into trivial PRs solely to create events;
- generate fake Q&A conversations;
- create self-serving accepted-answer loops;
- add fake co-authors;
- mass-react to posts or PRs;
- create empty releases or meaningless version bumps;
- mass-comment across external repositories;
- weaken repository security solely to pursue an achievement.

---

## 3. Design Strategy

The system uses a **dual-track automation model**.

### Track A — `dhtoan` profile achievements

Focus areas:

- meaningful merged PRs;
- external OSS contributions;
- genuine co-authored work;
- useful technical Q&A answers;
- maintainer reviews;
- authentic public OSS activity.

Target achievement families include:

- Pull Shark;
- Pair Extraordinaire;
- Galaxy Brain;
- Starstruck;
- other legitimate GitHub achievements that arise from real project activity.

The system will not optimize for YOLO if doing so would require bypassing repository review or protection controls.

### Track B — AunoForge repository credibility

Focus areas:

- external contributors;
- real adopters;
- Marketplace publication;
- releases;
- Discussions/Q&A;
- community recipes;
- branch protection;
- OpenSSF/security posture;
- CI quality;
- documentation;
- stars and forks as organic downstream signals.

The two tracks must reinforce each other: AunoForge should create real maintenance work and collaboration opportunities, while `dhtoan` develops a broader external OSS contribution history.

---

## 4. Current Baseline

At design time, AunoForge already has:

- public repository visibility;
- TypeScript codebase;
- Apache-2.0 license;
- Node.js 20+ support;
- multi-platform CI for Linux, macOS, and Windows;
- AunoForge Review GitHub Action;
- README and project documentation;
- `SECURITY.md`;
- `CONTRIBUTING.md`;
- issue forms for bug, feature, and recipe requests;
- provider adapters for mock, Codex/OpenAI, and Claude/Anthropic;
- a GitHub Action entrypoint;
- a safe/read-only-by-default architecture;
- evidence-aware review behavior.

Observed repository gaps include:

- GitHub Discussions not yet enabled;
- no discovered `CODEOWNERS` file;
- no dedicated pull-request template;
- no contributor-recognition file;
- no dedicated achievement/growth tracking document;
- security automation not yet expanded to Dependency Review, CodeQL, OpenSSF Scorecard, and Dependabot;
- Marketplace publication not yet completed;
- topic taxonomy still heavily provider-focused.

---

## 5. Opportunity Engine

Every candidate activity receives a value score before it is surfaced or acted upon.

### 5.1 Scoring model

- OSS user value: **40%**
- Community/adoption value: **25%**
- Achievement potential: **15%**
- Credibility/security value: **10%**
- Effort efficiency: **10%**

Achievement potential is intentionally a minority factor.

A real Windows compatibility fix in an active external OSS project should score highly. A trivial README-only PR with no material benefit should be rejected even if it could produce a GitHub event.

### 5.2 Opportunity queue

The daily queue should contain no more than three high-value items.

Examples:

1. external OSS bug suitable for `dhtoan` to fix;
2. AunoForge contributor PR waiting for review;
3. unanswered technical Discussion with enough information to answer well.

The system should prefer a small high-quality queue over a large list of low-value tasks.

---

## 6. Continuous Automation Architecture

The automation system is event-aware where tools support events and time-based where they do not.

```text
GitHub / OSS ecosystem
        |
        v
Opportunity Scanner
        |
        v
Qualification & Deduplication
        |
        v
Value / Risk Scoring
        |
        +------------------+
        |                  |
        v                  v
Safe internal action   Human-gated public action
        |                  |
        v                  v
Diagnosis / draft      Review / approval
        |                  |
        +--------+---------+
                 |
                 v
        Evidence & Growth Tracking
```

### 6.1 Hourly condition watches

#### AunoForge CI / PR Watch

Check for:

- CI failures;
- blocked PRs;
- review requests;
- external contributor PRs awaiting maintainer response;
- security or regression signals.

Notify only when meaningful action is required.

#### Contributor Response Watch

Check for:

- new external issues;
- new external PRs;
- contributors waiting for feedback;
- stalled review conversations.

Do not emit empty “nothing changed” reports.

### 6.2 Daily jobs

#### External OSS Opportunity Scout

Find up to three high-quality contribution opportunities in relevant domains:

- TypeScript;
- Node.js;
- GitHub Actions;
- CLI tooling;
- WordPress/PHP;
- developer tooling;
- security tooling;
- documentation where the change is substantive.

Only surface opportunities that are open, active, scoped, useful, and compatible with the user's skills.

The system does not automatically comment or open PRs in external repositories.

#### Achievement Opportunity Scan

Track legitimate opportunities for:

- merged PRs;
- genuine co-authored work;
- accepted Q&A answers;
- contributor reviews;
- organic repository growth.

#### AunoForge Backlog Health

Maintain a useful contributor surface. Target range:

- 3–5 active good-first issues;
- 3–5 help-wanted tasks;
- 2–3 recipe opportunities;
- 1–2 documentation opportunities.

Do not create issues merely to keep counts at target.

### 6.3 Weekly jobs

#### OSS Growth Report

Report factual deltas for:

- stars;
- forks;
- watchers/subscribers when available;
- external contributors;
- external merged PRs;
- recipes;
- real adopter repositories;
- releases;
- external OSS PRs by `dhtoan`;
- genuine co-authored contributions;
- accepted Q&A answers.

#### Release Readiness

Recommend a release only when there is a meaningful reason such as:

- a substantive feature;
- real bug fixes;
- security improvements;
- ecosystem support;
- meaningful contributor work;
- breaking or upgrade-relevant changes.

#### Security / OpenSSF Readiness

Check readiness for:

- Dependency Review;
- CodeQL;
- OpenSSF Scorecard;
- Dependabot;
- safe GitHub permissions;
- branch protection;
- release provenance where practical.

#### Marketplace / Distribution Review

Check:

- Action metadata;
- release/tag state;
- README examples;
- tagged-action usability;
- Marketplace readiness.

---

## 7. CI Self-Healing Boundary

When CI fails, automation may:

1. inspect the failed job;
2. inspect logs;
3. classify the failure;
4. identify likely root cause;
5. prepare a deterministic fix when evidence is sufficient;
6. run or recommend verification;
7. open a legitimate AunoForge PR if the fix is narrow, reproducible, and useful.

Automation must not merge the PR automatically.

Typical allowed deterministic fix classes:

- cross-platform path handling;
- manifest syntax;
- YAML formatting;
- stale test assertions;
- documentation-link regression;
- recipe validation regression.

If the cause is ambiguous, security-sensitive, or requires product judgment, automation stops after diagnosis and notifies the maintainer.

---

## 8. GitHub Community Surface

### 8.1 Discussions

Enable GitHub Discussions manually and create:

- Announcements;
- Q&A;
- Ideas;
- Recipes;
- Show and tell.

`Q&A` must use GitHub's question/answer format so real accepted answers can form a durable knowledge base.

Issues remain for concrete work; support questions should be redirected to Discussions.

### 8.2 Issue forms

Keep and improve:

- bug;
- feature;
- recipe.

Add `.github/ISSUE_TEMPLATE/config.yml` to link users to:

- Discussions for questions;
- `SECURITY.md` for vulnerability reporting;
- documentation resources.

#### Bug form requirements

Capture:

- AunoForge version;
- Node.js version;
- operating system;
- command;
- provider;
- expected behavior;
- actual behavior;
- reproduction steps;
- sanitized logs;
- minimal reproduction where possible.

Require confirmation that secrets were removed and existing issues were searched.

#### Feature form requirements

Capture:

- user problem;
- beneficiary;
- desired behavior;
- alternatives;
- security impact;
- breaking-change impact.

#### Recipe form requirements

Capture:

- ecosystem;
- recipe purpose;
- deterministic checks;
- expected known-good fixture;
- expected known-bad fixture;
- required capabilities.

### 8.3 Good-first-issue structure

Every deliberately curated good-first issue should contain:

- context;
- why it matters;
- scope;
- out of scope;
- acceptance criteria;
- likely files;
- required tests;
- difficulty;
- expected surface area.

The implementation phase must validate each candidate against actual code before opening it.

### 8.4 Label taxonomy

Use a compact taxonomy covering:

**Type**
- bug
- enhancement
- documentation
- security

**Area**
- core
- cli
- github-action
- provider
- recipe
- reporter
- ci

**Community**
- good first issue
- help wanted
- community
- question

**Status**
- needs reproduction
- needs tests
- blocked
- ready for review

### 8.5 CODEOWNERS

Add `.github/CODEOWNERS` with `@dhtoan` as initial owner for critical surfaces. Do not require code-owner review until another maintainer exists.

### 8.6 Pull-request template

Add `.github/pull_request_template.md` covering:

- what changed;
- why;
- verification;
- security impact;
- tests;
- documentation;
- recipe fixtures where applicable;
- breaking changes.

### 8.7 Contributor recognition

Add `CONTRIBUTORS.md` and update it only for real contributors with meaningful merged work.

Contributor credit may also appear in release notes.

---

## 9. Security & Repository Protection

### 9.1 Branch ruleset

Target `main` with:

- deletion blocked;
- force push blocked;
- PR required;
- required status checks;
- conversation resolution required.

Required status checks should reflect actual workflow job names, including Node.js matrix quality jobs, macOS/Windows smoke checks, and AunoForge review.

Do not require one human approval while `dhtoan` is the sole maintainer.

### 9.2 Security automation rollout order

Implement incrementally:

1. Dependency Review;
2. CodeQL;
3. OpenSSF Scorecard;
4. Dependabot weekly updates for npm and GitHub Actions.

Each workflow must use least privilege and must not add excessive PR noise.

---

## 10. Marketplace & Distribution

AunoForge should publish its GitHub Action to Marketplace once tagged usage is verified.

Before Marketplace publication:

- a real release exists;
- Action metadata is valid;
- release tag works as an Action reference;
- README usage is tested;
- Marketplace branding/category information is valid.

For pre-v1 documentation, prefer an immutable version tag such as `@v0.1.0` over `@main` when presenting stable usage examples.

A stable major tag such as `@v1` should not be introduced until v1 compatibility expectations are intentionally supported.

---

## 11. Achievement Tracking Model

The tracker uses four states:

- `NOT STARTED`
- `IN PROGRESS`
- `LIKELY ELIGIBLE`
- `VERIFIED`

`VERIFIED` requires direct evidence that GitHub actually displays the achievement.

### 11.1 Internal achievement radar

Track at least:

- Pull Shark;
- Pair Extraordinaire;
- Galaxy Brain;
- Starstruck.

Other achievements may be added only when they can be pursued without reducing project quality or violating anti-gaming rules.

Progress bars or numeric thresholds are internal planning aids only and must never be described as GitHub guarantees.

### 11.2 Achievement tracking document

Add:

`docs/community/achievement-tracker.md`

Track:

- observed achievement state;
- meaningful merged PRs;
- external PRs;
- co-authored work;
- accepted Q&A answers;
- stars;
- forks;
- external contributors;
- adopter repositories;
- Marketplace milestone;
- releases.

Do not update the file for every minor metric movement. Weekly reports remain conversational/automation output, while repository-tracked milestones are updated only for material events.

---

## 12. Anti-Gaming Hard Gates

The following actions are always rejected:

- fake or alternate contributor accounts;
- fake stars or star exchanges;
- reaction farming;
- fake questions or answers;
- self-created accepted-answer loops;
- fake co-author attribution;
- empty PRs;
- trivial PR splitting;
- meaningless release churn;
- synthetic issue creation;
- copied generic external comments;
- disabling safety controls to pursue an achievement.

Rule:

> If the primary purpose of an action is only to create a GitHub event rather than deliver OSS value, reject it.

---

## 13. Public-Action Permission Matrix

### Automation may perform directly

- read issues, PRs, workflows, and repository metadata;
- analyze CI failures;
- track metrics;
- search for external OSS opportunities;
- prepare suggested fixes;
- prepare issue/PR drafts;
- notify the maintainer;
- update internal factual tracking when evidence is clear.

### Automation may perform only under deterministic quality gates

- create a legitimate AunoForge maintenance issue when a real, non-duplicate, testable gap exists;
- apply obvious labels;
- open an AunoForge code-changing PR for a narrow deterministic fix.

### Human-gated actions

Automation must not independently:

- merge PRs;
- publish releases;
- publish Marketplace listings;
- submit PRs to external repositories;
- post external-repository comments;
- accept Q&A answers;
- perform sponsorship/payment actions;
- add fake or speculative co-authors;
- pin repositories on the user profile;
- weaken repository protection.

---

## 14. Internal Rate Limits

### Auto-created AunoForge issues

Maximum default rate: **2 per week**, excluding newly discovered real bugs or security issues that warrant immediate tracking.

An issue must be:

- non-duplicate;
- based on a real gap;
- testable;
- clearly scoped;
- supported by acceptance criteria.

### External opportunities

Surface at most **3 per day**.

### Public comments

Never post generic activity-only comments such as “Great work” or “Looks good” for activity generation.

---

## 15. 30-Day Sprint Targets

These are operational goals, not guarantees of GitHub achievement issuance.

### Repository goals

- Marketplace-ready or published;
- Discussions/Q&A enabled;
- `main` protected;
- CODEOWNERS and PR template added;
- Dependency Review enabled;
- CodeQL enabled;
- OpenSSF Scorecard enabled;
- Dependabot configured weekly;
- 10–15 useful backlog issues where justified;
- 3–5 active good-first issues;
- at least 2 real external contributors;
- at least 3 meaningful external PRs merged;
- at least 1 real external repository using or concretely trialing AunoForge;
- at least 1 meaningful post-launch release when justified;
- stretch goal: 16+ organic stars.

### `dhtoan` profile goals

- at least 3 meaningful PRs merged into external OSS repositories;
- at least 1 genuine co-authored contribution;
- at least 2 useful accepted Q&A answers if real questions exist;
- consistent substantive reviews of external contributor PRs.

---

## 16. 90-Day Targets

### AunoForge baseline targets

- at least 5 external contributors;
- at least 10 meaningful external PRs merged;
- at least 3 real adopter repositories;
- at least 20 useful recipes;
- at least 3 meaningful releases;
- active Discussions/Q&A;
- Marketplace usage evidence;
- first public case study;
- healthy security automation.

### AunoForge stretch targets

- 50+ organic stars;
- 10+ external contributors;
- 25+ useful recipes;
- 5+ adopter repositories.

### `dhtoan` profile targets

- 10+ meaningful external OSS PRs merged;
- 3+ genuine co-authored contributions;
- 5+ accepted technical Q&A answers if opportunity exists;
- consistent public review and maintainer history across multiple repositories.

---

## 17. Success Metrics

North-star metrics:

1. **Active external repositories using AunoForge**
2. **Unique external contributors with meaningful merged PRs**

Secondary metrics:

- stars;
- forks;
- releases;
- Marketplace usage;
- recipes;
- accepted Q&A answers;
- external OSS contributions;
- GitHub achievements.

Achievements and followers are downstream indicators, not primary product metrics.

---

## 18. Definition of Success

### Day 30

The sprint is successful if:

- AunoForge is discoverable;
- Marketplace is ready or published;
- Discussions are active;
- `main` is protected;
- security workflows are healthy;
- at least one real contributor exists;
- at least one real external PR exists;
- at least one real adopter or concrete trial exists;
- `dhtoan` has begun meaningful external OSS contribution.

The sprint remains successful even if GitHub displays zero new achievement badges.

### Day 90

The program is successful when AunoForge begins to operate as a real community project rather than a repository dependent solely on its creator.

Evidence includes people who:

- use it;
- report bugs;
- ask questions;
- submit recipes;
- submit PRs.

And a maintainer who:

- maintains AunoForge;
- contributes externally;
- answers technical questions;
- reviews community work.

---

## 19. Failure & Safety Policy

Automation must stop public mutations and notify the maintainer when:

- GitHub authentication or permission state changes unexpectedly;
- branch protection disappears unexpectedly;
- CI repeatedly fails without a clear deterministic root cause;
- a proposed issue duplicates existing work;
- GitHub data is incomplete or inconsistent;
- a security incident is active;
- an action requires guessing about another person's intent;
- a public action may create spam or misleading activity.

The default failure mode is **read, diagnose, notify — do not mutate**.

---

## 20. Implementation Boundary

### Programmatic work planned after spec approval

- improved issue forms;
- issue-template config;
- pull-request template;
- CODEOWNERS;
- contributor recognition file;
- achievement tracker document;
- security workflows;
- legitimate backlog/good-first issues after code validation;
- scheduled monitoring and reporting automations;
- CI diagnosis workflow improvements where justified;
- factual OSS evidence updates for material milestones.

### One-time GitHub UI actions required from the maintainer

Where connector write support is unavailable, the maintainer must manually:

- enable Discussions;
- create/configure Q&A and other Discussion categories;
- disable Wiki if desired;
- finish/edit branch rulesets;
- publish to GitHub Marketplace;
- update repository topics/settings not exposed by available tools;
- manage profile pins;
- perform sponsorship/payment actions.

The implementation plan must clearly separate automated actions from these one-time UI steps.

---

## 21. Rollout Order

Implementation should proceed in this order:

1. contributor/community files and templates;
2. branch/security configuration support and security workflows;
3. Discussions/manual UI checklist;
4. contributor-ready backlog validated against code;
5. Marketplace/tagged-action readiness;
6. automation schedules;
7. weekly growth reporting;
8. external OSS opportunity scouting;
9. achievement tracking and factual evidence updates;
10. 30-day and 90-day review checkpoints.

This order ensures AunoForge has a credible community surface before automation begins driving attention toward it.

---

## 22. Final Design Principle

AunoForge's growth automation must make the project more useful even if GitHub removed achievements tomorrow.

If a proposed automation cannot pass that test, it does not belong in the system.
