import { NextRequest, NextResponse } from 'next/server';
import { updateGameCategory, updateGameTags, updateGameQuiz, updateCompletionReview, updateDroppedReview } from '@/lib/db';
import type { Category, QuizData, CompletionReview, DroppedReview } from '@/lib/types';

type Params = Promise<{ id: string }>;

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const body = await req.json();

  if (body.category !== undefined) {
    await updateGameCategory(id, body.category as Category);
  }

  if (body.tags !== undefined) {
    await updateGameTags(id, body.tags as string[]);
  }

  if (body.quiz_data !== undefined && body.category !== undefined) {
    await updateGameQuiz(id, body.quiz_data as QuizData, body.category as Category);
  }

  if (body.completion_review !== undefined) {
    await updateCompletionReview(id, body.completion_review as CompletionReview);
  }

  if (body.dropped_review !== undefined) {
    await updateDroppedReview(id, body.dropped_review as DroppedReview);
  }

  return NextResponse.json({ success: true });
}
