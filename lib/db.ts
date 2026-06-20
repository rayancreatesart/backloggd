import { neon } from '@neondatabase/serverless';
import type { Game, Settings, QuizData, Category, AutoFilterReason, CompletionReview, DroppedReview } from './types';

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL environment variable is not set');
  return neon(url);
}

// Schema is created once on cold start (CREATE IF NOT EXISTS is a fast no-op when tables exist)
let schemaReady = false;
async function ensureSchema() {
  if (schemaReady) return;
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      playtime_minutes INTEGER DEFAULT 0,
      category TEXT DEFAULT 'uncategorised',
      tags TEXT DEFAULT '[]',
      quiz_completed INTEGER DEFAULT 0,
      quiz_data TEXT DEFAULT '{}',
      hltb_main REAL,
      hltb_extra REAL,
      hltb_completionist REAL,
      hltb_searched INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      steam_tags TEXT DEFAULT '[]',
      game_type TEXT,
      is_multiplayer INTEGER DEFAULT 0,
      steamspy_sentiment REAL,
      auto_filtered INTEGER DEFAULT 0,
      auto_filter_reason TEXT,
      recommended INTEGER,
      analysis_done INTEGER DEFAULT 0,
      completion_review TEXT,
      dropped_review TEXT,
      sgdb_cover_url TEXT,
      source TEXT DEFAULT 'steam'
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS tag_sentiment (
      tag TEXT PRIMARY KEY,
      positive_count INTEGER DEFAULT 0,
      negative_count INTEGER DEFAULT 0
    )
  `;
  schemaReady = true;
}

// ── Row mapping ───────────────────────────────────────────────────────────────

function rowToGame(row: Record<string, unknown>): Game {
  return {
    id: row.id as string,
    name: row.name as string,
    source: (row.source as 'steam' | 'psn') || 'steam',
    playtime_minutes: row.playtime_minutes as number,
    category: row.category as Category,
    tags: JSON.parse((row.tags as string) || '[]'),
    steam_tags: JSON.parse((row.steam_tags as string) || '[]'),
    game_type: (row.game_type as string) || null,
    is_multiplayer: Boolean(row.is_multiplayer),
    steamspy_sentiment: (row.steamspy_sentiment as number) ?? null,
    auto_filtered: Boolean(row.auto_filtered),
    auto_filter_reason: (row.auto_filter_reason as AutoFilterReason) || null,
    recommended: row.recommended == null ? null : Boolean(row.recommended),
    completion_review: row.completion_review
      ? (() => { try { return JSON.parse(row.completion_review as string); } catch { return null; } })()
      : null,
    dropped_review: row.dropped_review
      ? (() => { try { return JSON.parse(row.dropped_review as string); } catch { return null; } })()
      : null,
    quiz_completed: Boolean(row.quiz_completed),
    quiz_data: row.quiz_data
      ? (() => { try { return JSON.parse(row.quiz_data as string); } catch { return null; } })()
      : null,
    hltb_main: (row.hltb_main as number) ?? null,
    hltb_extra: (row.hltb_extra as number) ?? null,
    hltb_completionist: (row.hltb_completionist as number) ?? null,
    hltb_searched: Boolean(row.hltb_searched),
    analysis_done: Boolean(row.analysis_done),
    sgdb_cover_url: (row.sgdb_cover_url as string) || null,
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : (row.created_at as string),
    updated_at: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : (row.updated_at as string),
  };
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT value FROM settings WHERE key = ${key}`;
  return (rows[0]?.value as string) ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function getSettings(): Promise<Settings> {
  return {
    steam_api_key:        (await getSetting('steam_api_key')) ?? '',
    steam_id:             (await getSetting('steam_id')) ?? '',
    anthropic_api_key:    (await getSetting('anthropic_api_key')) ?? '',
    steamgriddb_api_key:  (await getSetting('steamgriddb_api_key')) ?? '',
    psn_npsso:            (await getSetting('psn_npsso')) ?? '',
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await setSetting('steam_api_key', settings.steam_api_key);
  await setSetting('steam_id', settings.steam_id);
  await setSetting('anthropic_api_key', settings.anthropic_api_key);
  await setSetting('steamgriddb_api_key', settings.steamgriddb_api_key);
  if (settings.psn_npsso !== undefined) await setSetting('psn_npsso', settings.psn_npsso);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getAllGames(): Promise<Game[]> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT * FROM games ORDER BY name ASC`;
  return (rows as Record<string, unknown>[]).map(rowToGame);
}

export async function getGame(id: string): Promise<Game | null> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT * FROM games WHERE id = ${id}`;
  return rows[0] ? rowToGame(rows[0] as Record<string, unknown>) : null;
}

export async function getGamesNeedingAnalysis(): Promise<Game[]> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT * FROM games WHERE analysis_done = 0 ORDER BY playtime_minutes DESC`;
  return (rows as Record<string, unknown>[]).map(rowToGame);
}

export async function getAutoFilteredGames(): Promise<Game[]> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT * FROM games WHERE auto_filtered = 1 ORDER BY name ASC`;
  return (rows as Record<string, unknown>[]).map(rowToGame);
}

export async function getPendingRecommendations(): Promise<Game[]> {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    SELECT * FROM games
    WHERE auto_filtered = 1
      AND auto_filter_reason = 'likely_completed'
      AND recommended IS NULL
    ORDER BY name ASC
  `;
  return (rows as Record<string, unknown>[]).map(rowToGame);
}

export async function upsertGame(id: string, name: string, playtime_minutes: number): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`
    INSERT INTO games (id, name, playtime_minutes)
    VALUES (${id}, ${name}, ${playtime_minutes})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      playtime_minutes = EXCLUDED.playtime_minutes,
      updated_at = NOW()
  `;
}

export async function upsertPsnGame(id: string, name: string, playtime_minutes: number, cover_url: string | null): Promise<void> {
  await ensureSchema();
  const db = sql();
  await db`
    INSERT INTO games (id, name, playtime_minutes, source, sgdb_cover_url)
    VALUES (${id}, ${name}, ${playtime_minutes}, 'psn', ${cover_url})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      playtime_minutes = EXCLUDED.playtime_minutes,
      sgdb_cover_url = COALESCE(EXCLUDED.sgdb_cover_url, games.sgdb_cover_url),
      updated_at = NOW()
  `;
}

export async function updateGameCategory(id: string, category: Category): Promise<void> {
  const db = sql();
  await db`UPDATE games SET category = ${category}, updated_at = NOW() WHERE id = ${id}`;
}

export async function updateGameTags(id: string, tags: string[]): Promise<void> {
  const db = sql();
  await db`UPDATE games SET tags = ${JSON.stringify(tags)}, updated_at = NOW() WHERE id = ${id}`;
}

export async function updateGameQuiz(id: string, quiz_data: QuizData, category: Category): Promise<void> {
  const db = sql();
  await db`
    UPDATE games SET
      quiz_completed = 1,
      quiz_data = ${JSON.stringify(quiz_data)},
      category = ${category},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function updateGameHltb(id: string, main: number | null, extra: number | null, completionist: number | null): Promise<void> {
  const db = sql();
  await db`
    UPDATE games SET
      hltb_main = ${main},
      hltb_extra = ${extra},
      hltb_completionist = ${completionist},
      hltb_searched = 1,
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function updateGameSteamTags(id: string, steam_tags: string[], sentiment: number | null): Promise<void> {
  const db = sql();
  await db`
    UPDATE games SET
      steam_tags = ${JSON.stringify(steam_tags)},
      steamspy_sentiment = ${sentiment},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function updateGameClaudeAnalysis(id: string, game_type: string, is_multiplayer: boolean): Promise<void> {
  const db = sql();
  await db`
    UPDATE games SET
      game_type = ${game_type},
      is_multiplayer = ${is_multiplayer ? 1 : 0},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function markAutoFiltered(id: string, reason: AutoFilterReason, category?: Category): Promise<void> {
  const cat = category ?? (reason === 'likely_completed' ? 'completed' : 'uncategorised');
  const db = sql();
  await db`
    UPDATE games SET
      auto_filtered = 1,
      auto_filter_reason = ${reason},
      category = ${cat},
      updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function markAnalysisDone(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = sql();
  await db`UPDATE games SET analysis_done = 1 WHERE id = ANY(${ids}::text[])`;
}

export async function updateCompletionReview(id: string, review: CompletionReview): Promise<void> {
  const game = await getGame(id);
  if (game?.steam_tags.length) await recordTagSentiment(game.steam_tags, review.recommended === 'yes');
  const db = sql();
  await db`UPDATE games SET completion_review = ${JSON.stringify(review)}, updated_at = NOW() WHERE id = ${id}`;
}

export async function updateGameCoverUrl(id: string, url: string): Promise<void> {
  const db = sql();
  await db`UPDATE games SET sgdb_cover_url = ${url}, updated_at = NOW() WHERE id = ${id}`;
}

export async function updateDroppedReview(id: string, review: DroppedReview): Promise<void> {
  const game = await getGame(id);
  if (game?.steam_tags.length && review.recommended !== 'maybe') {
    await recordTagSentiment(game.steam_tags, review.recommended === 'yes');
  }
  const db = sql();
  await db`UPDATE games SET dropped_review = ${JSON.stringify(review)}, updated_at = NOW() WHERE id = ${id}`;
}

export async function updateGameRecommendation(id: string, recommended: boolean): Promise<void> {
  const db = sql();
  await db`UPDATE games SET recommended = ${recommended ? 1 : 0}, updated_at = NOW() WHERE id = ${id}`;
}

export async function updateGamePlaytime(id: string, playtime_minutes: number): Promise<void> {
  const db = sql();
  await db`UPDATE games SET playtime_minutes = ${playtime_minutes}, updated_at = NOW() WHERE id = ${id}`;
}

export async function deleteGames(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = sql();
  await db`DELETE FROM games WHERE id = ANY(${ids}::text[])`;
}

// ── Tag sentiment ─────────────────────────────────────────────────────────────

export async function recordTagSentiment(tags: string[], positive: boolean): Promise<void> {
  await ensureSchema();
  const db = sql();
  for (const tag of tags) {
    const pos = positive ? 1 : 0;
    const neg = positive ? 0 : 1;
    await db`
      INSERT INTO tag_sentiment (tag, positive_count, negative_count)
      VALUES (${tag}, ${pos}, ${neg})
      ON CONFLICT (tag) DO UPDATE SET
        positive_count = tag_sentiment.positive_count + EXCLUDED.positive_count,
        negative_count = tag_sentiment.negative_count + EXCLUDED.negative_count
    `;
  }
}

export async function resetAnalysis(): Promise<void> {
  const db = sql();
  await db`UPDATE games SET analysis_done = 0, auto_filtered = 0, auto_filter_reason = NULL`;
}

export async function getTagSentimentMap(): Promise<Record<string, number>> {
  await ensureSchema();
  const db = sql();
  const rows = await db`SELECT tag, positive_count, negative_count FROM tag_sentiment` as {
    tag: string; positive_count: number; negative_count: number;
  }[];
  const map: Record<string, number> = {};
  for (const row of rows) {
    const total = row.positive_count + row.negative_count;
    if (total > 0) map[row.tag] = row.positive_count / total;
  }
  return map;
}
