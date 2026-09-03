# Kortex AI

An AI-powered learning platform for Nigerian students to master their courses with intelligent study assistance.

## Stack

- **Frontend**: React 19 + React Router v7 + Tailwind CSS v4
- **Backend**: Express 5 (TypeScript, served via `tsx`)
- **AI**: DeepSeek API (`deepseek-chat` model) via OpenAI-compatible SDK
- **Database / Auth**: Firebase (Firestore + Firebase Auth + Firebase Storage)
- **Build tool**: Vite 6

## How to run

```bash
npm install
npm run dev       # starts Express + Vite dev server on port 8080
npm run build     # production build
npm start         # run the production build
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DEEPSEEK_API_KEY` | ✅ Yes | DeepSeek API key — get one at https://platform.deepseek.com/api_keys |
| `PORT` | No | Server port (default: 8080) |
| `NODE_ENV` | No | Set to `production` for built/deployed version |

Firebase credentials are stored in `firebase-applet-config.json` (project root). Update that file if switching Firebase projects.

## API endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health + AI key status check |
| `/api/diagnostics` | GET | DeepSeek connectivity test |
| `/api/generate-course` | POST | Generate course curriculum for a department |
| `/api/generate-study` | POST | Generate full study guide + quiz questions |
| `/api/generate-quiz` | POST | Generate practice quiz for a topic |
| `/api/quiz-explain` | POST | AI explanation for a quiz answer |
| `/api/chat` | POST | Streaming AI chat (SSE) |

## Key source files

- `server.ts` — Express backend + all AI API calls (DeepSeek via `getDeepSeekClient()`)
- `src/lib/api.ts` — Frontend helpers that call the backend API
- `src/lib/firebase.ts` — Firebase init + Firestore helpers
- `firebase-applet-config.json` — Firebase project config

## User preferences

- All AI calls go through DeepSeek only (no Gemini, no Anthropic)
- Firebase stays as the backend (do not migrate to Replit DB)
