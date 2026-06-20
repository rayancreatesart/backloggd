import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, getSetting } from '@/lib/db';

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    steam_api_key: settings.steam_api_key ? '••••' + settings.steam_api_key.slice(-4) : '',
    steam_id: settings.steam_id,
    anthropic_api_key: settings.anthropic_api_key ? '••••' + settings.anthropic_api_key.slice(-4) : '',
    steamgriddb_api_key: settings.steamgriddb_api_key ? '••••' + settings.steamgriddb_api_key.slice(-4) : '',
    configured: Boolean(settings.steam_api_key && settings.steam_id),
    has_anthropic: Boolean(settings.anthropic_api_key),
    has_steamgriddb: Boolean(settings.steamgriddb_api_key),
    psn_npsso: settings.psn_npsso ? '••••' + settings.psn_npsso.slice(-4) : '',
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { steam_api_key, steam_id, anthropic_api_key, steamgriddb_api_key } = body;

  if (!steam_api_key || !steam_id) {
    return NextResponse.json({ error: 'Steam API key and Steam ID are required.' }, { status: 400 });
  }

  const [existingSteamKey, existingAnthropicKey, existingSteamgridKey, existingNpsso] = await Promise.all([
    getSetting('steam_api_key'),
    getSetting('anthropic_api_key'),
    getSetting('steamgriddb_api_key'),
    getSetting('psn_npsso'),
  ]);

  await saveSettings({
    steam_api_key: steam_api_key.startsWith('••••') ? (existingSteamKey ?? '') : steam_api_key,
    steam_id,
    anthropic_api_key: anthropic_api_key
      ? (anthropic_api_key.startsWith('••••') ? (existingAnthropicKey ?? '') : anthropic_api_key)
      : (existingAnthropicKey ?? ''),
    steamgriddb_api_key: steamgriddb_api_key
      ? (steamgriddb_api_key.startsWith('••••') ? (existingSteamgridKey ?? '') : steamgriddb_api_key)
      : (existingSteamgridKey ?? ''),
    psn_npsso: existingNpsso ?? '',
  });

  return NextResponse.json({ success: true });
}
