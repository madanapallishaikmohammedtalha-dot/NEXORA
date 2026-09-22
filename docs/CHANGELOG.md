# NEXORA — Changelog

All notable changes to the NEXORA project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned for v1.0.0
- Web Audio API notification chimes for Pomodoro interval completion.
- Global keyboard navigation shortcuts (`Cmd/Ctrl + 1..8`, `Space` for focus timer).
- High-contrast night theme toggle for low-light study environments.
- Rich Markdown editor for curriculum topic notes.

---

## [0.9.0] - 2026-09-21

### Added
- **Deterministic Capacity Engine**:
  - Implemented `calculateDailyCapacity()` in `src/services/scheduler.ts` deriving study budgets from 1,440 minutes minus sleep, fixed classes, meals, and transition buffers.
  - Configurable daily maximum safety cap (`dailyCapacityMaxHours`) to protect student cognitive health.
  - Support for semester holiday and reading week capacity overrides.
- **Weekly College Timetable**:
  - 7-day recurring schedule grid (Monday–Sunday) in `src/components/TimetableModule.tsx`.
  - Taxonomy for fixed vs. flexible slots (`lecture`, `lab`, `tutorial`, `commute`, `personal`, `study_window`).
  - Automated transition buffer calculations around campus commitments.
- **Curriculum Roadmaps & Prerequisite DAG**:
  - Directed Acyclic Graph dependency model in `src/types.ts` (`prerequisiteTopicIds`).
  - Dynamic status evaluation (`locked`, `ready`, `in_progress`, `completed`).
  - Mastery progression mechanics with visual progress bars and prerequisite dependency inspection cards.
- **Daily Mission Planner & Advisory AI Diff Staging**:
  - Interactive time-blocking checklist in `src/components/DailyPlannerModule.tsx`.
  - Advisory AI plan generation via `/api/ai/plan-proposal`.
  - Structured diff review card displaying proposed tasks, rationale, priority scores, and granular item selection.
  - Manual item creation, editing, deletion, and status toggling (`pending`, `in_progress`, `completed`, `skipped`).
- **Socratic AI Academic Tutor**:
  - Interactive tutoring chat in `src/components/AITutorModule.tsx`.
  - 4 specialized operational modes: Socratic Probing, Step-by-Step Analogies, Concept Quizzes, and Prerequisite Breakdowns.
  - Contextual grounding against active curriculum topics and student mastery levels.
- **AI Syllabus & Roadmap Generator**:
  - Automated decomposition of course descriptions and notes into 5–7 prerequisite-linked DAG topics via `/api/ai/generate-roadmap`.
- **Focus Session Tracker & Reflection Modal**:
  - Integrated Pomodoro focus timer with 25m, 45m, and 60m presets in `src/components/SessionTrackerModal.tsx`.
  - End-of-session cognitive reflection capturing planned vs. actual duration, comprehension rating (1–5★), and cognitive energy rating (1–5).
  - Automated mastery level boosts tied to comprehension ratings.
- **Academic Progress & Analytics**:
  - Subject pacing tracker measuring weekly logged hours against target credit hours.
  - Historical study session logs with qualitative takeaways.
- **Semester & Course Catalog Manager**:
  - Multi-semester configuration, term date boundaries, credit hours, and color coding in `src/components/SemesterModule.tsx`.
  - Mid-semester reading weeks and holiday management.
- **Local-First Data Sovereignty & Settings**:
  - Complete client storage in `localStorage` under `nexora_os_v1`.
  - One-click JSON backup export (`exportStateAsJSON`) and validated restoration (`importStateFromJSON`).
  - Custom Gemini API key and model selection support.
- **Server-Side AI Proxy**:
  - Express server (`server.ts`) integrating `@google/genai` TypeScript SDK.
  - Dual-layer deterministic fallback system guaranteeing full offline utility when no API key is present.
