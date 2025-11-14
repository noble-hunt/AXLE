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
  const [lastWorkoutId, setLastWorkoutId] = useState<string | null>(null);

  // Refs
  const gemRef = useRef<HTMLDivElement>(null);
  const gemOuterRef = useRef<SVGPolygonElement>(null);
  const gemMiddleRef = useRef<SVGPolygonElement>(null);
  const gemInnerRef = useRef<SVGPolygonElement>(null);
  const gemContainerRef = useRef<SVGSVGElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const blobPathRef = useRef<SVGPathElement>(null);
  const blobContainerRef = useRef<SVGSVGElement>(null);
  const gumballContainerRef = useRef<SVGSVGElement>(null);
  const treeRef = useRef<SVGPathElement>(null);
  const liquidFillRef = useRef<SVGRectElement>(null);

  // ===== TRAINING IDENTITY GEM: Multi-layered Crystal =====
  useEffect(() => {
    if (!gemOuterRef.current || !gemMiddleRef.current || !gemInnerRef.current || !animeLoaded) return;

    const outer = gemOuterRef.current;
    const middle = gemMiddleRef.current;
    const inner = gemInnerRef.current;

    // Clean up any existing animations
    window.anime.remove([outer, middle, inner]);

    // Parallax rotation for each layer (initialize once)
    window.anime({
      targets: outer,
      rotate: '360deg',
      duration: 8000,
      easing: 'linear',
      loop: true,
    });

    window.anime({
      targets: middle,
      rotate: '-360deg',
      duration: 12000,
      easing: 'linear',
      loop: true,
    });

    window.anime({
      targets: inner,
      rotate: '360deg',
      duration: 10000,
      easing: 'linear',
      loop: true,
    });
  }, [animeLoaded]);

  // ===== TRAINING IDENTITY GEM: Color Gradient Morphing =====
  useEffect(() => {
    if (!animeLoaded) return;

    // Color morphing: red (strength) to blue (cardio)
    const strengthHue = 0; // Red
    const cardioHue = 240; // Blue
    const currentHue = strengthRatio * strengthHue + cardioRatio * cardioHue;
    
    // Create gradient colors
    const color1 = `hsl(${currentHue}, 80%, 50%)`;
    const color2 = `hsl(${currentHue + 30}, 70%, 60%)`;

    // Animate gradient stops separately
    const gradient1 = document.getElementById('gemGradientStop1');
    const gradient2 = document.getElementById('gemGradientStop2');
    
    if (gradient1 && gradient2) {
      // Clean up previous color animations
      window.anime.remove([gradient1, gradient2]);

      // Animate first stop
      window.anime({
        targets: gradient1,
        'stop-color': color1,
        duration: 1500,
        easing: 'easeInOutQuad',
      });

      // Animate second stop
      window.anime({
        targets: gradient2,
        'stop-color': color2,
        duration: 1500,
        easing: 'easeInOutQuad',
      });
    }
  }, [strengthRatio, cardioRatio, animeLoaded]);

  // ===== TRAINING IDENTITY GEM: Glowing Vertices =====
  useEffect(() => {
    if (!animeLoaded) return;

    const vertices = document.querySelectorAll('.gem-vertex');
    if (vertices.length === 0) return;

    // Clean up existing vertex animations
    window.anime.remove(vertices);

    const glowIntensity = Math.min(streakDays / 30, 1);

    vertices.forEach((vertex, i) => {
      window.anime({
        targets: vertex,
        scale: [1, 1 + glowIntensity * 0.5, 1],
        opacity: [0.6, 0.6 + glowIntensity * 0.4, 0.6],
        duration: 2000,
        delay: i * 100,
        easing: 'easeInOutQuad',
        loop: true,
      });
    });
  }, [streakDays, animeLoaded]);

  // ===== TRAINING IDENTITY GEM: Particle Trails (Initialize Once) =====
  useEffect(() => {
    if (!gemContainerRef.current || !animeLoaded) return;

    const particles = document.querySelectorAll('.gem-particle');
    if (particles.length === 0) return;

    // Clean up existing particle animations
    window.anime.remove(particles);

    const orbitRadius = 55;

    particles.forEach((particle, i) => {
      const angle = (i / particles.length) * Math.PI * 2;
      
      // Orbital motion
      window.anime({
        targets: particle,
        translateX: [
          { value: Math.cos(angle) * orbitRadius },
          { value: Math.cos(angle + Math.PI * 2) * orbitRadius }
        ],
        translateY: [
          { value: Math.sin(angle) * orbitRadius },
          { value: Math.sin(angle + Math.PI * 2) * orbitRadius }
        ],
        duration: 6000 + i * 300,
        easing: 'linear',
        loop: true,
      });
    });
  }, [animeLoaded]);

  // ===== TRAINING IDENTITY GEM: Particle Opacity Based on Workout Frequency =====
  useEffect(() => {
    if (!animeLoaded) return;

    const particles = document.querySelectorAll('.gem-particle');
    if (particles.length === 0) return;

    const workoutFrequency = Math.min(workouts.length / 10, 1);

    particles.forEach((particle, i) => {
      // Update opacity/scale based on workout frequency
      window.anime({
        targets: particle,
        opacity: [0.3, 0.8 * workoutFrequency, 0.3],
        scale: [0.8, 1.2, 0.8],
        duration: 1500,
        delay: i * 200,
        easing: 'easeInOutQuad',
        loop: true,
      });
    });
  }, [workouts.length, animeLoaded]);

  // ===== VITALITY ORB: Blob Morphing =====
  useEffect(() => {
    if (!blobPathRef.current || !animeLoaded) return;

    // Define 5 organic blob shapes
    const blobPaths = [
      // Shape 0: Low recovery - jagged, stressed
      "M20,-30 C30,-20 40,0 30,20 C20,30 0,35 -20,30 C-35,20 -40,0 -30,-20 C-20,-35 0,-40 20,-30 Z",
      // Shape 1: Slight improvement
      "M22,-28 C32,-18 38,5 28,22 C18,32 -5,33 -22,28 C-33,18 -38,0 -28,-22 C-18,-33 5,-38 22,-28 Z",
      // Shape 2: Medium recovery
      "M24,-26 C34,-16 36,8 26,24 C16,34 -8,32 -24,26 C-32,16 -36,0 -26,-24 C-16,-34 8,-36 24,-26 Z",
      // Shape 3: Good recovery
      "M26,-24 C36,-14 34,12 24,26 C14,36 -12,30 -26,24 C-30,14 -34,0 -24,-26 C-14,-36 12,-34 26,-24 Z",
      // Shape 4: Excellent recovery - smooth, rounded
      "M25,-25 C35,-15 35,15 25,25 C15,35 -15,35 -25,25 C-35,15 -35,-15 -25,-25 C-15,-35 15,-35 25,-25 Z",
    ];

    const pathIndex = Math.min(Math.floor(sleepQuality * 4), 4);
    const recoveryHue = sleepQuality * 180 + 20; // 200° teal → 20° orange

    // Morph blob shape
    window.anime({
      targets: blobPathRef.current,
      d: blobPaths[pathIndex],
      duration: 2000,
      easing: 'easeInOutQuad',
    });

    // Animate fill color
    window.anime({
      targets: blobPathRef.current,
      fill: `hsl(${recoveryHue}, 70%, 60%)`,
      duration: 2000,
      easing: 'easeInOutQuad',
    });

    // Pulsing/breathing effect
    window.anime({
      targets: blobPathRef.current,
      scale: [1, 1.15, 1],
      opacity: [0.8, 1, 0.8],
      duration: 3000 - (restingHR - 40) * 30,
      easing: 'easeInOutQuad',
      loop: true,
    });
  }, [sleepQuality, restingHR, animeLoaded]);

  // ===== VITALITY ORB: Particle Aura =====
  useEffect(() => {
    if (!blobContainerRef.current || !animeLoaded) return;

    const particles = document.querySelectorAll('.orb-particle');
    if (particles.length === 0) return;

    const particleCount = particles.length;
    const radius = 40;

    // Animate each particle in circular orbit
    particles.forEach((particle, i) => {
      const angle = (i / particleCount) * Math.PI * 2;
      
      window.anime({
        targets: particle,
        translateX: [
          { value: Math.cos(angle) * radius },
          { value: Math.cos(angle + Math.PI * 2) * radius }
        ],
        translateY: [
          { value: Math.sin(angle) * radius },
          { value: Math.sin(angle + Math.PI * 2) * radius }
        ],
        duration: 8000 + i * 200, // Stagger speeds
        easing: 'linear',
        loop: true,
      });

      // Pulse particles
      window.anime({
        targets: particle,
        opacity: [0.3, 0.8, 0.3],
        r: [1.5, 2.5, 1.5],
        duration: 2000,
        delay: i * 150,
        easing: 'easeInOutQuad',
        loop: true,
      });
    });
  }, [sleepQuality, animeLoaded]);

  // ===== GUMBALL MACHINE: Liquid Fill Animation =====
  useEffect(() => {
    if (!liquidFillRef.current || !animeLoaded) return;

    const targetHeight = Math.min(workouts.length * 10, 100);

    window.anime({
      targets: liquidFillRef.current,
      height: targetHeight,
      y: 110 - targetHeight,
      duration: 800,
      easing: 'easeOutQuad',
    });
  }, [workouts.length, animeLoaded]);

  // ===== GUMBALL MACHINE: Drop Animation with Spring Physics =====
  useEffect(() => {
    if (!animeLoaded || workouts.length === 0) return;

    // Get all gumball elements
    const gumballs = document.querySelectorAll('.gumball');
    if (gumballs.length === 0) return;

    // Animate all gumballs with stagger
    window.anime({
      targets: gumballs,
      translateY: [
        { value: -200, duration: 0 },
        { value: 0, duration: 1200, easing: 'spring(1, 80, 10, 0)' }
      ],
      scale: [
        { value: 0.5, duration: 0 },
        { value: 1, duration: 1200, easing: 'spring(1, 80, 10, 0)' }
      ],
      rotate: [
        { value: 0, duration: 0 },
        { value: '1turn', duration: 1200, easing: 'easeOutQuad' }
      ],
      opacity: [
        { value: 0, duration: 0 },
        { value: 0.9, duration: 400 }
      ],
      delay: window.anime.stagger(100),
    });
  }, [workouts.length, animeLoaded]);

  // ===== GUMBALL MACHINE: Ripple Effect on Last Gumball =====
  useEffect(() => {
    if (!lastWorkoutId || !animeLoaded) return;

    const ripple = document.getElementById(`ripple-${lastWorkoutId}`);
    if (!ripple) return;

    // Create timeline for drop → bounce → ripple
    const timeline = window.anime.timeline({
      easing: 'easeOutQuad',
    });

    timeline
      .add({
        targets: ripple,
        r: [0, 20],
        opacity: [0.6, 0],
        duration: 1000,
        delay: 1200, // Wait for drop to complete
      });
  }, [lastWorkoutId, animeLoaded]);

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
    setLastWorkoutId(newWorkout.id);
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
          💎 Training Identity Gem (Multi-layered Crystal)
        </h2>
        <p className="text-sm text-gray-400">
          Adjust sliders to see crystal morph, vertices glow, and particles orbit!
        </p>
        <div className="flex justify-center">
          <svg
            ref={gemContainerRef}
            viewBox="0 0 100 100"
            className="w-64 h-64"
          >
            {/* Gradient Definition */}
            <defs>
              <linearGradient id="gemGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop id="gemGradientStop1" offset="0%" stopColor="hsl(0, 80%, 50%)" />
                <stop id="gemGradientStop2" offset="100%" stopColor="hsl(30, 70%, 60%)" />
              </linearGradient>
            </defs>

            {/* Particle Trails */}
            {Array.from({ length: 8 }).map((_, i) => {
              const particleCount = 8;
              const angle = (i / particleCount) * Math.PI * 2;
              const radius = 55;
              return (
                <circle
                  key={i}
                  className="gem-particle"
                  cx={50 + Math.cos(angle) * radius}
                  cy={50 + Math.sin(angle) * radius}
                  r="1.5"
                  fill="white"
                  opacity="0.5"
                />
              );
            })}

            {/* Outer Crystal Layer */}
            <polygon
              ref={gemOuterRef}
              points="50,5 95,35 82,85 18,85 5,35"
              fill="url(#gemGradient)"
              opacity="0.3"
              style={{ transformOrigin: '50px 50px' }}
            />

            {/* Middle Crystal Layer */}
            <polygon
              ref={gemMiddleRef}
              points="50,15 85,40 75,80 25,80 15,40"
              fill="url(#gemGradient)"
              opacity="0.5"
              style={{ transformOrigin: '50px 50px' }}
            />

            {/* Inner Crystal Layer */}
            <polygon
              ref={gemInnerRef}
              points="50,25 75,45 68,75 32,75 25,45"
              fill="url(#gemGradient)"
              opacity="0.7"
              style={{ transformOrigin: '50px 50px' }}
            />

            {/* Vertex Points (Outer Layer) */}
            {[[50, 5], [95, 35], [82, 85], [18, 85], [5, 35]].map(([x, y], i) => (
              <circle
                key={`vertex-${i}`}
                className="gem-vertex"
                cx={x}
                cy={y}
                r="2"
                fill="white"
                opacity="0.8"
              />
            ))}
          </svg>
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
            {/* Gradient Definition for Liquid Fill */}
            <defs>
              <linearGradient id="liquidGradient" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.4" />
              </linearGradient>
            </defs>

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

            {/* Liquid Fill Meter */}
            <rect
              ref={liquidFillRef}
              x="10"
              y="110"
              width="80"
              height="0"
              fill="url(#liquidGradient)"
              rx="8"
            />

            {/* Gumballs */}
            {workouts.map((workout, i) => {
              const row = Math.floor(i / 5);
              const col = i % 5;
              return (
                <g key={workout.id}>
                  {/* Ripple effect for last added gumball */}
                  {workout.id === lastWorkoutId && (
                    <circle
                      id={`ripple-${workout.id}`}
                      cx={20 + col * 14}
                      cy={95 - row * 14}
                      r="0"
                      fill="none"
                      stroke={workout.color}
                      strokeWidth="2"
                      opacity="0"
                    />
                  )}
                  {/* Gumball */}
                  <circle
                    className="gumball"
                    cx={20 + col * 14}
                    cy={95 - row * 14}
                    r="6"
                    fill={workout.color}
                    opacity="0"
                  />
                </g>
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
        <h2 className="text-xl font-semibold">🌀 Vitality Orb (Morphing Blob)</h2>
        <p className="text-sm text-gray-400">
          Adjust sleep quality to see the blob morph and particles respond!
        </p>
        <div className="flex justify-center">
          <svg
            ref={blobContainerRef}
            viewBox="-50 -50 100 100"
            className="w-64 h-64"
          >
            {/* Morphing Blob */}
            <path
              ref={blobPathRef}
              d="M20,-30 C30,-20 40,0 30,20 C20,30 0,35 -20,30 C-35,20 -40,0 -30,-20 C-20,-35 0,-40 20,-30 Z"
              fill="hsl(200, 70%, 60%)"
              opacity="0.8"
            />

            {/* Particle Aura */}
            {Array.from({ length: Math.floor(sleepQuality * 15) }).map((_, i) => {
              const particleCount = Math.floor(sleepQuality * 15);
              const angle = (i / particleCount) * Math.PI * 2;
              const radius = 40;
              return (
                <circle
                  key={i}
                  className="orb-particle"
                  cx={Math.cos(angle) * radius}
                  cy={Math.sin(angle) * radius}
                  r="2"
                  fill="white"
                  opacity="0.5"
                />
              );
            })}
          </svg>
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

    </div>
  );
}