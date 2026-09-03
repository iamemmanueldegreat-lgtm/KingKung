---
name: DeepSeek client setup
description: How the AI client works in server.ts — important when adding new AI endpoints
---

## Rule
All AI calls go through `getDeepSeekClient()` in server.ts using `DEEPSEEK_MODEL = 'deepseek-chat'`.
There is no Gemini or Anthropic usage anywhere in the codebase (both packages removed).

## Why
User explicitly requested Gemini removal; DeepSeek-only for all AI features.

## How to apply
- New AI endpoints: call `getDeepSeekClient().models.generateContent({ contents, config })` or `generateContentStream`
- The wrapper normalises Gemini-style API calls into OpenAI-compatible calls to `https://api.deepseek.com/v1`
- For JSON output: set `config.responseMimeType: 'application/json'`
- For streaming: use `generateContentStream` and iterate chunks
- Always use `parseJsonSafe()` for JSON responses (handles think-tags and malformed JSON)

## Trust proxy
`app.set('trust proxy', 1)` is set at the top of createApp() — required on Replit so express-rate-limit resolves the real client IP from X-Forwarded-For.
