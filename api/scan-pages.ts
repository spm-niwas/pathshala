import { HttpError, scanChapterPages, type ScanPagesInput } from '../server/scanner.ts';

interface ServerlessReq {
  method?: string;
  body?: unknown;
}

interface ServerlessRes {
  status: (code: number) => ServerlessRes;
  json: (body: unknown) => void;
}

export default async function handler(req: ServerlessReq, res: ServerlessRes) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const result = await scanChapterPages((req.body || {}) as ScanPagesInput);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in Vercel /api/scan-pages:', error);
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Failed to scan textbook pages.';
    res.status(500).json({ error: message });
  }
}
