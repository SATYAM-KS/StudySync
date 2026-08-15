import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

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
  if (!apiKey) {
    return {
      isProductiveWork: true,
      confidence: 90,
      activitySummary: 'Focus Study Session',
      category: 'studying',
      reason: 'Standard study session.'
    };
  }

  try {
    let mimeType = 'image/jpeg';
    let data = base64Image;

    const match = base64Image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      data = match[2];
    }

    const prompt = `You are a strict, objective AI Proctor for a computer science, engineering, and technical study accountability platform.
Campaign Name: "${campaignName}"
Claimed Task: "${subjectNote}"

Examine the attached screenshot of the student's screen carefully. Determine if the visible window contains GENUINE CODE, ENGINEERING, COMPUTER SCIENCE, OR TECHNICAL STUDY WORK.

CRITERIA FOR WORK / STUDY (isProductiveWork = true):
- Writing, debugging, or reviewing code in IDEs (VS Code, Cursor, PyCharm, IntelliJ, terminal, shell, Neovim, Jupyter notebooks, Colab, GitHub, GitLab)
- Coding practice & problem solving (LeetCode, HackerRank, Codeforces, NeetCode)
- Technical documentation & references (MDN, Stack Overflow, DevDocs, official API docs, system architecture diagrams)
- Engineering & CS textbooks, academic research papers, technical PDFs, lecture slides, course materials, formula sheets
- Mathematical derivations, engineering calculations, CAD/EDA tools, circuit design
- Technical study notes in Notion, Obsidian, Google Docs, Word, Markdown
- Academic & technical flashcards (Anki, Quizlet)
- YouTube videos ONLY IF they are actual educational coding tutorials, technical lectures, or system design breakdowns with visible code, slides, or technical diagrams.

CRITERIA FOR OFF-TASK / DISTRACTION (isProductiveWork = false):
- Vlogs, daily lifestyle videos, travel videos, car videos, entertainment YouTube videos, comedy clips, reaction videos, movie trailers, anime, Netflix, sports highlights
- Social media feeds (Instagram, TikTok, Twitter/X timeline, Reddit memes, Facebook)
- Video gaming (Steam, PC games, Twitch gaming streams)
- Online shopping, casual lifestyle browsing, general non-technical entertainment

If the screenshot shows an entertainment vlog, lifestyle video, casual YouTube stream, or non-technical entertainment, you MUST return "isProductiveWork": false.

Respond ONLY with valid JSON in this exact structure:
{
  "isProductiveWork": true or false,
  "confidence": 85-100,
  "activitySummary": "Brief 3 to 6 words summary of visible window (e.g. 'Watching YouTube Lifestyle Vlog', 'Coding in VS Code', 'Reading Data Structures PDF')",
  "category": "coding" | "studying" | "reading" | "research" | "writing" | "entertainment" | "social_media" | "gaming" | "idle" | "other",
  "reason": "One concise sentence explaining why this is or is not recognized as genuine technical/engineering/CS study work."
}`;

    const res = await ai.interactions.create({
      model: 'gemini-3.6-flash',
      input: [
        { type: 'text', text: prompt },
        { type: 'image', data, mime_type: mimeType }
      ]
    });

    const text = res.output_text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isProductiveWork: Boolean(parsed.isProductiveWork),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 90,
        activitySummary: parsed.activitySummary || (parsed.isProductiveWork ? 'Technical Study Session' : 'Entertainment/Distraction Detected'),
        category: parsed.category || (parsed.isProductiveWork ? 'studying' : 'entertainment'),
        reason: parsed.reason || (parsed.isProductiveWork ? 'Technical study content verified on screen.' : 'Non-technical entertainment/vlog detected on screen.')
      };
    }

    return {
      isProductiveWork: false,
      confidence: 85,
      activitySummary: 'Unverified Screen Content',
      category: 'entertainment',
      reason: 'No clear technical or engineering study content detected.'
    };
  } catch (err: any) {
    console.error('AI Screen Analysis error:', err?.message || err);
    return {
      isProductiveWork: false,
      confidence: 75,
      activitySummary: 'Inspection Timeout',
      category: 'other',
      reason: 'Could not verify technical study content.'
    };
  }
}
