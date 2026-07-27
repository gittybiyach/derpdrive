**Timestamp:** 2026-07-27
**Agent:** Claude (opencode)
**Action:** Created the DerpDrive MCP server from scratch. Built TypeScript MCP server using `@modelcontextprotocol/sdk`, `googleapis`, and `google-auth-library`. Implemented 12 Drive tools with OAuth local-server auth flow. Fought Google's consent screen bullshit (testing mode → published), gcloud auth scope blocks, and OOB redirect deprecation. Eventually got a working desktop-app OAuth flow with localhost:3336 redirect server.
**Result:** `dist/index.js` — fully functional MCP server. Token saved. Registered in `opencode.json` as MCP server `google-drive`.
**Escalation:** no

**Timestamp:** 2026-07-27
**Agent:** Claude (opencode)
**Action:** Set up git repo at `/home/tone/derpdrive/`, copied templates, wrote PLAN.md + SESSIONS.md, created GitHub repo `gittybiyach/derpdrive`, pushed.
**Result:** Repo live at https://github.com/gittybiyach/derpdrive
**Escalation:** no
