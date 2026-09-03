---
name: Replit preview ports
description: Environment-specific Vite settings required for the embedded Replit preview
---

For this Express + Vite middleware setup, Vite’s HMR/websocket listener opened an extra port that Replit routed as “Upgrade Required”. The application itself was healthy on its configured port.

**Why:** Replit’s embedded preview expects one web application port; an additional Vite listener can cause the preview router to select the wrong port.

**How to apply:** Keep the workflow on the application port and disable both HMR and Vite websocket handling in the Vite server configuration and middleware options.