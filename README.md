# Would You Rather? 🤔

Play Would You Rather with friends across devices! 10,000 questions, live voting, multiplayer with room codes!

## Play Online
Visit the GitHub Pages version (demo mode with simulated votes):
https://gabriel18278172.github.io/would-you-rather-game/

## Run with Real Vote Tracking
To get REAL votes from real people:

1. Clone this repo
2. Run `node server.js`
3. Open http://localhost:3000
4. Share the URL — every vote is real and permanent!

No `npm install` needed — **zero dependencies**. Only Node.js built-ins are used.

### Deploy for free (no account needed beyond GitHub):
- **Render.com**: Connect GitHub repo → auto deploys
- **Railway.app**: Import from GitHub → instant deploy

### Zero dependencies
This server uses ONLY Node.js built-in modules (`http`, `fs`, `path`, `url`). No npm install needed.

### How it works
- Votes are stored in `data/votes.json` on the server
- When served via `node server.js`, every vote is real and persistent
- When running on GitHub Pages (static hosting), the game falls back to simulated crowd data automatically
