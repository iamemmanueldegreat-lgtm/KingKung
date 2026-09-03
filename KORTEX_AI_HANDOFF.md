# Kortex AI — AI Vibe-Coder Handoff

> This document is the working handoff for any developer or AI agent continuing the Kortex AI codebase.
>
> Read this file before changing architecture, authentication, curriculum storage, AI providers, Replit workflows, or Firebase rules.

## 1. Product identity

**Product name:** Kortex AI

**Product type:** AI-powered learning platform for Nigerian tertiary students.

**Current product priority:** Nigerian polytechnics using official NBTE curricula.

**Current starting curriculum:** Computer Science, based on the supplied official NBTE Computer Science curriculum PDF.

**Long-term direction:** Help Nigerian students understand their actual school curriculum through generated study guides, quizzes, contextual tutoring, progress tracking, and offline access.

### Product promise

Kortex should feel like a patient personal tutor that:

- Understands the student’s school, department, level, and course.
- Teaches difficult topics in simple everyday English.
- Uses Nigerian and locally relatable examples where helpful.
- Gives structured explanations instead of shallow summaries.
- Generates practice questions that are tied to the exact topic.
- Caches generated study material so students do not repeatedly spend AI requests.
- Supports offline reading after a topic has been downloaded.
- Uses official curriculum sources instead of an arbitrary manually-created course catalogue.

### Current scope decision

Polytechnics are the focus now. University curriculum support is not the active product priority.

The codebase contains partial CCMAS support because it was explored during curriculum ingestion, but the Admin UI currently disables CCMAS importing and displays it as “coming later.” Do not expand university functionality unless the product owner explicitly changes this priority.

---

## 2. Current technology stack

- **Frontend:** React 19
- **Routing:** React Router v7
- **Styling:** Tailwind CSS v4
- **Animation:** Motion
- **Icons:** lucide-react
- **Backend:** Express 5 with TypeScript
- **Development runner:** `tsx`
- **Bundler:** Vite 6 for the frontend, esbuild for the bundled server
- **AI provider:** DeepSeek only
- **AI model:** `deepseek-chat`
- **AI SDK:** OpenAI-compatible SDK pointed at `https://api.deepseek.com/v1`
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth
- **File/media storage:** Firebase Storage
- **Analytics:** Firebase Analytics when supported, plus Vercel Analytics and Speed Insights
- **PDF extraction:** `pdfjs-dist` in the browser
- **Markdown rendering:** `react-markdown` with `remark-gfm`
- **Offline support:** browser `localStorage` plus PWA service worker assets

### Important architecture rule

Firebase remains the backend. Do not migrate the project to Replit Database or replace Firestore unless the product owner explicitly requests that change.

---

## 3. How to run the project

```bash
npm install
npm run dev
```

The development server runs through `server.ts` and serves Express plus Vite middleware on port `8080`.

Production-style verification:

```bash
npm run lint
npm run build
npm start
```

Package scripts currently mean:

- `npm run dev` — runs `tsx server.ts`
- `npm run lint` — runs `tsc --noEmit`
- `npm run build` — runs Vite build and bundles `server.ts` to `dist/server.cjs`
- `npm start` — runs `node dist/server.cjs`
- `npm run clean` — removes `dist`

### Replit workflow rules

The configured workflow is **Start application** and runs:

```bash
npm run dev
```

It waits for port `8080`.

The app must expose only the application port in the embedded Replit preview. Vite HMR and websocket listeners are intentionally disabled because they opened an additional port (`24678`) that caused Replit’s preview router to return **“Upgrade Required.”**

These settings are intentional:

- `vite.config.ts` has `server.hmr: false`
- `vite.config.ts` has `server.ws: false`
- The Vite middleware options inside `server.ts` also disable `hmr` and `ws`
- Express listens on `0.0.0.0`
- The workflow waits for port `8080`

If the preview ever says **Upgrade Required**:

1. Check `getWorkflowStatus` or the workflow UI.
2. Confirm only port `8080` is open.
3. Check that Vite HMR/websocket listeners have not been re-enabled.
4. Restart the **Start application** workflow.
5. Check `curl http://localhost:8080/api/health`.

Do not add random `[[ports]]` mappings to `.replit`. Use the workflow’s configured port.

---

## 4. Environment and secrets

Required:

```text
DEEPSEEK_API_KEY
```

Optional:

```text
PORT=8080
NODE_ENV=development
APP_URL
```

Firebase configuration is loaded from the root-level `firebase-applet-config.json`. This is the project’s current Firebase configuration mechanism. Do not move Firebase settings into a new backend or replace the initialized Firestore database configuration without checking the existing Firebase project.

### Secret safety

- Never print the real `DEEPSEEK_API_KEY`.
- Never commit `.env`.
- Never put secret values in this document.
- Do not ask the user to paste a secret into chat.
- Use the Replit secrets/environment flow when a secret must be requested or changed.

The backend startup diagnostics may log that the DeepSeek key is present and may show a masked prefix/suffix. Do not make the diagnostics reveal the complete key.

---

## 5. Repository map

### Root files

- `server.ts` — Express server, DeepSeek client wrapper, API endpoints, curriculum parser, startup diagnostics, Vite middleware.
- `package.json` — scripts and dependencies.
- `vite.config.ts` — Vite/Tailwind/React configuration and Replit preview constraints.
- `firebase-applet-config.json` — Firebase app configuration.
- `firestore.rules` — Firestore security rules.
- `.replit` — Replit deployment/workflow settings. Do not edit directly; use the validated Replit configuration flow when platform tooling requires it.
- `replit.md` — short project overview and user preferences.
- `.env.example` — documented environment variable names without real values.
- `api/index.ts` — Vercel/serverless entry wrapper if used by the deployment configuration.
- `vercel.json` — Vercel-related configuration.

### Frontend

- `src/main.tsx` — React entry point.
- `src/App.tsx` — Firebase auth listener, profile loading, providers, and route table.
- `src/index.css` — global styles and Tailwind CSS entry.
- `src/types.ts` — `UserProfile`, `Course`, `Topic`, notes, bank accounts, withdrawal request types.
- `src/lib/firebase.ts` — Firebase initialization, Firestore, Auth, Storage, Analytics, error helper.
- `src/lib/api.ts` — frontend wrappers for AI endpoints.
- `src/lib/credits.ts` — free-tier chat/topic limits and Firestore credit updates.
- `src/lib/constants.ts` — Nigerian schools, departments, polytechnic levels, university levels, and `isPolytechnic`.
- `src/lib/curriculumPdf.ts` — browser-side PDF.js extraction and source/level/semester detection.
- `src/contexts/AuthContext.tsx` — auth context type and hook.
- `src/contexts/CurriculumContext.tsx` — curriculum mode context; currently defaults to school curriculum.
- `src/contexts/ThemeContext.tsx` — light/dark theme.
- `src/layouts/MainLayout.tsx` — authenticated layout and bottom navigation.
- `src/pages/Home.tsx` — dashboard, streak, recent/continue learning, course availability.
- `src/pages/Library.tsx` — curriculum course browser with search, semester filters, and shared NBTE filtering.
- `src/pages/Course.tsx` — course detail and chapter/topic list.
- `src/pages/Study.tsx` — topic study screen, on-demand generation, cached content, Ask AI, practice quiz.
- `src/pages/Chat.tsx` — general AI chat.
- `src/pages/Auth.tsx` — email registration/login.
- `src/pages/Profile.tsx` — user profile and account information.
- `src/pages/EditProfile.tsx` — profile editing.
- `src/pages/AcademicProfile.tsx` — academic information.
- `src/pages/Analytics.tsx` — study activity and progress analytics.
- `src/pages/Billing.tsx` — manual premium/payment flow.
- `src/pages/Admin.tsx` — admin course/topic management, payments, withdrawals, rep management, curriculum PDF importer.
- `src/pages/RepDashboard.tsx` — representative/referral dashboard.
- `src/pages/Notifications.tsx` — notification page.
- `src/pages/ForgotPassword.tsx` and `src/pages/ResetPassword.tsx` — password recovery.
- `src/components/PracticeQuiz.tsx` — practice quiz UI and answer/explanation behavior.
- `src/components/AskAiDrawer.tsx` — contextual tutoring drawer.
- `src/components/PWAPromptBanner.tsx` and `src/hooks/usePWA.ts` — PWA install behavior.

### Supplied curriculum assets

The repository contains:

- `attached_assets/nd-computer-science-nbte-curriculum-32_1785833133396.pdf`
- `attached_assets/Computing-CCMAS_2023-FINAL_1785833152345.pdf`

The NBTE PDF is the active product source. The CCMAS PDF is retained for future university work but is not the current import priority.

---

## 6. Authentication and user profile behavior

Authentication uses Firebase Auth with email/password registration and login. `src/App.tsx` listens to Firebase auth state and then listens to the corresponding Firestore document under `users/{uid}`.

The profile object is kept in React context and includes:

```ts
interface UserProfile {
  id: string;
  email: string;
  phone_number?: string;
  full_name?: string;
  state: string;
  school: string;
  department: string;
  level: string;
  is_pro: boolean;
  avatar_url?: string;
  cover_url?: string;
  is_admin?: boolean;
  payment_status?: 'idle' | 'awaiting_approval' | 'approved';
  payment_plan?: 'monthly' | 'semester';
  payment_amount?: number;
  payment_requested_at?: string;
  used_coupon?: string;
  is_rep?: boolean;
  rep_coupon_code?: string;
  rep_earnings?: number;
  rep_withdrawn?: number;
  rep_bank_name?: string;
  rep_bank_account?: string;
  rep_bank_accounts?: BankAccount[];
  coupon_uses?: number;
  streak?: number;
  last_login_date?: string;
  active_days?: string[];
  ai_credits_used?: Record<string, number>;
  free_chat_used?: number;
  free_topics_unlocked?: string[];
  study_hours_by_date?: Record<string, number>;
  academic_stats_by_date?: Record<string, {
    answered: number;
    right: number;
    coins: number;
    finished_reading: number;
    started_reading: number;
  }>;
}
```

### Profile side effects

On profile load, `App.tsx`:

- Ensures today’s login date is stored.
- Recomputes the study streak from activity.
- Initializes daily study-hours and academic-stat objects.
- Initializes daily AI credit tracking.
- Persists updated profile analytics to Firestore.
- Tracks live study time while the browser tab is visible.

Be careful when changing this logic: it writes to the user profile on login and can cause snapshot/update loops if written carelessly.

### Admin access

The Admin page checks `user.is_admin`. Firestore admin authorization is based on the existence of an `admins/{email}` document. There is also a legacy email-specific override in `src/App.tsx`; inspect the current code before changing admin behavior and do not create new hardcoded personal-email rules.

---

## 7. Product routes

Public/auth routes:

- `/auth`
- `/forgot-password`
- `/reset-password`

Authenticated routes:

- `/` — Home dashboard
- `/library` — course library
- `/profile` — profile
- `/edit-profile` — edit profile
- `/academic-profile` — academic profile
- `/notifications` — notifications
- `/course/:courseId` — course contents
- `/study/:courseId/:topicId` — study topic
- `/analytics` — analytics
- `/chat` — AI chat
- `/billing` — premium/payment page
- `/rep` — representative portal
- `/admin` — admin workspace

Unauthenticated users are redirected to `/auth`. Authenticated users visiting `/auth` are redirected to `/`.

---

## 8. Curriculum and Firestore data model

### Course document

Courses are currently stored in the root collection:

```text
courses/{courseId}
```

Typical course fields:

```ts
{
  code: string;
  title: string;
  school: string;
  department: string;
  level: string;
  description: string;
  semester?: 1 | 2;
  credit_units?: number;
  program_type?: 'polytechnic' | 'university';
  source?: 'NBTE' | 'CCMAS' | 'custom';
  createdAt?: string;
}
```

Topics are subcollection documents:

```text
courses/{courseId}/topics/{topicId}
```

Typical topic fields:

```ts
{
  title: string;
  chapter?: string;
  chapter_order?: number;
  order?: number;
  estimated_minutes?: number;
  content?: string;
  key_takeaways?: string;
  quiz_questions?: string; // often JSON.stringify(array)
  createdAt?: string;
}
```

### Shared NBTE rule

All Nigerian polytechnics can share the official NBTE curriculum. Therefore NBTE curriculum courses use:

```text
school: "NBTE"
source: "NBTE"
program_type: "polytechnic"
```

When Home or Library filters courses for a student:

```ts
const schoolMatch =
  course.school === user.school ||
  (isPolytechnic(user.school) && course.school === 'NBTE') ||
  (!isPolytechnic(user.school) && course.school === 'CCMAS');
```

Do not duplicate the same NBTE course once per polytechnic unless there is a real school-specific variation.

### Level rule

Polytechnic levels are:

```text
ND1
ND2
HND1
HND2
```

University levels exist in constants for future work:

```text
100 Level
200 Level
300 Level
400 Level
500 Level
600 Level
```

The current product priority is NBTE, including both ND and HND.

### Course document ID convention

The Admin importer builds IDs from:

```text
department-level-semester-or-all-courseCode
```

It strips non-alphanumeric characters and lowercases the result. NBTE uses semester-specific IDs when semester is known. CCMAS uses `all` because its structure is level-based, but CCMAS importing is currently disabled in the UI.

Preserve this collision-avoidance behavior when changing imports.

---

## 9. NBTE curriculum import

### User-facing flow

Admin → **Import Curriculum**:

1. Admin chooses a PDF.
2. `src/lib/curriculumPdf.ts` extracts selectable text in the browser using PDF.js.
3. The UI shows page count, extracted character count, source, levels, and semesters.
4. The extracted text can be reviewed/edited.
5. The UI sends the text to `POST /api/parse-curriculum`.
6. The server isolates the relevant NBTE structure and specification sections.
7. DeepSeek parses courses and topics in small batches.
8. The Admin reviews the result.
9. Courses and topic subcollections are saved to Firestore.

The PDF itself is not sent blindly to DeepSeek. Text extraction happens first.

### NBTE layout assumptions

The supplied NBTE PDF is a long, landscape, text-based document. It contains:

- Semester course structure tables.
- Year/level information.
- Later detailed course specification blocks.
- Weekly lesson-plan-like rows that must not become individual courses.

The parser uses the official structure tables for course identification and metadata, then uses specification blocks for topic content.

### HND handling

HND support is required, not optional.

The current parser:

- Recognizes `HIGHER NATIONAL DIPLOMA`.
- Recognizes `HND`.
- Maps HND Year I to `HND1`.
- Maps HND Year II to `HND2`.
- Maps National Diploma Year I/II to `ND1`/`ND2`.
- Preserves the per-course level returned by DeepSeek.

Do not simplify the parser to “Year I = ND1” because HND documents often use the same Year I/Year II wording.

### Active source restriction

The Admin UI currently allows:

```text
NBTE — Polytechnic
```

The CCMAS option is disabled and labelled as coming later. If a CCMAS PDF is uploaded, the UI rejects it with a message explaining that university importing is not enabled yet.

The server still contains CCMAS parsing code for future use. Do not delete it casually; simply keep it out of the current product path until the university phase begins.

---

## 10. AI architecture and rules

All AI requests must use DeepSeek.

The single provider/model rule is:

```ts
const DEEPSEEK_MODEL = "deepseek-chat";
```

The client is lazily created by `getDeepSeekClient()` in `server.ts`:

- Reads `process.env.DEEPSEEK_API_KEY`.
- Uses the OpenAI SDK.
- Uses `baseURL: "https://api.deepseek.com/v1"`.
- Converts the project’s Gemini-shaped helper calls into OpenAI chat completions.
- Supports JSON output through `response_format: { type: "json_object" }`.
- Supports streaming for chat.

There must be no Gemini or Anthropic provider added unless the product owner explicitly changes the provider decision.

### JSON safety

Use `parseJsonSafe()` for model JSON. It:

- Trims output.
- Removes `<think>...</think>` blocks.
- Removes Markdown JSON fences.
- Attempts normal JSON parsing.
- Attempts `jsonrepair`.
- Attempts object/array extraction as a fallback.

### AI content principles

Study content must:

- Be comprehensive but easy to understand.
- Avoid unnecessary academic jargon.
- Define technical terms immediately in simple language.
- Match the student’s department and level.
- Use Nigerian/local everyday examples when appropriate.
- Include Markdown headings and readable spacing.
- Include misconceptions and exam-focused takeaways.
- Avoid shallow generic filler.

### AI endpoints

#### `GET /api/health`

Returns basic service status:

```json
{
  "status": "ok",
  "ai": "connected",
  "provider": "deepseek",
  "timestamp": "..."
}
```

#### `GET /api/diagnostics`

Runs a DeepSeek connectivity test and returns masked key status. Never expose the real key.

#### `POST /api/generate-course`

Request:

```json
{
  "department": "Computer Science"
}
```

Returns one generated course package with school, code, title, description, and topics. This is legacy/manual course-generation functionality; official NBTE imports are preferred for the current product.

#### `POST /api/generate-study`

Request:

```json
{
  "topic": "Data Structures",
  "course": "Introduction to Programming",
  "level": "ND1",
  "department": "Computer Science",
  "school": "Auchi Polytechnic"
}
```

Returns:

```json
{
  "content": "Markdown study guide",
  "key_takeaways": "Markdown bullet list",
  "quiz_questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "calculatedAnswer": "...",
      "explanation": "..."
    }
  ]
}
```

The server validates/normalizes takeaways and quiz questions and has a fallback study package if the AI call fails.

#### `POST /api/generate-image-prompt`

Request:

```json
{
  "title": "Database Systems",
  "department": "Computer Science"
}
```

Returns:

```json
{
  "content": "short image-generation prompt"
}
```

This endpoint creates a prompt only; it does not generate an image.

#### `POST /api/generate-quiz`

Request:

```json
{
  "courseTitle": "Introduction to Computing",
  "courseCode": "COM 111",
  "topicTitle": "Computer Hardware",
  "numQuestions": 5
}
```

Returns a validated quiz question array. Questions should have exactly four options and a synchronized `correctIndex`, `calculatedAnswer`, and explanation.

#### `POST /api/quiz-explain`

Request includes:

```json
{
  "question": "...",
  "options": ["...", "...", "...", "..."],
  "correctIndex": 1,
  "chosenIndex": 0,
  "userQuery": "Why is my answer wrong?"
}
```

Returns:

```json
{
  "explanation": "short contextual explanation"
}
```

#### `POST /api/chat`

Request:

```json
{
  "messages": [
    { "role": "user", "content": "Explain this" }
  ],
  "student": {
    "fullName": "Student",
    "department": "Computer Science",
    "level": "ND1",
    "school": "Auchi Polytechnic"
  },
  "topicTitle": "Current topic",
  "courseTitle": "Current course",
  "studyContext": "Optional current study material"
}
```

Returns Server-Sent Events:

```text
data: {"text":"..."}

data: [DONE]
```

When `studyContext` is supplied, the tutor should prioritize the supplied material.

#### `POST /api/parse-curriculum`

Request:

```json
{
  "text": "browser-extracted PDF text",
  "department": "Computer Science",
  "level": "ND1",
  "semester": 1,
  "programType": "NBTE",
  "source": "NBTE"
}
```

The server:

- Detects NBTE or CCMAS.
- Isolates relevant programme sections.
- Uses structure text for official courses and metadata.
- Extracts detailed course specification blocks.
- Splits specification blocks into small DeepSeek batches.
- Merges duplicate course results by code/level/semester.
- Returns per-course code, title, level, semester, credit units, and topics.

Expected response shape:

```json
{
  "source": "NBTE",
  "department": "Computer Science",
  "detectedSections": 20,
  "batches": 4,
  "courses": [
    {
      "code": "COM 111",
      "title": "Introduction to Computing",
      "level": "ND1",
      "semester": 1,
      "credit_units": 3,
      "topics": [
        {
          "title": "History of Computing",
          "chapter": "Foundations",
          "chapter_order": 1,
          "order": 1
        }
      ]
    }
  ]
}
```

---

## 11. Study experience and caching

The main learning flow is:

```text
Home
  → Library
  → Course
  → Study topic
```

### Study topic loading order

`Study.tsx` attempts, in order:

1. Browser `localStorage` offline topic cache.
2. Firestore topic content.
3. On-demand DeepSeek generation if the topic has no content and the user is online.
4. Offline uncached message if the user is offline and no local copy exists.

Generated content is:

- Displayed immediately.
- Written back to the Firestore topic document when possible.
- Saved to local storage for offline reading.
- Marked as saved/offline cached in the UI.

Firestore writes of generated topic content are intentionally non-fatal. A user should still see the generated content if the Firestore update fails.

### Local storage keys

Important patterns include:

```text
offline_topic_{topicId}
offline_course_title_{courseId}
offline_topics_list_{courseId}
course_detail_{courseId}
```

Do not break these keys without providing migration or fallback support.

### Practice and contextual AI

Study pages provide:

- Explanation tab.
- Key Takeaways tab.
- Practice tab.
- Ask AI contextual drawer.

The Ask AI drawer receives the current topic/course and the current study material as context.

---

## 12. Free tier and premium behavior

Free limits in `src/lib/credits.ts`:

```ts
FREE_LIMITS = {
  CHAT_MESSAGES: 10,
  TOPICS: 2
}
```

Premium users (`user.is_pro === true`) bypass these limits.

Free users:

- Can send only the configured number of chat messages.
- Can unlock only two topics unless already unlocked.

Topic unlocks are written to:

```text
users/{userId}.free_topics_unlocked
```

Chat usage is incremented in:

```text
users/{userId}.free_chat_used
```

### Billing behavior

The current billing UI is a manual payment/approval flow, not a fully integrated payment gateway:

- Base price is currently ₦5,000.
- Coupon-discounted price is currently ₦3,000.
- A built-in coupon string exists in the current implementation.
- Representative coupon codes can be checked against user documents.
- User submits payment details/status.
- Admin manually approves or resets the payment status.
- Approval sets `is_pro: true` and `payment_status: "approved"`.

Do not describe this as a production payment gateway integration. If payments are later made production-grade, use the monetization/integration instructions and review security/server-side validation carefully.

---

## 13. Admin workspace

Admin functionality currently includes:

- Manual course creation.
- Manual topic creation.
- Course management.
- User/payment dashboard.
- Approve premium access.
- Reset/decline payment requests.
- Make/revoke representative status.
- Approve/reject withdrawals.
- NBTE curriculum PDF import.

The curriculum importer is the current strategic feature. Prefer improving it over expanding legacy manual course generation.

### Admin import safety rules

- Preserve official course codes and titles.
- Do not invent courses that are not in the official structure.
- Do not treat weekly lesson rows as separate courses.
- Preserve course-specific level.
- Preserve course-specific semester when known.
- Do not assign Semester 1 to every course in a multi-semester PDF.
- Support HND1/HND2 as well as ND1/ND2.
- Keep NBTE as the active source until university support is intentionally resumed.

---

## 14. Firestore security model

The primary admin helper in `firestore.rules` checks whether the authenticated user’s email has a corresponding document:

```text
admins/{email}
```

General rules:

- Public reads are allowed for many curriculum/course/topic paths.
- Admin-only writes are used for shared curriculum and admin-managed content.
- Users can read/write their own profile.
- Users can read/write their own recent views.
- Notes and chat sessions are scoped to the owning user.
- Some topic updates are allowed to authenticated users so generated content can be cached.

Review `firestore.rules` before tightening or loosening permissions. Do not assume client-side `is_admin` is sufficient authorization; Firestore rules are the real data boundary.

---

## 15. Important current implementation quirks

These are known behaviors or constraints that a future AI should understand before refactoring:

1. **The app is a single Express + Vite middleware process.** Do not create a separate frontend workflow unless the architecture is intentionally changed.
2. **Only DeepSeek is supported.** Do not add Gemini/Anthropic calls.
3. **Firebase is the source of truth.** Do not migrate to Replit DB.
4. **NBTE is shared across polytechnics.** Filter with `school: "NBTE"` for polytechnic users.
5. **CCMAS parser code exists but the UI is intentionally disabled.**
6. **HND support must remain explicit.** Year I/II alone does not identify ND versus HND.
7. **PDF extraction is browser-side.** Keep page markers such as `===== PAGE N =====` because server-side section detection relies on them.
8. **AI generation is on demand and cached.** Avoid generating all topic content eagerly unless product requirements change.
9. **Some legacy fallback content exists.** A fallback response does not mean the AI provider should be replaced.
10. **Rate limiting is applied to AI endpoints.** It is currently 30 requests per minute per IP.
11. **Express trusts one proxy hop.** This is required for Replit’s forwarded client IP and rate limiting.
12. **The frontend uses localStorage for offline behavior.** Do not remove it without designing a replacement.
13. **Some profile/admin behavior contains legacy assumptions.** Inspect current code before adding more hardcoded identity rules.
14. **Vite HMR/websockets are disabled deliberately.** Re-enabling them may recreate the Replit “Upgrade Required” preview issue.
15. **The build warns about large chunks.** This is currently a warning, not a build failure. Code splitting can be considered later.

---

## 16. Current priorities and recommended roadmap

### Priority 1 — NBTE Computer Science completeness

- Validate the supplied NBTE PDF import from the Admin UI.
- Confirm all intended ND1 and ND2 courses import correctly.
- Test an HND PDF when one is available.
- Confirm HND1/HND2 course IDs, level filters, and topic saving.
- Review AI-generated topic names against the official course specifications.
- Avoid duplicate courses when importing the same source again.

### Priority 2 — Student curriculum experience

- Make sure polytechnic students see shared NBTE courses for their department and level.
- Verify Semester 1 and Semester 2 filtering.
- Verify HND users see HND courses and not ND courses.
- Verify “no courses yet” states are clear.
- Improve loading/error states for Firestore reads.

### Priority 3 — AI quality

- Test study-guide quality on real NBTE Computer Science topics.
- Check that quiz `correctIndex` always matches the correct option.
- Check that examples match ND/HND level.
- Add stronger validation where model output is malformed.
- Preserve the fallback behavior when DeepSeek is unavailable.

### Priority 4 — Offline reliability

- Test topic generation, refresh, offline reload, and localStorage restoration.
- Confirm generated content is not regenerated repeatedly once cached.
- Consider cache versioning if the content schema changes.

### Priority 5 — Monetization hardening

- Move payment verification to a secure server/integration before real production payments.
- Do not trust client-side activation of `is_pro`.
- Audit coupon and representative earnings logic.
- Add explicit audit records for approvals and withdrawals.

### Later — University/CCMAS

Only begin after the polytechnic/NBTE experience is stable:

- Re-enable CCMAS import in the UI.
- Validate programme-section isolation against the actual CCMAS PDF.
- Decide how university levels and semester structures should be represented.
- Keep CCMAS records separated with `school: "CCMAS"` and `source: "CCMAS"`.

---

## 17. Verification checklist for every meaningful change

Before declaring work complete:

```bash
npm run lint
npm run build
```

Then:

1. Restart the **Start application** workflow after server/config changes.
2. Check workflow logs.
3. Confirm only port `8080` is exposed.
4. Check:

   ```bash
   curl http://localhost:8080/api/health
   ```

5. Confirm no browser console errors in preview.
6. If the change is visual, inspect the relevant route at desktop and mobile widths.
7. If the change touches Firestore, review the relevant security rule.
8. If the change touches AI, confirm it still uses `getDeepSeekClient()` and `DEEPSEEK_MODEL`.
9. If the change touches curriculum, test source, level, semester, course ID, and filtering behavior.

---

## 18. Safe continuation instructions for another AI

When starting a new task:

1. Read this file.
2. Read `replit.md`.
3. Read the relevant memory files under `.agents/memory/`.
4. Inspect the current code; this document can become stale.
5. Do not assume university support is active just because CCMAS code exists.
6. Do not assume a PDF is safe to send directly to the model; extract and isolate text first.
7. Do not ask for an API key before checking whether the existing Replit secret is available.
8. Do not replace Firebase with another database.
9. Do not introduce a second workflow for the existing app.
10. Run the verification checklist before finishing.

### Preferred implementation style

- Make focused changes in the existing architecture.
- Reuse existing types, helpers, and Firestore conventions.
- Keep server AI calls in `server.ts` or extract them into focused modules without changing the provider contract.
- Keep user-visible errors explicit.
- Avoid silent fallbacks that hide data corruption.
- Preserve current data when adding fields.
- Prefer additive migrations over destructive rewrites.
- Ask a clarifying question only when a product decision cannot be inferred safely.

---

## 19. Definition of success for the current phase

Kortex AI is ready for the next phase when:

- An admin can import the official NBTE Computer Science PDF.
- The system extracts text locally before AI processing.
- ND1 and ND2 courses are correctly identified.
- HND1 and HND2 are supported without being confused with ND levels.
- Courses retain correct department, level, semester, source, and credit units.
- Topics are saved beneath the correct course documents.
- Polytechnic students from different schools can see shared NBTE courses.
- Study content is generated on demand, cached in Firestore, and available offline.
- Quiz answers and explanations are reliable.
- DeepSeek is the only AI provider.
- The Replit preview opens normally on port 8080 without “Upgrade Required.”
- `npm run lint` and `npm run build` pass.

---

## 20. Final non-negotiable decisions

1. Product is Kortex AI for Nigerian students.
2. Prioritize NBTE polytechnics before universities.
3. Support ND1, ND2, HND1, and HND2.
4. Use official curriculum documents as the source of truth.
5. Extract PDF text before sending curriculum content to AI.
6. Use DeepSeek only.
7. Keep Firebase/Firestore/Auth/Storage.
8. Store shared NBTE curricula with `school: "NBTE"`.
9. Keep generated study content cached in Firestore and local browser storage.
10. Do not re-enable Vite HMR/websocket listeners in the embedded Replit preview without understanding the extra-port consequence.