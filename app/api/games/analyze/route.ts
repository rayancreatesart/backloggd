import { NextResponse } from 'next/server';
import {
  getGamesNeedingAnalysis,
  updateGameSteamTags,
  updateGameHltb,
  updateGameClaudeAnalysis,
  markAutoFiltered,
  markAnalysisDone,
  getSetting,
} from '@/lib/db';
import { HowLongToBeatService } from 'howlongtobeat';
import type { Game } from '@/lib/types';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchSteamSpyData(appid: string): Promise<{ tags: string[]; sentiment: number | null }> {
  try {
    const res = await fetch(`https://steamspy.com/api.php?request=appdetails&appid=${appid}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { tags: [], sentiment: null };
    const data = await res.json();
    const tags = Object.keys(data.tags || {}).slice(0, 12);
    const pos = data.positive ?? 0;
    const neg = data.negative ?? 0;
    const total = pos + neg;
    const sentiment = total > 50 ? pos / total : null;
    return { tags, sentiment };
  } catch {
    return { tags: [], sentiment: null };
  }
}

async function fetchHltbMain(gameName: string): Promise<number | null> {
  try {
    const hltb = new HowLongToBeatService();
    const results = await hltb.search(gameName);
    if (results?.length > 0 && results[0].gameplayMain > 0) return results[0].gameplayMain;
    return null;
  } catch {
    return null;
  }
}

async function analyzeWithClaude(
  games: Array<{ id: string; name: string; steam_tags: string[]; hltb_main: number | null }>,
  apiKey: string
): Promise<Array<{ game_type: string; is_multiplayer: boolean }>> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const gamesText = games
    .map(
      (g, i) =>
        `${i + 1}. "${g.name}"\n   Tags: ${g.steam_tags.slice(0, 8).join(', ') || 'none'}\n   HLTB: ${g.hltb_main ? g.hltb_main + 'h' : 'unknown'}`
    )
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are analyzing Steam games for a personal backlog manager. For each game, determine:

1. game_type: A concise label describing the primary experience (e.g. "open-world RPG", "competitive FPS", "narrative adventure", "couch co-op platformer", "city builder", "MMORPG", "visual novel")
2. is_multiplayer: true ONLY if the game is PRIMARILY a multiplayer experience (MMOs, battle royales, competitive online games). Games with mainly single-player content + optional co-op = false.

Games to analyze:
${gamesText}

Return ONLY a valid JSON array of exactly ${games.length} objects in the same order:
[{"game_type": "...", "is_multiplayer": false}, ...]

No markdown, no explanation, just the JSON array.`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text'
      ? response.content[0].text.trim().replace(/^```json?\n?/, '').replace(/\n?```$/, '')
      : '[]';

  try {
    return JSON.parse(text);
  } catch {
    return games.map(() => ({ game_type: 'unknown', is_multiplayer: false }));
  }
}

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        const games = await getGamesNeedingAnalysis();

        if (games.length === 0) {
          send({ type: 'complete', filtered: [] });
          controller.close();
          return;
        }

        send({ type: 'start', total: games.length });

        // ── Phase 1: SteamSpy + HLTB ──────────────────────────────────────
        const enriched: (Game & { steam_tags: string[] })[] = [];

        for (let i = 0; i < games.length; i++) {
          const game = games[i];
          send({ type: 'progress', phase: 'tags', current: i + 1, total: games.length, game: game.name });

          const spy = await fetchSteamSpyData(game.id);
          await updateGameSteamTags(game.id, spy.tags, spy.sentiment);

          let hltb_main = game.hltb_main;
          if (!game.hltb_searched) {
            hltb_main = await fetchHltbMain(game.name);
            await updateGameHltb(game.id, hltb_main, game.hltb_extra, game.hltb_completionist);
            await sleep(400);
          }

          enriched.push({ ...game, steam_tags: spy.tags, hltb_main });
          await sleep(300);
        }

        // ── Phase 2: Claude classification ────────────────────────────────
        const apiKey = await getSetting('anthropic_api_key');

        if (apiKey) {
          const BATCH = 15;
          for (let i = 0; i < enriched.length; i += BATCH) {
            const batch = enriched.slice(i, i + BATCH);
            send({
              type: 'progress',
              phase: 'claude',
              current: Math.min(i + BATCH, enriched.length),
              total: enriched.length,
              game: batch[0].name,
            });

            try {
              const results = await analyzeWithClaude(batch, apiKey);
              for (let j = 0; j < batch.length; j++) {
                const r = results[j];
                if (r) {
                  await updateGameClaudeAnalysis(batch[j].id, r.game_type, r.is_multiplayer);
                  enriched[i + j].is_multiplayer = r.is_multiplayer;
                }
              }
            } catch {
              send({ type: 'warning', message: `Claude analysis failed for batch — continuing without it` });
            }
            await sleep(500);
          }
        } else {
          send({ type: 'warning', message: 'No Anthropic API key — skipping AI classification' });
        }

        // ── Phase 3: Auto-filter rules ────────────────────────────────────
        const filtered: Array<{ id: string; name: string; reason: string }> = [];

        for (const game of enriched) {
          if (game.is_multiplayer && game.playtime_minutes > 600) {
            await markAutoFiltered(game.id, 'multiplayer_enough', 'uncategorised');
            filtered.push({ id: game.id, name: game.name, reason: 'multiplayer_enough' });
          } else if (game.hltb_main !== null && game.playtime_minutes >= game.hltb_main * 60 * 0.85) {
            await markAutoFiltered(game.id, 'likely_completed', 'completed');
            filtered.push({ id: game.id, name: game.name, reason: 'likely_completed' });
          }
        }

        await markAnalysisDone(enriched.map(g => g.id));
        send({ type: 'complete', filtered });
      } catch (e) {
        send({ type: 'error', message: String(e) });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// POST — reset so all games get re-analysed on next GET
export async function POST() {
  try {
    const { resetAnalysis } = await import('@/lib/db');
    await resetAnalysis();
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
