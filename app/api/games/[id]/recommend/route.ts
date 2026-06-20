import { NextRequest, NextResponse } from 'next/server';
import { getGame, updateGameRecommendation, recordTagSentiment } from '@/lib/db';

type Params = Promise<{ id: string }>;

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const { recommended } = await req.json();

  if (typeof recommended !== 'boolean') {
    return NextResponse.json({ error: 'recommended must be a boolean' }, { status: 400 });
  }

  const game = await getGame(id);
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

  await updateGameRecommendation(id, recommended);

  if (game.steam_tags.length > 0) {
    await recordTagSentiment(game.steam_tags, recommended);
  }

  return NextResponse.json({ success: true });
}
