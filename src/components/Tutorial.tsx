import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X, ChevronRight, ChevronLeft, Layers, AlignLeft, Eye, Award,
  BookOpen, Target, Search, Star, Download, Upload, Keyboard,
  ArrowRight, ArrowLeft, Sun, Moon, Home as HomeIcon,
} from 'lucide-react';
import { setPendingScrollTarget } from './Books';

// ─── Tutorial step definition ────────────────────────────────────────────────

interface TutorialStep {
  title: string;
  content: React.ReactNode;
  /** Navigate to this path before showing the step (optional) */
  navigateTo?: string;
  /** CSS selector for the element to spotlight (optional) */
  target?: string;
  /** Placement of the tooltip relative to the target */
  placement?: 'bottom' | 'top' | 'center' | 'bottom-right';
  /** Verse range to scroll to after navigation (optional) */
  scrollTarget?: { start: number; end: number };
}

// ─── The tutorial steps ──────────────────────────────────────────────────────

function buildSteps(): TutorialStep[] {
  return [
    // ─── 1. Welcome ──────────────────────────────────────────────────────────
    {
      title: 'Welcome to KJV Memorize!',
      content: (
        <div className="space-y-3">
          <p>Let's take a guided tour through all the features of this app.
          You can press <kbd className="kbd-key inline">Esc</kbd> at any time to stop the tour,
          <kbd className="kbd-key inline ml-1">←</kbd> / <kbd className="kbd-key inline">→</kbd> to navigate between steps.</p>
          <p className="text-sm text-gray-500">This tour uses your own data — if you have bookmarks or progress,
          we'll show them in context. Don't worry, nothing will be changed.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 2. Dashboard ─────────────────────────────────────────────────────────
    {
      title: 'Your Dashboard',
      navigateTo: '/',
      content: (
        <div className="space-y-3">
          <p>This is your home base. Here you can see your overall progress —
          how many verses you're tracking, your mastery rate, and your daily streak.</p>
          <p>The <strong>Start Practice</strong> button takes you to the practice mode selector,
          and the featured verse cards let you jump straight into practicing specific verses.</p>
        </div>
      ),
      target: 'main',
      placement: 'top',
    },

    // ─── 3. Navigation ────────────────────────────────────────────────────────
    {
      title: 'Navigation Bar',
      content: (
        <div className="space-y-3">
          <p>The navigation bar at the top lets you jump between the five main sections:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Dashboard</strong> — overview and quick actions</li>
            <li><strong>Practice</strong> — memorization training modes</li>
            <li><strong>Books</strong> — browse and read the Bible</li>
            <li><strong>Stats</strong> — detailed progress charts</li>
            <li><strong>Awards</strong> — achievement badges</li>
          </ul>
          <p className="text-sm text-gray-500">You can also use keyboard shortcuts: press <kbd className="kbd-key inline">g</kbd> to go to Books, or <kbd className="kbd-key inline">t</kbd> to toggle dark mode.</p>
        </div>
      ),
      target: 'nav',
      placement: 'bottom',
    },

    // ─── 4. Books browsing ────────────────────────────────────────────────────
    {
      title: 'Browse All 66 Books',
      navigateTo: '/books',
      content: (
        <div className="space-y-3">
          <p>The Books page shows all 66 books of the Bible. Use the <strong>Old Testament</strong> /
          <strong> New Testament</strong> filter buttons to narrow down the list.</p>
          <p>Click any book to see its chapters, or switch to the <strong>Search</strong> tab
          to search across all 24,857 verses.</p>
        </div>
      ),
      target: 'main',
      placement: 'top',
    },

    // ─── 5. Chapter view ──────────────────────────────────────────────────────
    {
      title: 'Reading a Chapter',
      navigateTo: '/books/John/3#v16',
      scrollTarget: { start: 16, end: 16 },
      content: (
        <div className="space-y-3">
          <p>When you click a chapter number, you'll see every verse displayed as a card.
          Each verse has a number you can click to highlight it and update the URL.</p>
          <p className="text-sm text-gray-500">The URL now ends with <code className="px-1 rounded">#v16</code> —
          you can copy this link to share a specific verse with anyone!</p>
        </div>
      ),
      target: 'main',
      placement: 'bottom',
    },

    // ─── 6. Verse navigation ──────────────────────────────────────────────────
    {
      title: 'Keyboard Verse Navigation',
      content: (
        <div className="space-y-3">
          <p>While reading a chapter, you can navigate between verses with your keyboard:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><kbd className="kbd-key inline">→</kbd> — Next verse (wraps across chapters and books!)</li>
            <li><kbd className="kbd-key inline">←</kbd> — Previous verse</li>
            <li><kbd className="kbd-key inline">Shift</kbd> + <kbd className="kbd-key inline">→</kbd> — Jump to last verse in chapter</li>
            <li><kbd className="kbd-key inline">Shift</kbd> + <kbd className="kbd-key inline">←</kbd> — Jump to verse 1</li>
            <li><kbd className="kbd-key inline">⌘</kbd> + <kbd className="kbd-key inline">→</kbd> — Next chapter</li>
            <li><kbd className="kbd-key inline">⌘</kbd> + <kbd className="kbd-key inline">←</kbd> — Previous chapter</li>
          </ul>
          <p className="text-sm text-gray-500">The verse you're on gets a purple glow so you always know where you are.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 7. Quick search ──────────────────────────────────────────────────────
    {
      title: 'Quick Bible Reference Search',
      content: (
        <div className="space-y-3">
          <p>Press <kbd className="kbd-key inline">/</kbd> anywhere in the app to open the search dialog.
          You can type a Bible reference in almost any format:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><code className="px-1 rounded">jn3:16</code> — compact abbreviation</li>
            <li><code className="px-1 rounded">John 3:16</code> — full name</li>
            <li><code className="px-1 rounded">ps23</code> — just book + chapter</li>
            <li><code className="px-1 rounded">1 john 2</code> — numbered book</li>
            <li><code className="px-1 rounded">ps23:1-6</code> — verse range!</li>
          </ul>
          <p>Matching references appear instantly. Use <kbd className="kbd-key inline">↑</kbd> / <kbd className="kbd-key inline">↓</kbd> to select,
          then <kbd className="kbd-key inline">Enter</kbd> to jump directly to that verse.</p>
          <p className="text-sm text-gray-500">If no reference matches, Enter does a full-text search instead.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 8. Advanced search ───────────────────────────────────────────────────
    {
      title: 'Advanced Search Syntax',
      navigateTo: '/books?search=love',
      content: (
        <div className="space-y-3">
          <p>The full-text search supports powerful syntax for finding exactly what you need:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><code className="px-1 rounded">"the love of God"</code> — exact phrase (consecutive words)</li>
            <li><code className="px-1 rounded">love|charity</code> — OR (matches either word)</li>
            <li><code className="px-1 rounded">lov*</code> — wildcard (love, loved, loving...)</li>
            <li><code className="px-1 rounded">l?ve</code> — single-char wildcard (love, live)</li>
            <li><code className="px-1 rounded">"the * of God"</code> — any word between</li>
            <li><code className="px-1 rounded">love -hate</code> — exclude verses containing "hate"</li>
          </ul>
          <p className="text-sm text-gray-500">Multiple terms are AND'd together — all must match.</p>
        </div>
      ),
      target: 'main',
      placement: 'top',
    },

    // ─── 9. Strong's Concordance ──────────────────────────────────────────────
    {
      title: "Strong's Concordance",
      navigateTo: '/books/John/3',
      content: (
        <div className="space-y-3">
          <p>Turn on <strong>Strong's</strong> to see Hebrew or Greek word numbers next to every word.
          Click any underlined word to see its lexicon entry — the original language word,
          transliteration, definition, and parsing (part of speech).</p>
          <p>Links to BibleHub and Blue Letter Bible let you dive even deeper into the original language.</p>
          <p className="text-sm text-gray-500">This is incredible for word studies — see exactly what the
          original Hebrew or Greek text says behind every English word.</p>
        </div>
      ),
      target: 'main',
      placement: 'top',
    },

    // ─── 10. Interlinear ──────────────────────────────────────────────────────
    {
      title: 'Interlinear Text',
      content: (
        <div className="space-y-3">
          <p>Turn on <strong>Interlinear</strong> to see the original Hebrew (Old Testament) or
          Greek (New Testament) text displayed alongside the English translation.</p>
          <p>Each original-language word is clickable — tap it to see the word's transliteration,
          gloss, parsing code, and links to lexicon resources.</p>
          <p className="text-sm text-gray-500">The Hebrew text reads right-to-left. Links to STEP Bible
          and BibleHub provide full interlinear views if you want to go deeper.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 11. Bookmarks ────────────────────────────────────────────────────────
    {
      title: 'Bookmarking Verses',
      content: (
        <div className="space-y-3">
          <p>Click the <Star className="w-4 h-4 inline text-yellow-500" /> star icon next to any verse to
          bookmark it. Bookmarked verses appear in your <strong>Collection</strong> for focused practice.</p>
          <p>You can also bookmark verse <strong>ranges</strong> — navigate to a range like
          <code className="bg-gray-100 px-1 rounded ml-1">#v1-6</code> and click "Favorite this range"
          to save the whole passage as "Psalms 23:1-6".</p>
          <p className="text-sm text-gray-500">Bookmarked ranges can be practiced verse-by-verse,
          just like individual verses.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 12. Font size ────────────────────────────────────────────────────────
    {
      title: 'Customize Your Reading Experience',
      content: (
        <div className="space-y-3">
          <p>You can adjust the verse text size while reading:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><kbd className="kbd-key inline">+</kbd> — Increase verse text size</li>
            <li><kbd className="kbd-key inline">−</kbd> — Decrease verse text size</li>
            <li><kbd className="kbd-key inline">t</kbd> — Toggle dark / light theme</li>
            <li><kbd className="kbd-key inline">Home</kbd> / <kbd className="kbd-key inline">End</kbd> — Scroll to top / bottom</li>
          </ul>
          <p className="text-sm text-gray-500">Your font size preference is saved automatically.</p>
        </div>
      ),
      placement: 'center',
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // PRACTICE MODES — DETAILED TUTORIAL (6 STEPS)
    // ═══════════════════════════════════════════════════════════════════════════

    // ─── 13. Practice overview ────────────────────────────────────────────────
    {
      title: 'Practice Modes — Overview',
      navigateTo: '/practice',
      content: (
        <div className="space-y-3">
          <p>Now let's explore the <strong>7 practice modes</strong>! Each mode trains your memory
          in a different way, from easy recognition to full recall.</p>
          <p>The modes are arranged from easiest to hardest. We recommend starting with
          <strong> Word Bank</strong> and working your way up to <strong>Full Recall</strong>.</p>
          <p className="text-sm text-gray-500">The app uses <strong>spaced repetition</strong> (SM-2 algorithm)
          to automatically schedule reviews — verses you struggle with come up more often.</p>
        </div>
      ),
      target: 'main',
      placement: 'top',
    },

    // ─── 14. Word Bank ────────────────────────────────────────────────────────
    {
      title: 'Mode 1: Word Bank',
      navigateTo: '/practice',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-6 h-6 text-purple-500" />
            <span className="font-bold text-purple-600 text-lg">Word Bank — Tap to Order</span>
          </div>
          <p><strong>How it works:</strong> The verse's words are shuffled into a "word bank" at the bottom.
          You tap each word in order to reconstruct the verse. Tap a placed word to send it back to the bank.</p>
          <p><strong>What it's great for:</strong> This is the perfect starting mode when you're first
          learning a verse. You don't need to recall the words from memory — you just need to recognize
          the correct order. It builds familiarity with the verse's structure and flow.</p>
          <p><strong>Why try it:</strong> If you're new to Bible memorization, Word Bank is the gentlest
          introduction. The shuffled words give you all the pieces — you just put the puzzle together.
          It's especially good for longer verses where remembering every word feels overwhelming.</p>
          <p className="text-sm text-gray-500">Tip: The "Check Answer" button stays disabled until all words
          are placed, so you can't accidentally submit an incomplete answer.</p>
        </div>
      ),
      target: 'main',
      placement: 'top',
    },

    // ─── 15. First Letters ────────────────────────────────────────────────────
    {
      title: 'Mode 2: First Letters',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <AlignLeft className="w-6 h-6 text-blue-500" />
            <span className="font-bold text-blue-600 text-lg">First Letters — Hint-Guided</span>
          </div>
          <p><strong>How it works:</strong> Each word in the verse is shown as just its first letter.
          For example, "In the beginning God created" becomes <code className="px-1 rounded">I t b G c</code>.
          You type the complete verse into a textarea, using the first letters as hints.</p>
          <p><strong>What it's great for:</strong> This is the natural next step after Word Bank. You now
          need to recall each word yourself, but the first letters give you just enough of a hint to
          trigger your memory. It's like having training wheels that you can gradually rely on less.</p>
          <p><strong>Why try it:</strong> First Letters trains <em>active recall</em> — the cognitive
          process that strengthens memory. Studies show that retrieving information from memory is far
          more effective for long-term retention than simply re-reading it. The first-letter hints make
          this retrieval achievable even for verses you're still learning.</p>
          <p className="text-sm text-gray-500">Tip: If you get stuck, click "Reveal" to see the full verse.
          The app records this as an incorrect answer so the verse comes up again sooner.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 16. Simplified Vanishing Cloze ───────────────────────────────────────
    {
      title: 'Mode 3: Simplified Vanishing Cloze',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-6 h-6 text-teal-400" />
            <span className="font-bold text-teal-500 text-lg">Simplified Vanishing Cloze — Easier Adaptive Mode</span>
          </div>
          <p><strong>How it works:</strong> Just like Vanishing Cloze, the verse is displayed with some words
          blanked out (shown as small input boxes). But instead of typing the entire verse, you only type
          <strong> the first letter of each blanked word</strong>. The number of blanks still increases as
          you master the verse (same 5 levels: Study Mode → Full Recall).</p>
          <p><strong>Tip:</strong> If you can't recall a word, press <kbd className="kbd-key inline">?</kbd>
          in that blank to reveal the word — it will be marked as incorrect so the verse comes back for
          review sooner. You can also click any blank in any order to fill them in whatever sequence
          you like. Keyboard shortcuts (like <kbd className="kbd-key inline">⌘/Ctrl+Enter</kbd>) are
          disabled in this mode.</p>
          <p><strong>What it's great for:</strong> This is the easier sibling of Vanishing Cloze. It's a
          great stepping stone when full Vanishing Cloze feels too demanding but Word Bank / First Letters
          are no longer challenging enough. You still have to recall each word, but only its initial —
          a much lighter cognitive load.</p>
          <p><strong>Why try it:</strong> It gives you the adaptive, progressive-disclosure benefits of
          Vanishing Cloze with less typing, making it perfect for quick review sessions or for verses
          you're still building confidence on.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 17. Vanishing Cloze ──────────────────────────────────────────────────
    {
      title: 'Mode 4: Vanishing Cloze',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-6 h-6 text-teal-500" />
            <span className="font-bold text-teal-600 text-lg">Vanishing Cloze — Adapts to You</span>
          </div>
          <p className="text-sm bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg p-2">
            <strong>What does "cloze" mean?</strong> A <em>cloze test</em> is a classic language-learning
            exercise where some words are removed from a text and you have to fill them in from context.
            The name comes from <em>"closure"</em> — your brain fills in the missing pieces. "Vanishing"
            refers to the fact that <strong>more words vanish (get blanked out) as you master the verse</strong>.
          </p>
          <p><strong>How it works:</strong> The verse is displayed with some words blanked out (shown as
          underscores). You type the complete verse including the blanked words. The clever part:
          <strong> the number of blanks increases as you master the verse!</strong></p>
          <p>It works in 5 levels:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><strong>Level 0 (Study Mode):</strong> Full verse shown — just read and click "Got it"</li>
            <li><strong>Level 1:</strong> 25% of words blanked</li>
            <li><strong>Level 2:</strong> 50% of words blanked</li>
            <li><strong>Level 3:</strong> 75% of words blanked</li>
            <li><strong>Level 4 (Full Recall):</strong> All words blanked — complete from memory</li>
          </ul>
          <p><strong>What it's great for:</strong> This is the most <em>adaptive</em> mode. It automatically
          scales the difficulty based on how many times you've successfully recited the verse. New verses
          start easy (Study Mode), then gradually get harder as you improve.</p>
          <p><strong>Why try it:</strong> Vanishing Cloze implements <strong>progressive disclosure</strong>
          — a proven learning technique where support is gradually removed as competence grows.
          It's the "scaffolding" approach: full support at first, then less and less until you can
          do it entirely on your own. This makes it the best mode for <em>long-term mastery</em>.</p>
          <p className="text-sm text-gray-500">Tip: Your level for each verse is tracked individually.
          Verses you know well advance quickly; verses you struggle with stay at lower levels longer.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 18. Multiple Choice ──────────────────────────────────────────────────
    {
      title: 'Mode 5: Multiple Choice',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-6 h-6 text-amber-500" />
            <span className="font-bold text-amber-600 text-lg">Multiple Choice — Recognition</span>
          </div>
          <p><strong>How it works:</strong> You're shown the verse reference (e.g. "John 3:16") and four
          possible verse texts. You select the correct one. You can also use keyboard keys
          <kbd className="kbd-key inline ml-1">1</kbd>–<kbd className="kbd-key inline">4</kbd> to answer quickly.</p>
          <p><strong>What it's great for:</strong> This is a <em>recognition</em> exercise — easier than
          recall because the answer is right in front of you. It's excellent for quickly reviewing many
          verses in a short session, and for building confidence when you're early in the learning process.</p>
          <p><strong>Why try it:</strong> Multiple Choice is the fastest mode for covering a lot of ground.
          You can review 20+ verses in just a few minutes. It's perfect for daily warm-ups or when you
          want to maintain familiarity with verses you've already memorized without the intense focus
          required by recall modes. The distractor options are pulled from other verses in your practice
          pool, so they're always realistic and challenging.</p>
          <p className="text-sm text-gray-500">Tip: After answering, the correct option turns green and
          any wrong selection turns red. Click "Next Verse" to continue.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 19. Reference Match ──────────────────────────────────────────────────
    {
      title: 'Mode 6: Reference Match',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="w-6 h-6 text-indigo-500" />
            <span className="font-bold text-indigo-600 text-lg">Reference Match — Reverse Recall</span>
          </div>
          <p><strong>How it works:</strong> This is the <em>reverse</em> of Multiple Choice. You're shown
          the verse <em>text</em> and must select the correct <em>reference</em> (e.g. "John 3:16") from
          four options. This trains you to associate the content with its location in the Bible.</p>
          <p><strong>What it's great for:</strong> Knowing where a verse is located is crucial for
          sharing verses with others, teaching, and navigating the Bible. Reference Match builds the
          mental map between verse content and book/chapter/verse — a skill that's easy to neglect
          but essential for real-world Bible use.</p>
          <p><strong>Why try it:</strong> If you've ever thought "I know that verse, but I can't remember
          where it is!" — this mode is for you. It's surprisingly challenging and deeply rewarding.
          After practicing Reference Match for a while, you'll find yourself naturally recalling
          references when you encounter verses in sermons, books, or conversations.</p>
          <p className="text-sm text-gray-500">Tip: The reference options are always in "Book Chapter:Verse"
          format. The distractors are real references from other verses in your pool.</p>
        </div>
      ),
      placement: 'center',
    },

    // ─── 20. Full Recall ──────────────────────────────────────────────────────
    {
      title: 'Mode 7: Full Recall',
      content: (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-6 h-6 text-red-500" />
            <span className="font-bold text-red-600 text-lg">Full Recall — Type from Memory</span>
          </div>
          <p><strong>How it works:</strong> You're shown only the verse reference. You must type the
          <em> complete verse text</em> from memory into a textarea. No hints, no first letters,
          no word bank — just you and your memory. The app compares your answer against the actual
          text and gives you an accuracy score.</p>
          <p><strong>What it's great for:</strong> This is the ultimate test of memorization.
          If you can pass Full Recall, you've truly memorized the verse. It's the gold standard —
          the ability to recite the verse perfectly without any prompts.</p>
          <p><strong>Why try it:</strong> Full Recall is what all the other modes are building toward.
          It's the most challenging, but also the most satisfying. When you can type out a verse
          word-for-word from memory, you own it forever. Use this mode once you're confident with
          a verse through the easier modes — it will confirm your mastery and identify any weak spots.</p>
          <p className="text-sm text-gray-500">Tip: Full Recall is hidden by default — click
          "Show all modes" to reveal it. Don't be discouraged if your accuracy isn't 100% on the first
          try — that's normal! The app will schedule the verse for review so you can try again soon.</p>
        </div>
      ),
      placement: 'center',
    },

    // ═══════════════════════════════════════════════════════════════════════════

    // ─── 21. Settings export ──────────────────────────────────────────────────
    {
      title: 'Backup and Share Your Data',
      content: (
        <div className="space-y-3">
          <p>The <Download className="w-4 h-4 inline text-purple-500" /> download button in the nav bar
          saves <strong>all</strong> your data — settings, favorites, progress, sessions, achievements —
          as a single JSON file. Use it to:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Back up your data before clearing your browser</li>
            <li>Transfer your favorites to another device</li>
            <li>Share your favorite verses with a friend</li>
          </ul>
          <p>The <Upload className="w-4 h-4 inline text-purple-500" /> upload button imports a settings file
          and <strong>non-destructively merges</strong> favorites — your existing bookmarks are preserved,
          and only new ones from the file are added.</p>
          <p className="text-sm text-gray-500">The exported file is human-readable JSON, so you can even
          edit it manually to curate your favorite verses list.</p>
        </div>
      ),
      target: 'nav',
      placement: 'bottom-right',
    },

    // ─── 22. Done! ────────────────────────────────────────────────────────────
    {
      title: "You're All Set!",
      navigateTo: '/',
      content: (
        <div className="space-y-3">
          <p className="text-lg">That's the complete tour! Here's a quick recap of the key shortcuts:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><kbd className="kbd-key inline">?</kbd> — Show keyboard shortcuts anytime</li>
            <li><kbd className="kbd-key inline">/</kbd> — Quick search / jump to a verse</li>
            <li><kbd className="kbd-key inline">→</kbd> / <kbd className="kbd-key inline">←</kbd> — Navigate verses</li>
            <li><kbd className="kbd-key inline">g</kbd> — Go to Books</li>
            <li><kbd className="kbd-key inline">t</kbd> — Toggle dark mode</li>
          </ul>
          <p className="text-lg font-bold gradient-text">Happy memorizing! 📖</p>
          <p className="text-sm text-gray-500">You can take this tour again anytime by pressing
          <kbd className="kbd-key inline ml-1">?</kbd> and clicking "Take the tour".</p>
        </div>
      ),
      placement: 'center',
    },
  ];
}

// ─── Tutorial component ──────────────────────────────────────────────────────

export function Tutorial({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const steps = useRef(buildSteps()).current;
  const step = steps[stepIndex];

  // Navigate when the step requires it
  useEffect(() => {
    if (step.navigateTo) {
      // Set the pending scroll target BEFORE navigating so ChapterView
      // picks it up synchronously at mount time (avoids the race condition
      // where the hash isn't available yet when the component initializes).
      if (step.scrollTarget) {
        setPendingScrollTarget(step.scrollTarget);
      }
      navigate(step.navigateTo);
    }
  }, [step, navigate]);

  // Measure the target element after navigation + render
  useEffect(() => {
    if (!step.target) {
      setTargetRect(null);
      return;
    }
    // Wait for navigation + render to complete
    const timer = setTimeout(() => {
      const el = document.querySelector(step.target!);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [step, stepIndex]);

  // Keyboard controls: Esc to stop, arrows to navigate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (stepIndex > 0) setStepIndex(stepIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, stepIndex, steps.length]);

  // Re-measure on window resize
  useEffect(() => {
    const onResize = () => {
      if (step.target) {
        const el = document.querySelector(step.target);
        if (el) setTargetRect(el.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [step]);

  const next = useCallback(() => {
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
  }, [stepIndex, steps.length]);

  const prev = useCallback(() => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  // Compute tooltip position
  const isLargeTarget = targetRect && targetRect.height > window.innerHeight * 0.5;
  const tooltipStyle: React.CSSProperties = targetRect && !isLargeTarget
    ? {
        position: 'fixed',
        top: step.placement === 'bottom' || step.placement === 'bottom-right'
          ? targetRect.bottom + 16
          : step.placement === 'top'
          ? Math.max(16, targetRect.top - 400)
          : '50%',
        left: step.placement === 'center'
          ? '50%'
          : step.placement === 'bottom-right'
          ? Math.max(16, window.innerWidth - 520)
          : Math.max(16, Math.min(targetRect.left, window.innerWidth - 520)),
        transform: step.placement === 'center' ? 'translate(-50%, -50%)' : 'none',
        width: step.placement === 'center' ? '560px' : '500px',
        zIndex: 10001,
      }
    : targetRect && isLargeTarget && step.placement === 'bottom'
    ? {
        // For large targets with bottom placement, pin the tooltip to the
        // bottom of the viewport so it doesn't fly off-screen
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '560px',
        zIndex: 10001,
      }
    : {
        // No target or centered — center on screen
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '560px',
        zIndex: 10001,
      };

  // Spotlight box (the "hole" in the overlay)
  // Only spotlight small targets; for large targets (like <main>), just dim
  // the whole screen so scrolling still works.
  const spotlightStyle: React.CSSProperties | null = targetRect && !isLargeTarget
    ? {
        position: 'fixed',
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
        borderRadius: '12px',
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
        transition: 'all 0.3s ease',
        zIndex: 10000,
        pointerEvents: 'none',
      }
    : null;

  return createPortal(
    <>
      {/* Spotlight overlay or full-screen dim */}
      {spotlightStyle ? (
        <div style={spotlightStyle} />
      ) : (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Tooltip card */}
      <div style={tooltipStyle} className="modal-card">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-icon-wrapper">
            <Keyboard className="w-8 h-8 text-white" />
          </div>
          <h2 className="modal-title">{step.title}</h2>
          <button onClick={onClose} className="modal-close-btn">
            <X className="w-12 h-12" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {step.content}

          {/* Step indicator */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
            <span className="text-sm text-gray-400">
              Step {stepIndex + 1} of {steps.length}
            </span>
            <div className="flex gap-2">
              {!isFirst && (
                <button
                  onClick={prev}
                  className="btn-secondary text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}
              {!isLast ? (
                <button
                  onClick={next}
                  className="btn-primary text-white px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="btn-primary text-white px-4 py-1.5 rounded-lg text-sm font-bold"
                >
                  Done!
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default Tutorial;