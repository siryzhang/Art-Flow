import React, { useEffect, useRef, useState } from 'react';
import Renderer from './components/Renderer';
import Controls from './components/Controls';
import MusicPlayer from './components/MusicPlayer';
import { ArtStyleConfig, ParticleShape } from './types';

// Preset Styles
const PRESET_STYLES: ArtStyleConfig[] = [
  {
    name: "Van Gogh's Starry Night",
    description: "Expressive, swirling lines and deep colors",
    // Deep Blues, Vibrant Yellow/Orange, Cyan highlight
    colors: ["#1A3B6E", "#122645", "#599DB5", "#E3B624", "#D98E04"],
    particleSizeMin: 3,
    particleSizeMax: 3,
    density: 6,
    speed: 0.3,
    friction: 0.92,
    shape: ParticleShape.LINE, 
    connectionDistance: 0,
    trailEffect: 0.2,
    noiseStrength: 1.5,
    flowFieldStrength: 3.5,
    zDepth: 50 // Moderate depth texture
  },
  {
    name: "Monet's Water Lilies",
    description: "Soft, impressionist dabs with painterly blending",
    // Pastel Greens, Water Blues, Soft Pinks, Lilac
    colors: ["#769C6D", "#5E8B9E", "#A5C05B", "#D1828F", "#9C8EB0"],
    particleSizeMin: 4,
    particleSizeMax: 8,
    density: 5, 
    speed: 0.8,
    friction: 0.85,
    shape: ParticleShape.CIRCLE, 
    connectionDistance: 0,
    trailEffect: 0.05,
    noiseStrength: 1.0,
    flowFieldStrength: 2.0,
    zDepth: 20 // Subtle depth
  },
  {
    name: "Cyber Grid",
    description: "Digital aesthetic with squares and neon",
    colors: ["#00ff00", "#003300", "#ccffcc"],
    particleSizeMin: 4,
    particleSizeMax: 12,
    density: 12,
    speed: 0.2,
    friction: 0.8,
    shape: ParticleShape.SQUARE,
    connectionDistance: 0,
    trailEffect: 0.2,
    noiseStrength: 0,
    flowFieldStrength: 0,
    zDepth: 150 // Strong 3D blocks
  },
  {
    name: "Constellation",
    description: "Stars connected by lines",
    colors: ["#ffffff", "#aaccff", "#ffccaa"],
    particleSizeMin: 1,
    particleSizeMax: 4,
    density: 13,
    speed: 1.5,
    friction: 0.95,
    shape: ParticleShape.CIRCLE,
    connectionDistance: 40,
    trailEffect: 0.15,
    noiseStrength: 1,
    flowFieldStrength: 0.2,
    zDepth: 100
  },
  {
    name: "Chaos Theory",
    description: "High speed, high noise",
    colors: ["#ff0055", "#ffff00", "#00ffff"],
    particleSizeMin: 2,
    particleSizeMax: 20,
    density: 10,
    speed: 1,
    friction: 0.9,
    shape: ParticleShape.CROSS,
    connectionDistance: 0,
    trailEffect: 0.1,
    noiseStrength: 8,
    flowFieldStrength: 1.0,
    zDepth: 200 // Extreme chaos depth
  }
];

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamStarted, setStreamStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStyle, setCurrentStyle] = useState<ArtStyleConfig>(PRESET_STYLES[0]);
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    const startVideo = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 }, // Lower resolution is better for performance analysis
            height: { ideal: 480 },
            facingMode: "user"
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setStreamStarted(true);
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setError("Please allow camera access to experience the art renderer.");
      }
    };

    if (!showWelcome) {
        startVideo();
    }
  }, [showWelcome]);

  const handleStart = () => {
    setShowWelcome(false);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* Hidden Video Source */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* Main Renderer */}
      {streamStarted && (
        <Renderer
          styleConfig={currentStyle}
          videoRef={videoRef}
          isPaused={false}
        />
      )}

      {/* Music Player - Always visible once started */}
      {streamStarted && <MusicPlayer />}

      {/* Welcome Screen */}
      {showWelcome && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="max-w-md w-full p-8 text-center space-y-8">
                <div className="space-y-2">
                    <h1 className="text-5xl font-black bg-gradient-to-br from-purple-400 to-blue-500 bg-clip-text text-transparent">ArtFlow</h1>
                    <p className="text-gray-400 text-lg">AI-Powered Real-time Particle Cam</p>
                </div>
                
                <div className="relative group cursor-pointer" onClick={handleStart}>
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <button 
                        className="relative w-full bg-white text-black font-bold py-4 rounded-lg text-xl hover:bg-gray-100 transition-colors"
                    >
                        Launch Experience
                    </button>
                </div>
                <p className="text-xs text-gray-600">Requires camera access. Images are processed locally.</p>
            </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && !showWelcome && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="text-center p-6 border border-red-500/50 rounded-lg bg-red-900/20">
            <h2 className="text-2xl font-bold text-red-500 mb-2">Camera Error</h2>
            <p className="text-white/80">{error}</p>
          </div>
        </div>
      )}

      {/* UI Controls */}
      {streamStarted && (
        <Controls
          currentStyle={currentStyle}
          onStyleChange={setCurrentStyle}
          presetStyles={PRESET_STYLES}
        />
      )}

      {/* Interaction Hint */}
      {streamStarted && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none opacity-50 text-xs uppercase tracking-widest text-center">
            Move mouse to rotate • Move hand to disrupt
        </div>
      )}
    </div>
  );
};

export default App;