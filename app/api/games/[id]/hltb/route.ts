import { NextRequest, NextResponse } from 'next/server';
import { getGame, updateGameHltb } from '@/lib/db';
import { HowLongToBeatService } from 'howlongtobeat';

type Params = Promise<{ id: string }>;

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const game = getGame(id);

  if (!game) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  if (game.hltb_searched) {
    return NextResponse.json({
      hltb_main: game.hltb_main,
      hltb_extra: game.hltb_extra,
      hltb_completionist: game.hltb_completionist,
    });
  }

  try {
    const hltb = new HowLongToBeatService();
    const results = await hltb.search(game.name);

    if (results && results.length > 0) {
      const top = results[0];
      const main = top.gameplayMain > 0 ? top.gameplayMain : null;
      const extra = top.gameplayMainExtra > 0 ? top.gameplayMainExtra : null;
      const completionist = top.gameplayCompletionist > 0 ? top.gameplayCompletionist : null;
      updateGameHltb(id, main, extra, completionist);
      return NextResponse.json({ hltb_main: main, hltb_extra: extra, hltb_completionist: completionist });
    } else {
      updateGameHltb(id, null, null, null);
      return NextResponse.json({ hltb_main: null, hltb_extra: null, hltb_completionist: null });
    }
  } catch {
    updateGameHltb(id, null, null, null);
    return NextResponse.json({ hltb_main: null, hltb_extra: null, hltb_completionist: null });
  }
}
