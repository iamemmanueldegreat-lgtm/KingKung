---
name: NBTE level handling
description: Durable rules for importing NBTE polytechnic curricula across ND and HND levels
---

NBTE curriculum documents can describe both National Diploma and Higher National Diploma programmes using similar Year I/Year II headings. Source detection and level inference must use the document’s diploma type before mapping those headings.

**Why:** Mapping every Year I/II heading to ND1/ND2 loses HND courses and creates incorrect course IDs and library filters.

**How to apply:** Treat explicit “Higher National Diploma” or “HND” as HND1/HND2; otherwise use ND1/ND2 for National Diploma documents. Preserve the per-course level returned by parsing.