# DerpDrive — plan and verification checklist

Written 2026-07-27. Companion to `SESSIONS.md` (the journal). This file is the other half: what the project is for, what's actually built versus still aspirational, and how to check it's still doing its job.

## What this project is for

An MCP (Model Context Protocol) server that gives any AI agent full CRUD access to Google Drive — list, read, write, delete, move, copy, create folders, search, upload, download. Unlike Google's official Drive MCP, this one doesn't neuter delete/move operations. Built because Google's version is a pussy.

## What's actually built vs. still aspirational

**Built and working:**
- MCP server with 12 tools: `drive_list`, `drive_read`, `drive_write`, `drive_delete`, `drive_move`, `drive_copy`, `drive_mkdir`, `drive_search`, `drive_info`, `drive_upload`, `drive_download`, `drive_root`
- OAuth authentication flow (local server redirect, one-time browser authorization on port 3336)
- Persistent token storage and automatic refresh
- Google Drive API v3 integration via `googleapis` npm package
- Registered and working with opencode (in `~/.config/opencode/opencode.json`)
- Git repo at https://github.com/gittybiyach/derpdrive
- Lore backup repo initialized

**Known bug (fixed 2026-07-27):**
- `drive_write` was sending `parents` field on update requests, which Google Drive API rejects. Fixed by removing `parents` from the update request body — only set on create calls.

**Configured/described but not actually wired up:**
- Nothing — everything listed above is verified working against a real Google account (sisco7211@gmail.com)

## The spec — what "working correctly" actually means

1. An agent can list all files/folders in Drive root
2. An agent can read file content from any text file or Google Doc/Sheet/Presentation
3. An agent can create new text files in any folder
4. An agent can update existing file content (overwrite or append)
5. An agent can delete files (trash or permanent)
6. An agent can move files between folders and rename them
7. An agent can copy files
8. An agent can create new folders
9. An agent can search files by name
10. An agent can get full metadata on any file
11. An agent can upload local files to Drive
12. An agent can download Drive files to local filesystem
13. OAuth token auto-refreshes without re-authorization
14. The server handles errors gracefully with clear messages back to the caller

## Agent handoff notes

If you're picking up this project fresh:

**Where the server lives:** `~/.local/share/mcp-servers/google-drive/`
- `src/` — TypeScript source
- `dist/` — compiled JS
- `data/` — contains `credentials.json` (Google OAuth client) and `token.json` (OAuth refresh token, auto-created)
- Registered in `~/.config/opencode/opencode.json` under the key `google-drive`

**OAuth state:** Already authorized as sisco7211@gmail.com. Token auto-refreshes. You should never need to re-auth unless the token is revoked.

**How to test (from the terminal):**
```bash
# List files
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"drive_list","arguments":{"pageSize":5}}}' | node ~/.local/share/mcp-servers/google-drive/dist/index.js 2>/dev/null

# Read a file (replace fileId)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"drive_read","arguments":{"fileId":"SOME_FILE_ID"}}}' | node ~/.local/share/mcp-servers/google-drive/dist/index.js 2>/dev/null
```

**To rebuild after changes:**
```bash
cd ~/.local/share/mcp-servers/google-drive && npx tsc
```

**Git repo:** `~/derpdrive/` — synced with https://github.com/gittybiyach/derpdrive
- Build the ts in `~/.local/share/mcp-servers/google-drive/`, then copy updated `src/` files to `~/derpdrive/src/` and commit.

## External blockers / waiting on nobody

- None. Everything works.

## Verification checklist

Run these after ANY change to confirm nothing is broken. Each is a real MCP call over stdio.

- [ ] `drive_root` — returns `Root folder: My Drive (0ADgTTy51teoJUk9PVA)`
- [ ] `drive_list` — returns files in root, no errors
- [ ] `drive_write` — creates a new file, returns file ID
- [ ] `drive_read <fileId>` — returns file content matching what was written
- [ ] `drive_write (update)` — updates existing file content (tests the fix: no `parents` on update)
- [ ] `drive_read` after update — confirms new content
- [ ] `drive_delete fileId` — file moved to trash
- [ ] `drive_search` for deleted filename — confirms gone
- [ ] `drive_mkdir` — creates folder, returns folder ID
- [ ] `drive_move fileId parentId` — file moves to new folder
- [ ] `drive_copy fileId` — returns new copy ID
- [ ] `drive_info fileId` — returns all metadata fields
- [ ] `drive_upload localPath` — file appears in Drive
- [ ] `drive_download fileId localPath` — file appears locally

## Fix log

- 2026-07-27: `drive_write` update requests were sending `parents` field → Google 400 error. Fixed in `src/drive.ts:writeFile()` — parents only set on create, omitted on update.
- git log for full history: `git log --oneline` from `~/derpdrive`
