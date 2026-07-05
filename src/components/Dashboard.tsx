import { Link } from 'react-router-dom';
import { BookOpen, TrendingUp, Calendar, Target, Sparkles, Flame, Star, Heart, Crown, Dumbbell, Bookmark } from 'lucide-react';
import { useMyProgress, useMySessions, useMyAchievements, useMyBookmarks } from '../hooks';
import { KJV_VERSES } from '../data/kjv-verses';

function getDailyGoal() {
  try {
    const data = localStorage.getItem('kjv-memorize-daily-goal');
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

const FEATURED_VERSES = [
  { reference: 'John 3:16', theme: 'salvation', difficulty: 'medium' as const },
  { reference: 'Philippians 4:13', theme: 'strength', difficulty: 'easy' as const },
  { reference: 'Psalm 23:1', theme: 'faith', difficulty: 'easy' as const },
  { reference: 'Romans 8:28', theme: 'faith', difficulty: 'hard' as const },
  { reference: 'Genesis 1:1', theme: 'creation', difficulty: 'easy' as const },
  { reference: 'Psalm 119:11', theme: 'obedience', difficulty: 'easy' as const },
].map(f => ({
  ...f,
  text: KJV_VERSES.find(v => v.reference === f.reference)?.text ?? '',
}));

function Dashboard() {
  const [progress] = useMyProgress();
  const [sessions] = useMySessions();
  const [achievements] = useMyAchievements();
  const [bookmarks] = useMyBookmarks();

  const masteredCount = (progress ?? []).filter(p => p?.status === 'mastered').length;
  const learningCount = (progress ?? []).filter(p => p?.status === 'learning' || p?.status === 'reviewing').length;
  const bookmarkCount = (bookmarks ?? []).length;

  const statCards = [
    { title: 'Verses Mastered', value: masteredCount, icon: Crown, gradient: 'from-green-400 to-emerald-600', link: '/statistics', description: 'Perfectly memorized' },
    { title: 'In Progress', value: learningCount, icon: TrendingUp, gradient: 'from-blue-400 to-indigo-600', link: '/practice', description: 'Currently learning' },
    { title: 'Practice Sessions', value: (sessions ?? []).length, icon: Flame, gradient: 'from-orange-400 to-red-600', link: '/statistics', description: 'Total sessions' },
    { title: 'Achievements', value: (achievements ?? []).length, icon: Star, gradient: 'from-yellow-400 to-amber-600', link: '/achievements', description: 'Badges earned' },
    { title: 'My Collection', value: bookmarkCount, icon: Bookmark, gradient: 'from-violet-400 to-purple-600', link: '/practice?collection=1', description: 'Bookmarked verses' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Hero Section */}
      <div className="text-center py-12 glassmorphism rounded-3xl shadow-2xl animate-slide-up">
        <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl mb-4 animate-float">
          <Sparkles className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-5xl font-bold gradient-text mb-4">
          Welcome to KJV Memorization
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto px-4">
          Transform your spiritual journey by hiding God's word in your heart, one verse at a time
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          <Link to="/practice">
            <button className="btn-primary text-white py-4 px-8 rounded-xl font-bold text-lg shadow-lg">
              <Dumbbell className="inline w-5 h-5 mr-2" />
              Start Practice
            </button>
          </Link>
          <Link to="/books">
            <button className="btn-secondary py-4 px-8 rounded-xl font-bold text-lg">
              <BookOpen className="inline w-5 h-5 mr-2" />
              Browse Bible
            </button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <Link key={index} to={card.link} className="block">
            <div className="stat-card rounded-2xl p-6 card-hover">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm font-semibold uppercase tracking-wide">{card.title}</p>
                  <p className="text-4xl font-bold gradient-text mt-2">{card.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{card.description}</p>
                </div>
                <div className={`p-4 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                  <card.icon className="w-8 h-8 text-white" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Daily Goal Progress */}
      {(() => {
        const goal = getDailyGoal();
        if (!goal) return null;
        const pct = goal.targetVerses > 0 ? Math.min(Math.round((goal.completedVerses / goal.targetVerses) * 100), 100) : 0;
        return (
          <div className="glassmorphism rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-500" /> Today's Goal
              </h3>
              <span className="text-sm font-bold text-purple-600">{goal.completedVerses} / {goal.targetVerses} verses</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${goal.completed ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-purple-500 to-indigo-600'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {goal.completed && (
              <p className="text-sm text-green-600 font-semibold mt-2 flex items-center gap-1">
                <Star className="w-4 h-4" /> Daily goal completed! Great job!
              </p>
            )}
          </div>
        );
      })()}

      {/* Featured Verses */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl">
        <h2 className="text-3xl font-bold gradient-text mb-6 flex items-center">
          <BookOpen className="w-8 h-8 mr-3" />
          Popular Verses to Memorize
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED_VERSES.map((verse, index) => (
            <Link to={`/practice/${encodeURIComponent(verse.reference)}`} key={index}>
              <div className="verse-card rounded-xl p-5 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-purple-600 text-lg">{verse.reference}</p>
                    <p className="text-gray-700 mt-2 verse-text italic text-sm leading-relaxed line-clamp-2">{verse.text}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold">
                        {verse.theme}
                      </span>
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                        verse.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        verse.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {verse.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link to="/practice">
            <button className="btn-primary text-white py-3 px-8 rounded-xl font-bold shadow-lg">
              <Dumbbell className="inline w-5 h-5 mr-2" />
              Practice All Verses
            </button>
          </Link>
        </div>
      </div>

      {/* Daily Motivation */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-white/20 backdrop-blur">
            <Heart className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-3">Daily Motivation</h2>
            <p className="text-xl italic opacity-95 mb-3 verse-text">
              "Thy word have I hid in mine heart, that I might not sin against thee."
            </p>
            <p className="text-right font-semibold">— Psalm 119:11 (KJV)</p>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glassmorphism rounded-2xl p-6 shadow-lg card-hover">
          <div className="flex items-center gap-3 mb-3">
            <Flame className="w-6 h-6 text-orange-500" />
            <h3 className="font-bold text-lg text-gray-800">Daily Streaks</h3>
          </div>
          <p className="text-gray-600">Practice daily to build momentum and earn streak achievements!</p>
          <Link to="/achievements">
            <button className="mt-4 text-sm font-semibold text-purple-600 hover:text-purple-800">View Achievements →</button>
          </Link>
        </div>
        <div className="glassmorphism rounded-2xl p-6 shadow-lg card-hover">
          <div className="flex items-center gap-3 mb-3">
            <Target className="w-6 h-6 text-blue-500" />
            <h3 className="font-bold text-lg text-gray-800">Spaced Repetition</h3>
          </div>
          <p className="text-gray-600">Review verses at increasing intervals for long-term retention.</p>
          <Link to="/statistics">
            <button className="mt-4 text-sm font-semibold text-purple-600 hover:text-purple-800">View Statistics →</button>
          </Link>
        </div>
        <div className="glassmorphism rounded-2xl p-6 shadow-lg card-hover">
          <div className="flex items-center gap-3 mb-3">
            <Crown className="w-6 h-6 text-yellow-500" />
            <h3 className="font-bold text-lg text-gray-800">Master Verses</h3>
          </div>
          <p className="text-gray-600">Aim for mastery status by achieving 100% accuracy consistently.</p>
          <Link to="/books">
            <button className="mt-4 text-sm font-semibold text-purple-600 hover:text-purple-800">Browse Bible →</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
