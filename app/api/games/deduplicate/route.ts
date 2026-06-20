import { NextResponse } from 'next/server';
import { getAllGames, updateGamePlaytime, deleteGames } from '@/lib/db';

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPs5(id: string): boolean {
  return id.replace('psn_', '').toUpperCase().startsWith('PPSA');
}

export async function GET() {
  const games = await getAllGames();
  const steamGames = games.filter(g => g.source === 'steam');
  const psnGames = games.filter(g => g.source === 'psn');

  let count = 0;

  for (const psn of psnGames) {
    const match = steamGames.find(s => normaliseName(s.name) === normaliseName(psn.name));
    if (match) count++;
  }

  const seen = new Map<string, string>();
  for (const psn of psnGames) {
    const key = normaliseName(psn.name);
    if (seen.has(key)) count++;
    else seen.set(key, psn.id);
  }

  return NextResponse.json({ count });
}

export async function POST() {
  const games = await getAllGames();
  const steamGames = games.filter(g => g.source === 'steam');
  const psnGames = games.filter(g => g.source === 'psn');

  const toRemove = new Set<string>();

  // Step 1: Remove cross-platform dupes (Steam wins)
  for (const psn of psnGames) {
    const match = steamGames.find(s => normaliseName(s.name) === normaliseName(psn.name));
    if (match) {
      if (psn.playtime_minutes > match.playtime_minutes) {
        await updateGamePlaytime(match.id, psn.playtime_minutes);
      }
      toRemove.add(psn.id);
    }
  }

  // Step 2: Remove within-PSN dupes (PS5 wins, then most playtime)
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
    const ps5 = group.find(g => isPs5(g.id));
    const keeper = ps5 ?? group.reduce((best, g) => g.playtime_minutes > best.playtime_minutes ? g : best);
    const maxPlaytime = Math.max(...group.map(g => g.playtime_minutes));
    if (maxPlaytime > keeper.playtime_minutes) {
      await updateGamePlaytime(keeper.id, maxPlaytime);
    }
    for (const g of group) {
      if (g.id !== keeper.id) toRemove.add(g.id);
    }
  }

  await deleteGames([...toRemove]);
  return NextResponse.json({ removed: toRemove.size });
}
