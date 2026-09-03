---
name: Curriculum data model
description: How NBTE/CCMAS curriculum courses are stored and filtered — critical for Library and Home page queries
---

## Rule
NBTE polytechnic courses are stored with `school: 'NBTE'`. CCMAS university courses use `school: 'CCMAS'`.
When filtering courses for a student, the query must include these shared-curriculum schools alongside their specific school.

## Why
All polytechnics share the same NBTE curriculum. Storing `school: 'NBTE'` (instead of 'Auchi Polytechnic') lets every polytechnic student see the curriculum without duplicating courses per school.

## How to apply
In any page that queries courses by school (Library.tsx, Home.tsx):
```js
const isPoly = isPolytechnic(user.school);
const schoolMatch =
  c.school === user.school ||
  (isPoly && c.school === 'NBTE') ||
  (!isPoly && c.school === 'CCMAS');
```

## Course fields added for curriculum
- `semester: 1 | 2` — semester number; legacy courses without this show in all semesters
- `credit_units: number` — NBTE credit/contact hours
- `program_type: 'polytechnic' | 'university'`
- `source: 'NBTE' | 'CCMAS' | 'custom'`

## Admin import flow
Admin → "Import Curriculum" tab → upload PDF → extract selectable text locally in the browser → review/edit text → POST `/api/parse-curriculum` → preview → save.
The importer uses PDF.js with a bundled worker, so the PDF itself does not need to be uploaded to a third-party extractor.

NBTE PDFs use semester course tables plus later course specification blocks. CCMAS Computing PDFs contain multiple programme sections and level-based global course structures. The server isolates the relevant section and parses specification excerpts in small batches to avoid oversized AI prompts.

Firestore doc IDs include department, level, semester (or `all` for CCMAS), and course code to prevent collisions across a full curriculum import. Topics remain in `courses/{courseId}/topics`.

**Why:** The supplied NBTE and CCMAS PDFs are long, text-based documents with different layouts; one generic pasted-text prompt incorrectly risks truncating content, mixing programmes, or assigning the wrong semester.

**How to apply:** Keep PDF extraction client-side, preserve extracted page markers for server-side section detection, and never apply one semester to an entire multi-semester PDF when the AI cannot identify it.
