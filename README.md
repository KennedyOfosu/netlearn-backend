# NetLearn Backend — Setup Guide

Real-time leaderboard backend for the NetLearn Platform.
Built with **Node.js**, **Express**, **Socket.IO**, and **PostgreSQL (Supabase)**.

---

## 1. Create Your Supabase Database

1. Go to [supabase.com](https://supabase.com) → **Start your project** (free)
2. Sign in with GitHub or email
3. Click **New Project** → give it a name (e.g. `netlearn`) → set a database password → **Create Project**
4. Wait ~1 minute for the project to start
5. Go to **Project Settings → Database → Connection string**
6. Select **URI** mode and copy the string — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-REF].supabase.co:5432/postgres
   ```
7. Save this — you'll need it in step 2

> ✅ The backend will automatically create the `scores` table on first start. No SQL needed.

---

## 2. Configure Environment Variables

```bash
# In the netlearn-backend/ folder
cp .env.example .env
```

Edit `.env` and fill in:
```
DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@db.YOUR-REF.supabase.co:5432/postgres
ADMIN_KEY=netlearn2024
FRONTEND_URL=https://YOUR-GITHUB-USERNAME.github.io
PORT=3000
```

> ⚠️ Change `ADMIN_KEY` to something only you know — this protects the admin dashboard.

---

## 3. Install & Run Locally

```bash
cd netlearn-backend
npm install
npm start
```

You should see:
```
[DB] Schema ready
🚀 NetLearn backend running on port 3000
   Admin dashboard → http://localhost:3000/admin
   Admin key       → netlearn2024
```

Test it at:
- `http://localhost:3000/health` → `{"status":"ok"}`
- `http://localhost:3000/admin` → Admin login screen

---

## 4. Deploy to Render.com

1. Push the `netlearn-backend/` folder to a **new GitHub repository**
   - Create repo at [github.com/new](https://github.com/new) (e.g. `netlearn-backend`)
   - Upload the files (or use Git)

2. Go to [render.com](https://render.com) → **New → Web Service**

3. Connect your GitHub repo

4. Configure:
   | Setting | Value |
   |---|---|
   | **Name** | `netlearn-backend` |
   | **Runtime** | Node |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Plan** | Free |

5. Click **Advanced → Add Environment Variables** and add:
   - `DATABASE_URL` → your Supabase URI
   - `ADMIN_KEY` → your chosen password
   - `FRONTEND_URL` → `https://yourusername.github.io`

6. Click **Create Web Service** → wait 2–3 minutes

7. Your backend URL will be something like:
   ```
   https://netlearn-backend.onrender.com
   ```
   Save this URL!

---

## 5. Connect the Frontend

Open `NetLearn Platform/index.html` and find this line near the top of the `<script>`:

```js
const BACKEND_URL = ''; // ← paste your Render URL here
```

Change it to:
```js
const BACKEND_URL = 'https://netlearn-backend.onrender.com';
```

Then commit and push `index.html` to your GitHub Pages repo.
The frontend will now submit scores and show the global leaderboard.

---

## 6. Access the Admin Dashboard

Go to:
```
https://netlearn-backend.onrender.com/admin
```

Enter your `ADMIN_KEY` (default: `netlearn2024`) to log in.

You'll see:
- **Real-time stats** — total players, today's games, all-time high score
- **Leaderboards** — Time Attack, Quiz, IP Class tabs with full rankings
- **Live Feed** — every score submission appears here in real-time
- **Export CSV** — download any leaderboard as a spreadsheet

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/scores` | None | Submit a player score |
| `GET` | `/api/leaderboard/:game` | None | Get top scores (`time_attack`, `quiz`, `ip_class`) |
| `GET` | `/api/admin/verify?key=...` | Admin key | Verify admin key |
| `GET` | `/api/admin/stats?key=...` | Admin key | Full stats for dashboard |
| `GET` | `/admin` | — | Admin dashboard page |
| `GET` | `/health` | None | Health check |

### Score Payload
```json
POST /api/scores
{
  "player_name": "Alice",
  "game": "time_attack",
  "score": 350,
  "correct": 12,
  "total": 15
}
```

### Games
| game | score field meaning | correct field |
|---|---|---|
| `time_attack` | Points earned | Correct answers |
| `quiz` | Correct answers × 10 | Correct answers |
| `ip_class` | Best streak | Total correct |

---

## Notes

- **Free tier warning:** Render.com's free tier spins down after 15 minutes of inactivity. The first request after a spin-down takes ~30 seconds. Upgrade to a paid plan for always-on hosting.
- **Supabase free tier** gives 500MB storage and 2GB bandwidth/month — more than enough for a classroom.
- Scores are stored permanently in the database and persist across server restarts.
