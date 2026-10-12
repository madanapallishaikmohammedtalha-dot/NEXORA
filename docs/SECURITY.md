# NEXORA — Security Architecture & Threat Model

## 1. Security & Privacy Philosophy

NEXORA treats student privacy as a non-negotiable architectural invariant. Academic performance, personal schedule commitments, learning difficulties, and cognitive reflections are deeply private information. NEXORA enforces **Data Minimization, Zero Tracking, and Client-Side Sovereignty**.

---

## 2. Threat Model

```mermaid
graph TD
    subgraph Threats["Threat Vectors"]
        T1[T1: API Key Exfiltration]
        T2[T2: Prompt Injection / Jailbreaking]
        T3[T3: Malicious Backup Injection]
        T4[T4: Cross-Site Scripting XSS]
        T5[T5: Cloud Data Snooping / Third-Party Tracking]
    end

    subgraph Defenses["NEXORA Defenses"]
        D1[Ephemeral In-Memory Client & Server Proxy]
        D2[System/User Delimitation & Strict JSON Schemas]
        D3[JSON Schema Validation & Sanitized Deserialization]
        D4[React Virtual DOM & Sanitized Markdown Parser]
        D5[Zero External Telemetry & Local-First Storage]
    end

    T1 --> D1
    T2 --> D2
    T3 --> D3
    T4 --> D4
    T5 --> D5
```

---

## 3. Threat Analysis & Mitigations

### 3.1 T1: API Key Exfiltration & Exposure
* **Risk**: Exposure of student Gemini API keys or server credentials through source code commits, browser devtools inspection, or client bundles.
* **Storage Invariant**:
  - In V1.0, user-entered API keys are stored in **unencrypted plain text** in the browser's origin-scoped `localStorage` under `nexora_os_v1` (`state.profile.apiKey`).
  - No client-side cryptographic encryption at rest is applied. Students using public or shared computers should clear their custom API key before ending their session or use server-side environment variables instead.
* **Transport Invariant**:
  - When custom credentials are provided, the key is transmitted in the JSON request body (`{ userApiKey: "..." }`) via standard POST requests to the local Express proxy endpoints (`/api/ai/proxy/*`).
  - No custom authorization headers, Bearer tokens, or encryption envelopes are used for transport.
* **Server Processing Invariant**:
  - API keys are **strictly forbidden** from client-side bundles (`VITE_` prefix is prohibited for sensitive tokens).
  - The server reads the platform-managed `GEMINI_API_KEY` from `process.env` when no user key is provided.
  - The server creates ephemeral, garbage-collected `GoogleGenAI` instances per request. Keys are never logged to console, written to log files, or persisted to disk.

---

### 3.2 T2: Prompt Injection & Adversarial Syllabus Ingestion
* **Risk**: Malicious course titles or crafted syllabus text attempting to hijack the AI Advisory Engine into outputting arbitrary instructions.
* **Mitigation**:
  - Clear system prompt boundary demarcation.
  - Enforced `application/json` MIME type output constraint. The Gemini API rejects attempts to return unstructured executable script text.
  - Client and server parse model outputs through strict TypeScript interfaces; unparsed or malformed responses trigger deterministic fallbacks immediately.

---

### 3.3 T3: Malicious Backup Injection & Prototype Pollution
* **Risk**: A corrupted or tampered `.json` backup file containing malicious scripts or prototype pollution vectors.
* **Mitigation**:
  - `importStateFromJSON()` executes defensive validation:
    ```typescript
    const parsed = JSON.parse(jsonString);
    if (!parsed.profile || !parsed.subjects) {
      throw new Error('Invalid NEXORA backup file format');
    }
    ```
  - State is merged explicitly against the known `INITIAL_DEMO_STATE` schema rather than executing shallow object assignments.

---

### 3.4 T4: Cross-Site Scripting (XSS)
* **Risk**: User notes or AI tutor markdown executing arbitrary JavaScript within the application context.
* **Mitigation**:
  - Standard UI text is rendered through React JSX, which automatically escapes untrusted strings.
  - Rich markdown content in the AI Tutor is rendered via `react-markdown` without `dangerouslySetInnerHTML`, stripping raw `<script>` tags and arbitrary inline HTML.

---

### 3.5 T5: Third-Party Telemetry & Data Harvesting
* **Risk**: Academic records or personal reflections leaking to third-party ad networks or tracking scripts.
* **Mitigation**:
  - Zero external tracking scripts, Google Analytics tags, Facebook pixels, or session recorders.
  - Zero third-party web font or CDN dependencies (Tailwind is bundled locally; icons are bundled from `lucide-react`).

---

## 4. Security Checklist for Deployments

- [x] Ensure `.env` is listed in `.gitignore` and never committed to version control.
- [x] Bind server to port `3000` and host `0.0.0.0`.
- [x] Verify that `metadata.json` requests only required frame permissions.
- [x] Verify that all API endpoints enforce rate-limiting or payload size bounds in production reverse proxies.
