import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Workout from "@/pages/workout";
import WorkoutDetail from "@/pages/workout-detail";
import History from "@/pages/history";
import PRs from "@/pages/prs";
import Achievements from "@/pages/achievements";
import Connect from "@/pages/connect";
import Reports from "@/pages/reports";
import WorkoutGenerate from "@/pages/workout-generate";
import DevEnv from "@/pages/dev-env";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/workout" component={Workout} />
      <Route path="/workout/:id" component={WorkoutDetail} />
      <Route path="/history" component={History} />
      <Route path="/prs" component={PRs} />
      <Route path="/achievements" component={Achievements} />
      <Route path="/connect" component={Connect} />
      <Route path="/reports" component={Reports} />
      <Route path="/generate-workout" component={WorkoutGenerate} />
      <Route path="/dev/env" component={DevEnv} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="axle-ui-theme">
        <TooltipProvider>
          <AppLayout>
            <Toaster />
            <Router />
          </AppLayout>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
