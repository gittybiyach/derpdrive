import { createServer } from "http";
import { readFile, writeFile, mkdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { OAuth2Client } from "google-auth-library";

const DATA_DIR = join(dirname(new URL(import.meta.url).pathname), "..", "data");
const CREDENTIALS_PATH = join(DATA_DIR, "credentials.json");
const TOKEN_PATH = join(DATA_DIR, "token.json");

const SCOPES = ["https://www.googleapis.com/auth/drive"];

interface Credentials {
  installed: {
    client_id: string;
    client_secret: string;
  };
}

export async function ensureDataDir(): Promise<void> {
  try { await stat(DATA_DIR); }
  catch { await mkdir(DATA_DIR, { recursive: true }); }
}

export async function loadCredentials(): Promise<Credentials> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    throw new Error(`No credentials at ${CREDENTIALS_PATH}`);
  }
}

export async function loadToken(): Promise<string | null> {
  try {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    const tokens = JSON.parse(raw);
    return tokens.refresh_token || null;
  } catch {
    return null;
  }
}

async function saveToken(tokens: Record<string, any>): Promise<void> {
  await ensureDataDir();
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2));
}

export async function authenticate(credentials: Credentials): Promise<OAuth2Client> {
  const existingRefresh = await loadToken();
  const clientId = credentials.installed.client_id;
  const clientSecret = credentials.installed.client_secret;

  if (existingRefresh) {
    const oauth = new OAuth2Client(clientId, clientSecret);
    oauth.setCredentials({ refresh_token: existingRefresh });
    return oauth;
  }

  const oauth = new OAuth2Client(clientId, clientSecret, "http://localhost:3336/");

  const authUrl = oauth.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://${req.headers.host}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error || code) {
        if (error) {
          res.writeHead(400);
          res.end(`Error: ${error}`);
          server.close();
          reject(new Error(error));
          return;
        }
        try {
          const { tokens } = await oauth.getToken(code!);
          oauth.setCredentials(tokens);
          await saveToken(tokens);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Authorized! You can close this tab.</h1></body></html>");
          server.close();
          resolve(oauth);
        } catch (err: any) {
          res.writeHead(500);
          res.end("Auth failed");
          server.close();
          reject(err);
        }
      }
    });

    server.listen(3336, "127.0.0.1", async () => {
      console.error("");
      console.error("╔══════════════════════════════════════════════════════╗");
      console.error("║      GOOGLE DRIVE AUTHORIZATION REQUIRED            ║");
      console.error("╚══════════════════════════════════════════════════════╝");
      console.error("");
      console.error("Open this in your browser, sign in, click Allow:");
      console.error(`   ${authUrl}`);
      console.error("");
      try {
        const open = (await import("open")).default;
        await open(authUrl);
      } catch {
        // browser didn't open, user can click the link
      }
    });
  });
}
