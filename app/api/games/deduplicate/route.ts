import { NextResponse } from 'next/server';
import { getAllGames } from '@/lib/db';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDb() {
  return new Database(path.join(os.homedir(), '.game-backlog', 'data.db'));
}

// PS5 title IDs start with PPSA, PS4 with CUSA
function isPs5(id: string): boolean {
  return id.replace('psn_', '').toUpperCase().startsWith('PPSA');
}

export async function GET() {
  const games = getAllGames();
  const steamGames = games.filter(g => g.source === 'steam');
  const psnGames = games.filter(g => g.source === 'psn');

  let count = 0;

  // Cross-platform: same game on Steam and PSN
  for (const psn of psnGames) {
    const match = steamGames.find(s => normaliseName(s.name) === normaliseName(psn.name));
    if (match) count++;
  }

  // Within PSN: PS4 and PS5 versions of the same game
  const seen = new Map<string, string>(); // normName → id to keep
  for (const psn of psnGames) {
    const key = normaliseName(psn.name);
    if (seen.has(key)) {
      count++;
    } else {
      seen.set(key, psn.id);
    }
  }

  return NextResponse.json({ count });
}

export async function POST() {
  const games = getAllGames();
  const steamGames = games.filter(g => g.source === 'steam');
  const psnGames = games.filter(g => g.source === 'psn');

  const toRemove = new Set<string>();
  const db = getDb();

  // ── Step 1: Remove cross-platform dupes (Steam wins) ──────────────────────
  for (const psn of psnGames) {
    const match = steamGames.find(s => normaliseName(s.name) === normaliseName(psn.name));
    if (match) {
      // Merge playtime if PSN played more
      if (psn.playtime_minutes > match.playtime_minutes) {
        db.prepare(`UPDATE games SET playtime_minutes = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(psn.playtime_minutes, match.id);
      }
      toRemove.add(psn.id);
    }
  }

  // ── Step 2: Remove within-PSN dupes (PS5 wins; fallback: most playtime) ───
  const remainingPsn = psnGames.filter(g => !toRemove.has(g.id));
  const byName = new Map<string, typeof remainingPsn>();

  for (const psn of remainingPsn) {
    const key = normaliseName(psn.name);
    const group = byName.get(key) ?? [];
    group.push(psn);
    byName.set(key, group);
  }

  for (const group of byName.values()) {
    if (group.length < 2) continue;

    // Pick the keeper: prefer PS5 version, then highest playtime
    const ps5 = group.find(g => isPs5(g.id));
    const keeper = ps5 ?? group.reduce((best, g) => g.playtime_minutes > best.playtime_minutes ? g : best);
    const maxPlaytime = Math.max(...group.map(g => g.playtime_minutes));

    // Merge playtime onto keeper if another version had more
    if (maxPlaytime > keeper.playtime_minutes) {
      db.prepare(`UPDATE games SET playtime_minutes = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(maxPlaytime, keeper.id);
    }

    for (const g of group) {
      if (g.id !== keeper.id) toRemove.add(g.id);
    }
  }

  // ── Delete all marked entries ──────────────────────────────────────────────
  const ids = [...toRemove];
  if (ids.length > 0) {
    const stmt = db.prepare(`DELETE FROM games WHERE id = ?`);
    const run = db.transaction((list: string[]) => { for (const id of list) stmt.run(id); });
    run(ids);
  }

  db.close();
  return NextResponse.json({ removed: ids.length });
}
