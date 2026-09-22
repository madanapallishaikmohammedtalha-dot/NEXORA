# NEXORA — Functional & Non-Functional Requirements

## 1. Functional Requirements (FR)

### 1.1 Semester & Academic Lifecycle Management
- **FR-1.1**: The system MUST allow users to define active and past academic semesters with explicit start and end dates.
- **FR-1.2**: The system MUST support defining multiple holiday and break ranges (e.g., Reading Week, Thanksgiving, Winter Break) per semester.
- **FR-1.3**: The system MUST support managing an academic course catalog per semester with course code, name, credits, color theme, and target weekly study hours.
- **FR-1.4**: When a date falls within a configured holiday, the system MUST flag the day as a break and adjust available study capacity accordingly.

### 1.2 Timetable & Commitment Tracking
- **FR-2.1**: The system MUST maintain a recurring 7-day weekly schedule of commitments (Monday through Sunday).
- **FR-2.2**: The system MUST categorize slots into: `lecture`, `lab`, `tutorial`, `commute`, `personal`, and `study_window`.
- **FR-2.3**: Slots MUST be flagged as `isFixed: true` (mandatory commitment) or `isFixed: false` (flexible study opportunity).
- **FR-2.4**: Fixed slots MUST specify start time and end time in 24-hour format (`HH:mm`), location/classroom, and associated subject.
- **FR-2.5**: The system MUST enforce non-negative slot durations (`endTime > startTime`).

### 1.3 Deterministic Capacity Calculation
- **FR-3.1**: The system MUST calculate available study time from the fixed invariant of 1,440 minutes per day.
- **FR-3.2**: Sleep hours (default: 8.0 hours) MUST be subtracted before computing free time.
- **FR-3.3**: Basic maintenance and hygiene time (hardcoded baseline: 120 minutes) MUST be subtracted.
- **FR-3.4**: All fixed timetable blocks for the day MUST be deducted from available time.
- **FR-3.5**: A customizable transition buffer (default: 15 minutes) MUST be applied to each fixed campus block.
- **FR-3.6**: The raw uncommitted minutes MUST be scaled to a sustainable cognitive focus coefficient (75%) to prevent exhaustion.
- **FR-3.7**: Daily study capacity MUST be clamped by the student's configured daily maximum ceiling (`dailyCapacityMaxHours`, default: 4.5 hours).

### 1.4 Curriculum Roadmaps & Prerequisite DAG
- **FR-4.1**: Each subject MUST support a sequence of modular learning topics with title, description, estimated study minutes, and notes.
- **FR-4.2**: Topics MUST support multi-parent prerequisite references (`prerequisiteTopicIds: string[]`), forming a Directed Acyclic Graph (DAG).
- **FR-4.3**: A topic's status MUST be computed dynamically:
  - `locked`: One or more prerequisite topics do not have `completed` status.
  - `ready`: All prerequisite topics are `completed`, but current mastery is 0%.
  - `in_progress`: Prerequisites are satisfied and mastery is between 1% and 79%.
  - `completed`: Mastery level is >= 80%.
- **FR-4.4**: The system MUST present a clear list of missing prerequisites when a student inspects a locked topic.

### 1.5 Daily Mission Planner
- **FR-5.1**: The system MUST maintain a distinct `DailyMission` for each calendar date (`YYYY-MM-DD`).
- **FR-5.2**: The planner MUST display the day's net available minutes alongside the sum of allocated planned minutes.
- **FR-5.3**: Users MUST be able to manually create, edit, reorder, and remove mission items.
- **FR-5.4**: Users MUST be able to toggle item execution statuses: `pending`, `in_progress`, `completed`, `skipped`.
- **FR-5.5**: The planner MUST provide an **AI Proposal Workflow**:
  - The AI proposal MUST NOT overwrite existing items automatically.
  - The proposal MUST be displayed in a reviewable diff card with rationale, proposed minutes, and priority scores.
  - Users MUST be able to selectively check/uncheck individual proposed items and commit only accepted tasks.

### 1.6 Focus Session & Cognitive Reflection
- **FR-6.1**: The system MUST include an integrated Pomodoro/Focus timer with preset intervals (25m, 45m, 60m, custom).
- **FR-6.2**: When launched from a mission item or roadmap topic, the session MUST automatically bind to the respective subject and topic.
- **FR-6.3**: Upon completion or manual stop, the system MUST record:
  - Planned duration (minutes)
  - Actual elapsed duration (minutes)
  - Comprehension rating (1 = Lost to 5 = Mastered)
  - Cognitive energy rating (1 = Exhausted to 5 = Peak Flow)
  - Qualitative key takeaways and reflection notes
- **FR-6.4**: Completing a session MUST automatically increment the topic's mastery level and update the mission item's actual study time.

### 1.7 Academic Analytics & Pacing
- **FR-7.1**: The system MUST calculate weekly actual vs. target study hours for each enrolled subject.
- **FR-7.2**: The system MUST compute curriculum completion percentages per subject based on topic completion states.
- **FR-7.3**: The system MUST calculate overall planned vs. actual execution adherence across completed study sessions.

### 1.8 AI Advisory & Socratic Tutoring
- **FR-8.1**: The system MUST provide AI endpoints:
  - `/api/ai/plan-proposal`: Recommends a daily study plan based on schedule constraints, candidate topics, and recent energy.
  - `/api/ai/tutor`: Socratic academic tutoring with 4 operational modes (`socratic`, `explain`, `quiz`, `breakdown`).
  - `/api/ai/generate-roadmap`: Generates 5–7 structured prerequisite-linked topics from course descriptions.
- **FR-8.2**: The AI MUST operate in advisory mode only; all scheduling actions require user confirmation.
- **FR-8.3**: When network calls fail or no API key is provided, the system MUST fall back gracefully to local deterministic heuristics.

### 1.9 Data Sovereignty & Settings
- **FR-9.1**: The system MUST store all application state in browser `localStorage` under a versioned key (`nexora_os_v1`).
- **FR-9.2**: The system MUST support one-click JSON backup export and validated JSON file restoration.
- **FR-9.3**: Users MUST be able to reset the application state to the default demo state at any time.
- **FR-9.4**: Users MUST be able to configure their preferred AI provider, custom Gemini API key, and model selection.

---

## 2. Non-Functional Requirements (NFR)

### 2.1 Performance & Responsiveness
- **NFR-1.1**: The application MUST achieve an initial bundle load under 500 KB (gzipped).
- **NFR-1.2**: All deterministic calculations (daily capacity, timetable slot filtering, DAG prerequisite evaluation) MUST execute in < 10ms.
- **NFR-1.3**: UI state updates MUST be synchronous without layout jitter or blocking the main browser thread.

### 2.2 Privacy & Security
- **NFR-2.1**: No personal student data (schedules, reflections, subject notes) SHALL be transmitted to any third-party server other than optional AI requests.
- **NFR-2.2**: User-provided API keys MUST be stored exclusively in client-side storage and only sent in authorization payloads to the application's local backend proxy.
- **NFR-2.3**: The server proxy MUST NOT persist or log user API keys or prompt payloads to disk.

### 2.3 Reliability & Offline Operation
- **NFR-3.1**: The application core (Timetable, Planner, DAG Roadmaps, Session Timer, Analytics) MUST function with 100% fidelity with zero network connection.
- **NFR-3.2**: In offline mode, AI features MUST fall back to deterministic heuristics and local first-principles prompt scaffolds without throwing uncaught exceptions.

### 2.4 Usability & Accessibility
- **NFR-4.1**: Color palettes MUST meet WCAG 2.1 Level AA contrast standards (minimum 4.5:1 for standard body text).
- **NFR-4.2**: Every interactive element (inputs, buttons, modal triggers) MUST maintain an explicit semantic `id` attribute and clear focus rings.
- **NFR-4.3**: The UI MUST be responsive across desktop, tablet, and mobile screen viewports.

---

## 3. Requirements Traceability Matrix

| Requirement ID | Implementation Module | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **FR-1.1 – 1.4** | `SemesterModule.tsx`, `storage.ts` | Unit / UI Test | Implemented |
| **FR-2.1 – 2.5** | `TimetableModule.tsx`, `scheduler.ts` | Unit / UI Test | Implemented |
| **FR-3.1 – 3.7** | `scheduler.ts` (`calculateDailyCapacity`) | Mathematical Verification | Implemented |
| **FR-4.1 – 4.4** | `RoadmapModule.tsx`, `scheduler.ts` (`evaluatePrerequisites`) | Graph Traversal Test | Implemented |
| **FR-5.1 – 5.5** | `DailyPlannerModule.tsx`, `App.tsx` | User Interaction Test | Implemented |
| **FR-6.1 – 6.4** | `SessionTrackerModal.tsx`, `App.tsx` | Timer & Logging Test | Implemented |
| **FR-7.1 – 7.3** | `ProgressModule.tsx`, `Dashboard.tsx` | Analytics Aggregation Test | Implemented |
| **FR-8.1 – 8.3** | `server.ts`, `ai.ts`, `AITutorModule.tsx` | API / Fallback Verification | Implemented |
| **FR-9.1 – 9.4** | `storage.ts`, `SettingsModule.tsx` | Export / Import JSON Validation | Implemented |
| **PLANNED-1** | Spaced Repetition Review Engine | FSRS Algorithm Integration | Planned (v1.1) |
| **PLANNED-2** | External Calendar `.ics` Sync | RFC 5545 Parser | Planned (v1.2) |
