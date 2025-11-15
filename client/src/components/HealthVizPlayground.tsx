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
  // Immediate UI state (for responsive sliders)
  const [strengthRatioUI, setStrengthRatioUI] = useState(0.6);
  const [cardioRatioUI, setCardioRatioUI] = useState(0.3);
  const [streakDaysUI, setStreakDaysUI] = useState(7);
  const [sleepQualityUI, setSleepQualityUI] = useState(0.8);
  const [streakWeeksUI, setStreakWeeksUI] = useState(0);
  const [goodSleepNightsUI, setGoodSleepNightsUI] = useState(4);

  // Debounced animation state (triggers expensive operations)
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
  const treeContainerRef = useRef<SVGSVGElement>(null);
  const liquidFillRef = useRef<SVGRectElement>(null);

  // ===== L-SYSTEM TREE GENERATION =====
  interface TreeData {
    branches: string[];
    leaves: Array<{ x: number; y: number }>;
    roots: string[];
  }

  const [treeData, setTreeData] = useState<TreeData>({ branches: [], leaves: [], roots: [] });

  // ===== POLISH FEATURES =====
  const [fps, setFps] = useState(60);
  const [isAnimationsPaused, setIsAnimationsPaused] = useState(false);
  const debounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const animationTimelinesRef = useRef<any[]>([]);
  const fpsFrameTimes = useRef<number[]>([]);
  const lastFrameTime = useRef<number>(performance.now());

  // ===== POLISH UTILITY FUNCTIONS =====
  
  // Debounced slider setter (updates UI immediately, debounces animation state)
  const debouncedSet = (key: string, uiSetter: (value: any) => void, animSetter: (value: any) => void, value: any) => {
    // Update UI state immediately for responsive sliders
    uiSetter(value);
    
    // Debounce the animation state update
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(() => {
      animSetter(value);
    }, 300);
  };

  // Reset all animations
  const resetAnimations = () => {
    if (!animeLoaded) return;
    
    // Remove all existing animations
    window.anime.remove('.gem-particle, .gem-vertex, .orb-particle, .tree-branch, .tree-root, .tree-leaf');
    animationTimelinesRef.current.forEach(timeline => {
      if (timeline && timeline.restart) {
        timeline.restart();
      }
    });
    
    // Trigger re-render by updating a dummy state
    setStreakWeeks(s => s);
  };

  // Random workout pattern - adds 10 workouts over 3 seconds
  const addRandomWorkoutPattern = () => {
    if (!animeLoaded) {
      // Fallback without animation
      for (let i = 0; i < 10; i++) {
        setTimeout(() => addWorkout(), i * 300);
      }
      return;
    }

    const workoutColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    const workoutFocus: Array<"strength" | "cardio" | "mixed" | "endurance"> = ['strength', 'cardio', 'mixed', 'endurance'];
    
    // Create timeline for workout additions
    const timeline = window.anime.timeline({
      easing: 'easeInOutQuad'
    });

    // Register timeline
    animationTimelinesRef.current.push(timeline);

    for (let i = 0; i < 10; i++) {
      timeline.add({
        duration: 1,
        complete: () => {
          addWorkout();
        }
      }, i * 300);
    }
  };

  // Generate L-System string
  const generateLSystem = (iterations: number): string => {
    let result = "F";
    for (let i = 0; i < iterations; i++) {
      result = result.replace(/F/g, "F[+F]F[-F]F");
    }
    return result;
  };

  // Convert L-System to SVG paths
  const lSystemToSVG = (lsystem: string, startX: number, startY: number, length: number, angle: number): TreeData => {
    const branches: string[] = [];
    const leaves: Array<{ x: number; y: number }> = [];
    const stack: Array<{ x: number; y: number; angle: number }> = [];
    
    let x = startX;
    let y = startY;
    let currentAngle = angle;
    const allSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    
    const angleIncrement = 25 * (Math.PI / 180); // 25 degrees in radians
    
    // Parse L-system and create all line segments
    for (let i = 0; i < lsystem.length; i++) {
      const char = lsystem[i];
      
      if (char === 'F') {
        // Move forward and record segment
        const startSegX = x;
        const startSegY = y;
        x = x + length * Math.sin(currentAngle);
        y = y - length * Math.cos(currentAngle);
        allSegments.push({ x1: startSegX, y1: startSegY, x2: x, y2: y });
        leaves.push({ x, y }); // Potential leaf at every segment end
      } else if (char === '+') {
        currentAngle += angleIncrement;
      } else if (char === '-') {
        currentAngle -= angleIncrement;
      } else if (char === '[') {
        stack.push({ x, y, angle: currentAngle });
      } else if (char === ']') {
        const state = stack.pop();
        if (state) {
          x = state.x;
          y = state.y;
          currentAngle = state.angle;
        }
      }
    }
    
    // Convert all segments to individual branch paths
    allSegments.forEach(seg => {
      branches.push(`M${seg.x1},${seg.y1} L${seg.x2},${seg.y2}`);
    });
    
    // Generate roots (mirror branches downward, but keep in viewBox)
    const roots = branches.map(branch => {
      const points = branch.split(/[ML]/).filter(p => p.trim());
      const rootPoints = points.map(point => {
        const [px, py] = point.split(',').map(Number);
        // Mirror and scale down to fit in viewBox (stay below y=100)
        const mirroredY = startY + (startY - py) * 0.3; // Scale by 0.3 to keep in bounds
        return `${px},${Math.min(mirroredY, 118)}`; // Cap at 118 to stay in viewBox
      });
      return `M${rootPoints.join(' L')}`;
    });
    
    return { branches, leaves, roots };
  };

  // Generate tree data when streakWeeks changes
  useEffect(() => {
    const iterations = Math.min(Math.floor(streakWeeks / 2), 3); // Max 3 iterations to avoid too many branches
    const lsystemString = generateLSystem(iterations);
    const data = lSystemToSVG(lsystemString, 50, 100, 8, 0);
    setTreeData(data);
  }, [streakWeeks]);

  // Initialize paths and leaves to be visible (decouple from anime.js loading)
  useEffect(() => {
    const branches = document.querySelectorAll('.tree-branch');
    const roots = document.querySelectorAll('.tree-root');
    const leaves = document.querySelectorAll('.tree-leaf');
    
    // Reset dash offsets so paths are visible even without animation
    branches.forEach((branch) => {
      const pathElement = branch as SVGPathElement;
      pathElement.style.strokeDasharray = 'none';
      pathElement.style.strokeDashoffset = '0';
    });
    
    roots.forEach((root) => {
      const pathElement = root as SVGPathElement;
      pathElement.style.strokeDasharray = 'none';
      pathElement.style.strokeDashoffset = '0';
    });

    // Make leaves visible
    leaves.forEach((leaf) => {
      const leafElement = leaf as SVGCircleElement;
      leafElement.style.opacity = '0.8';
    });
  }, [treeData]);

  // ===== FPS COUNTER =====
  useEffect(() => {
    let animationFrameId: number;

    const updateFPS = () => {
      const currentTime = performance.now();
      const delta = currentTime - lastFrameTime.current;
      lastFrameTime.current = currentTime;

      // Track frame times
      fpsFrameTimes.current.push(1000 / delta);
      if (fpsFrameTimes.current.length > 60) {
        fpsFrameTimes.current.shift();
      }

      // Calculate average FPS
      const avgFps = fpsFrameTimes.current.reduce((a, b) => a + b, 0) / fpsFrameTimes.current.length;
      setFps(Math.round(avgFps));

      animationFrameId = requestAnimationFrame(updateFPS);
    };

    animationFrameId = requestAnimationFrame(updateFPS);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // ===== PAGE VISIBILITY API =====
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      setIsAnimationsPaused(isHidden);

      if (!animeLoaded || !window.anime) return;

      if (isHidden) {
        // Pause all animations
        animationTimelinesRef.current.forEach(timeline => {
          if (timeline && timeline.pause) {
            timeline.pause();
          }
        });
      } else {
        // Resume all animations
        animationTimelinesRef.current.forEach(timeline => {
          if (timeline && timeline.play) {
            timeline.play();
          }
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [animeLoaded]);

  // ===== TRAINING IDENTITY CRYSTAL: Multi-layered with Parallax Rotation =====
  useEffect(() => {
    if (!gemOuterRef.current || !gemMiddleRef.current || !gemInnerRef.current || !animeLoaded) return;

    const outer = gemOuterRef.current;
    const middle = gemMiddleRef.current;
    const inner = gemInnerRef.current;

    // Clean up any existing animations
    window.anime.remove([outer, middle, inner]);

    // Parallax rotation for each layer with specified speeds
    window.anime({
      targets: outer,
      rotate: '360deg',
      duration: 20000, // 20s linear
      easing: 'linear',
      loop: true,
    });

    window.anime({
      targets: middle,
      rotate: '-360deg', // Counter-clockwise
      duration: 30000, // 30s linear
      easing: 'linear',
      loop: true,
    });

    window.anime({
      targets: inner,
      rotate: '360deg',
      duration: 25000, // 25s linear
      easing: 'linear',
      loop: true,
    });
  }, [animeLoaded]);

  // ===== TRAINING IDENTITY CRYSTAL: Color Gradient Morphing =====
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
    const gradient1 = document.getElementById('crystalGradStop1');
    const gradient2 = document.getElementById('crystalGradStop2');
    
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

  // ===== TRAINING IDENTITY CRYSTAL: Glowing Vertices =====
  useEffect(() => {
    if (!animeLoaded) return;

    const vertices = document.querySelectorAll('.crystal-vertex');
    if (vertices.length === 0) return;

    // Clean up existing vertex animations
    window.anime.remove(vertices);

    const glowIntensity = Math.min(streakDays / 30, 1);

    // Animate all vertices with stagger
    window.anime({
      targets: '.crystal-vertex',
      scale: [1, 1.5, 1],
      opacity: [0.6, 0.9, 0.6],
      duration: 2000,
      delay: window.anime.stagger(100), // 100ms stagger
      easing: 'easeInOutQuad',
      loop: true,
    });
  }, [streakDays, animeLoaded]);

  // ===== TRAINING IDENTITY CRYSTAL: Orbiting Particles =====
  useEffect(() => {
    if (!gemContainerRef.current || !animeLoaded) return;

    const particles = document.querySelectorAll('.crystal-particle');
    if (particles.length === 0) return;

    // Clean up existing particle animations
    window.anime.remove(particles);

    const orbitRadius = 40; // Radius for circular orbit
    const centerX = 50;
    const centerY = 50;

    particles.forEach((particle, i) => {
      const startAngle = (i / particles.length) * Math.PI * 2;
      
      // Create circular orbital motion using translateX/Y
      window.anime({
        targets: particle,
        translateX: function() {
          return Array.from({ length: 360 }, (_, deg) => {
            const angle = startAngle + (deg * Math.PI / 180);
            return Math.cos(angle) * orbitRadius;
          });
        },
        translateY: function() {
          return Array.from({ length: 360 }, (_, deg) => {
            const angle = startAngle + (deg * Math.PI / 180);
            return Math.sin(angle) * orbitRadius;
          });
        },
        // Set initial position
        cx: centerX,
        cy: centerY,
        duration: 8000,
        delay: i * 50, // Stagger by 50ms
        easing: 'linear',
        loop: true,
      });
    });
  }, [animeLoaded]);


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

    // Register timeline
    animationTimelinesRef.current.push(timeline);

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

  // ===== TREE GROWTH: Coordinated Timeline Animation =====
  useEffect(() => {
    if (!animeLoaded || !treeContainerRef.current || treeData.branches.length === 0) return;

    const branches = document.querySelectorAll('.tree-branch');
    const roots = document.querySelectorAll('.tree-root');
    const leaves = document.querySelectorAll('.tree-leaf');

    if (branches.length === 0) return;

    // Clean up existing animations
    window.anime.remove([...Array.from(branches), ...Array.from(roots), ...Array.from(leaves)]);

    // Set initial states for branches
    branches.forEach((branch) => {
      const pathElement = branch as SVGPathElement;
      const pathLength = pathElement.getTotalLength();
      pathElement.style.strokeDasharray = `${pathLength}`;
      pathElement.style.strokeDashoffset = `${pathLength}`;
    });

    // Set initial states for roots
    roots.forEach((root) => {
      const pathElement = root as SVGPathElement;
      const pathLength = pathElement.getTotalLength();
      pathElement.style.strokeDasharray = `${pathLength}`;
      pathElement.style.strokeDashoffset = `${pathLength}`;
    });

    // Create coordinated timeline
    const timeline = window.anime.timeline({
      easing: 'easeOutQuad'
    });

    // Register timeline
    animationTimelinesRef.current.push(timeline);

    // Step 1: Grow branches sequentially
    branches.forEach((branch, i) => {
      const pathElement = branch as SVGPathElement;
      const pathLength = pathElement.getTotalLength();
      
      timeline.add({
        targets: pathElement,
        strokeDashoffset: [pathLength, 0],
        duration: 1000,
        easing: 'easeOutQuad',
      }, i * 200); // Stagger by 200ms
    });

    // Step 2: Grow roots after branches
    const branchDuration = branches.length * 200;
    roots.forEach((root, i) => {
      const pathElement = root as SVGPathElement;
      const pathLength = pathElement.getTotalLength();
      
      timeline.add({
        targets: pathElement,
        strokeDashoffset: [pathLength, 0],
        duration: 800,
        easing: 'easeOutQuad',
      }, branchDuration + i * 100);
    });

    // Step 3: Fade in leaves after branches and roots
    const rootDuration = roots.length * 100;
    const leafDelay = branchDuration + rootDuration + 500;
    
    timeline.add({
      targets: Array.from(leaves),
      opacity: [0, 0.8],
      scale: [0, 1],
      duration: 600,
      delay: window.anime.stagger(50),
      easing: 'easeOutElastic(1, .6)',
    }, leafDelay);

    // Step 4: Start wind sway after leaves appear
    const swayDelay = leafDelay + 600 + (leaves.length * 50);
    
    // Leaf sway
    timeline.add({
      targets: Array.from(leaves),
      translateX: [-2, 2, -2],
      translateY: [-1, 1, -1],
      duration: 3000,
      delay: window.anime.stagger(100),
      easing: 'easeInOutSine',
      loop: true,
    }, swayDelay);

    // Branch sway (skip trunk)
    const swayBranches = Array.from(branches).slice(1);
    if (swayBranches.length > 0) {
      timeline.add({
        targets: swayBranches,
        rotate: ['-1deg', '1deg', '-1deg'],
        duration: 4000,
        delay: window.anime.stagger(150),
        easing: 'easeInOutSine',
        loop: true,
        transformOrigin: '0% 0%',
      }, swayDelay);
    }
  }, [treeData, goodSleepNights, animeLoaded]);

  return (
    <div className="p-6 space-y-12 bg-gray-900 min-h-screen text-white">
      {/* FPS Counter */}
      <div className="fixed top-4 right-4 bg-black/80 px-3 py-2 rounded-lg text-sm font-mono border border-gray-700">
        <span className="text-green-400">{fps} FPS</span>
        {isAnimationsPaused && <span className="text-yellow-400 ml-2">⏸ PAUSED</span>}
      </div>

      <h1 className="text-3xl font-bold">
        Health Viz Playground 🎨
        {!animeLoaded && <span className="text-xs text-gray-500 ml-2">(animations disabled)</span>}
      </h1>

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-3" data-testid="control-buttons">
        <button
          onClick={resetAnimations}
          disabled={!animeLoaded}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          data-testid="button-reset-animations"
        >
          🔄 Reset Animations
        </button>
        
        <button
          onClick={addRandomWorkoutPattern}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          data-testid="button-random-workouts"
        >
          ⚡ Random Workout Pattern
        </button>

        <div className="px-4 py-2 bg-gray-800 rounded-lg text-sm">
          <span className="text-gray-400">Slider changes debounced:</span> <span className="text-green-400 font-mono">300ms</span>
        </div>
      </div>

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
            className="w-80 h-80"
          >
            {/* Gradient and Filter Definitions */}
            <defs>
              <linearGradient id="crystalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop id="crystalGradStop1" offset="0%" stopColor="hsl(0, 80%, 50%)" />
                <stop id="crystalGradStop2" offset="100%" stopColor="hsl(30, 70%, 60%)" />
              </linearGradient>
              <filter id="blur">
                <feGaussianBlur stdDeviation="0.5" />
              </filter>
            </defs>

            {/* Outer Crystal Layer - 7 vertices */}
            <polygon
              ref={gemOuterRef}
              points="50,10 90,30 95,70 70,95 30,95 5,70 10,30"
              fill="url(#crystalGrad)"
              opacity="0.3"
              style={{ transformOrigin: '50px 50px' }}
            />

            {/* Middle Crystal Layer - 7 vertices with blur */}
            <polygon
              ref={gemMiddleRef}
              points="50,20 80,35 85,65 65,85 35,85 15,65 20,35"
              fill="url(#crystalGrad)"
              opacity="0.5"
              filter="url(#blur)"
              style={{ transformOrigin: '50px 50px' }}
            />

            {/* Inner Crystal Layer - 7 vertices */}
            <polygon
              ref={gemInnerRef}
              points="50,30 70,40 75,60 60,75 40,75 25,60 30,40"
              fill="url(#crystalGrad)"
              opacity="0.8"
              style={{ transformOrigin: '50px 50px' }}
            />

            {/* 12 Vertex Points at strategic positions */}
            {[
              [50, 10], [90, 30], [95, 70], [70, 95], [30, 95], [5, 70], [10, 30],
              [50, 20], [80, 35], [65, 85], [35, 85], [15, 65]
            ].map(([x, y], i) => (
              <circle
                key={`vertex-${i}`}
                className="crystal-vertex"
                cx={x}
                cy={y}
                r="4"
                fill="white"
                opacity="0.9"
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            ))}

            {/* 20 Orbiting Particles */}
            {Array.from({ length: 20 }).map((_, i) => (
              <circle
                key={`particle-${i}`}
                className="crystal-particle"
                r="2"
                fill="white"
                opacity="0.6"
              />
            ))}
          </svg>
        </div>
        <div className="space-y-2">
          <label className="block">
            Strength Ratio: {strengthRatioUI.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={strengthRatioUI}
              onChange={(e) => debouncedSet('strength', setStrengthRatioUI, setStrengthRatio, parseFloat(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            Cardio Ratio: {cardioRatioUI.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={cardioRatioUI}
              onChange={(e) => debouncedSet('cardio', setCardioRatioUI, setCardioRatio, parseFloat(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            Streak Days: {streakDaysUI}
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={streakDaysUI}
              onChange={(e) => debouncedSet('streakDays', setStreakDaysUI, setStreakDays, parseInt(e.target.value))}
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
            Sleep Quality: {sleepQualityUI.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={sleepQualityUI}
              onChange={(e) => debouncedSet('sleepQuality', setSleepQualityUI, setSleepQuality, parseFloat(e.target.value))}
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
          🌳 Growing Tree (L-System Procedural Growth)
        </h2>
        <p className="text-sm text-gray-400">
          Adjust weeks & sleep to see recursive branches, roots, and leaves grow!
        </p>

        <div className="flex justify-center">
          <svg
            ref={treeContainerRef}
            viewBox="0 0 100 120"
            className="w-64 h-80"
            data-testid="tree-container"
          >
            {/* Roots Group (rendered first, below branches) */}
            <g className="tree-roots">
              {treeData.roots.map((rootPath, i) => (
                <path
                  key={`root-${i}`}
                  className="tree-root"
                  d={rootPath}
                  stroke="#654321"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  opacity="0.6"
                  data-testid={`tree-root-${i}`}
                />
              ))}
            </g>

            {/* Branches Group (procedurally generated) */}
            <g className="tree-branches">
              {treeData.branches.map((branchPath, i) => (
                <path
                  key={`branch-${i}`}
                  className="tree-branch"
                  d={branchPath}
                  stroke="#8b4513"
                  strokeWidth={i === 0 ? "3" : "2"}
                  fill="none"
                  strokeLinecap="round"
                  data-testid={`tree-branch-${i}`}
                />
              ))}
            </g>

            {/* Leaves Group (limited by goodSleepNights) */}
            <g className="tree-leaves">
              {treeData.leaves.slice(0, goodSleepNights).map((leaf, i) => (
                <circle
                  key={`leaf-${i}`}
                  className="tree-leaf"
                  cx={leaf.x}
                  cy={leaf.y}
                  r="3"
                  fill="#4ade80"
                  opacity="0"
                  data-testid={`tree-leaf-${i}`}
                />
              ))}
            </g>
          </svg>
        </div>

        <div className="space-y-2">
          <label className="block">
            Streak Weeks: {streakWeeksUI}
            <input
              type="range"
              min="0"
              max="6"
              step="1"
              value={streakWeeksUI}
              onChange={(e) => debouncedSet('streakWeeks', setStreakWeeksUI, setStreakWeeks, parseInt(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="block">
            Good Sleep Nights (last 7 days): {goodSleepNightsUI}
            <input
              type="range"
              min="0"
              max="7"
              step="1"
              value={goodSleepNightsUI}
              onChange={(e) => debouncedSet('goodSleep', setGoodSleepNightsUI, setGoodSleepNights, parseInt(e.target.value))}
              className="w-full"
            />
          </label>
        </div>
      </div>

    </div>
  );
}