import { NextResponse } from 'next/server';
import { exchangeNpssoForCode, exchangeCodeForAccessToken, getUserPlayedGames } from 'psn-api';
import { getSetting, upsertPsnGame } from '@/lib/db';

function parseDuration(duration: string | null | undefined): number {
  if (!duration) return 0;
  const hours = parseInt(duration.match(/(\d+)H/)?.[1] ?? '0');
  const minutes = parseInt(duration.match(/(\d+)M/)?.[1] ?? '0');
  const seconds = parseInt(duration.match(/(\d+)S/)?.[1] ?? '0');
  return hours * 60 + minutes + Math.round(seconds / 60);
}

function pickCoverUrl(title: { imageUrl?: string; concept?: { media?: { images?: { url: string; type: string }[] } } }): string | null {
  if (title.imageUrl) return title.imageUrl;
  const images = title.concept?.media?.images;
  if (Array.isArray(images) && images.length > 0) {
    // Prefer a square/tall image over wide banners
    const preferred = images.find(img => !img.type.includes('BANNER') && !img.type.includes('WIDE')) ?? images[0];
    return preferred?.url ?? null;
  }
  return null;
}

export async function POST() {
  const npsso = await getSetting('psn_npsso');
  if (!npsso) {
    return NextResponse.json({ error: 'PSN not connected. Please connect your PSN account first.' }, { status: 400 });
  }

  try {
    const accessCode = await exchangeNpssoForCode(npsso);
    const { accessToken } = await exchangeCodeForAccessToken(accessCode);
    const authorization = { accessToken };

    let synced = 0;
    let offset = 0;
    const limit = 200;

    while (true) {
      const response = await getUserPlayedGames(authorization, 'me', {
        categories: 'ps4_game,ps5_native_game',
        limit,
        offset,
      });

      const titles = response.titles ?? [];
      if (titles.length === 0) break;

      for (const title of titles) {
        const id = `psn_${title.titleId}`;
        const name = title.name ?? title.localizedName ?? 'Unknown Game';
        const playtime = parseDuration(title.playDuration);
        const coverUrl = pickCoverUrl(title);
        await upsertPsnGame(id, name, playtime, coverUrl);
        synced++;
      }

      if (titles.length < limit) break;
      offset += limit;
    }

    return NextResponse.json({ synced });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('npsso') || msg.includes('401') || msg.includes('token')) {
      return NextResponse.json(
        { error: 'Your PSN session has expired. Please reconnect your PSN account.' },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: `PSN sync failed: ${msg}` }, { status: 500 });
  }
}
