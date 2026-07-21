import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from "./components/Dashboard";
import Practice from "./components/Practice";
import Books from "./components/Books";
import Favorites from "./components/Favorites";
import Statistics from "./components/Statistics";
import Achievements from "./components/Achievements";
import Navigation from "./components/Navigation";

// Vite sets BASE_URL from `base` in vite.config.ts ('/kjv-ref/' in prod, '/' in dev).
// BrowserRouter needs it as basename so routes match under the project subpath.
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

function App() {
  return (
    <Router basename={ROUTER_BASENAME}>
      <div className="min-h-screen">
        <Navigation />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/books/:book/:chapter" element={<Books />} />
            <Route path="/books/:book" element={<Books />} />
            <Route path="/practice/:reference" element={<Practice />} />
            <Route path="/books" element={<Books />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
