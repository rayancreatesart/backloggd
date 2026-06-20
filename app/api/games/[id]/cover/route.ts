import { NextRequest, NextResponse } from 'next/server';
import { getGame, getSetting, updateGameCoverUrl } from '@/lib/db';

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;

  const game = await getGame(id);
  if (!game) return NextResponse.json({ url: null });

  if (game.sgdb_cover_url) return NextResponse.json({ url: game.sgdb_cover_url });

  const apiKey = process.env.STEAMGRIDDB_API_KEY ?? (await getSetting('steamgriddb_api_key'));
  if (!apiKey) return NextResponse.json({ url: null });

  try {
    const res = await fetch(
      `https://www.steamgriddb.com/api/v2/grids/steam/${id}?dimensions=600x900,342x482,660x930&types=static&nsfw=false`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!res.ok) return NextResponse.json({ url: null });

    const data = await res.json();
    const url: string | null = data?.data?.[0]?.url ?? null;

    if (url) await updateGameCoverUrl(id, url);

    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ url: null });
  }
}
