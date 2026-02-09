import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ubicación del archivo de sesión (en la raíz del paquete shared o home del usuario)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = path.resolve(__dirname, '../../../../.auth-session.json');

export interface SessionData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export function saveSession(data: SessionData) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
  console.log(`Sesión guardada en: ${SESSION_FILE}`);
}

export function loadSession(): SessionData | null {
  if (!fs.existsSync(SESSION_FILE)) return null;
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    return JSON.parse(raw) as SessionData;
  } catch (e) {
    return null;
  }
}