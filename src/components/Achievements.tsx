import { useSubscribe } from '@prophet/client/react';
import { Link } from '@prophet/client/react';
import {
  Trophy, Star, Award, Heart, Flame, BookOpen, Target,
  Calendar, Crown, Shield, Sparkles, Dumbbell, Lock,
} from 'lucide-react';
import { MyAchievements, MySessions, MyProgress } from '../../kjv-memorize';

type AchievementType = 'first-verse' | 'ten-verses' | 'fifty-verses' | 'hundred-verses' |
  'seven-day-streak' | 'thirty-day-streak' | 'master-level' | 'daily-goal' |
  'book-complete' | 'testament-complete';

interface AchievementInfo {
  icon: any;
  title: string;
  description: string;
  gradient: string;
  hint: string;
}

const ACHIEVEMENT_INFO: Record<AchievementType, AchievementInfo> = {
  'first-verse': {
    icon: Star, title: 'First Steps', description: 'Complete your first practice session',
    gradient: 'from-yellow-400 to-amber-500', hint: 'Practice any verse to unlock',
  },
  'ten-verses': {
    icon: Award, title: 'Verse Collector', description: 'Complete 10 practice sessions',
    gradient: 'from-blue-400 to-indigo-500', hint: 'Keep practicing to reach 10 sessions',
  },
  'fifty-verses': {
    icon: Trophy, title: 'Scripture Scholar', description: 'Complete 50 practice sessions',
    gradient: 'from-purple-400 to-pink-500', hint: 'Keep building your practice habit',
  },
  'hundred-verses': {
    icon: Crown, title: 'Bible Champion', description: 'Complete 100 practice sessions',
    gradient: 'from-amber-400 to-orange-500', hint: 'A true dedication to God\'s Word',
  },
  'seven-day-streak': {
    icon: Flame, title: '7-Day Warrior', description: 'Practice 7 days in a row',
    gradient: 'from-red-400 to-orange-500', hint: 'Practice daily without missing a day',
  },
  'thirty-day-streak': {
    icon: Flame, title: 'Monthly Devotion', description: 'Practice 30 days in a row',
    gradient: 'from-orange-400 to-red-500', hint: 'Commit to 30 consecutive days',
  },
  'master-level': {
    icon: Shield, title: 'Master of the Word', description: 'Achieve mastery on any verse',
    gradient: 'from-green-400 to-emerald-500', hint: 'Score 90%+ repeatedly on a verse',
  },
  'daily-goal': {
    icon: Target, title: 'Goal Achiever', description: 'Meet your daily practice goal',
    gradient: 'from-pink-400 to-rose-500', hint: 'Complete your daily verse goal',
  },
  'book-complete': {
    icon: BookOpen, title: 'Book Master', description: 'Practice all featured verses from a book',
    gradient: 'from-indigo-400 to-purple-500', hint: 'Practice all verses from one Bible book',
  },
  'testament-complete': {
    icon: BookOpen, title: 'Testament Hero', description: 'Practice all featured verses from a Testament',
    gradient: 'from-cyan-400 to-blue-500', hint: 'Complete all Old or New Testament featured verses',
  },
};

function Achievements() {
  const { data: achievements, loading } = useSubscribe(MyAchievements);
  const { data: sessions } = useSubscribe(MySessions);
  const { data: progress } = useSubscribe(MyProgress);

  const earnedTypes = new Set((achievements ?? []).map(a => a?.type as AchievementType));
  const allTypes = Object.keys(ACHIEVEMENT_INFO) as AchievementType[];
  const earnedCount = earnedTypes.size;
  const totalCount = allTypes.length;

  // Derive "close to earning" hints
  const sessionCount = (sessions ?? []).length;
  const masteredCount = (progress ?? []).filter(p => p?.status === 'mastered').length;

  const getProgress = (type: AchievementType): { current: number; target: number } | null => {
    switch (type) {
      case 'first-verse': return { current: Math.min(sessionCount, 1), target: 1 };
      case 'ten-verses': return { current: Math.min(sessionCount, 10), target: 10 };
      case 'fifty-verses': return { current: Math.min(sessionCount, 50), target: 50 };
      case 'hundred-verses': return { current: Math.min(sessionCount, 100), target: 100 };
      case 'master-level': return { current: Math.min(masteredCount, 1), target: 1 };
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="text-center glassmorphism rounded-3xl p-8 shadow-xl">
        <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-xl mb-4 animate-float">
          <Trophy className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-bold gradient-text mb-3">Achievements</h1>
        <p className="text-gray-600 text-lg mb-6">
          {loading ? 'Loading...' : `${earnedCount} of ${totalCount} earned`}
        </p>

        {/* Progress Bar */}
        <div className="max-w-md mx-auto">
          <div className="bg-gray-200 rounded-full h-6 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 via-amber-500 to-orange-500 transition-all duration-1000 ease-out flex items-center justify-center"
              style={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
            >
              {earnedCount > 0 && (
                <span className="text-xs font-bold text-white drop-shadow">
                  {Math.round((earnedCount / totalCount) * 100)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {allTypes.map((type) => {
          const info = ACHIEVEMENT_INFO[type];
          const earned = earnedTypes.has(type);
          const earnedAt = (achievements ?? []).find(a => a?.type === type)?.earnedAt;
          const prog = getProgress(type);
          const Icon = info.icon;

          return (
            <div
              key={type}
              className={`glassmorphism rounded-2xl p-6 transition-all ${
                earned ? 'shadow-xl border-2 border-yellow-200' : 'opacity-75'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-4 rounded-xl shadow-lg flex-shrink-0 ${
                  earned ? `bg-gradient-to-br ${info.gradient}` : 'bg-gray-200'
                }`}>
                  {earned ? (
                    <Icon className="w-10 h-10 text-white" />
                  ) : (
                    <Lock className="w-10 h-10 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-gray-900 text-lg">{info.title}</h3>
                    {earned && <Trophy className="w-5 h-5 text-yellow-500 flex-shrink-0" />}
                  </div>
                  <p className="text-gray-600 text-sm mt-1">{info.description}</p>

                  {earned && earnedAt && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Earned {new Date(earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}

                  {!earned && prog && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">{prog.current} / {prog.target}</span>
                        <span className="text-xs text-purple-600 font-semibold">
                          {Math.round((prog.current / prog.target) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-400 to-indigo-500 transition-all"
                          style={{ width: `${(prog.current / prog.target) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {!earned && !prog && (
                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 italic">
                      <Sparkles className="w-3 h-3" /> {info.hint}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA if no achievements */}
      {!loading && earnedCount === 0 && (
        <div className="glassmorphism rounded-2xl p-8 shadow-lg text-center">
          <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-600 mb-2">Start Earning Achievements!</h3>
          <p className="text-gray-500 mb-6">Complete your first practice session to earn the "First Steps" badge.</p>
          <Link href="/practice">
            <button className="btn-primary text-white py-3 px-8 rounded-xl font-bold shadow-lg flex items-center gap-2 mx-auto">
              <Dumbbell className="w-5 h-5" /> Start Practicing
            </button>
          </Link>
        </div>
      )}

      {/* Tips */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl bg-gradient-to-r from-amber-50 to-yellow-50">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex-shrink-0">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Achievement Tips</h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <Flame className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <span>Practice every day to build streaks — even 5 minutes counts!</span>
              </li>
              <li className="flex items-start gap-3">
                <Star className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>Start with "Full Recall" mode for the deepest learning</span>
              </li>
              <li className="flex items-start gap-3">
                <Crown className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <span>Score 90%+ consistently on a verse to reach master level</span>
              </li>
              <li className="flex items-start gap-3">
                <Heart className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <span>"Well done, good and faithful servant!" — Matthew 25:21</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Achievements;
