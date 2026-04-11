// This file was generated with `prophet typegen` for use with @prophet/client.
// Do not edit manually. To regenerate, run: prophet typegen <file.prophet>

export interface ShapeDescriptor<TEntity, TArgs extends Record<string, unknown> = Record<string, never>> {
  readonly name: string;
  readonly entity?: string;
  readonly where?: any;
  readonly __entity?: TEntity;
  readonly __args?: TArgs;
}

export interface MutationDescriptor<TArgs extends Record<string, unknown> = Record<string, never>, TReturns = void> {
  readonly name: string;
  readonly handler?: (args: Record<string, unknown>, rt: any) => any;
  readonly argSchema?: Record<string, { type: string; optional?: boolean; enumValues?: string[] }>;
  readonly entityArgs?: readonly { name: string; entity: string }[];
  readonly __args?: TArgs;
  readonly __returns?: TReturns;
}

export interface MembersDescriptor<TEntity, TScopes extends string = string> {
  readonly name: string;
  readonly __entity?: TEntity;
  readonly __scopes?: TScopes;
}

export interface PresenceDescriptor<TEntity, TData extends Record<string, unknown> = Record<string, never>> {
  readonly name: string;
  readonly __entity?: TEntity;
  readonly __data?: TData;
}

export type BookId = string & { readonly __brand: "BookId" };
export type ChapterId = string & { readonly __brand: "ChapterId" };
export type VerseId = string & { readonly __brand: "VerseId" };
export type UserProgressId = string & { readonly __brand: "UserProgressId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type AchievementId = string & { readonly __brand: "AchievementId" };
export type DailyGoalId = string & { readonly __brand: "DailyGoalId" };
export type ReviewScheduleId = string & { readonly __brand: "ReviewScheduleId" };
export type BookmarkId = string & { readonly __brand: "BookmarkId" };
export type UserId = string & { readonly __brand: "UserId" };

export interface User {
  id: UserId;
}

/** A book of the Bible */
export interface Book {
  id: BookId;
  name: string;
  testament: "old" | "new";
  chapters: number;
  abbreviation: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** A chapter in a Bible book */
export interface Chapter {
  id: ChapterId;
  book: BookId;
  number: number;
  verseCount: number;
  createdAt: string;
  updatedAt: string;
}

/** A single Bible verse */
export interface Verse {
  id: VerseId;
  book: BookId;
  chapter: ChapterId;
  number: number;
  text: string;
  reference: string;
  keywords: string[];
  difficulty: "easy" | "medium" | "hard";
  theme: string | null;
  createdAt: string;
  updatedAt: string;
}

/** User's progress memorizing a specific verse */
export interface UserProgress {
  id: UserProgressId;
  user: UserId;
  verse: VerseId;
  status: "new" | "learning" | "reviewing" | "mastered";
  timesRecited: number;
  lastPracticed: string | null;
  nextReview: string | null;
  accuracy: number;
  streak: number;
  createdAt: string;
  updatedAt: string;
}

/** A memorization practice session */
export interface Session {
  id: SessionId;
  user: UserId;
  versesPracticed: VerseId[];
  startTime: string;
  endTime: string | null;
  mode: "recall" | "fill-blank" | "multiple-choice" | "reference";
  score: number;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
}

/** An achievement badge */
export interface Achievement {
  id: AchievementId;
  user: UserId;
  type: "first-verse" | "ten-verses" | "fifty-verses" | "hundred-verses" | "seven-day-streak" | "thirty-day-streak" | "master-level" | "daily-goal" | "book-complete" | "testament-complete";
  earnedAt: string;
  verseCount: number | null;
  book: BookId | null;
  createdAt: string;
  updatedAt: string;
}

/** Daily memorization goal */
export interface DailyGoal {
  id: DailyGoalId;
  user: UserId;
  date: string;
  targetVerses: number;
  completedVerses: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Spaced repetition review schedule */
export interface ReviewSchedule {
  id: ReviewScheduleId;
  user: UserId;
  verse: VerseId;
  interval: number;
  easeFactor: number;
  dueDate: string;
  reviewsCompleted: number;
  createdAt: string;
  updatedAt: string;
}

/** User-bookmarked verse for practice */
export interface Bookmark {
  id: BookmarkId;
  user: UserId;
  reference: string;
  addedAt: string;
  createdAt: string;
  updatedAt: string;
}

/** All Bible books */
export const AllBooks: ShapeDescriptor<Book> = {
  name: "AllBooks",
  entity: "Book",
  where: null,
} as const;
/** Chapters in a book */
export const BookChapters: ShapeDescriptor<Chapter> = {
  name: "BookChapters",
  entity: "Chapter",
  where: {"kind":"fieldEquality","fieldName":"book","argName":"book"},
} as const;
/** Verses in a chapter */
export const ChapterVerses: ShapeDescriptor<Verse> = {
  name: "ChapterVerses",
  entity: "Verse",
  where: {"kind":"fieldEquality","fieldName":"chapter","argName":"chapter"},
} as const;
/** Current user's memorization progress */
export const MyProgress: ShapeDescriptor<UserProgress> = {
  name: "MyProgress",
  entity: "UserProgress",
  where: null,
} as const;
/** Progress for a specific verse */
export const ProgressByVerse: ShapeDescriptor<UserProgress, { verse: VerseId }> = {
  name: "ProgressByVerse",
  entity: "UserProgress",
  where: null,
} as const;
/** Verses due for review */
export const DueReviews: ShapeDescriptor<ReviewSchedule> = {
  name: "DueReviews",
  entity: "ReviewSchedule",
  where: null,
} as const;
/** Current user's practice sessions */
export const MySessions: ShapeDescriptor<Session> = {
  name: "MySessions",
  entity: "Session",
  where: null,
} as const;
/** Current user's achievements */
export const MyAchievements: ShapeDescriptor<Achievement> = {
  name: "MyAchievements",
  entity: "Achievement",
  where: null,
} as const;
/** Today's memorization goal */
export const TodayGoal: ShapeDescriptor<DailyGoal> = {
  name: "TodayGoal",
  entity: "DailyGoal",
  where: null,
} as const;
/** Find verse by reference */
export const VerseByReference: ShapeDescriptor<Verse, { reference: string }> = {
  name: "VerseByReference",
  entity: "Verse",
  where: {"kind":"fieldEquality","fieldName":"reference","argName":"reference"},
} as const;
/** Verses by difficulty level */
export const VersesByDifficulty: ShapeDescriptor<Verse, { difficulty: "easy" | "medium" | "hard" }> = {
  name: "VersesByDifficulty",
  entity: "Verse",
  where: {"kind":"fieldEquality","fieldName":"difficulty","argName":"difficulty"},
} as const;
/** Verses by theme */
export const VersesByTheme: ShapeDescriptor<Verse, { theme: string }> = {
  name: "VersesByTheme",
  entity: "Verse",
  where: {"kind":"fieldEquality","fieldName":"theme","argName":"theme"},
} as const;
/** Mastery statistics */
export const MasteryStats: ShapeDescriptor<UserProgress> = {
  name: "MasteryStats",
  entity: "UserProgress",
  where: null,
} as const;
/** Recent practice sessions */
export const RecentSessions: ShapeDescriptor<Session> = {
  name: "RecentSessions",
  entity: "Session",
  where: null,
} as const;
/** Current user's bookmarked verses */
export const MyBookmarks: ShapeDescriptor<Bookmark> = {
  name: "MyBookmarks",
  entity: "Bookmark",
  where: null,
} as const;



export const createBookmark: MutationDescriptor<{ reference: string }, BookmarkId> = {
  name: "createBookmark",
  handler: ({
  reference
}: any, rt: any) => {
  const bookmark = rt.insert("Bookmark", {
    user: rt.currentUser,
    reference,
    addedAt: new Date()
  });
  rt.grant("Bookmark", bookmark.id, "owner", "currentUser");
  return bookmark;
},
  argSchema: { "reference": { type: "string" } },
  entityArgs: [],
} as const;
export const removeBookmark: MutationDescriptor<{ bookmark: BookmarkId }> = {
  name: "removeBookmark",
  handler: ({
  bookmark
}: any, rt: any) => {
  bookmark.delete();
},
  argSchema: { "bookmark": { type: "entity" } },
  entityArgs: [{ name: "bookmark", entity: "Bookmark" }],
} as const;
export const createBook: MutationDescriptor<{ name: string; testament: "old" | "new"; chapters: number; abbreviation: string; order: number }, BookId> = {
  name: "createBook",
  handler: (args: Record<string, unknown>, rt: any) => {
  return rt.insert("Book", args);
},
  argSchema: { "name": { type: "string" }, "testament": { type: "enum", enumValues: ["old","new"] }, "chapters": { type: "number" }, "abbreviation": { type: "string" }, "order": { type: "number" } },
  entityArgs: [],
} as const;
export const createChapter: MutationDescriptor<{ book: BookId; number: number; verseCount: number }, ChapterId> = {
  name: "createChapter",
  handler: (args: any, rt: any) => {
  return rt.insert("Chapter", args);
},
  argSchema: { "book": { type: "entity" }, "number": { type: "number" }, "verseCount": { type: "number" } },
  entityArgs: [{ name: "book", entity: "Book" }],
} as const;
export const createVerse: MutationDescriptor<{ book: BookId; chapter: ChapterId; number: number; text: string; reference: string; keywords: string[]; difficulty: "easy" | "medium" | "hard"; theme?: string }, VerseId> = {
  name: "createVerse",
  handler: (args: any, rt: any) => {
  return rt.insert("Verse", args);
},
  argSchema: { "book": { type: "entity" }, "chapter": { type: "entity" }, "number": { type: "number" }, "text": { type: "string" }, "reference": { type: "string" }, "keywords": { type: "array" }, "difficulty": { type: "enum", enumValues: ["easy","medium","hard"] }, "theme": { type: "string", optional: true } },
  entityArgs: [{ name: "book", entity: "Book" }, { name: "chapter", entity: "Chapter" }],
} as const;
export const batchImportVerses: MutationDescriptor<{ verses: ({ book: BookId; chapter: ChapterId; number: number; text: string; reference: string; keywords: string[]; difficulty: "easy" | "medium" | "hard"; theme?: string | null })[] }> = {
  name: "batchImportVerses",
  handler: ({
  verses
}: any, rt: any) => {
  return verses.map(v => rt.insert("Verse", v));
},
  argSchema: { "verses": { type: "array" } },
  entityArgs: [],
} as const;
export const updateProgress: MutationDescriptor<{ progress: UserProgressId; status: "new" | "learning" | "reviewing" | "mastered"; accuracy: number }> = {
  name: "updateProgress",
  handler: ({
  progress,
  status,
  accuracy
}: any, rt: any) => {
  rt.update("UserProgress", progress.id, {
    status,
    accuracy,
    lastPracticed: new Date(),
    timesRecited: progress.timesRecited + 1,
    streak: progress.streak + 1
  });
},
  argSchema: { "progress": { type: "entity" }, "status": { type: "enum", enumValues: ["new","learning","reviewing","mastered"] }, "accuracy": { type: "number" } },
  entityArgs: [{ name: "progress", entity: "UserProgress" }],
} as const;
export const createProgress: MutationDescriptor<{ verse: VerseId }, UserProgressId> = {
  name: "createProgress",
  handler: ({
  verse
}: any, rt: any) => {
  const progress = rt.insert("UserProgress", {
    user: rt.currentUser,
    verse,
    createdAt: new Date()
  });
  rt.grant("UserProgress", progress.id, "owner", "currentUser");
  rt.grant("UserProgress", progress.id, "viewer", "authenticatedUsers");
  return progress;
},
  argSchema: { "verse": { type: "entity" } },
  entityArgs: [{ name: "verse", entity: "Verse" }],
} as const;
export const createSession: MutationDescriptor<{ versesPracticed: VerseId[]; mode: "recall" | "fill-blank" | "multiple-choice" | "reference"; score: number; totalQuestions: number }, SessionId> = {
  name: "createSession",
  handler: ({
  versesPracticed,
  mode,
  score,
  totalQuestions
}: any, rt: any) => {
  const session = rt.insert("Session", {
    user: rt.currentUser,
    versesPracticed,
    startTime: new Date(),
    endTime: new Date(),
    mode,
    score,
    totalQuestions
  });
  rt.grant("Session", session.id, "owner", "currentUser");
  rt.grant("Session", session.id, "viewer", "authenticatedUsers");
  return session;
},
  argSchema: { "versesPracticed": { type: "array" }, "mode": { type: "enum", enumValues: ["recall","fill-blank","multiple-choice","reference"] }, "score": { type: "number" }, "totalQuestions": { type: "number" } },
  entityArgs: [],
} as const;
export const awardAchievement: MutationDescriptor<{ type: "first-verse" | "ten-verses" | "fifty-verses" | "hundred-verses" | "seven-day-streak" | "thirty-day-streak" | "master-level" | "daily-goal" | "book-complete" | "testament-complete"; verseCount?: number; book?: BookId }, AchievementId> = {
  name: "awardAchievement",
  handler: ({
  type,
  verseCount,
  book
}: any, rt: any) => {
  const achievement = rt.insert("Achievement", {
    user: rt.currentUser,
    type,
    earnedAt: new Date(),
    verseCount,
    book
  });
  rt.grant("Achievement", achievement.id, "owner", "currentUser");
  rt.grant("Achievement", achievement.id, "viewer", "authenticatedUsers");
  return achievement;
},
  argSchema: { "type": { type: "enum", enumValues: ["first-verse","ten-verses","fifty-verses","hundred-verses","seven-day-streak","thirty-day-streak","master-level","daily-goal","book-complete","testament-complete"] }, "verseCount": { type: "number", optional: true }, "book": { type: "entity", optional: true } },
  entityArgs: [{ name: "book", entity: "Book" }],
} as const;
export const createDailyGoal: MutationDescriptor<{ date: string; targetVerses: number }, DailyGoalId> = {
  name: "createDailyGoal",
  handler: ({
  date,
  targetVerses
}: any, rt: any) => {
  const goal = rt.insert("DailyGoal", {
    user: rt.currentUser,
    date,
    targetVerses
  });
  rt.grant("DailyGoal", goal.id, "owner", "currentUser");
  rt.grant("DailyGoal", goal.id, "viewer", "authenticatedUsers");
  return goal;
},
  argSchema: { "date": { type: "date" }, "targetVerses": { type: "number" } },
  entityArgs: [],
} as const;
export const updateDailyGoal: MutationDescriptor<{ goal: DailyGoalId; completedVerses: number; completed: boolean }> = {
  name: "updateDailyGoal",
  handler: ({
  goal,
  completedVerses,
  completed
}: any, rt: any) => {
  rt.update("DailyGoal", goal.id, {
    completedVerses,
    completed
  });
},
  argSchema: { "goal": { type: "entity" }, "completedVerses": { type: "number" }, "completed": { type: "bool" } },
  entityArgs: [{ name: "goal", entity: "DailyGoal" }],
} as const;
export const createReviewSchedule: MutationDescriptor<{ verse: VerseId; interval: number; easeFactor: number; dueDate: string }, ReviewScheduleId> = {
  name: "createReviewSchedule",
  handler: ({
  verse,
  interval,
  easeFactor,
  dueDate
}: any, rt: any) => {
  const schedule = rt.insert("ReviewSchedule", {
    user: rt.currentUser,
    verse,
    interval,
    easeFactor,
    dueDate
  });
  rt.grant("ReviewSchedule", schedule.id, "owner", "currentUser");
  rt.grant("ReviewSchedule", schedule.id, "viewer", "authenticatedUsers");
  return schedule;
},
  argSchema: { "verse": { type: "entity" }, "interval": { type: "number" }, "easeFactor": { type: "number" }, "dueDate": { type: "date" } },
  entityArgs: [{ name: "verse", entity: "Verse" }],
} as const;
export const updateReviewSchedule: MutationDescriptor<{ schedule: ReviewScheduleId; interval: number; easeFactor: number; dueDate: string; reviewsCompleted: number }> = {
  name: "updateReviewSchedule",
  handler: ({
  schedule,
  interval,
  easeFactor,
  dueDate,
  reviewsCompleted
}: any, rt: any) => {
  rt.update("ReviewSchedule", schedule.id, {
    interval,
    easeFactor,
    dueDate,
    reviewsCompleted
  });
},
  argSchema: { "schedule": { type: "entity" }, "interval": { type: "number" }, "easeFactor": { type: "number" }, "dueDate": { type: "date" }, "reviewsCompleted": { type: "number" } },
  entityArgs: [{ name: "schedule", entity: "ReviewSchedule" }],
} as const;

export const __schemas: Record<string, Record<string, string>> = {
  Book: {
    name: "string",
    testament: "enum",
    chapters: "number",
    abbreviation: "string",
    order: "number",
    createdAt: "date",
    updatedAt: "date",
  },
  Chapter: {
    book: "entity",
    number: "number",
    verseCount: "number",
    createdAt: "date",
    updatedAt: "date",
  },
  Verse: {
    book: "entity",
    chapter: "entity",
    number: "number",
    text: "string",
    reference: "string",
    keywords: "array",
    difficulty: "enum",
    theme: "string",
    createdAt: "date",
    updatedAt: "date",
  },
  UserProgress: {
    user: "user",
    verse: "entity",
    status: "enum",
    timesRecited: "number",
    lastPracticed: "date",
    nextReview: "date",
    accuracy: "number",
    streak: "number",
    createdAt: "date",
    updatedAt: "date",
  },
  Session: {
    user: "user",
    versesPracticed: "array",
    startTime: "date",
    endTime: "date",
    mode: "enum",
    score: "number",
    totalQuestions: "number",
    createdAt: "date",
    updatedAt: "date",
  },
  Achievement: {
    user: "user",
    type: "enum",
    earnedAt: "date",
    verseCount: "number",
    book: "entity",
    createdAt: "date",
    updatedAt: "date",
  },
  DailyGoal: {
    user: "user",
    date: "date",
    targetVerses: "number",
    completedVerses: "number",
    completed: "bool",
    createdAt: "date",
    updatedAt: "date",
  },
  ReviewSchedule: {
    user: "user",
    verse: "entity",
    interval: "number",
    easeFactor: "number",
    dueDate: "date",
    reviewsCompleted: "number",
    createdAt: "date",
    updatedAt: "date",
  },
  Bookmark: {
    user: "user",
    reference: "string",
    addedAt: "date",
    createdAt: "date",
    updatedAt: "date",
  },
};

export const __defaults: Record<string, Record<string, { kind: string }>> = {
};

export const __entityDefaults: Record<string, Record<string, unknown>> = {
  Verse: {
    difficulty: "medium",
  },
  UserProgress: {
    status: "new",
    timesRecited: 0,
    accuracy: 0,
    streak: 0,
  },
  Session: {
    score: 0,
    totalQuestions: 0,
  },
  DailyGoal: {
    targetVerses: 5,
    completedVerses: 0,
    completed: false,
  },
  ReviewSchedule: {
    interval: 1,
    easeFactor: 2.5,
    reviewsCompleted: 0,
  },
};
