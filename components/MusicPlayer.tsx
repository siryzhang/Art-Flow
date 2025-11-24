import React, { useState, useRef, useEffect } from 'react';

// Verified stable Item ID: MoonlightSonata_755
const TRACK = {
  title: "Moonlight Sonata",
  artist: "Beethoven",
  url: "https://archive.org/download/MoonlightSonata_755/Beethoven-MoonlightSonata.mp3"
};

const MusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMinimized, setIsMinimized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Handle Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle Play/Pause Logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Playback prevented (browser policy):", error);
          setIsPlaying(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  return (
    <>
      <style>
        {`
          @keyframes bar-dance {
            0%, 100% { height: 20%; opacity: 0.3; }
            50% { height: 100%; opacity: 0.8; }
          }
        `}
      </style>

      {/* Audio Element (Always present) */}
      <audio 
        ref={audioRef}
        src={TRACK.url}
        loop
        preload="auto"
      />

      {/* Main Container */}
      <div 
        className={`fixed top-6 right-6 z-50 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
      >
        
        {/* MINIMIZED STATE: Mini Visualizer Bars (Mapping from Expanded) */}
        <div 
          onClick={() => setIsMinimized(false)}
          className={`cursor-pointer transition-all duration-500 absolute top-0 right-0 flex items-center justify-center gap-1 p-2
            ${isMinimized ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-0'}
          `}
          style={{ height: '32px' }}
        >
           {[...Array(5)].map((_, i) => (
             <div 
               key={i}
               className="w-1 bg-purple-400 rounded-full"
               style={{
                 height: '100%',
                 animation: isPlaying 
                    ? `bar-dance ${0.6 + i * 0.15}s ease-in-out infinite` 
                    : 'none',
                 transform: isPlaying ? 'none' : 'scaleY(0.2)', // Static small dash when paused
                 opacity: isPlaying ? 0.8 : 0.4,
                 transition: 'transform 0.3s ease, opacity 0.3s ease'
               }}
             />
           ))}
        </div>

        {/* EXPANDED STATE: Compact Vertical Card */}
        <div 
          className={`bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl overflow-hidden w-48 p-4 transition-all duration-500 origin-top-right
            ${isMinimized ? 'opacity-0 pointer-events-none scale-90 translate-y-[-20px]' : 'opacity-100 scale-100 translate-y-0'}
          `}
        >
          {/* Header: Title & Minimize */}
          <div className="flex justify-between items-start mb-4">
             <div>
                <h3 className="font-serif font-bold text-white text-sm leading-tight">{TRACK.title}</h3>
                <p className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{TRACK.artist}</p>
             </div>
             <button 
                onClick={() => setIsMinimized(true)}
                className="text-white/30 hover:text-white transition-colors -mt-1 -mr-1 p-1"
             >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
             </button>
          </div>

          {/* Center: Play Button & Visualizer Fusion */}
          <div className="relative h-14 flex items-center justify-center mb-4">
             
             {/* Background Visualizer Bars */}
             <div className="absolute inset-0 flex items-center justify-center gap-1 z-0">
                {[...Array(7)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`w-1.5 bg-purple-500/40 rounded-full transition-all`}
                        style={{ 
                            height: '100%',
                            animation: isPlaying ? `bar-dance ${0.6 + Math.random() * 0.4}s ease-in-out infinite` : 'none',
                            animationDelay: `${i * 0.1}s`,
                            opacity: isPlaying ? 0.6 : 0.1,
                            transform: isPlaying ? 'scaleY(1)' : 'scaleY(0.2)'
                        }} 
                    />
                ))}
             </div>

             {/* Play Button Overlay */}
             <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="relative z-10 w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 hover:bg-purple-100 transition-all shadow-lg"
             >
                {isPlaying ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                ) : (
                    <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
             </button>
          </div>

          {/* Bottom: Volume Slider */}
          <div className="flex items-center gap-2">
             <svg className="w-3 h-3 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
             <input 
                type="range" 
                min="0" max="1" step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:bg-white/30 transition-all"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default MusicPlayer;