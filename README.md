# 🎓 StudySync — AI-Proctored Student Study Cohorts & Focus Lounge

StudySync is a real-time collaborative focus and accountability platform for engineering, computer science, and competitive exam cohorts. It pairs flexible daily study goals with automated **AI Screen Verification powered by Google Gemini** to ensure genuine, deep-work focus.

---

## ✨ Features

- ⏱️ **AI Focus Studio & Proctoring**:
  - Automatically takes periodic screen snapshots and evaluates active tasks with Gemini 3.6 Flash.
  - Distinguishes authentic technical/engineering study (code, IDEs, technical documentation, academic textbooks, problem solving) from entertainment (vlogs, games, social media feeds).
  - Automatically credits 5-minute verified focus blocks upon successful inspection.

- 📊 **Real-Time Daily Goal Progress**:
  - Displays daily focus minutes achieved out of total target minutes (e.g. `45m / 420m (11%)`).
  - Interactive circular session timer with 12-hour clock format support across the platform.
  - Persistent active sessions that resume accurately even across browser reloads.

- 👥 **Cohort Campaigns & Flexible Schedules**:
  - Join study campaigns with flexible daily hours and preferred group study slots.
  - Admin access gating (applications require review & approval from the campaign admin before access is granted).

- 🎙️ **Live Voice Rooms & Community Chat**:
  - Peer-to-peer audio lounges for co-working study sessions.
  - Real-time room chat with markdown support, file attachments, and active presence indicators.

- 🏆 **Live Leaderboards & Accountability**:
  - Real-time leaderboard updates as cohort members log verified focus blocks.
  - Streak tracking, milestone badges, and weekly breakdown analytics.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Backend**: Node.js, Express, Socket.IO, `@google/genai` (Gemini API)
- **Database & Storage**: JSON file database persistence, WebRTC voice mesh / LiveKit

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- A [Google Gemini API Key](https://aistudio.google.com/app/apikey)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/SATYAM-KS/StudySync.git
   cd StudySync
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and fill in your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   JWT_SECRET=your_jwt_secret_here
   APP_URL=http://localhost:3000
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

---

## 🔒 Security & Privacy

- Screen sharing captures are sent securely to the AI Proctor API for evaluation and are never shared publicly.
- `.env` and local database files are excluded by `.gitignore` to prevent sensitive credentials and personal data from being committed.

---

## 📄 License

MIT License. Open source for educational and cohort study use.