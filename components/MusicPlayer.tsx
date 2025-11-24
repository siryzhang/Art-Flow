import React, { useState, useRef, useEffect } from 'react';

interface Track {
  title: string;
  artist: string;
  url: string;
  styleParams: string; // Just for description
}

const PLAYLIST: Track[] = [
  {
    title: "Gymnopédie No.1",
    artist: "Erik Satie",
    // Transcoded MP3 from Wikimedia Commons
    url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/34/Satie_Gymnopedie_No_1.ogg/Satie_Gymnopedie_No_1.ogg.mp3",
    styleParams: "Melancholic, Calm"
  },
  {
    title: "Clair de Lune",
    artist: "Claude Debussy",
    // Transcoded MP3 from Wikimedia Commons
    url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/2/22/Clair_de_lune_%28Debussy%29_-_Suite_bergamasque.ogg/Clair_de_lune_%28Debussy%29_-_Suite_bergamasque.ogg.mp3",
    styleParams: "Fluid, Dreamy"
  },
  {
    title: "Nocturne Op.9 No.2",
    artist: "Frédéric Chopin",
    // Transcoded MP3 from Wikimedia Commons
    url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/e6/Frederic_Chopin_-_Nocturne_Eb_major_Opus_9_Number_2.ogg/Frederic_Chopin_-_Nocturne_Eb_major_Opus_9_Number_2.ogg.mp3",
    styleParams: "Romantic, Soothing"
  },
  {
    title: "Moonlight Sonata",
    artist: "Ludwig van Beethoven",
     // Transcoded MP3 from Wikimedia Commons
    url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/eb/Beethoven_Moonlight_1st_movement.ogg/Beethoven_Moonlight_1st_movement.ogg.mp3",
    styleParams: "Deep, Meditative"
  }
];

const MusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle track ending
  const handleEnded = () => {
    playNext();
  };

  const playNext = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % PLAYLIST.length);
  };

  const playPrev = () => {
    setCurrentTrackIndex((prev) => (prev - 1 + PLAYLIST.length) % PLAYLIST.length);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
          playPromise.catch(e => {
              console.error("Audio play failed:", e);
              // Auto-advance if current track fails (fallback)
              if (e.name === 'NotSupportedError' || e.name === 'Error') {
                  playNext();
              }
          });
      }
    }
    setIsPlaying(!isPlaying);
  };

  // Auto-play when track changes if already playing
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.load();
        if (isPlaying) {
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => console.error("Audio play failed during change:", e));
            }
        }
    }
  }, [currentTrackIndex]);

  const currentTrack = PLAYLIST[currentTrackIndex];

  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-500 ease-in-out ${isMinimized ? 'w-12 h-12' : 'w-72'}`}>
      <audio 
        ref={audioRef} 
        src={currentTrack.url} 
        onEnded={handleEnded}
        crossOrigin="anonymous"
        loop={false}
      />
      
      <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
        
        {/* Minimized State */}
        {isMinimized ? (
           <button 
             onClick={() => setIsMinimized(false)}
             className="w-full h-full flex items-center justify-center bg-black/40 hover:bg-white/10 transition-colors group"
           >
             <div className="flex gap-1 items-end h-4">
                 {[1,2,3].map(i => (
                     <div key={i} className={`w-1 bg-white/80 rounded-full ${isPlaying ? 'animate-pulse' : 'h-1'}`} style={{height: isPlaying ? '100%' : '20%', animationDelay: `${i*0.1}s`}} />
                 ))}
             </div>
           </button>
        ) : (
          /* Maximized State */
          <div className="p-5 text-white">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse"></div>
                 <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">Sonic Therapy</span>
               </div>
               <button onClick={() => setIsMinimized(true)} className="text-white/40 hover:text-white transition-colors">
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                 </svg>
               </button>
            </div>

            {/* Track Info */}
            <div className="mb-6 space-y-1">
                <h3 className="font-serif text-xl font-medium leading-tight truncate">{currentTrack.title}</h3>
                <p className="text-sm text-white/60 truncate">{currentTrack.artist}</p>
            </div>

            {/* Visualizer Bar (Fake) */}
            <div className="flex items-center gap-0.5 h-8 mb-6 opacity-80">
                {Array.from({length: 30}).map((_, i) => (
                    <div 
                        key={i} 
                        className="flex-1 bg-white/20 rounded-t-sm transition-all duration-300"
                        style={{
                            height: isPlaying ? `${Math.random() * 100}%` : '10%',
                            backgroundColor: isPlaying ? `rgba(255, 255, 255, ${0.2 + Math.random() * 0.5})` : 'rgba(255,255,255,0.1)'
                        }}
                    />
                ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-4">
                {/* Prev */}
                <button onClick={playPrev} className="text-white/60 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                </button>

                {/* Play/Pause */}
                <button 
                    onClick={togglePlay}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
                >
                    {isPlaying ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    ) : (
                        <svg className="w-5 h-5 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>

                {/* Next */}
                <button onClick={playNext} className="text-white/60 hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
            </div>

            {/* Volume */}
            <div className="mt-6 flex items-center gap-3 group">
                <svg className="w-3 h-3 text-white/40" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                <input 
                    type="range" 
                    min="0" max="1" step="0.05"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
                />
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default MusicPlayer;