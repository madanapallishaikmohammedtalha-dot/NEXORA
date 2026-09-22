import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize default GenAI client if GEMINI_API_KEY is available
function getGenAIClient(customApiKey?: string) {
  const key = customApiKey || process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// =========================================================================
// Generic AI Provider Proxy Endpoints (docs/PROVIDERS.md)
// Keeps vendor SDK isolated, protects server & client credentials,
// standardizes error status codes (401, 429, 404, 503).
// =========================================================================

// Provider Health Check
app.post("/api/ai/proxy/health", async (req, res) => {
  const { userApiKey } = req.body || {};
  const hasKey = Boolean(userApiKey || process.env.GEMINI_API_KEY);

  if (!hasKey) {
    return res.status(200).json({
      isHealthy: false,
      hasCredentials: false,
      message: "No Gemini API key found on server or provided by user.",
    });
  }

  res.json({
    isHealthy: true,
    hasCredentials: true,
    message: "Google Gemini API connection configured and available.",
  });
});

// Provider Text Generation Proxy
app.post("/api/ai/proxy/generate-text", async (req, res) => {
  const {
    prompt,
    messages = [],
    systemInstruction,
    modelId = "gemini-3.8-flash",
    temperature = 0.7,
    maxTokens,
    stopSequences,
    userApiKey,
  } = req.body || {};

  const client = getGenAIClient(userApiKey);
  if (!client) {
    return res.status(401).json({
      error: "Authentication required: No API key provided and server GEMINI_API_KEY is unset.",
      category: "authentication",
      recoveryAction: "Please add your API key in Settings > AI Configuration or switch to Offline Heuristic mode.",
    });
  }

  try {
    let contents: any;
    if (messages.length > 0) {
      contents = messages.map((m: any) => ({
        role: m.role === "assistant" ? "model" : m.role === "system" ? "user" : "user",
        parts: [{ text: m.content }],
      }));
    } else if (prompt) {
      contents = prompt;
    } else {
      return res.status(400).json({
        error: "Prompt or messages array is required.",
        category: "invalid_request",
      });
    }

    const response = await client.models.generateContent({
      model: modelId,
      contents,
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens: maxTokens,
        stopSequences,
      },
    });

    res.json({
      text: response.text || "",
      modelUsed: modelId,
      finishReason: "stop",
      usage: {
        promptTokens: (response as any).usageMetadata?.promptTokenCount || 0,
        completionTokens: (response as any).usageMetadata?.candidatesTokenCount || 0,
        totalTokens: (response as any).usageMetadata?.totalTokenCount || 0,
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = err?.status || err?.statusCode || 500;

    if (status === 401 || msg.includes("API key") || msg.includes("unauthorized") || msg.includes("API_KEY_INVALID")) {
      return res.status(401).json({
        error: "Invalid or unauthorized API key.",
        category: "authentication",
        message: msg,
      });
    }

    if (status === 429 || msg.includes("rate limit") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({
        error: "Rate limit or resource quota reached.",
        category: "rate_limit",
        message: msg,
      });
    }

    if (status === 404 || msg.includes("not found") || msg.includes("models/")) {
      return res.status(404).json({
        error: `Requested model "${modelId}" was not found or is unavailable.`,
        category: "model_unavailable",
        message: msg,
      });
    }

    return res.status(503).json({
      error: "Service error communicating with upstream provider.",
      category: "network",
      message: msg,
    });
  }
});

// Provider Structured JSON Proxy
app.post("/api/ai/proxy/generate-json", async (req, res) => {
  const {
    prompt,
    systemInstruction,
    schemaDescription,
    modelId = "gemini-3.8-flash",
    temperature = 0.2,
    userApiKey,
  } = req.body || {};

  const client = getGenAIClient(userApiKey);
  if (!client) {
    return res.status(401).json({
      error: "Authentication required: No API key provided.",
      category: "authentication",
      recoveryAction: "Configure your API key in Settings > AI Configuration.",
    });
  }

  try {
    let fullPrompt = prompt;
    if (schemaDescription) {
      fullPrompt = `${prompt}\n\nYou MUST respond with valid JSON strictly adhering to this structure:\n${schemaDescription}`;
    }

    const response = await client.models.generateContent({
      model: modelId,
      contents: fullPrompt,
      config: {
        systemInstruction,
        temperature,
        responseMimeType: "application/json",
      },
    });

    const rawText = response.text || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      parsed = { raw: rawText };
    }

    res.json({
      data: parsed,
      rawText,
      modelUsed: modelId,
      usage: {
        promptTokens: (response as any).usageMetadata?.promptTokenCount || 0,
        completionTokens: (response as any).usageMetadata?.candidatesTokenCount || 0,
        totalTokens: (response as any).usageMetadata?.totalTokenCount || 0,
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = err?.status || err?.statusCode || 500;

    if (status === 401 || msg.includes("API key") || msg.includes("API_KEY_INVALID")) {
      return res.status(401).json({ error: "Invalid API key.", category: "authentication", message: msg });
    }
    if (status === 429 || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({ error: "Rate limit reached.", category: "rate_limit", message: msg });
    }
    if (status === 404 || msg.includes("not found")) {
      return res.status(404).json({ error: `Model "${modelId}" unavailable.`, category: "model_unavailable", message: msg });
    }

    return res.status(503).json({ error: "Upstream provider error.", category: "network", message: msg });
  }
});

// Mock Custom Proxy Routes (for testing custom local endpoints like Ollama / LocalAI)
app.get("/api/ai/proxy/custom/health", (_req, res) => {
  res.json({ isHealthy: true, message: "Mock custom proxy endpoint is responsive." });
});

app.post("/api/ai/proxy/custom/generate-text", (req, res) => {
  const { prompt, modelId = "llama3-8b" } = req.body || {};
  res.json({
    text: `[Custom Proxy Response from ${modelId}]: Analyzed prompt successfully.`,
    modelUsed: modelId,
    usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
  });
});

app.post("/api/ai/proxy/custom/generate-json", (req, res) => {
  const { modelId = "llama3-8b" } = req.body || {};
  res.json({
    data: { status: "success", source: "custom-proxy", model: modelId },
    rawText: JSON.stringify({ status: "success", source: "custom-proxy", model: modelId }),
    modelUsed: modelId,
    usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
  });
});

// Vite Middleware for dev & static serving in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NEXORA Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
