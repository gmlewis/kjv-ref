import { Link } from 'react-router-dom';
import { useMyProgress, useMySessions } from '../hooks';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { TrendingUp, Award, Zap, Crown, Heart, Dumbbell } from 'lucide-react';

import { KJV_VERSES } from '../data/kjv-verses';

function Statistics() {
  const [progress, progressLoading] = useMyProgress();
  const [sessions, sessionsLoading] = useMySessions();

  const progressList = progress ?? [];
  const sessionList = sessions ?? [];

  // Mastery distribution
  const masteredCount = progressList.filter(p => p?.status === 'mastered').length;
  const reviewingCount = progressList.filter(p => p?.status === 'reviewing').length;
  const learningCount = progressList.filter(p => p?.status === 'learning').length;
  const newCount = progressList.filter(p => p?.status === 'new').length;

  const masteryData = [
    { name: 'Mastered', value: masteredCount, color: '#22c55e' },
    { name: 'Reviewing', value: reviewingCount, color: '#3b82f6' },
    { name: 'Learning', value: learningCount, color: '#f59e0b' },
    { name: 'New', value: newCount, color: '#a78bfa' },
  ].filter(d => d.value > 0);

  const totalVerses = progressList.length;
  const masteryRate = totalVerses > 0 ? Math.round((masteredCount / totalVerses) * 100) : 0;

  // Session stats
  const totalSessions = sessionList.length;
  const avgScore = totalSessions > 0
    ? Math.round(sessionList.reduce((sum, s) => sum + (s?.score ?? 0), 0) / totalSessions)
    : 0;

  // Sessions by mode
  const modeData = ['recall', 'fill-blank', 'multiple-choice', 'reference'].map(m => ({
    mode: m.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    sessions: sessionList.filter(s => s?.mode === m).length,
  })).filter(d => d.sessions > 0);

  // Recent sessions chart (last 10)
  const recentSessions = [...sessionList]
    .sort((a, b) => new Date(b?.startTime ?? 0).getTime() - new Date(a?.startTime ?? 0).getTime())
    .slice(0, 10)
    .reverse()
    .map((s, i) => ({
      session: `#${i + 1}`,
      score: s?.score ?? 0,
      questions: s?.totalQuestions ?? 0,
    }));

  // Difficulty breakdown of verses in our data
  const difficultyData = [
    { name: 'Easy', count: KJV_VERSES.filter(v => v.difficulty === 'easy').length, color: '#22c55e' },
    { name: 'Medium', count: KJV_VERSES.filter(v => v.difficulty === 'medium').length, color: '#f59e0b' },
    { name: 'Hard', count: KJV_VERSES.filter(v => v.difficulty === 'hard').length, color: '#ef4444' },
  ];

  const statCards = [
    { title: 'Total Verses Tracked', value: totalVerses, icon: Crown, gradient: 'from-blue-400 to-indigo-600', description: 'verses in progress' },
    { title: 'Mastery Rate', value: `${masteryRate}%`, icon: Award, gradient: 'from-green-400 to-emerald-600', description: 'verses mastered' },
    { title: 'Sessions Completed', value: totalSessions, icon: Zap, gradient: 'from-orange-400 to-red-600', description: 'practice sessions' },
    { title: 'Avg Score', value: `${avgScore}%`, icon: TrendingUp, gradient: 'from-purple-400 to-pink-600', description: 'average session score' },
  ];

  const loading = progressLoading || sessionsLoading;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="text-center glassmorphism rounded-3xl p-8 shadow-xl">
        <div className="inline-block p-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-xl mb-4">
          <TrendingUp className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-4xl font-bold gradient-text mb-3">Your Statistics</h1>
        <p className="text-gray-600 text-lg">Track your memorization journey</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card rounded-2xl p-6 card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-semibold uppercase tracking-wide">{card.title}</p>
                <p className="text-4xl font-bold gradient-text mt-2">
                  {loading ? <span className="animate-pulse">—</span> : card.value}
                </p>
                <p className="text-xs text-gray-500 mt-1">{card.description}</p>
              </div>
              <div className={`p-4 rounded-xl bg-gradient-to-br ${card.gradient} shadow-lg`}>
                <card.icon className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {!loading && totalSessions === 0 && totalVerses === 0 && (
        <div className="glassmorphism rounded-2xl p-12 shadow-xl text-center">
          <Dumbbell className="w-16 h-16 text-purple-300 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-500 mb-3">No Data Yet</h3>
          <p className="text-gray-400 mb-6">Start practicing to see your statistics here!</p>
          <Link to="/practice">
            <button className="btn-primary text-white py-3 px-8 rounded-xl font-bold shadow-lg">
              Start Practicing
            </button>
          </Link>
        </div>
      )}

      {/* Charts - only if data exists */}
      {(totalSessions > 0 || totalVerses > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mastery Distribution */}
          {totalVerses > 0 && (
            <div className="glassmorphism rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
                <Crown className="w-6 h-6" /> Mastery Distribution
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={masteryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {masteryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Session Scores */}
          {recentSessions.length > 0 && (
            <div className="glassmorphism rounded-2xl p-6 shadow-xl">
              <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
                <Zap className="w-6 h-6" /> Recent Session Scores
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={recentSessions}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="session" stroke="#64748b" />
                    <YAxis domain={[0, 100]} stroke="#64748b" />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255,255,255,0.95)',
                        borderRadius: '12px',
                        border: 'none',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                      }}
                    />
                    <defs>
                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#667eea" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#667eea" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#667eea"
                      strokeWidth={3}
                      fill="url(#colorScore)"
                      name="Score %"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sessions by Mode */}
      {modeData.length > 0 && (
        <div className="glassmorphism rounded-2xl p-6 shadow-xl">
          <h2 className="text-2xl font-bold gradient-text mb-6 flex items-center gap-2">
            <Award className="w-6 h-6" /> Sessions by Mode
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={modeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mode" stroke="#64748b" />
                <YAxis stroke="#64748b" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255,255,255,0.95)',
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="sessions" fill="#667eea" name="Sessions" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Verse Library Breakdown */}
      <div className="glassmorphism rounded-2xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold gradient-text mb-5 flex items-center gap-2">
          <TrendingUp className="w-6 h-6" /> Verse Library
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {difficultyData.map(d => (
            <div key={d.name} className="text-center p-4 rounded-xl glassmorphism">
              <p className="text-3xl font-bold" style={{ color: d.color }}>{d.count}</p>
              <p className="text-sm text-gray-500 mt-1">{d.name} verses</p>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex">
          {difficultyData.map(d => (
            <div
              key={d.name}
              className="h-full transition-all"
              style={{
                width: `${(d.count / KJV_VERSES.length) * 100}%`,
                backgroundColor: d.color,
              }}
            />
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-2">{KJV_VERSES.length} total verses in practice library</p>
      </div>

      {/* Motivation */}
      <div className="glassmorphism rounded-3xl p-8 shadow-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white">
        <div className="flex items-start gap-4">
          <div className="p-4 rounded-2xl bg-white/20 backdrop-blur flex-shrink-0">
            <Heart className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-4">Keep Going!</h2>
            <p className="text-xl opacity-95 leading-relaxed">
              Consistent daily practice is the key to long-term memorization. Every verse you learn is a treasure stored in your heart.
            </p>
            <div className="mt-5">
              <Link to="/practice">
                <button className="bg-white/20 hover:bg-white/30 transition-all py-3 px-6 rounded-xl font-bold flex items-center gap-2">
                  <Dumbbell className="w-5 h-5" /> Practice Now
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Statistics;
