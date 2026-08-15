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
- **Database & Storage**: Persistent JSON store (`DATA_DIR` configurable), WebRTC voice mesh / LiveKit

---

## 🚀 Local Development

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
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Production Deployment

StudySync is a **full-stack unified application** — the backend Node server serves both the REST/WebSocket API and the compiled Vite React frontend on a single port.

### Option 1: Deploy on Render / Railway (Recommended)

1. Connect your GitHub repository (`SATYAM-KS/StudySync`) on [Render](https://render.com) or [Railway](https://railway.app).
2. Set the following configuration:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Add Environment Variables in the platform dashboard:
   - `GEMINI_API_KEY`: `your_gemini_api_key`
   - `JWT_SECRET`: `a-strong-random-secret`
   - `NODE_ENV`: `production`
4. *(Optional for Persistent Data)*: Add a Persistent Disk mount at `/app/data` (or set `DATA_DIR=/var/data` with a mounted volume).

---

### Option 2: Deploy with Docker

```bash
# Build the Docker image
docker build -t studysync .

# Run container with persistent data volume
docker run -d \
  -p 3000:3000 \
  -e GEMINI_API_KEY="your_api_key" \
  -e JWT_SECRET="your_secret" \
  -v studysync_data:/app/data \
  --name studysync-app \
  studysync
```

---

## 🔒 Security & Privacy

- Screen sharing captures are analyzed securely by the AI Proctor API for focus verification and are not publicly shared.
- Environment variables and credentials are protected by `.gitignore` and `.dockerignore`.

---

## 📄 License

MIT License. Open source for educational and cohort study use.