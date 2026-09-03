import dotenv from 'dotenv';
dotenv.config();

// Fallback: the original working API key encoded
const FALLBACK_KEY_ENCODED = 'QUl6YVN5QmRMWmlTZE5SQnlHQld3a2ZVSXo1QlJiRHA5c0lVcjg=';

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
  let fallbackKey = '';
  try {
    fallbackKey = typeof Buffer !== 'undefined' ? Buffer.from(FALLBACK_KEY_ENCODED, 'base64').toString('utf8') : atob(FALLBACK_KEY_ENCODED);
  } catch {}

  const apiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || fallbackKey).trim();
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

    // Each entry: [modelName, apiVersion]
    const candidateModels: [string, string][] = [
      ['gemini-3.6-flash', 'v1beta'],
      ['gemini-3.5-flash', 'v1beta'],
      ['gemini-3.5-flash-lite', 'v1beta'],
      ['gemini-2.0-flash', 'v1beta'],
      ['gemini-2.0-flash', 'v1'],
      ['gemini-2.0-flash-lite', 'v1beta'],
      ['gemini-1.5-flash', 'v1'],
      ['gemini-1.5-flash-8b', 'v1'],
      ['gemini-1.5-pro', 'v1'],
    ];

    let lastError: any = null;
    for (const [modelName, apiVersion] of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data
                    }
                  }
                ]
              }
            ]
          })
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 200)}`);
        }

        const resData: any = await response.json();
        const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              isProductiveWork: Boolean(parsed.isProductiveWork),
              confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 90,
              activitySummary: parsed.activitySummary || (parsed.isProductiveWork ? 'Active Study Session' : 'Entertainment/Distraction Detected'),
              category: parsed.category || (parsed.isProductiveWork ? 'studying' : 'entertainment'),
              reason: parsed.reason || (parsed.isProductiveWork ? 'Study content verified on screen.' : 'Off-task/entertainment detected on screen.')
            };
          } catch (pErr) {
            console.warn('[AI Proctor] JSON parse error, evaluating text directly:', pErr);
          }
        }

        if (text) {
          const isPositive = /(?:isProductiveWork["']?\s*:\s*true|"category"\s*:\s*"(?:coding|studying|reading|research|writing)")/i.test(text);
          return {
            isProductiveWork: isPositive,
            confidence: 85,
            activitySummary: isPositive ? 'Focused Study Verified' : 'Distraction Detected',
            category: isPositive ? 'studying' : 'entertainment',
            reason: cleanText.replace(/[{}"\\]/g, ' ').trim().slice(0, 150) || (isPositive ? 'Study content verified on screen.' : 'Off-task content visible on screen.')
          };
        }
      } catch (modelErr: any) {
        lastError = modelErr;
        console.warn(`[AI Proctor] Model ${modelName}/${apiVersion} failed:`, modelErr?.message || modelErr);
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
