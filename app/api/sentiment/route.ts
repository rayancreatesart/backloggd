import { NextResponse } from 'next/server';
import { getTagSentimentMap } from '@/lib/db';

export async function GET() {
  const map = getTagSentimentMap();
  return NextResponse.json(map);
}
