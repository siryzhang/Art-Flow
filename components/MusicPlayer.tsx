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

  // Direct Control Handlers (Avoids useEffect race conditions)
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
      } else {
        audio.pause();
      }
    } catch (error) {
      console.warn("Playback action interrupted or failed:", error);
      // We don't manually set isPlaying here; we let the onPlay/onPause events handle it
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes bar-dance {
            0%, 100% { height: 20%; opacity: 0.3; }
            50% { height: 100%; opacity: 0.8; }
          }
          @keyframes pulse-ring {
            0% { transform: scale(0.8); opacity: 0.5; }
            100% { transform: scale(1.3); opacity: 0; }
          }
        `}
      </style>

      {/* Audio Element */}
      <audio 
        ref={audioRef}
        src={TRACK.url}
        loop
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={(e) => console.error("Audio error:", e)}
      />

      {/* Main Container */}
      <div 
        className={`fixed top-6 right-6 z-50 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
      >
        
        {/* MINIMIZED STATE: Mini Visualizer Bars */}
        <div 
          onClick={() => setIsMinimized(false)}
          className={`cursor-pointer transition-all duration-500 absolute top-0 right-0 flex items-center justify-center gap-1 p-2 bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 hover:bg-black/40
            ${isMinimized ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-0'}
          `}
          style={{ height: '32px' }}
        >
           {[...Array(5)].map((_, i) => (
             <div 
               key={i}
               className="w-1 bg-purple-400 rounded-full"
               style={{
                 animation: isPlaying 
                    ? `bar-dance ${0.6 + i * 0.15}s ease-in-out infinite alternate` 
                    : 'none',
                 height: isPlaying ? '100%' : '20%',
                 opacity: isPlaying ? 1 : 0.3
               }}
             />
           ))}
        </div>

        {/* EXPANDED STATE: Compact Vertical Card */}
        <div 
          className={`glass-panel rounded-2xl p-4 w-40 flex flex-col items-center gap-4 transition-all duration-500 origin-top-right
            ${isMinimized ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 pointer-events-auto scale-100'}
          `}
        >
           {/* Header: Info & Minimize */}
           <div className="w-full flex justify-between items-start">
              <div className="overflow-hidden">
                <h3 className="text-white font-bold text-xs truncate leading-tight">{TRACK.title}</h3>
                <p className="text-white/50 text-[10px] truncate">{TRACK.artist}</p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                className="text-white/40 hover:text-white transition-colors -mt-1 -mr-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline></svg>
              </button>
           </div>

           {/* Center: Play Button Integrated with Visualizer */}
           <div className="relative w-20 h-20 flex items-center justify-center group cursor-pointer" onClick={togglePlay}>
              
              {/* Visualizer Ring Background */}
              <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-80">
                  {[...Array(6)].map((_, i) => (
                      <div 
                        key={i}
                        className="w-1.5 bg-gradient-to-t from-purple-500 to-blue-400 rounded-full"
                        style={{
                           height: isPlaying ? '100%' : '20%',
                           animation: isPlaying 
                             ? `bar-dance ${0.5 + i * 0.1}s ease-in-out infinite alternate` 
                             : 'none',
                           transition: 'height 0.3s ease'
                        }}
                      />
                  ))}
              </div>

              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className={`w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                      {isPlaying ? (
                        <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      ) : (
                        <svg className="w-4 h-4 text-white fill-current ml-0.5" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
                      )}
                  </div>
              </div>
           </div>

           {/* Footer: Volume */}
           <div className="w-full flex items-center gap-2">
              <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
              <input 
                type="range" 
                min="0" max="1" step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
              />
           </div>

        </div>
      </div>
    </>
  );
};

export default MusicPlayer;