import { NextRequest, NextResponse } from 'next/server';
import { exchangeNpssoForCode, exchangeCodeForAccessToken } from 'psn-api';
import { setSetting } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { npsso } = await req.json();
  if (!npsso?.trim()) {
    return NextResponse.json({ error: 'NPSSO token is required.' }, { status: 400 });
  }

  try {
    const accessCode = await exchangeNpssoForCode(npsso.trim());
    await exchangeCodeForAccessToken(accessCode);
    await setSetting('psn_npsso', npsso.trim());
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Invalid NPSSO token. Please follow the steps again and copy the full token.' },
      { status: 400 }
    );
  }
}
