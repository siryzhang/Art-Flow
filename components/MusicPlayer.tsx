
import React, { useState, useRef, useEffect } from 'react';

const TRACK = {
  title: "Moonlight Sonata",
  artist: "Beethoven",
  url: "https://archive.org/download/MoonlightSonata_755/Beethoven-MoonlightSonata.mp3"
};

const MusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [isMinimized, setIsMinimized] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // 初始化音频对象，避免 inline src 造成的 reload 问题
  useEffect(() => {
    const audio = new Audio();
    audio.src = TRACK.url;
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = ""; // 彻底释放
        audioRef.current = null;
      }
    };
  }, []);

  // 同步音量
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      // 如果正在尝试播放，先等待 promise 完成再暂停，防止 Interruption 错误
      if (playPromiseRef.current) {
        try { await playPromiseRef.current; } catch (e) {}
      }
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        playPromiseRef.current = audio.play();
        await playPromiseRef.current;
        setIsPlaying(true);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Playback failed:", error);
        }
      } finally {
        playPromiseRef.current = null;
      }
    }
  };

  return (
    <div className="fixed top-6 right-6 z-50 transition-all duration-500">
      {/* Visualizer & Controller */}
      <div 
        onClick={isMinimized ? () => setIsMinimized(false) : undefined}
        className={`glass-panel rounded-2xl p-4 transition-all duration-500 origin-top-right ${isMinimized ? 'w-12 h-12 overflow-hidden cursor-pointer' : 'w-44'}`}
      >
        {!isMinimized ? (
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="truncate pr-4">
                <p className="text-[10px] text-white/40 uppercase tracking-tighter">Now Playing</p>
                <h3 className="text-white font-bold text-xs truncate">{TRACK.title}</h3>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }} className="text-white/20 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14h6v6M20 10h-6V4"/></svg>
              </button>
            </div>
            
            <div className="flex items-center justify-center py-2">
              <button 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-white/10' : 'bg-white text-black'}`}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg className="w-5 h-5 fill-current ml-1" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <svg className="w-3 h-3 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))} 
                onClick={(e) => e.stopPropagation()}
                className="flex-1 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" 
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full gap-1">
             {[...Array(3)].map((_, i) => (
               <div key={i} className={`w-1 bg-purple-500 rounded-full transition-all duration-300 ${isPlaying ? 'animate-pulse' : 'h-1 opacity-50'}`} style={{ height: isPlaying ? '100%' : '30%', animationDelay: `${i*0.2}s` }} />
             ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicPlayer;
