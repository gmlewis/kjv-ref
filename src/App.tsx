import { Switch, Route } from "@prophet/client/react";
import Dashboard from "./components/Dashboard";
import Practice from "./components/Practice";
import Books from "./components/Books";
import Statistics from "./components/Statistics";
import Achievements from "./components/Achievements";
import Navigation from "./components/Navigation";

function App() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Switch>
          <Route path="/books/:book/:chapter"><Books /></Route>
          <Route path="/books/:book"><Books /></Route>
          <Route path="/practice/:reference"><Practice /></Route>
          <Route path="/books"><Books /></Route>
          <Route path="/practice"><Practice /></Route>
          <Route path="/statistics"><Statistics /></Route>
          <Route path="/achievements"><Achievements /></Route>
          <Route path="/"><Dashboard /></Route>
        </Switch>
      </main>
    </div>
  );
}

export default App;
