# TODO: Convert Prophet Web App to Static Website for GitHub Pages

This task involves removing ALL dependence upon Prophet and replacing its features with static website alternatives that work on GitHub Pages.

## Overview
The current KJV Memorization app relies heavily on the Prophet platform for:
- Data storage and retrieval (entities)
- Real-time subscriptions
- Mutations (data updates)
- File storage for large reference data
- Authentication and permissions
- Routing

For GitHub Pages deployment, we need to replace all Prophet functionality with static alternatives.

## Tasks

### Phase 1: Analysis and Preparation
- [ ] Audit all Prophet imports throughout the codebase
- [ ] Identify all Prophet hooks used: `useSubscribe`, `useMutation`, `useFile`, `useParams`, `useLocation`, `useCurrentUser`, `useUploadFile`, `useMembers`, `usePresence`
- [ ] Identify all Prophet components used: `ProphetApp`, `Route`, `Switch`, `Link`
- [ ] Identify all Prophet-generated types and shapes used
- [ ] Document all Prophet file IDs used from `prophet-file-ids.ts`
- [ ] Verify all static fallback paths exist in `public/` directory

### Phase 2: Replace Prophet Data Storage
#### Replace Entity Storage with In-Memory/LocalStorage
- [ ] Replace `Book` entity with static data from `BOOK_ABBR_MAP`
- [ ] Replace `Chapter` entity with computed data from verse references
- [ ] Replace `Verse` entity with data from `kjv-verses.ts` and `kjv-bible.ts`
- [ ] Replace `UserProgress` entity with localStorage storage
- [ ] Replace `Session` entity with localStorage storage
- [ ] Replace `Achievement` entity with localStorage storage
- [ ] Replace `DailyGoal` entity with localStorage storage
- [ ] Replace `ReviewSchedule` entity with localStorage storage
- [ ] Replace `Bookmark` entity with localStorage storage

#### Replace Prophet Shapes with Direct Data Access
- [ ] Replace `AllBooks` shape with direct access to book data
- [ ] Replace `BookChapters` shape with computed chapter data
- [ ] Replace `ChapterVerses` shape with direct verse lookup
- [ ] Replace `MyProgress` shape with localStorage retrieval
- [ ] Replace `ProgressByVerse` shape with direct progress lookup
- [ ] Replace `DueReviews` shape with scheduled review computation
- [ ] Replace `MySessions` shape with localStorage retrieval
- [ ] Replace `MyAchievements` shape with localStorage retrieval
- [ ] Replace `TodayGoal` shape with date-based goal retrieval
- [ ] Replace `VerseByReference` shape with direct verse lookup
- [ ] Replace `VersesByDifficulty` shape with filtered verse array
- [ ] Replace `VersesByTheme` shape with filtered verse array
- [ ] Replace `MasteryStats` shape with computed statistics
- [ ] Replace `RecentSessions` shape with localStorage retrieval
- [ ] Replace `MyBookmarks` shape with localStorage retrieval

#### Replace Prophet Mutations with Local Functions
- [ ] Replace `createBookmark` mutation with localStorage save function
- [ ] Replace `removeBookmark` mutation with localStorage delete function
- [ ] Replace `createBook` mutation (not needed - books are static)
- [ ] Replace `createChapter` mutation (not needed - chapters are static)
- [ ] Replace `createVerse` mutation (not needed - verses are static)
- [ ] Replace `batchImportVerses` mutation (not needed - verses are static)
- [ ] Replace `updateProgress` mutation with localStorage update function
- [ ] Replace `createProgress` mutation with localStorage save function
- [ ] Replace `createSession` mutation with localStorage save function
- [ ] Replace `awardAchievement` mutation with localStorage save function
- [ ] Replace `createDailyGoal` mutation with localStorage save function
- [ ] Replace `updateDailyGoal` mutation with localStorage update function
- [ ] Replace `createReviewSchedule` mutation with localStorage save function
- [ ] Replace `updateReviewSchedule` mutation with localStorage update function

### Phase 3: Replace Prophet File Storage
#### Replace `useFile` Hook with Static Imports/Fetch
- [ ] Replace KJV text file (`kjvTxt`) with import/fetch from `public/kjv.txt`
- [ ] Replace Strong's Hebrew lexicon (`strongsHebrew`) with import/fetch from `public/strongs/hebrew.json`
- [ ] Replace Strong's Greek lexicon (`strongsGreek`) with import/fetch from `public/strongs/greek.json`
- [ ] Replace Strong's word index (`strongsWordIndex`) with import/fetch from `public/strongs/word-index.json`
- [ ] Replace interlinear Hebrew text (`interlinearHebrew`) with import/fetch from `public/interlinear/hebrew.json`
- [ ] Replace interlinear Greek text (`interlinearGreek`) with import/fetch from `public/interlinear/greek.json`
- [ ] Replace per-book interlinear words with import/fetch from `public/interlinear/words/{book}.json`

#### Update Data Loading Functions
- [ ] Modify `kjv-bible.ts` to use static imports instead of Prophet file URLs
- [ ] Modify `strongs.ts` to use static imports instead of Prophet file URLs
- [ ] Modify `interlinear.ts` to use static imports instead of Prophet file URLs
- [ ] Update `dataUrls.ts` to return static paths instead of Prophet URLs
- [ ] Remove Prophet file ID constants that are no longer needed

### Phase 4: Replace Prophet Authentication
#### Remove Authentication Dependencies
- [ ] Remove `useCurrentUser` hooks and replace with mock/user-less implementation
- [ ] Remove authentication checks from mutations
- [ ] Remove `authenticatedUsers` and `currentUser` references
- [ ] Simplify all entity access to not require user context
- [ ] Remove all permission/scopes logic since it's a public static site
- [ ] Update all mutations to work without user authentication

### Phase 5: Replace Prophet Routing
#### Replace with React Router
- [ ] Install `react-router-dom` as a dependency
- [ ] Replace `ProphetApp` provider with standard React setup
- [ ] Replace `Switch` component with `Routes` from react-router-dom
- [ ] Replace `Route` component with `Route` from react-router-dom
- [ ] Replace `Link` component with `Link` from react-router-dom
- [ ] Replace `useParams` hook with `useParams` from react-router-dom
- [ ] Replace `useLocation` hook with `useLocation` from react-router-dom
- [ ] Replace `useRoute` hook with proper react-router-dom equivalent
- [ ] Update all route paths and navigation logic

### Phase 6: Replace Prophet UI Components
#### Replace Prophet-Specific Components
- [ ] Replace `Switch` with `Routes` from react-router-dom
- [ ] Replace `Route` with `Route` from react-router-dom
- [ ] Ensure all `Link` components work with react-router-dom
- [ ] Test all navigation flows

### Phase 7: State Management Solution
#### Choose and Implement State Management
- [ ] Evaluate options: Context API, Zustand, Redux Toolkit, or localStorage with event listeners
- [ ] Implement chosen solution for sharing data between components
- [ ] Ensure progress, sessions, achievements, etc. persist across page reloads
- [ ] Implement localStorage persistence for all user data
- [ ] Add synchronization between tabs/windows if needed

### Phase 8: Build and Deployment Configuration
#### Update Build Process
- [ ] Modify `vite.config.ts` for proper static site building
- [ ] Update `package.json` build scripts for static output
- [ ] Ensure all static assets are properly copied to dist/
- [ ] Configure proper routing for client-side routing (404 fallback to index.html)
- [ ] Update `deploy.sh` or create new deployment script for GitHub Pages
- [ ] Remove all Prophet-specific build steps (`prophet typegen`, etc.)

### Phase 9: Testing and Validation
#### Verify Static Site Functionality
- [ ] Test all data loading works without Prophet
- [ ] Test all UI components render correctly
- [ ] Test all navigation routes work
- [ ] Test all data persistence (progress, sessions, etc.)
- [ ] Test all practice modes work correctly
- [ ] Test all achievement tracking works
- [ ] Test all bookmarking functionality works
- [ ] Test responsive design on various screen sizes
- [ ] Test performance and bundle size

#### Prepare for GitHub Pages Deployment
- [ ] Create `CNAME` file if using custom domain
- [ ] Ensure all assets use relative paths
- [ ] Test build output locally with HTTP server
- [ ] Configure GitHub repository for Pages deployment
- [ ] Set up proper branch/folder for Pages serving
- [ ] Create deployment documentation

### Phase 10: Cleanup
#### Remove Unused Prophet Code
- [ ] Remove `kjv-memorize.prophet` file
- [ ] Remove `kjv-memorize.ts` generated types file
- [ ] Remove `src/types/prophet.d.ts` file
- [ ] Remove `src/lib/prophet-mock.ts` file
- [ ] Remove all Prophet imports from components
- [ ] Remove all Prophet-related utility functions
- [ ] Remove all Prophet-specific comments and documentation
- [ ] Update README.md to reflect static site nature
- [ ] Remove Prophet SDK installation from setup scripts

## Verification Checklist
- [ ] No remaining imports from `@prophet/client/react`
- [ ] No remaining references to Prophet file IDs
- [ ] No remaining references to Prophet entities or shapes
- [ ] No remaining Prophet-specific routing components
- [ ] No remaining Prophet authentication dependencies
- [ ] All data loads successfully from static sources
- [ ] All user data persists in localStorage
- [ ] All navigation works with react-router-dom
- [ ] All practice modes function correctly
- [ ] All achievements and tracking work properly
- [ ] Build output works correctly when served statically
- [ ] Site can be deployed to GitHub Pages and functions properly

## Estimated Effort
This conversion requires significant refactoring but is feasible since:
- Much of the data is already available in static form
- The UI components are largely independent of Prophet specifics
- The app already has fallback mechanisms for development
- Core functionality (practice modes, spaced repetition, etc.) is already implemented

The main challenges will be:
1. State management replacement for Prophet's real-time subscriptions
2. Ensuring all data persistence works correctly with localStorage
3. Replacing the authentication-dependent flows with public access patterns
4. Maintaining the same user experience while removing backend dependencies