#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadCredentials, authenticate, loadToken } from "./oauth.js";
import {
  createDrive,
  listFiles,
  readFileContent,
  writeFile,
  deleteFile,
  moveFile,
  copyFile,
  createFolder,
  searchFiles,
  getFileInfo,
  uploadLocalFile,
  downloadToLocal,
  getRootFolder,
} from "./drive.js";

const server = new Server(
  { name: "google-drive", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

let initialized = false;

async function ensureInit() {
  if (initialized) return;
  const creds = await loadCredentials();
  const refreshToken = await loadToken();
  if (!refreshToken) {
    throw new Error(
      "Not authorized. Run this to authorize:\n  " +
      process.argv[1] + " --auth"
    );
  }
  const oauth = await authenticate(creds);
  const drive = createDrive(oauth);
  (server as any).__drive = drive;
  initialized = true;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "drive_list",
      description: "List files and folders in Google Drive. Optionally specify a parent folder ID to list contents of that folder.",
      inputSchema: {
        type: "object",
        properties: {
          parentId: {
            type: "string",
            description: "Folder ID to list contents of. Omit to list root/My Drive.",
          },
          pageSize: {
            type: "number",
            description: "Max results (default 50, max 1000).",
            default: 50,
          },
        },
      },
    },
    {
      name: "drive_read",
      description: "Read the text content of a file in Google Drive. Supports plain text, Google Docs, Sheets (CSV), and Presentations.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID of the file to read." },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drive_write",
      description: "Create a new file or update an existing file in Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the file." },
          content: { type: "string", description: "Text content to write." },
          parentId: { type: "string", description: "Folder ID to create the file in. Omit for root." },
          mimeType: { type: "string", description: "MIME type (default: text/plain). Use text/markdown, text/html, text/csv, application/json, etc." },
          fileId: { type: "string", description: "If updating an existing file, its ID." },
        },
        required: ["name", "content"],
      },
    },
    {
      name: "drive_delete",
      description: "Move a file to trash or permanently delete it.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID of the file/folder to delete." },
          permanent: { type: "boolean", description: "Permanently delete instead of moving to trash (default: false).", default: false },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drive_move",
      description: "Move a file to a different folder and/or rename it.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID of the file/folder to move." },
          parentId: { type: "string", description: "Destination folder ID. Omit to only rename." },
          name: { type: "string", description: "New name for the file. Omit to keep current name." },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drive_copy",
      description: "Copy a file in Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID of the file to copy." },
          name: { type: "string", description: "Name for the copy (default: 'Copy of <original>')." },
          parentId: { type: "string", description: "Folder ID for the copy. Omit for same folder as original." },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drive_mkdir",
      description: "Create a new folder in Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name of the folder." },
          parentId: { type: "string", description: "Parent folder ID. Omit to create in root." },
        },
        required: ["name"],
      },
    },
    {
      name: "drive_search",
      description: "Search for files by name in Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (searches file names)." },
          pageSize: { type: "number", description: "Max results (default 20).", default: 20 },
        },
        required: ["query"],
      },
    },
    {
      name: "drive_info",
      description: "Get metadata about a file or folder in Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID of the file/folder." },
        },
        required: ["fileId"],
      },
    },
    {
      name: "drive_upload",
      description: "Upload a local file to Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          localPath: { type: "string", description: "Absolute path to the local file." },
          parentId: { type: "string", description: "Folder ID to upload to. Omit for root." },
          name: { type: "string", description: "Name in Drive (default: same as local filename)." },
        },
        required: ["localPath"],
      },
    },
    {
      name: "drive_download",
      description: "Download a file from Google Drive to the local filesystem.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "ID of the file to download." },
          localPath: { type: "string", description: "Absolute path where to save the file." },
        },
        required: ["fileId", "localPath"],
      },
    },
    {
      name: "drive_root",
      description: "Get the root 'My Drive' folder info (useful for getting the root folder ID).",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await ensureInit();
  const drive = (server as any).__drive;
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "drive_list": {
        const { files, nextPageToken } = await listFiles(drive, args?.parentId as string, args?.pageSize as number || 50);
        let text = files.length === 0
          ? "No files found."
          : files.map(f =>
              `${f.mimeType === "application/vnd.google-apps.folder" ? "📁" : "📄"} ${f.name} (${f.id})${f.mimeType === "application/vnd.google-apps.folder" ? " [folder]" : ""}`
            ).join("\n");
        if (nextPageToken) text += `\n\n(More results available. Use pageSize or pagination.)`;
        return { content: [{ type: "text", text }] };
      }

      case "drive_read": {
        const { content, mimeType } = await readFileContent(drive, args?.fileId as string);
        return { content: [{ type: "text", text: content }] };
      }

      case "drive_write": {
        const file = await writeFile(
          drive,
          args?.name as string,
          args?.content as string,
          args?.parentId as string,
          args?.mimeType as string,
          args?.fileId as string,
        );
        return { content: [{ type: "text", text: `File created/updated: ${file.name} (${file.id})` }] };
      }

      case "drive_delete": {
        await deleteFile(drive, args?.fileId as string, args?.permanent as boolean || false);
        const mode = args?.permanent ? "permanently deleted" : "moved to trash";
        return { content: [{ type: "text", text: `File ${mode}: ${args?.fileId}` }] };
      }

      case "drive_move": {
        const file = await moveFile(drive, args?.fileId as string, args?.parentId as string, args?.name as string);
        return { content: [{ type: "text", text: `Moved/renamed: ${file.name} (${file.id})` }] };
      }

      case "drive_copy": {
        const file = await copyFile(drive, args?.fileId as string, args?.name as string, args?.parentId as string);
        return { content: [{ type: "text", text: `Copied to: ${file.name} (${file.id})` }] };
      }

      case "drive_mkdir": {
        const folder = await createFolder(drive, args?.name as string, args?.parentId as string);
        return { content: [{ type: "text", text: `Folder created: ${folder.name} (${folder.id})` }] };
      }

      case "drive_search": {
        const { files } = await searchFiles(drive, args?.query as string, args?.pageSize as number || 20);
        const text = files.length === 0
          ? "No files found matching query."
          : files.map((f, i) => `${i + 1}. ${f.name} (${f.id})`).join("\n");
        return { content: [{ type: "text", text }] };
      }

      case "drive_info": {
        const info = await getFileInfo(drive, args?.fileId as string);
        const lines = [
          `Name: ${info.name}`,
          `ID: ${info.id}`,
          `Type: ${info.mimeType}`,
          `Size: ${info.size || "N/A"}`,
          `Created: ${info.createdTime || "N/A"}`,
          `Modified: ${info.modifiedTime || "N/A"}`,
          `Trashed: ${info.trashed ? "Yes" : "No"}`,
          `Parents: ${info.parents?.join(", ") || "Root"}`,
          `Link: ${info.webViewLink || "N/A"}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }

      case "drive_upload": {
        const file = await uploadLocalFile(drive, args?.localPath as string, args?.parentId as string, args?.name as string);
        return { content: [{ type: "text", text: `Uploaded: ${file.name} (${file.id})` }] };
      }

      case "drive_download": {
        await downloadToLocal(drive, args?.fileId as string, args?.localPath as string);
        return { content: [{ type: "text", text: `Downloaded to: ${args?.localPath}` }] };
      }

      case "drive_root": {
        const root = await getRootFolder(drive);
        return { content: [{ type: "text", text: `Root folder: ${root.name} (${root.id})` }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `Error: ${err.message || err}` }],
      isError: true,
    };
  }
});

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--auth")) {
    const creds = await loadCredentials();
    const oauth = await authenticate(creds);
    console.error("Authorization successful! Token saved.");
    process.exit(0);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Google Drive MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
