import { app } from '../server.ts';
import { initDb } from '../src/server/db.ts';

let isInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isInitialized) {
    try {
      await initDb();
      isInitialized = true;
    } catch (e) {
      console.error('Vercel initDb error:', e);
    }
  }
  return app(req, res);
}
