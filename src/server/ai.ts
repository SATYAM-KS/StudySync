import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_GEMINI_KEY = 'AIzaSyBdLZiSdNRByGBWwkfUIv5BRbDpD9sIUr8';

export interface ScreenAnalysisResult {
  isProductiveWork: boolean;
  confidence: number;
  activitySummary: string;
  category: 'studying' | 'coding' | 'reading' | 'writing' | 'research' | 'entertainment' | 'social_media' | 'gaming' | 'idle' | 'other';
  reason: string;
}

export async function analyzeScreenSnapshot(
  base64Image: string,
  campaignName: string = 'General Study',
  subjectNote: string = 'Focused Work'
): Promise<ScreenAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY || DEFAULT_GEMINI_KEY;
  if (!apiKey) {
    return {
      isProductiveWork: false,
      confidence: 85,
      activitySummary: 'Proctor Unconfigured',
      category: 'other',
      reason: 'AI Proctor API key is not configured.'
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    let mimeType = 'image/jpeg';
    let data = base64Image ? base64Image.trim() : '';

    if (data.includes(';base64,')) {
      const parts = data.split(';base64,');
      const mimeMatch = parts[0].match(/data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+)/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
      data = parts[1];
    } else if (data.startsWith('data:')) {
      const commaIdx = data.indexOf(',');
      if (commaIdx !== -1) {
        data = data.slice(commaIdx + 1);
      }
    }

    // Strip any whitespace, newlines, or carriage returns from base64
    data = data.replace(/\s+/g, '');

    if (!data || data.length < 50) {
      return {
        isProductiveWork: false,
        confidence: 85,
        activitySummary: 'No Screen Frame',
        category: 'idle',
        reason: 'No screen capture frame was received.'
      };
    }

    const prompt = `You are a strict, objective, and fair AI Screen Proctor for StudySync, an online accountability study platform.
Campaign: "${campaignName}"
Claimed Subject / Task: "${subjectNote}"

Examine the student's screen screenshot carefully. Your goal is to distinguish between genuine STUDYING / ACADEMIC / TECHNICAL / PRODUCTIVE WORK and TIMEPASS / LEISURE / ENTERTAINMENT / DISTRACTION / SHOPPING.

============================================================
CRITERIA FOR STUDY & PRODUCTIVE WORK (isProductiveWork = true):
============================================================
1. CODING & TECH: Writing, editing, running, or debugging code in IDEs (VS Code, Cursor, PyCharm, IntelliJ, Terminal, Shell, Jupyter Notebooks, Google Colab, GitHub, GitLab, LeetCode, HackerRank, Codeforces, NeetCode).
2. ACADEMIC STUDY (ANY SUBJECT): Reading, studying, or reviewing materials in Computer Science, Engineering, Mathematics, Physics, Chemistry, Biology, Medicine/Healthcare, Law, Business/Finance, Humanities, Languages, or Competitive Exam Prep (UPSC, SAT, GRE, MCAT, JEE, NEET, etc.).
3. READING & RESEARCH: Textbooks, lecture slides, academic research papers (arXiv, PubMed, IEEE, etc.), technical PDFs, documentation (MDN, Stack Overflow, DevDocs), formula sheets, Wikipedia/Google educational articles.
4. NOTE-TAKING & WRITING: Writing notes, assignments, reports, essays, summaries in Notion, Obsidian, Google Docs, MS Word, OneNote, Apple Notes, Markdown editors.
5. PRACTICE & RECALL: Flashcards (Anki, Quizlet), practice exams, problem sets, calculator, CAD, spreadsheet data analysis.
6. EDUCATIONAL VIDEOS & LECTURES: Video lectures, tutorials, educational courses (YouTube, Coursera, edX, Udemy, Khan Academy) showing educational content, coding demonstrations, slides, mathematical derivations, or academic explanations.
7. STUDY PLATFORM: StudySync interface or study timer alongside or while setting up study session.

============================================================
CRITERIA FOR TIMEPASS & DISTRACTION (isProductiveWork = false):
============================================================
1. ONLINE SHOPPING & E-COMMERCE: Browsing product listings, e-commerce stores (Amazon, Flipkart, audio gear, electronics, clothes, gadgets, music players, shoes, cars, shopping carts, checkout pages).
2. ENTERTAINMENT VIDEOS: Movies, TV series, anime, sitcoms, comedy sketches, vlogs, travel vlogs, celebrity gossip, reaction videos, music videos, sports matches/highlights, gaming livestreams (Twitch/YouTube Gaming).
3. SOCIAL MEDIA & DOOMSCROLLING: Instagram (Reels/Feed), TikTok, YouTube Shorts, Twitter/X feeds, Reddit memes/jokes, Facebook, Snapchat, Discord non-study chats.
4. GAMING: Playing PC/Console games, Steam games, mobile games, browser games, Minecraft, FPS games, etc.
5. CASUAL BROWSING: Celebrity gossip, pop culture news, random non-academic blogs.
6. BLANK / IDLE: Completely blank/black screen, lock screen, screensaver, or desktop with no open apps/study material.

============================================================
OUTPUT FORMAT:
============================================================
Respond ONLY with valid JSON in this exact structure:
{
  "isProductiveWork": true or false,
  "confidence": 85-100,
  "activitySummary": "Brief 3 to 6 words summary of visible screen (e.g. 'Online Shopping on E-Commerce Store', 'Coding in VS Code', 'Watching YouTube Entertainment Vlog', 'Reading Chemistry Textbook', 'Practicing LeetCode Problems')",
  "category": "coding" | "studying" | "reading" | "research" | "writing" | "entertainment" | "social_media" | "gaming" | "idle" | "other",
  "reason": "One concise, clear sentence explaining what is visible on screen and why it is recognized as productive study work or off-task timepass/shopping."
}`;

    const candidateModels = [
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.6-flash'
    ];

    let lastError: any = null;
    for (const modelName of candidateModels) {
      try {
        const res = await ai.interactions.create({
          model: modelName,
          input: [
            { type: 'text', text: prompt },
            { type: 'image', data, mime_type: mimeType }
          ]
        });

        const text = res.output_text || '';
        const cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            isProductiveWork: Boolean(parsed.isProductiveWork),
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 90,
            activitySummary: parsed.activitySummary || (parsed.isProductiveWork ? 'Active Study Session' : 'Entertainment/Distraction Detected'),
            category: parsed.category || (parsed.isProductiveWork ? 'studying' : 'entertainment'),
            reason: parsed.reason || (parsed.isProductiveWork ? 'Study content verified on screen.' : 'Off-task/entertainment detected on screen.')
          };
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`[AI Proctor] Model ${modelName} unavailable/throttled, trying next fallback:`, modelErr?.message || modelErr);
        continue;
      }
    }

    if (lastError) {
      throw lastError;
    }

    return {
      isProductiveWork: false,
      confidence: 85,
      activitySummary: 'Unverified Screen Content',
      category: 'idle',
      reason: 'No clear study or productive content detected on screen.'
    };
  } catch (err: any) {
    console.error('AI Screen Analysis error:', err?.message || err);
    return {
      isProductiveWork: false,
      confidence: 75,
      activitySummary: 'Inspection Error',
      category: 'other',
      reason: 'Could not complete screen verification.'
    };
  }
}
