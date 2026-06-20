import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings, getSetting } from '@/lib/db';

export async function GET() {
  const settings = getSettings();
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

  const existing = {
    steam_api_key: getSetting('steam_api_key') ?? '',
    steam_id: getSetting('steam_id') ?? '',
    anthropic_api_key: getSetting('anthropic_api_key') ?? '',
    steamgriddb_api_key: getSetting('steamgriddb_api_key') ?? '',
    psn_npsso: getSetting('psn_npsso') ?? '',
  };

  saveSettings({
    steam_api_key: steam_api_key.startsWith('••••') ? existing.steam_api_key : steam_api_key,
    steam_id,
    anthropic_api_key: anthropic_api_key
      ? (anthropic_api_key.startsWith('••••') ? existing.anthropic_api_key : anthropic_api_key)
      : existing.anthropic_api_key,
    steamgriddb_api_key: steamgriddb_api_key
      ? (steamgriddb_api_key.startsWith('••••') ? existing.steamgriddb_api_key : steamgriddb_api_key)
      : existing.steamgriddb_api_key,
    psn_npsso: existing.psn_npsso,
  });

  return NextResponse.json({ success: true });
}
