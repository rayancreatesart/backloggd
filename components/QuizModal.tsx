'use client';
import { useState } from 'react';
import type { Game, QuizData, Category } from '@/lib/types';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '@/lib/types';

interface Props {
  games: Game[];
  tagSentiment: Record<string, number>;
  onClose: () => void;
  onDone: (id: string, quiz: QuizData, category: Category) => void;
}

type Step = 'story_check' | 'want_to_play' | 'played_similar' | 'left_bored' | 'result';

function getTagSentimentScore(game: Game, tagSentiment: Record<string, number>): number | null {
  const tags = game.steam_tags;
  if (!tags.length) return null;
  const scores = tags.map(t => tagSentiment[t]).filter((s): s is number => s !== undefined);
  if (!scores.length) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function suggestCategory(quiz: QuizData, game: Game, tagSentiment: Record<string, number>): Category {
  let score = 0;

  // Sentiment from SteamSpy reviews — scaled -2 to +2
  if (game.steamspy_sentiment !== null) {
    score += (game.steamspy_sentiment - 0.5) * 4;
  }

  // "Do you really want to play this?"
  if (quiz.want_to_play === 'want') score += 2;
  if (quiz.want_to_play === 'have_to') score -= 2;

  // "Have you played similar games?"
  if (quiz.played_similar === 'yes') {
    const tagScore = getTagSentimentScore(game, tagSentiment);
    if (tagScore !== null) {
      if (tagScore > 0.65) score += 1;
      else if (tagScore < 0.40) score -= 1;
    }
    // No tag data → neutral
  }

  // "Did you start and get bored?"
  if (quiz.left_bored === 'yes') score -= 3;

  return score >= 2 ? 'play_now' : 'play_later';
}

function resetQuiz(): QuizData {
  return { story_completed: null, want_to_play: null, played_similar: null, left_bored: null };
}

function shouldAskBored(game: Game): boolean {
  // Only ask if they've started (>0 min) but played less than 1 hour
  return game.playtime_minutes > 0 && game.playtime_minutes < 60;
}

function shouldAskStoryCheck(game: Game): boolean {
  // Only ask if they've played it AND it's under the HLTB threshold (not yet auto-filtered as completed)
  return (
    game.playtime_minutes > 30 &&
    game.hltb_main !== null &&
    game.playtime_minutes < game.hltb_main * 60 * 0.85
  );
}

function getSteps(game: Game): Step[] {
  const steps: Step[] = [];
  if (shouldAskStoryCheck(game)) steps.push('story_check');
  steps.push('want_to_play', 'played_similar');
  if (shouldAskBored(game)) steps.push('left_bored');
  steps.push('result');
  return steps;
}

export default function QuizModal({ games, tagSentiment, onClose, onDone }: Props) {
  const [queueIndex, setQueueIndex] = useState(0);
  const [quiz, setQuiz] = useState<QuizData>(resetQuiz());
  const [step, setStep] = useState<Step>(() => getSteps(games[0])[0]);
  const [suggested, setSuggested] = useState<Category | null>(null);
  const [finalCategory, setFinalCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const currentGame = games[queueIndex];
  const hasNext = queueIndex < games.length - 1;
  const progress = (queueIndex / games.length) * 100;
  const steps = currentGame ? getSteps(currentGame) : [];

  if (!currentGame) {
    return (
      <Overlay>
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-white mb-2">All done!</h2>
          <p className="text-gray-400 text-sm mb-6">Every game in your backlog has been categorised.</p>
          <button onClick={onClose} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-semibold transition">
            Back to Library
          </button>
        </div>
      </Overlay>
    );
  }

  function goToStep(nextStep: Step, updatedQuiz: QuizData) {
    if (nextStep === 'result') {
      const s = suggestCategory(updatedQuiz, currentGame, tagSentiment);
      setSuggested(s);
      setFinalCategory(s);
      setStep('result');
    } else {
      setStep(nextStep);
    }
  }

  function answerStoryCheck(value: 'yes' | 'no') {
    if (value === 'yes') {
      // Completed — save directly and move on
      saveGame({ ...quiz, story_completed: 'yes' }, 'completed');
      return;
    }
    const updated: QuizData = { ...quiz, story_completed: 'no' as const };
    setQuiz(updated);
    const next = steps[steps.indexOf('story_check') + 1];
    goToStep(next, updated);
  }

  function answer(key: keyof QuizData, value: string) {
    const updated = { ...quiz, [key]: value } as QuizData;
    setQuiz(updated);
    const idx = steps.indexOf(step);
    const next = steps[idx + 1];
    goToStep(next, updated);
  }

  async function saveGame(quizData: QuizData, cat: Category) {
    setSaving(true);
    await fetch(`/api/games/${currentGame.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_data: quizData, category: cat }),
    });
    setSaving(false);
    onDone(currentGame.id, quizData, cat);
    advance();
  }

  function advance() {
    if (hasNext) {
      const next = games[queueIndex + 1];
      setQueueIndex(i => i + 1);
      setQuiz(resetQuiz());
      setStep(getSteps(next)[0]);
      setSuggested(null);
      setFinalCategory(null);
    } else {
      onClose();
    }
  }

  const coverUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${currentGame.id}/header.jpg`;
  const hltbHours = currentGame.hltb_main ? `~${currentGame.hltb_main}h to beat` : null;
  const playedHours = currentGame.playtime_minutes > 0 ? `${Math.round(currentGame.playtime_minutes / 60 * 10) / 10}h played` : 'Never played';

  return (
    <Overlay>
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Progress */}
        <div className="h-1 bg-white/5">
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        {/* Game header with cover */}
        <div className="relative">
          <img src={coverUrl} alt={currentGame.name} className="w-full h-36 object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] to-transparent" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 flex items-center justify-center text-gray-300 hover:text-white transition"
            title="Exit quiz"
          >
            ×
          </button>

          <div className="absolute bottom-3 left-4 right-12">
            <p className="text-xs text-gray-400 mb-0.5">{queueIndex + 1} of {games.length}</p>
            <h2 className="text-xl font-bold text-white truncate">{currentGame.name}</h2>
            <div className="flex items-center gap-3 text-xs mt-0.5">
              <span className="text-blue-400">{playedHours}</span>
              {hltbHours && <span className="text-gray-500">{hltbHours}</span>}
              {currentGame.game_type && (
                <span className="text-purple-400 capitalize">{currentGame.game_type}</span>
              )}
            </div>
          </div>
        </div>

        {/* Quiz body */}
        <div className="p-6">
          {step === 'story_check' && (
            <QuizStep
              question="Did you finish the main story?"
              hint={hltbHours ? `You've played ${playedHours} — HLTB says ${hltbHours}` : undefined}
              options={[
                { label: "Yes, I completed it", value: 'yes', icon: '🏁' },
                { label: "No, still in progress", value: 'no', icon: '⏸️' },
              ]}
              onPick={v => answerStoryCheck(v as 'yes' | 'no')}
            />
          )}

          {step === 'want_to_play' && (
            <QuizStep
              question="Do you actually want to play this, or do you feel like you have to?"
              hint={currentGame.steamspy_sentiment !== null
                ? `${Math.round(currentGame.steamspy_sentiment * 100)}% of Steam reviewers liked this game`
                : undefined}
              options={[
                { label: "I genuinely want to play it", value: 'want', icon: '🔥' },
                { label: "I feel like I should, but meh", value: 'have_to', icon: '😑' },
              ]}
              onPick={v => answer('want_to_play', v)}
            />
          )}

          {step === 'played_similar' && (
            <QuizStep
              question="Have you played similar games like this before?"
              hint={currentGame.steam_tags.length > 0
                ? `Tagged as: ${currentGame.steam_tags.slice(0, 4).join(', ')}`
                : undefined}
              options={[
                { label: "Yes, I know this type of game", value: 'yes', icon: '✅' },
                { label: "No, this would be new territory", value: 'no', icon: '🆕' },
              ]}
              onPick={v => answer('played_similar', v)}
            />
          )}

          {step === 'left_bored' && (
            <QuizStep
              question="You've only played a little — did you start and leave because you got bored?"
              hint={`Only ${currentGame.playtime_minutes} min played`}
              options={[
                { label: "Yes, it didn't grab me", value: 'yes', icon: '😴' },
                { label: "No, I just never got back to it", value: 'no', icon: '🕐' },
              ]}
              onPick={v => answer('left_bored', v)}
            />
          )}

          {step === 'result' && suggested && finalCategory && (
            <div>
              <p className="text-gray-400 text-sm mb-3">Based on your answers and community sentiment:</p>
              <div
                className="rounded-xl p-4 mb-4 border text-center"
                style={{
                  backgroundColor: CATEGORY_COLORS[suggested] + '22',
                  borderColor: CATEGORY_COLORS[suggested] + '66',
                }}
              >
                <span className="text-2xl font-bold" style={{ color: CATEGORY_COLORS[suggested] }}>
                  {CATEGORY_LABELS[suggested]}
                </span>
                {currentGame.steamspy_sentiment !== null && (
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.round(currentGame.steamspy_sentiment * 100)}% positive reviews on Steam
                  </p>
                )}
              </div>

              <p className="text-sm text-gray-400 mb-3">Override if you disagree:</p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {(['play_now', 'play_later', 'in_progress', 'dropped', 'dont_bother', 'na'] as Category[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFinalCategory(cat)}
                    className="py-2 rounded-lg text-sm font-medium border transition"
                    style={
                      finalCategory === cat
                        ? {
                            backgroundColor: CATEGORY_COLORS[cat] + '44',
                            borderColor: CATEGORY_COLORS[cat],
                            color: CATEGORY_COLORS[cat],
                          }
                        : {
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderColor: 'rgba(255,255,255,0.1)',
                            color: '#9ca3af',
                          }
                    }
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={advance}
                  className="flex-1 py-3 border border-white/10 rounded-xl text-gray-400 hover:text-white text-sm transition"
                >
                  Skip for now
                </button>
                <button
                  onClick={() => saveGame(quiz, finalCategory)}
                  disabled={saving}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white font-semibold text-sm transition"
                >
                  {saving ? 'Saving…' : hasNext ? 'Save & Next →' : 'Save & Finish'}
                </button>
              </div>
            </div>
          )}

          {step !== 'result' && (
            <button onClick={advance} className="mt-4 w-full text-xs text-gray-500 hover:text-gray-300 transition">
              Skip this game →
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {children}
    </div>
  );
}

function QuizStep({
  question, hint, options, onPick,
}: {
  question: string;
  hint?: string;
  options: { label: string; value: string; icon: string }[];
  onPick: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-white font-semibold text-base mb-1">{question}</p>
      {hint ? <p className="text-xs text-blue-400 mb-4">{hint}</p> : <div className="mb-4" />}
      <div className="flex flex-col gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onPick(opt.value)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 text-left transition group"
          >
            <span className="text-xl">{opt.icon}</span>
            <span className="text-sm text-gray-200 group-hover:text-white font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
