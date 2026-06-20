import { NextRequest, NextResponse } from 'next/server';
import { getAllGames } from '@/lib/db';
import type { Game, GameSuggestion, CompletionReview } from '@/lib/types';

type SuggestCategory = 'play_now' | 'play_later' | 'dont_bother' | 'dropped';

// ── IDF weighting ──────────────────────────────────────────────────────────────
// Tags shared by many games (Action, Indie, Singleplayer) carry almost no genre
// signal. Rare tags (Soulslike, Colony Sim, Bullet Hell) are meaningful.

function buildTagIdf(games: Game[]): Map<string, number> {
  const counts = new Map<string, number>();
  const N = games.length;
  for (const g of games) {
    for (const t of g.steam_tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [tag, count] of counts) {
    idf.set(tag, Math.log((N + 1) / (count + 1)));
  }
  return idf;
}

function weightedTagSimilarity(
  tagsA: string[],
  tagsB: string[],
  idf: Map<string, number>
): number {
  if (!tagsA.length || !tagsB.length) return 0;
  const setB = new Set(tagsB);
  let score = 0;
  for (const tag of tagsA) {
    if (setB.has(tag)) score += idf.get(tag) ?? 0;
  }
  const maxScore = tagsA.reduce((s, t) => s + (idf.get(t) ?? 0), 0);
  return maxScore > 0 ? score / maxScore : 0;
}

// ── Genre (game_type) similarity ───────────────────────────────────────────────

const GENRE_STOPWORDS = new Set(['game', 'based', 'with', 'and', 'the', 'for', 'style']);

function gameTypeWords(gt: string | null): Set<string> {
  if (!gt) return new Set();
  return new Set(
    gt.toLowerCase()
      .split(/[\s\-,/]+/)
      .filter(w => w.length > 3 && !GENRE_STOPWORDS.has(w))
  );
}

type GenreSim = { score: number; known: boolean };

function gameTypeSimilarity(a: string | null, b: string | null): GenreSim {
  const wa = gameTypeWords(a);
  const wb = gameTypeWords(b);
  if (!wa.size || !wb.size) return { score: 0.5, known: false };
  let overlap = 0;
  for (const w of wa) { if (wb.has(w)) overlap++; }
  return { score: overlap / Math.max(wa.size, wb.size), known: true };
}

// Confirmed genre mismatch → near-zero influence.
// Unknown genre → neutral. Full genre match → full weight.
function genreMultiplier(gs: GenreSim): number {
  if (!gs.known) return 0.45;
  if (gs.score === 0) return 0.05;
  return 0.1 + 0.9 * gs.score;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function positiveReviewScore(review: CompletionReview | null): number {
  if (!review) return -1;
  let score = 0;
  if (review.enjoyed === 'yes') score++;
  if (review.play_again === 'yes') score++;
  if (review.recommended === 'yes') score++;
  return score;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Reason builder ─────────────────────────────────────────────────────────────

function buildReason(
  game: Game,
  similar: Array<{ game: Game; tagSim: number; genreSim: GenreSim }>,
  category: SuggestCategory
): string {
  const s = game.steamspy_sentiment;
  const pct = s !== null ? Math.round(s * 100) : null;

  let sentimentPhrase = '';
  if (pct !== null) {
    if (pct >= 95)      sentimentPhrase = `${pct}% of players love it`;
    else if (pct >= 85) sentimentPhrase = `well-liked by ${pct}% of players`;
    else if (pct >= 70) sentimentPhrase = `decent reviews — ${pct}% positive`;
    else if (pct >= 60) sentimentPhrase = `mixed reception — only ${pct}% positive`;
    else if (pct >= 40) sentimentPhrase = `poor reviews — only ${pct}% liked it`;
    else                sentimentPhrase = `very poorly reviewed — only ${pct}% positive`;
  }

  // Only name a game as a genre reference if we know both genres actually match
  const genreAligned = similar.filter(x => x.genreSim.known && x.genreSim.score >= 0.35);

  const enjoyed = genreAligned.find(x =>
    x.game.category === 'play_now' ||
    x.game.category === 'in_progress' ||
    (x.game.category === 'completed' && positiveReviewScore(x.game.completion_review) >= 2)
  );
  const disliked = genreAligned.find(x =>
    x.game.category === 'dropped' ||
    x.game.category === 'dont_bother' ||
    (x.game.category === 'completed' && positiveReviewScore(x.game.completion_review) === 0)
  );

  let libraryPhrase = '';
  if (enjoyed && !disliked) {
    libraryPhrase = `same genre as ${enjoyed.game.name}, which you enjoy`;
  } else if (disliked && !enjoyed) {
    libraryPhrase = `same genre as ${disliked.game.name}, which didn't land for you`;
  } else if (disliked && enjoyed) {
    libraryPhrase = category === 'play_now'
      ? `same genre as ${enjoyed.game.name}, which you enjoy`
      : `same genre as ${disliked.game.name}, which didn't land for you`;
  }

  const hrs = Math.round(game.playtime_minutes / 60);
  const playtimePhrase = hrs >= 5 ? `you've already put ${hrs} hours in` : '';

  const clues = [sentimentPhrase, libraryPhrase, playtimePhrase].filter(Boolean);
  if (clues.length === 0) return 'Not enough data to give a strong reason.';

  const clueText =
    clues.length === 1 ? clues[0] :
    clues.length === 2 ? `${clues[0]} and ${clues[1]}` :
    `${clues[0]}, ${clues[1]}, and ${clues[2]}`;

  if (category === 'play_now')    return `${cap(clueText)} — strong pick.`;
  if (category === 'play_later')  return `${cap(clueText)} — worth keeping but no rush.`;
  if (category === 'dont_bother') return `${cap(clueText)} — probably not worth the time.`;
  if (category === 'dropped')     return `${cap(clueText)} — might be worth setting aside.`;
  return cap(clueText) + '.';
}

// ── Placement bonuses ──────────────────────────────────────────────────────────
// How strongly the user's existing choice weighs against re-categorisation.

const PLACEMENT_BONUS: Record<string, number> = {
  play_now:   2.5,
  play_later: 0.8,
};

const MIN_CONFIDENCE: Record<string, number> = {
  play_now:   0.65,
  play_later: 0.60,
};

// ── Core scoring ───────────────────────────────────────────────────────────────
//
// Philosophy:
//   play_now   = strong evidence required (exceptional reviews + liked genre, or legendary reception)
//   play_later = safe default for decent games with mixed or unknown context
//   dont_bother = clear negatives: poor reception OR genre the user dislikes
//
// Thresholds:
//   score >= 4.0  → play_now
//   score >= 0.0  → play_later
//   score <  0.0  → dont_bother

function suggestCategory(
  game: Game,
  categorised: Game[],
  source: string,
  idf: Map<string, number>
): { category: SuggestCategory; confidence: number; reason: string } {
  let score = 0;

  // 0. Placement bonus — respect the user's deliberate existing choice
  score += PLACEMENT_BONUS[source] ?? 0;

  // 1. Steam review sentiment
  //    Only overwhelmingly positive reception (≥ 0.95) gets to play_now on its own.
  //    Everything else needs library context to confirm.
  const s = game.steamspy_sentiment;
  if (s !== null) {
    if (s >= 0.95)      score += 4.5;  // Overwhelmingly Positive — go play it
    else if (s >= 0.85) score += 2.5;  // Very Positive — good but needs genre fit too
    else if (s >= 0.80) score += 1.0;  // Mostly Positive (high end)
    else if (s >= 0.70) score += 0.2;  // Mostly Positive (low end)
    else if (s >= 0.60) score -= 0.5;  // Mixed — slight negative
    else if (s >= 0.40) score -= 2.5;  // Mostly Negative
    else                score -= 4.5;  // Overwhelmingly Negative
  }

  // 2. Library context — genre-aware similarity to categorised games
  //
  //    Completed + loved → "I finished and enjoyed this genre" = strongest signal
  //    Dropped / dont_bother → "I actively avoided this genre" = strong negative
  const similar = categorised
    .filter(g => !['uncategorised', 'na'].includes(g.category) && g.steam_tags.length > 0)
    .map(g => {
      const tagSim = weightedTagSimilarity(game.steam_tags, g.steam_tags, idf);
      const genreSim = gameTypeSimilarity(game.game_type, g.game_type);
      return { game: g, tagSim, genreSim };
    })
    .filter(x => x.tagSim > 0.05)
    .sort((a, b) => {
      const sa = a.tagSim * genreMultiplier(a.genreSim);
      const sb = b.tagSim * genreMultiplier(b.genreSim);
      return sb - sa;
    })
    .slice(0, 12);

  for (const { game: sim, tagSim, genreSim } of similar) {
    const w = Math.min(tagSim, 1) * genreMultiplier(genreSim);
    const cat = sim.category;

    if (cat === 'completed') {
      const rs = positiveReviewScore(sim.completion_review);
      if (rs >= 2)       score += w * 2.5;  // Loved a similar game — strong green flag
      else if (rs === 1) score += w * 0.3;  // Finished but lukewarm
      else if (rs === 0) score -= w * 1.2;  // Finished but didn't enjoy
    }

    if (cat === 'play_now')    score += w * 0.8;
    if (cat === 'in_progress') score += w * 0.4;
    if (cat === 'play_later')  score += w * 0.1;
    if (cat === 'dropped')     score -= w * 1.5;  // Gave up on a similar game
    if (cat === 'dont_bother') score -= w * 2.0;  // Already wrote off this genre
  }

  // 3. Playtime signal (minor)
  if (game.playtime_minutes > 300)     score += 0.5;
  else if (game.playtime_minutes > 60) score += 0.2;

  // 4. Multiplayer with no library context → small penalty (uncertain)
  if (game.is_multiplayer && similar.length === 0) score -= 0.5;

  // 5. Map score → category + confidence
  let category: SuggestCategory;
  let confidence: number;

  if (score >= 4.0) {
    category = 'play_now';
    confidence = Math.min(0.95, 0.70 + (score - 4.0) * 0.04);
  } else if (score >= 0.0) {
    category = 'play_later';
    confidence = Math.min(0.90, 0.55 + score * 0.085);
  } else {
    category = 'dont_bother';
    confidence = Math.min(0.95, 0.55 + (-score) * 0.08);
  }

  return {
    category,
    confidence: Math.min(0.95, confidence),
    reason: buildReason(game, similar, category),
  };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') ?? 'uncategorised';

  const all = getAllGames();
  const idf = buildTagIdf(all);
  const targets = all.filter(g => g.category === source);
  const categorised = all.filter(g => g.category !== source && g.category !== 'uncategorised');

  const minConfidence = MIN_CONFIDENCE[source] ?? 0;

  const suggestions: GameSuggestion[] = targets
    .map(game => {
      const { category, confidence, reason } = suggestCategory(game, categorised, source, idf);
      return { game, suggested_category: category as GameSuggestion['suggested_category'], confidence, reason };
    })
    .filter(s => s.suggested_category !== source)
    .filter(s => s.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json(suggestions);
}
