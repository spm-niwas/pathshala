import { GoogleGenAI, Type, type GenerateContentResponse } from '@google/genai';

export interface ScanPageInput {
  pageNumber: number;
  mimeType: string;
  data: string;
}

export interface ScanPagesInput {
  language?: 'en' | 'hi';
  bookTitle?: string;
  chapterTitle?: string;
  pages?: ScanPageInput[];
}

export interface ScanIndexInput {
  language?: 'en' | 'hi';
  bookTitle?: string;
  pages?: ScanPageInput[];
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new HttpError(500, 'GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function generateWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0],
  maxRetries = 2
): Promise<GenerateContentResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delayMs = 600 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export async function scanIndexPages(body: ScanIndexInput) {
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const language = body.language === 'hi' ? 'hi' : 'en';
  const bookTitle = typeof body.bookTitle === 'string' ? body.bookTitle.slice(0, 120) : '';

  if (pages.length === 0) {
    throw new HttpError(400, 'Please add at least one index / contents page photo.');
  }
  if (pages.length > 4) {
    throw new HttpError(400, 'Please upload up to 4 index page photos per scan.');
  }

  const validPages = pages.every(
    (p) =>
      p &&
      typeof p.pageNumber === 'number' &&
      typeof p.mimeType === 'string' &&
      p.mimeType.startsWith('image/') &&
      typeof p.data === 'string' &&
      p.data.length > 20
  );

  if (!validPages) {
    throw new HttpError(400, 'One or more uploaded index page images were invalid.');
  }

  const ai = getGeminiClient();
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

  for (const page of pages) {
    parts.push({ text: `--- Contents / Index Page ${page.pageNumber} ---` });
    parts.push({
      inlineData: {
        mimeType: page.mimeType,
        data: page.data,
      },
    });
  }

  const languageGuide =
    language === 'hi'
      ? 'This textbook is in Hindi (Devanagari script, CBSE Class 3). Preserve Hindi chapter titles faithfully with exact Devanagari spelling and matras. If the contents page lists पाठ / इकाई numbers in Devanagari numerals (१, २, ३), convert chapterNumber to standard integers (1, 2, 3).'
      : 'This textbook is in English (CBSE Class 3). Extract each lesson, chapter, or poem/story title cleanly. If the book organizes lessons under Units (e.g. Unit 1: Fun with Friends -> 1. Colours, 2. Badal and Moti), include each teachable chapter/lesson in reading order.';

  parts.push({
    text: [
      `Book: ${bookTitle || 'Class 3 CBSE Textbook'}`,
      languageGuide,
      'Extract the ordered list of chapters from these Contents / Index page photos.',
      'Rules:',
      '- Skip non-chapter front/back matter such as Preface, Foreword, Note to Teachers, Acknowledgements, Syllabus, or Answer Key.',
      '- For each chapter, return: chapterNumber (positive integer 1, 2, 3...), title (concise chapter name without redundant leading "Chapter 1:" prefix if the number is already in chapterNumber, max 160 chars), and pageRange (e.g. "1-12" or "14" if visible on the index page, otherwise empty string).',
    ].join('\n\n'),
  });

  const response = await generateWithRetry(ai, {
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction:
        'You extract structured table-of-contents chapter lists from photos of Indian school textbooks (CBSE English and Hindi). Never invent chapters not shown in the images.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chapters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                chapterNumber: { type: Type.INTEGER },
                title: { type: Type.STRING },
                pageRange: { type: Type.STRING },
              },
              required: ['chapterNumber', 'title', 'pageRange'],
            },
          },
        },
        required: ['chapters'],
      },
    },
  });

  const rawJson = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawJson);

  if (!parsed || !Array.isArray(parsed.chapters)) {
    throw new HttpError(502, 'Could not read chapter list from the index page. Please try a clearer photo.');
  }

  const cleanedChapters = parsed.chapters
    .map((item: { chapterNumber?: unknown; title?: unknown; pageRange?: unknown }, idx: number) => ({
      chapterNumber:
        typeof item.chapterNumber === 'number' && Number.isFinite(item.chapterNumber) && item.chapterNumber >= 1
          ? Math.min(500, Math.round(item.chapterNumber))
          : idx + 1,
      title: typeof item.title === 'string' ? item.title.trim().slice(0, 160) : '',
      pageRange: typeof item.pageRange === 'string' ? item.pageRange.trim().slice(0, 30) : '',
    }))
    .filter((item: { title: string }) => item.title.length > 0)
    .slice(0, 80);

  return { chapters: cleanedChapters };
}

export async function scanChapterPages(body: ScanPagesInput) {
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const language = body.language === 'hi' ? 'hi' : 'en';
  const bookTitle = typeof body.bookTitle === 'string' ? body.bookTitle.slice(0, 120) : '';
  const chapterTitle = typeof body.chapterTitle === 'string' ? body.chapterTitle.slice(0, 160) : '';

  if (pages.length === 0) {
    throw new HttpError(400, 'Please add at least one textbook page photo before scanning.');
  }
  if (pages.length > 12) {
    throw new HttpError(400, 'Please scan up to 12 pages per batch so each request stays fast and accurate.');
  }

  const validPages = pages.every(
    (p) =>
      p &&
      typeof p.pageNumber === 'number' &&
      typeof p.mimeType === 'string' &&
      p.mimeType.startsWith('image/') &&
      typeof p.data === 'string' &&
      p.data.length > 20
  );

  if (!validPages) {
    throw new HttpError(400, 'One or more uploaded page images were invalid.');
  }

  const ai = getGeminiClient();

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  for (const page of pages) {
    parts.push({ text: `--- Page ${page.pageNumber} ---` });
    parts.push({
      inlineData: {
        mimeType: page.mimeType,
        data: page.data,
      },
    });
  }

  const languageGuide =
    language === 'hi'
      ? 'This textbook is in Hindi (Devanagari script, CBSE Class 3). Transcribe all Hindi Devanagari text faithfully with correct matras, punctuation (।), poems, stories, word meanings (शब्दार्थ), and exercises (प्रश्न-उत्तर, रिक्त स्थान). Keep any English headings or numbers as printed.'
      : 'This textbook is in English (CBSE Class 3). Transcribe all printed text faithfully including chapter headings, stories/poems, word meanings, tables/word problems, and end-of-chapter exercises (Fill in the blanks, Match, Answer these questions).';

  parts.push({
    text: [
      `Book: ${bookTitle || 'Class 3 CBSE Textbook'}`,
      `Chapter: ${chapterTitle || 'Scanned Chapter'}`,
      languageGuide,
      'Return structured JSON with:',
      '1. "pages": one entry per scanned image in order, with extractedText, hasDiagram (true if the page contains an important educational picture, diagram, clock, map, fraction figure, or chart that helps understand a question or concept), and diagramNote (short 1-2 sentence description of what the illustration/diagram shows, or empty string if none).',
      '2. "combinedText": a single clean combined text joining all pages seamlessly in reading order (preserving lesson prose and exercises together as one clean document, fixing broken mid-line wraps, and inserting brief [Picture: ...] notes inline where a diagram is needed to understand the text).',
      '3. "suggestedChapterTitle": if a clear printed chapter/lesson heading appears at the top of the scanned pages (e.g. "Poonam\'s Day Out" or "सीखो"), return that clean heading without the "Chapter 1:" prefix; otherwise return empty string.',
      '4. "suggestedChapterNumber": if a clear printed chapter/unit/पाठ number appears with that heading, return that integer; otherwise return 0.',
    ].join('\n\n'),
  });

  const response = await generateWithRetry(ai, {
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction:
        'You are an accurate textbook OCR and digitization assistant for Class 3 CBSE books in English and Hindi. Never invent text not visible in the photos. Ignore faint page borders or stray background clutter.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                extractedText: { type: Type.STRING },
                hasDiagram: { type: Type.BOOLEAN },
                diagramNote: { type: Type.STRING },
              },
              required: ['pageNumber', 'extractedText', 'hasDiagram', 'diagramNote'],
            },
          },
          combinedText: { type: Type.STRING },
          suggestedChapterTitle: { type: Type.STRING },
          suggestedChapterNumber: { type: Type.INTEGER },
        },
        required: ['pages', 'combinedText', 'suggestedChapterTitle', 'suggestedChapterNumber'],
      },
    },
  });

  const rawJson = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawJson);

  if (!parsed || !Array.isArray(parsed.pages) || typeof parsed.combinedText !== 'string') {
    throw new HttpError(502, 'Received an unexpected format while reading the textbook pages. Please try again.');
  }

  return parsed;
}
