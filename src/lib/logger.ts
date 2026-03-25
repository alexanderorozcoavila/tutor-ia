import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'errors.log');

export function logError(error: any, context?: string) {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR);
    }

    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${context ? `(${context}) ` : ''}${error?.stack || error}\n`;

    fs.appendFileSync(LOG_FILE, entry);
    console.error(entry);
  } catch (err) {
    console.error('Error al escribir en el log:', err);
  }
}
