# NEXORA — Changelog

All notable changes to the NEXORA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned for v1.1.0
- FSRS / SM-2 spaced repetition algorithmic memory retrievability modeling.
- Automated active recall flashcard generation from Socratic coaching sessions.
- RFC 5545 iCalendar (`.ics`) subscription export feed.

---

## [1.0.0] - 2026-10-09

### Added
- **Learning Roadmap**:
  - Prerequisite Directed Acyclic Graph (DAG) dependency graph with topological cycle detection.
  - Multi-domain curriculum graphs spanning academic subjects, career skills (DSA, Systems, Web Development, AI/ML), and project engineering tracks.
  - Pedagogical stages (*Foundations*, *Core Mechanisms*, *Applied Systems*, *Advanced Synthesis*).
  - Dynamic status transitions (`locked`, `ready`, `in_progress`, `completed`).
  - Evidence-backed mastery progression (`studied`, `practiced`, `assessed`, `mastered`).
  - Student override capability to unlock prerequisite-blocked topics with explicit advisory warnings.
- **Adaptive Daily Planning**:
  - Deterministic capacity engine in `src/services/plannerEngine.ts` modeling the strict 1,440-minute day.
  - Daily check-in capturing fatigue, transit delays, and urgent coursework to dynamically adapt available study capacity.
  - Overnight sleep schedule protection supporting post-midnight sleep hours without task encroachment.
  - Candidate topic selection prioritizing pacing deficits, prerequisite readiness, and active milestones.
  - Staged AI advisory proposals with human-in-the-loop diff cards, reasoning transparency, and selective item acceptance.
- **Focus Sessions**:
  - Integrated Pomodoro focus timer with presets (25m, 45m, 60m) and custom intervals.
  - Precision tracking of scheduled vs actual study minutes.
  - Cognitive reflection modal recording comprehension ratings (1–5★), energy flow (1–5), roadblocks, and takeaways.
  - Automated mastery level boosts tied to comprehension evidence.
- **Context-Aware AI Tutor**:
  - 8 specialized coaching modes: Explain (intuition-first 5-step breakdown), Why (motivation & real failure cases), Example, Analogy, Practice (progressive hints), Test (multi-format assessment), Explain-Back (rubric scoring 0–100), and Answer Review.
  - Deep curriculum awareness injecting active semester, course catalog code, topic name, and current mastery level.
  - Locked prerequisite warning banner preventing premature study of advanced topics.
  - Strict advisory boundary: AI tutor is incapable of modifying roadmaps or marking topics completed unilaterally.
- **Weekly Review & Longitudinal Analytics**:
  - Automated calendar-week aggregation (Monday–Sunday) tracking planned vs actual minutes and execution percentage.
  - Transparent 0–100 consistency score factoring sessions completed, execution ratio, subject diversity, streak continuity, and reflection depth.
  - Subject pacing matrix comparing logged hours against semester credit targets to surface deficits.
  - Topic mastery change delta tracking and behavioral learning pattern detection.
  - Actionable next-week study proposals with data-backed rationale that students can accept, modify, or commit directly to upcoming missions.
- **Semester Transition & Holiday Mode**:
  - Semester state machine deriving operational states (`upcoming`, `active`, `completed`, `break`).
  - Semester Achievement Report aggregating total hours, subject progress, mastery shifts, goal completions, and qualitative trends.
  - Safe term conclusion preserving all historical study sessions, enrolled courses, and reviews without data loss.
  - Holiday mode preferences: vacation study goals, daily capacity caps, weekly available hours, and protected rest days.
  - Multi-week holiday focus roadmaps ensuring study blocks never encroach on designated rest days.
- **Hardening & V1.0 Architecture**:
  - Deterministic local calendar date utility (`getTodayDateString()`) preventing timezone day shifts for global users.
  - Historical semester preservation in `OnboardingModal.tsx` ensuring re-running the setup wizard never deletes prior semesters.
  - Robust non-convex interval arithmetic in `plannerEngine.ts` correctly partitioning awake and sleep hours across midnight.
  - Multi-provider AI architecture separating `AIService`, `ProviderRegistry`, `GeminiProvider`, `CustomProxyProvider`, and `OfflineProvider`.
  - Schema validation and defensive sanitization boundaries (`src/services/validation.ts`) ensuring error recovery without UI crashes.
  - Comprehensive automated test suite with 309 passing unit and integration tests across all modules.

---

## [0.9.0] - 2026-09-21

### Added
- Initial prototype release of capacity engine, 7-day timetable, curriculum DAG, and basic Gemini API proxy integration.
