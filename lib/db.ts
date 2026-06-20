import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import type { Game, Settings, QuizData, Category, AutoFilterReason, CompletionReview, DroppedReview } from './types';

const DB_DIR = path.join(os.homedir(), '.game-backlog');
const DB_PATH = path.join(DB_DIR, 'data.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tag_sentiment (
      tag TEXT PRIMARY KEY,
      positive_count INTEGER DEFAULT 0,
      negative_count INTEGER DEFAULT 0
    );
  `);

  // Migrations — safe to run repeatedly
  const migrations = [
    `ALTER TABLE games ADD COLUMN steam_tags TEXT DEFAULT '[]'`,
    `ALTER TABLE games ADD COLUMN game_type TEXT`,
    `ALTER TABLE games ADD COLUMN is_multiplayer INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN steamspy_sentiment REAL`,
    `ALTER TABLE games ADD COLUMN auto_filtered INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN auto_filter_reason TEXT`,
    `ALTER TABLE games ADD COLUMN recommended INTEGER`,
    `ALTER TABLE games ADD COLUMN analysis_done INTEGER DEFAULT 0`,
    `ALTER TABLE games ADD COLUMN completion_review TEXT`,
    `ALTER TABLE games ADD COLUMN dropped_review TEXT`,
    `ALTER TABLE games ADD COLUMN sgdb_cover_url TEXT`,
    `ALTER TABLE games ADD COLUMN source TEXT DEFAULT 'steam'`,
  ];
  for (const m of migrations) {
    try { _db.exec(m); } catch { /* already exists */ }
  }

  return _db;
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function getSettings(): Settings {
  return {
    steam_api_key: getSetting('steam_api_key') ?? '',
    steam_id: getSetting('steam_id') ?? '',
    anthropic_api_key: getSetting('anthropic_api_key') ?? '',
    steamgriddb_api_key: getSetting('steamgriddb_api_key') ?? '',
    psn_npsso: getSetting('psn_npsso') ?? '',
  };
}

export function saveSettings(settings: Settings): void {
  setSetting('steam_api_key', settings.steam_api_key);
  setSetting('steam_id', settings.steam_id);
  setSetting('anthropic_api_key', settings.anthropic_api_key);
  setSetting('steamgriddb_api_key', settings.steamgriddb_api_key);
  if (settings.psn_npsso !== undefined) setSetting('psn_npsso', settings.psn_npsso);
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
    game_type: row.game_type as string | null,
    is_multiplayer: Boolean(row.is_multiplayer),
    steamspy_sentiment: row.steamspy_sentiment as number | null,
    auto_filtered: Boolean(row.auto_filtered),
    auto_filter_reason: (row.auto_filter_reason as AutoFilterReason) || null,
    recommended: row.recommended === null || row.recommended === undefined ? null : Boolean(row.recommended),
    completion_review: row.completion_review ? (() => { try { return JSON.parse(row.completion_review as string); } catch { return null; } })() : null,
    dropped_review: row.dropped_review ? (() => { try { return JSON.parse(row.dropped_review as string); } catch { return null; } })() : null,
    quiz_completed: Boolean(row.quiz_completed),
    quiz_data: row.quiz_data ? (() => { try { return JSON.parse(row.quiz_data as string); } catch { return null; } })() : null,
    hltb_main: row.hltb_main as number | null,
    hltb_extra: row.hltb_extra as number | null,
    hltb_completionist: row.hltb_completionist as number | null,
    hltb_searched: Boolean(row.hltb_searched),
    analysis_done: Boolean(row.analysis_done),
    sgdb_cover_url: (row.sgdb_cover_url as string) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function getAllGames(): Game[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM games ORDER BY name ASC').all() as Record<string, unknown>[];
  return rows.map(rowToGame);
}

export function getGame(id: string): Game | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM games WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToGame(row) : null;
}

export function getGamesNeedingAnalysis(): Game[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM games WHERE analysis_done = 0 ORDER BY playtime_minutes DESC').all() as Record<string, unknown>[];
  return rows.map(rowToGame);
}

export function getAutoFilteredGames(): Game[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM games WHERE auto_filtered = 1 ORDER BY name ASC').all() as Record<string, unknown>[];
  return rows.map(rowToGame);
}

export function getPendingRecommendations(): Game[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM games
    WHERE auto_filtered = 1
    AND auto_filter_reason = 'likely_completed'
    AND recommended IS NULL
    ORDER BY name ASC
  `).all() as Record<string, unknown>[];
  return rows.map(rowToGame);
}

export function upsertGame(id: string, name: string, playtime_minutes: number): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO games (id, name, playtime_minutes)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      playtime_minutes = excluded.playtime_minutes,
      updated_at = datetime('now')
  `).run(id, name, playtime_minutes);
}

export function upsertPsnGame(id: string, name: string, playtime_minutes: number, cover_url: string | null): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO games (id, name, playtime_minutes, source, sgdb_cover_url)
    VALUES (?, ?, ?, 'psn', ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      playtime_minutes = excluded.playtime_minutes,
      sgdb_cover_url = COALESCE(excluded.sgdb_cover_url, sgdb_cover_url),
      updated_at = datetime('now')
  `).run(id, name, playtime_minutes, cover_url);
}

export function updateGameCategory(id: string, category: Category): void {
  const db = getDb();
  db.prepare(`UPDATE games SET category = ?, updated_at = datetime('now') WHERE id = ?`).run(category, id);
}

export function updateGameTags(id: string, tags: string[]): void {
  const db = getDb();
  db.prepare(`UPDATE games SET tags = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(tags), id);
}

export function updateGameQuiz(id: string, quiz_data: QuizData, category: Category): void {
  const db = getDb();
  db.prepare(`
    UPDATE games SET
      quiz_completed = 1,
      quiz_data = ?,
      category = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(quiz_data), category, id);
}

export function updateGameHltb(id: string, main: number | null, extra: number | null, completionist: number | null): void {
  const db = getDb();
  db.prepare(`
    UPDATE games SET
      hltb_main = ?, hltb_extra = ?, hltb_completionist = ?,
      hltb_searched = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(main, extra, completionist, id);
}

export function updateGameSteamTags(id: string, steam_tags: string[], sentiment: number | null): void {
  const db = getDb();
  db.prepare(`
    UPDATE games SET
      steam_tags = ?, steamspy_sentiment = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(steam_tags), sentiment, id);
}

export function updateGameClaudeAnalysis(id: string, game_type: string, is_multiplayer: boolean): void {
  const db = getDb();
  db.prepare(`
    UPDATE games SET
      game_type = ?, is_multiplayer = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(game_type, is_multiplayer ? 1 : 0, id);
}

export function markAutoFiltered(id: string, reason: AutoFilterReason, category?: Category): void {
  const db = getDb();
  const cat = category ?? (reason === 'likely_completed' ? 'completed' : 'uncategorised');
  db.prepare(`
    UPDATE games SET
      auto_filtered = 1, auto_filter_reason = ?, category = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(reason, cat, id);
}

export function markAnalysisDone(ids: string[]): void {
  const db = getDb();
  const stmt = db.prepare(`UPDATE games SET analysis_done = 1 WHERE id = ?`);
  const run = db.transaction((ids: string[]) => { for (const id of ids) stmt.run(id); });
  run(ids);
}

export function updateCompletionReview(id: string, review: CompletionReview): void {
  const db = getDb();
  // Also feed tag sentiment from the "recommended" answer
  const game = getGame(id);
  if (game?.steam_tags.length) {
    recordTagSentiment(game.steam_tags, review.recommended === 'yes');
  }
  db.prepare(`UPDATE games SET completion_review = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(review), id);
}

export function updateGameCoverUrl(id: string, url: string): void {
  const db = getDb();
  db.prepare(`UPDATE games SET sgdb_cover_url = ?, updated_at = datetime('now') WHERE id = ?`).run(url, id);
}

export function updateDroppedReview(id: string, review: DroppedReview): void {
  const db = getDb();
  const game = getGame(id);
  // Feed tag sentiment: "recommended" answer is the clearest signal.
  // yes → others should play it (positive), no → avoid it (negative), maybe → skip update
  if (game?.steam_tags.length && review.recommended !== 'maybe') {
    recordTagSentiment(game.steam_tags, review.recommended === 'yes');
  }
  db.prepare(`UPDATE games SET dropped_review = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(JSON.stringify(review), id);
}

export function updateGameRecommendation(id: string, recommended: boolean): void {
  const db = getDb();
  db.prepare(`UPDATE games SET recommended = ?, updated_at = datetime('now') WHERE id = ?`).run(recommended ? 1 : 0, id);
}

// ── Tag sentiment ─────────────────────────────────────────────────────────────

export function recordTagSentiment(tags: string[], positive: boolean): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tag_sentiment (tag, positive_count, negative_count)
    VALUES (?, ?, ?)
    ON CONFLICT(tag) DO UPDATE SET
      positive_count = positive_count + excluded.positive_count,
      negative_count = negative_count + excluded.negative_count
  `);
  const run = db.transaction(() => {
    for (const tag of tags) {
      stmt.run(tag, positive ? 1 : 0, positive ? 0 : 1);
    }
  });
  run();
}

export function resetAnalysis(): void {
  const db = getDb();
  db.prepare(`UPDATE games SET analysis_done = 0, auto_filtered = 0, auto_filter_reason = NULL`).run();
}

export function getTagSentimentMap(): Record<string, number> {
  const db = getDb();
  const rows = db.prepare('SELECT tag, positive_count, negative_count FROM tag_sentiment').all() as {
    tag: string; positive_count: number; negative_count: number;
  }[];
  const map: Record<string, number> = {};
  for (const row of rows) {
    const total = row.positive_count + row.negative_count;
    if (total > 0) map[row.tag] = row.positive_count / total;
  }
  return map;
}
