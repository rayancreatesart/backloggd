export type Category = 'uncategorised' | 'play_now' | 'play_later' | 'in_progress' | 'completed' | 'dropped' | 'dont_bother' | 'na';
export type AutoFilterReason = 'multiplayer_enough' | 'likely_completed';

export interface Game {
  id: string;
  name: string;
  source: 'steam' | 'psn';
  completion_review: CompletionReview | null;
  dropped_review: DroppedReview | null;
  playtime_minutes: number;
  category: Category;
  tags: string[];           // user-defined custom tags
  steam_tags: string[];     // from SteamSpy
  game_type: string | null; // from Claude e.g. "open-world RPG"
  is_multiplayer: boolean;
  steamspy_sentiment: number | null; // review ratio 0-1
  auto_filtered: boolean;
  auto_filter_reason: AutoFilterReason | null;
  recommended: boolean | null; // null = not yet asked
  quiz_completed: boolean;
  quiz_data: QuizData | null;
  hltb_main: number | null;
  hltb_extra: number | null;
  hltb_completionist: number | null;
  hltb_searched: boolean;
  analysis_done: boolean;
  sgdb_cover_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuizData {
  story_completed: 'yes' | 'no' | null;
  want_to_play: 'want' | 'have_to' | null;
  played_similar: 'yes' | 'no' | null;
  left_bored: 'yes' | 'no' | null;
}

export interface Settings {
  steam_api_key: string;
  steam_id: string;
  anthropic_api_key: string;
  steamgriddb_api_key: string;
  psn_npsso: string;
}

export interface CompletionReview {
  enjoyed: 'yes' | 'mixed' | 'no';
  play_again: 'yes' | 'maybe' | 'no';
  recommended: 'yes' | 'no';
}

export interface DroppedReview {
  reason: 'not_my_type' | 'too_hard' | 'ran_out_of_time';
  enjoyed: 'yes' | 'no';
  recommended: 'yes' | 'maybe' | 'no';
}

export interface GameSuggestion {
  game: Game;
  suggested_category: Category;
  confidence: number; // 0-1
  reason: string;
}

export interface FilteredGame {
  id: string;
  name: string;
  reason: AutoFilterReason;
  playtime_minutes: number;
  hltb_main: number | null;
  steam_tags: string[];
  recommended: boolean | null;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  uncategorised: 'Uncategorised',
  play_now: 'Play Now',
  play_later: 'Play Later',
  in_progress: 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped',
  dont_bother: "Don't Bother",
  na: 'N/A',
};

export const CATEGORY_COLORS: Record<Category, string> = {
  uncategorised: '#6b7280',
  play_now: '#22c55e',
  play_later: '#3b82f6',
  in_progress: '#f97316',
  completed: '#a855f7',
  dropped: '#ef4444',
  dont_bother: '#7f1d1d',
  na: '#374151',
};

export const AUTO_FILTER_LABELS: Record<AutoFilterReason, string> = {
  multiplayer_enough: "You've played enough of this multiplayer game",
  likely_completed: "Looks like you've already completed this",
};
