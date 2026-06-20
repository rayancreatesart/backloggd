import { NextResponse } from 'next/server';
import { getSettings, upsertGame } from '@/lib/db';

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
}

interface SteamResponse {
  response: {
    game_count?: number;
    games?: SteamGame[];
  };
}

export async function POST() {
  const settings = getSettings();

  if (!settings.steam_api_key || !settings.steam_id) {
    return NextResponse.json({ error: 'Steam credentials not configured. Please set them in Settings.' }, { status: 400 });
  }

  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${settings.steam_api_key}&steamid=${settings.steam_id}&include_appinfo=1&format=json`;

  let data: SteamResponse;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ error: `Steam API returned ${res.status}. Check your API key and Steam ID.` }, { status: 502 });
    }
    data = await res.json();
  } catch {
    return NextResponse.json({ error: 'Failed to reach Steam API. Check your internet connection.' }, { status: 502 });
  }

  const games = data.response?.games;
  if (!games || games.length === 0) {
    if (data.response?.game_count === 0) {
      return NextResponse.json({ error: 'No games found. Make sure your Steam library is set to public.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'No games returned. Your Steam profile may be private — set it to public in Steam privacy settings.' }, { status: 400 });
  }

  let synced = 0;
  for (const game of games) {
    if (game.name) {
      upsertGame(String(game.appid), game.name, game.playtime_forever);
      synced++;
    }
  }

  return NextResponse.json({ success: true, synced, total: games.length });
}
