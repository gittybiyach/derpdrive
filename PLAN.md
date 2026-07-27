# DerpDrive — plan and verification checklist

Written 2026-07-27. Companion to `SESSINGS.md` (the journal). This file is the other half: what the project is for, what's actually built versus still aspirational, and how to check it's still doing its job.

## What this project is for

An MCP (Model Context Protocol) server that gives any AI agent full CRUD access to Google Drive — list, read, write, delete, move, copy, create folders, search, upload, download. Unlike Google's official Drive MCP, this one doesn't neuter delete/move operations. Built because Google's version is a pussy.

## What's actually built vs. still aspirational

**Built and working:**
- MCP server with 12 tools: `drive_list`, `drive_read`, `drive_write`, `drive_delete`, `drive_move`, `drive_copy`, `drive_mkdir`, `drive_search`, `drive_info`, `drive_upload`, `drive_download`, `drive_root`
- OAuth authentication flow (local server redirect, one-time browser authorization)
- Persistent token storage and automatic refresh
- Google Drive API v3 integration via `googleapis` npm package
- Registered and working with opencode

**Configured/described but not actually wired up:**
- Nothing — everything listed above is verified working against a real Google account

## The spec — what "working correctly" actually means

1. An agent can list all files/folders in Drive root
2. An agent can read file content from any text file or Google Doc/Sheet/Presentation
3. An agent can create new text files in any folder
4. An agent can update existing file content
5. An agent can delete files (trash or permanent)
6. An agent can move files between folders and rename them
7. An agent can copy files
8. An agent can create new folders
9. An agent can search files by name
10. An agent can get full metadata on any file
11. An agent can upload local files to Drive
12. An agent can download Drive files to local filesystem
13. OAuth token auto-refreshes without re-authorization
14. The server handles errors gracefully with clear messages

## External blockers / waiting on nobody

- None. Everything works.

## Verification checklist

- [ ] `drive_root` returns the "My Drive" folder info
- [ ] `drive_list` shows files in root
- [ ] `drive_read <fileId>` returns file contents
- [ ] `drive_write` creates a new file
- [ ] `drive_delete --permanent false` moves a file to trash
- [ ] `drive_move` renames or relocates a file
- [ ] `drive_copy` copies a file
- [ ] `drive_mkdir` creates a new folder
- [ ] `drive_search` finds files by name
- [ ] `drive_info` returns full metadata
- [ ] `drive_upload` sends a local file to Drive
- [ ] `drive_download` pulls a Drive file locally

## Fix log (pointer, not a duplicate of git history)

`git log --oneline` has the real history.
