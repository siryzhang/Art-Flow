import React, { useEffect, useRef, useState } from 'react';
import Renderer from './components/Renderer';
import Controls from './components/Controls';
import MusicPlayer from './components/MusicPlayer';
import { ArtStyleConfig, ParticleShape } from './types';

const PRESET_STYLES: ArtStyleConfig[] = [
  {
    name: "Starry Night (星空)",
    description: "Flowing oil brushstrokes that follow your silhouette",
    colors: ["#0f172a", "#1e3a8a", "#1e40af", "#0369a1", "#fbbf24", "#fef08a", "#ffffff"],
    particleSizeMin: 1.5,
    particleSizeMax: 7,
    density: 6,
    speed: 2.0,
    friction: 0.91,
    shape: ParticleShape.LINE,
    blendingMode: 'source-over',
    connectionDistance: 0,
    trailEffect: 0.2,
    noiseStrength: 2.5,
    flowFieldStrength: 3.5
  },
  {
    name: "Aurora Dream (极光)",
    description: "High-definition ethereal trails with sharp silhouette",
    colors: ["#00ffd5", "#00ff80", "#00b3ff", "#0055ff", "#8c00ff", "#ffffff"],
    particleSizeMin: 2,
    particleSizeMax: 15,
    density: 9,
    speed: 2.5,
    friction: 0.93,
    shape: ParticleShape.CIRCLE,
    blendingMode: 'lighter',
    connectionDistance: 0,
    trailEffect: 0.16,
    noiseStrength: 2.5,
    flowFieldStrength: 3.8
  },
  {
    name: "Cyber Neon (赛博)",
    description: "Vibrant glowing data streams",
    colors: ["#00f2ff", "#0062ff", "#7000ff", "#ff00d9"],
    particleSizeMin: 2,
    particleSizeMax: 5,
    density: 8,
    speed: 1.2,
    friction: 0.92,
    shape: ParticleShape.LINE,
    blendingMode: 'lighter',
    connectionDistance: 45,
    trailEffect: 0.15,
    noiseStrength: 1.0,
    flowFieldStrength: 1.5
  }
];

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [streamStarted, setStreamStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStyle, setCurrentStyle] = useState<ArtStyleConfig>(PRESET_STYLES[1]); 
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 }, 
            facingMode: "user" 
          },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStreamStarted(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("无法访问摄像头，请确保已授予权限并在 HTTPS 环境下运行。");
      }
    };
    
    if (!showWelcome) {
      startVideo();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showWelcome]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white">
      {/* 关键：不要使用 hidden，而是使用 opacity-0，否则 MediaPipe 可能无法抓取帧 */}
      <video 
        ref={videoRef} 
        className="opacity-0 absolute pointer-events-none" 
        playsInline 
        muted 
        width="640" 
        height="480"
      />
      
      {streamStarted && <Renderer styleConfig={currentStyle} videoRef={videoRef} isPaused={false} />}
      {streamStarted && <MusicPlayer />}

      {showWelcome && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
          <div className="max-w-md p-10 text-center space-y-8 glass-panel rounded-3xl">
            <h1 className="text-6xl font-black bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent italic">ArtFlow</h1>
            <p className="text-white/60 text-lg font-light tracking-wide">Transform your reality into digital masterpieces.</p>
            <button 
              onClick={() => setShowWelcome(false)}
              className="w-full bg-white text-black font-bold py-5 rounded-2xl text-xl hover:scale-[1.02] active:scale-95 transition-all shadow-2xl shadow-purple-500/20"
            >
              Enter Experience
            </button>
            <p className="text-[10px] text-white/20 uppercase tracking-widest">Balanced Art & Precision Rendering</p>
          </div>
        </div>
      )}

      {error && !showWelcome && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 px-6">
          <div className="max-w-sm text-center p-8 border border-red-500/30 rounded-3xl bg-red-500/10 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Connection Failed</h2>
            <p className="text-white/80 text-sm mb-6">{error}</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs transition-colors">Retry</button>
          </div>
        </div>
      )}

      {streamStarted && <Controls currentStyle={currentStyle} onStyleChange={setCurrentStyle} presetStyles={PRESET_STYLES} />}

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none opacity-30 text-[10px] uppercase tracking-[0.3em] font-light text-center">
          Moving your hand to sculpt the aurora
      </div>
    </div>
  );
};

export default App;