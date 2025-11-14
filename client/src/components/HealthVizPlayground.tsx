// client/src/components/HealthVizPlayground.tsx
import { useEffect, useRef, useState } from "react";

// Load anime.js from CDN
declare global {
  interface Window {
    anime: any;
  }
}

// Hook to load anime.js from CDN
function useAnimeJS() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.anime) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js";
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  return loaded;
}

interface Workout {
  id: string;
  focus: "strength" | "cardio" | "mixed" | "endurance";
  color: string;
}

export function HealthVizPlayground() {
  const animeLoaded = useAnimeJS();

  // ===== SLIDER CONTROLS (Initial Testing) =====
  const [strengthRatio, setStrengthRatio] = useState(0.6); // 0-1
  const [cardioRatio, setCardioRatio] = useState(0.3);
  const [streakDays, setStreakDays] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(0.8); // 0-1
  const [restingHR, setRestingHR] = useState(60);

  // ===== GROWTH MECHANICS =====
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [streakWeeks, setStreakWeeks] = useState(0);
  const [goodSleepNights, setGoodSleepNights] = useState(4);

  // Refs
  const gemRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const gumballContainerRef = useRef<SVGSVGElement>(null);
  const treeRef = useRef<SVGPathElement>(null);

  // ===== TRAINING IDENTITY GEM (Color + Scale) =====
  useEffect(() => {
    if (!gemRef.current) return;

    const hue = strengthRatio * 0 + cardioRatio * 240;
    const scale = 1 + streakDays * 0.05;
    const rotation = streakDays * 5;

    window.anime({
      targets: gemRef.current,
      background: `linear-gradient(135deg, hsl(${hue}, 80%, 50%), hsl(${hue + 30}, 70%, 60%))`,
      scale: [gemRef.current.style.transform ? 1 : 0.8, scale],
      rotate: `${rotation}deg`,
      duration: 1500,
      easing: "easeOutElastic(1, .6)",
    });
  }, [strengthRatio, cardioRatio, streakDays]);

  // ===== VITALITY ORB (Pulse + Glow) =====
  useEffect(() => {
    if (!orbRef.current) return;

    const recoveryHue = sleepQuality * 180 + 20; // 200° teal → 20° orange
    const pulseSpeed = 3000 - (restingHR - 40) * 30;
    const glowIntensity = sleepQuality * 20 + 5;

    window.anime({
      targets: orbRef.current,
      background: `radial-gradient(circle, hsl(${recoveryHue}, 70%, 60%), hsl(${recoveryHue}, 50%, 40%))`,
      boxShadow: `0 0 ${glowIntensity}px hsl(${recoveryHue}, 80%, 50%)`,
      scale: [1, 1.1, 1],
      duration: pulseSpeed,
      easing: "easeInOutQuad",
      loop: true,
    });
  }, [sleepQuality, restingHR]);

  // ===== GUMBALL MACHINE: Add workout =====
  const addWorkout = () => {
    const focuses: Array<"strength" | "cardio" | "mixed" | "endurance"> = [
      "strength",
      "cardio",
      "mixed",
      "endurance",
    ];
    const colors: Record<string, string> = {
      strength: "#ef4444",
      cardio: "#3b82f6",
      mixed: "#fbbf24",
      endurance: "#10b981",
    };

    const focus = focuses[Math.floor(Math.random() * focuses.length)];
    const newWorkout: Workout = {
      id: Date.now().toString(),
      focus,
      color: colors[focus],
    };

    setWorkouts((prev) => [...prev, newWorkout]);
  };

  // ===== TREE GROWTH: Morph branches =====
  useEffect(() => {
    if (!treeRef.current) return;

    const branchPaths = [
      "M50,100 L50,50", // 0 weeks (trunk only)
      "M50,100 L50,50 L30,30 L70,30", // 1-2 weeks (2 branches)
      "M50,100 L50,50 L30,30 L70,30 L20,10 L80,10", // 3+ weeks (4 branches)
    ];

    const pathIndex = Math.min(Math.floor(streakWeeks / 2), 2);

    window.anime({
      targets: treeRef.current,
      d: branchPaths[pathIndex],
      duration: 2000,
      easing: "easeOutElastic(1, .5)",
    });
  }, [streakWeeks]);

  // Show loading state while anime.js loads
  if (!animeLoaded) {
    return (
      <div className="p-6 bg-gray-900 min-h-screen text-white flex items-center justify-center">
        <p className="text-xl">Loading animations...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-12 bg-gray-900 min-h-screen text-white">
      <h1 className="text-3xl font-bold">Health Viz Playground 🎨</h1>

      {/* ========== SECTION 1: TRAINING IDENTITY GEM ========== */}
      <div className="space-y-4 border border-gray-700 p-6 rounded-lg">
        <h2 className="text-xl font-semibold">
          🔷 Training Identity Gem (Sliders)
        </h2>
        <div className="flex justify-center">
          <div
            ref={gemRef}
            className="w-40 h-40 rounded-lg"
            style={{
              clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
            }}
          />
        </div>
        <div className="space-y-2">
          <label className="block">
            Strength Ratio: {strengthRatio.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={strengthRatio}
              onChange={(e) => setStrengthRatio(parseFloat(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            Cardio Ratio: {cardioRatio.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={cardioRatio}
              onChange={(e) => setCardioRatio(parseFloat(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            Streak Days: {streakDays}
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={streakDays}
              onChange={(e) => setStreakDays(parseInt(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </div>

      {/* ========== SECTION 2: GUMBALL MACHINE (Growth) ========== */}
      <div className="space-y-4 border border-gray-700 p-6 rounded-lg">
        <h2 className="text-xl font-semibold">
          🍬 Gumball Machine (Growth Test)
        </h2>
        <p className="text-sm text-gray-400">
          Click "Add Workout" to see gumballs drop in!
        </p>

        <div className="flex justify-center">
          <svg
            ref={gumballContainerRef}
            viewBox="0 0 100 120"
            className="w-64 h-80"
            style={{
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
            }}
          >
            {/* Container outline */}
            <rect
              x="10"
              y="10"
              width="80"
              height="100"
              fill="none"
              stroke="white"
              strokeWidth="1"
              opacity="0.3"
              rx="8"
            />

            {/* Gumballs */}
            {workouts.map((workout, i) => {
              const row = Math.floor(i / 5);
              const col = i % 5;
              return (
                <circle
                  key={workout.id}
                  cx={20 + col * 14}
                  cy={95 - row * 14}
                  r="6"
                  fill={workout.color}
                  opacity="0.9"
                  style={{
                    animation:
                      i === workouts.length - 1
                        ? "dropIn 1.2s ease-out"
                        : "none",
                  }}
                />
              );
            })}
          </svg>
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={addWorkout}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
          >
            Add Workout
          </button>
          <button
            onClick={() => setWorkouts([])}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-semibold"
          >
            Reset
          </button>
        </div>
        <p className="text-center text-sm text-gray-400">
          Workouts: {workouts.length}
        </p>
      </div>

      {/* ========== SECTION 3: VITALITY ORB ========== */}
      <div className="space-y-4 border border-gray-700 p-6 rounded-lg">
        <h2 className="text-xl font-semibold">🌀 Vitality Orb (Sliders)</h2>
        <div className="flex justify-center">
          <div ref={orbRef} className="w-40 h-40 rounded-full" />
        </div>
        <div className="space-y-2">
          <label className="block">
            Sleep Quality: {sleepQuality.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={sleepQuality}
              onChange={(e) => setSleepQuality(parseFloat(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            Resting HR: {restingHR} bpm
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={restingHR}
              onChange={(e) => setRestingHR(parseInt(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </div>

      {/* ========== SECTION 4: GROWING TREE (Wellness) ========== */}
      <div className="space-y-4 border border-gray-700 p-6 rounded-lg">
        <h2 className="text-xl font-semibold">
          🌳 Growing Tree (Wellness Growth)
        </h2>
        <p className="text-sm text-gray-400">
          Adjust weeks & sleep to see branches/leaves grow!
        </p>

        <div className="flex justify-center">
          <svg viewBox="0 0 100 120" className="w-64 h-80">
            {/* Trunk + Branches (morphing path) */}
            <path
              ref={treeRef}
              d="M50,100 L50,50"
              stroke="#8b4513"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />

            {/* Leaves (based on good sleep nights) */}
            {Array.from({ length: goodSleepNights }).map((_, i) => {
              const x = 30 + Math.random() * 40;
              const y = 20 + Math.random() * 30;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#4ade80"
                  opacity="0.8"
                />
              );
            })}
          </svg>
        </div>

        <div className="space-y-2">
          <label className="block">
            Streak Weeks: {streakWeeks}
            <input
              type="range"
              min="0"
              max="6"
              step="1"
              value={streakWeeks}
              onChange={(e) => setStreakWeeks(parseInt(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            Good Sleep Nights (last 7 days): {goodSleepNights}
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              value={goodSleepNights}
              onChange={(e) => setGoodSleepNights(parseInt(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </div>

      {/* CSS for gumball drop animation */}
      <style>{`
        @keyframes dropIn {
          0% {
            transform: translateY(-100px);
            opacity: 0;
          }
          60% {
            transform: translateY(5px);
          }
          80% {
            transform: translateY(-2px);
          }
          100% {
            transform: translateY(0);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
}