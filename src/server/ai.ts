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

    const prompt = `You are a strict, uncompromising, and highly vigilant AI Screen Proctor for StudySync, an elite online accountability study platform.
Campaign: "${campaignName}"
Claimed Subject / Task: "${subjectNote}"

Examine the student's screen screenshot with extreme scrutiny. You must detect ANY non-study distractions, media players, or entertainment apps visible anywhere on screen.

============================================================
STRICT ZERO-TOLERANCE DISTRACTION RULES (isProductiveWork = false):
============================================================
If ANY of the following are visible ANYWHERE on the screen (whether in full screen, split screen, side panel, corner window, picture-in-picture, background window, or floating overlay), you MUST mark isProductiveWork = false:

1. MUSIC & AUDIO STREAMING APPS:
   - Spotify, Apple Music, YouTube Music, Amazon Music, SoundCloud, Wynk, Gaana, JioSaavn, or desktop music players.
   - If Spotify or any music browsing window, playlist, song title (e.g. songs, artists, albums, music lyrics, music player controls) is visible on screen, it is OFF-TASK / DISTRACTED.

2. NON-EDUCATIONAL VIDEOS & ENTERTAINMENT:
   - Music videos, commercial advertisements (e.g. NESCAFE, brand ads), movie trailers, movies, Netflix, Prime Video, Disney+, anime, sitcoms, comedy sketches, vlogs, travel vlogs, celebrity gossip, reaction videos, sports matches, gaming streams (Twitch/Kick/YouTube Gaming).
   - RULE FOR VIDEOS: If a video is playing/visible, it MUST be an explicit educational lecture, programming tutorial, or academic lesson. Any music video, advertisement, or entertainment video immediately disqualifies the session.

3. SOCIAL MEDIA & CHATS:
   - Instagram (Reels/Feed), TikTok, YouTube Shorts, Twitter/X, Reddit memes/feeds, Facebook, Snapchat, Discord (non-study gaming/casual chats), Telegram/WhatsApp personal chats.

4. ONLINE SHOPPING & E-COMMERCE:
   - Amazon, Flipkart, Myntra, electronics/gear shopping, fashion, product listings, price comparison, checkout pages.

5. GAMING & CASUAL BROWSING:
   - PC/browser games, Steam, Discord gaming, celebrity news, gossip, non-academic blogs.

6. SPLIT SCREEN CONTAMINATION:
   - Split-screen / multi-window is ONLY permitted if EVERY SINGLE visible window is legitimate academic/technical study material (e.g., VS Code + Official Documentation, Textbook PDF + Notion Notes).
   - If one side has code/study but the other side or background has Spotify, music, YouTube entertainment, shopping, or social media, the entire screen is CONTAMINATED and MUST be flagged as isProductiveWork = false.

7. BLANK / IDLE SCREEN:
   - Desktop wallpaper with no study apps, blank/black screen, lock screen, screensaver.

============================================================
GENUINE STUDY & PRODUCTIVE WORK CRITERIA (isProductiveWork = true):
============================================================
ONLY mark isProductiveWork = true if 100% of the active/visible screen content is dedicated to focused study/work without any entertainment/music app visible:
1. CODING & TECHNICAL: Writing, editing, debugging code in IDEs (VS Code, Cursor, PyCharm, IntelliJ, Xcode, Eclipse, Sublime, Vim, Terminal, Shell, PowerShell, Jupyter, Colab, GitHub, LeetCode, HackerRank, Codeforces, NeetCode).
2. ACADEMIC MATERIALS: Reading textbooks, research papers (arXiv, PubMed, IEEE), lecture slides, technical PDFs, formula sheets, documentation (MDN, Stack Overflow, DevDocs).
3. NOTE-TAKING & ESSAYS: Notion, Obsidian, Google Docs, Word, OneNote, Markdown notes dedicated to study.
4. ACADEMIC PRACTICE: Flashcards (Anki, Quizlet), problem sets, CAD, data analysis.
5. EDUCATIONAL LECTURES: Video tutorials/lectures strictly showing code, math derivations, slides, textbook diagrams, or academic instructions.

============================================================
OUTPUT FORMAT (Valid JSON ONLY):
============================================================
Respond ONLY with valid JSON in this exact structure:
{
  "isProductiveWork": false or true,
  "confidence": 90-100,
  "activitySummary": "Brief 3 to 6 words summary (e.g. 'Spotify Music App Visible on Screen', 'Coding in VS Code', 'Entertainment Video / Ad Visible', 'Reading Physics Textbook', 'Split Screen with Music Player')",
  "category": "entertainment" | "social_media" | "gaming" | "coding" | "studying" | "reading" | "research" | "writing" | "idle" | "other",
  "reason": "One concise, clear sentence explaining specifically what is visible on screen and why it is categorized as off-task/distracted or genuine focused study."
}`;

    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
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
