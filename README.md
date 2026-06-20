# Game Backlog

A personal game library manager for Steam and PlayStation. Tracks your backlog, analyses games using community data and AI, and helps you decide what to play next.

![Game Backlog Dashboard](public/next.svg)

## Features

- **Steam & PSN sync** — imports your full library from both platforms
- **Smart categorisation** — AI-powered analysis sorts games into Play Now, Play Later, Don't Bother, etc.
- **Recommendations** — IDF-weighted tag similarity + genre matching suggests what to play based on games you've loved
- **Backlog hero** — carousel of your top picks with Steam hero artwork
- **Recently added** — see what's new across both libraries at a glance
- **Cross-platform deduplication** — removes duplicate entries when you own a game on both Steam and PSN
- **Review flow** — log why you dropped or completed a game to improve future recommendations

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router, TypeScript)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local SQLite database stored at `~/.game-backlog/data.db`
- [Tailwind CSS 4](https://tailwindcss.com)
- [psn-api](https://github.com/achievements-app/psn-api) — PlayStation Network library sync
- [SteamSpy](https://steamspy.com/api.php) — community tags and sentiment
- [HowLongToBeat](https://howlongtobeat.com) — completion time estimates
- [SteamGridDB](https://www.steamgriddb.com) — fallback cover art

## Setup

### Prerequisites

- Node.js 18+
- A [Steam Web API key](https://steamcommunity.com/dev/apikey)
- Your Steam 64-bit ID (find it at [steamid.io](https://steamid.io))

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/game-backlog.git
cd game-backlog
npm install
```

### 2. Add environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your keys:

```
STEAM_API_KEY=your_steam_api_key
STEAMGRIDDB_API_KEY=your_steamgriddb_api_key   # optional
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The onboarding flow will walk you through connecting Steam (and optionally PSN).

The SQLite database is created automatically at `~/.game-backlog/data.db` on first run — nothing is written to the project directory.

## Connecting PlayStation Network (optional)

PSN uses an NPSSO token for authentication (no API key required):

1. Sign in at [store.playstation.com](https://store.playstation.com)
2. In the same browser, visit: `https://ca.account.sony.com/api/v1/ssocookie`
3. Copy the `npsso` value from the JSON response
4. Paste it into the PSN setup screen in the app

Tokens are valid for ~2 years and are stored locally only.

## AI classification (optional)

Game type detection and smart categorisation uses Claude via the Anthropic API.

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. Add it in **Settings** inside the app

Without a key, the app still works — games just won't have an AI-generated game type label, which slightly reduces recommendation quality.

## Data & privacy

All data is stored locally in `~/.game-backlog/data.db`. Nothing is sent to any server except:
- Steam/PSN APIs to sync your library
- SteamSpy/HLTB for public game metadata
- Anthropic API (only if you add a key) for game classification

## License

MIT
