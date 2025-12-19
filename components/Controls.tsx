
import React, { useState } from 'react';
import { ArtStyleConfig, ParticleShape } from '../types';
import { generateArtStyle } from '../services/geminiService';

interface ControlsProps {
  currentStyle: ArtStyleConfig;
  onStyleChange: (style: ArtStyleConfig) => void;
  presetStyles: ArtStyleConfig[];
}

const Controls: React.FC<ControlsProps> = ({ currentStyle, onStyleChange, presetStyles }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const newStyle = await generateArtStyle(prompt);
      onStyleChange(newStyle);
      setPrompt('');
    } catch (e) {
      alert("Failed to generate style. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${isOpen ? 'translate-y-0' : 'translate-y-[calc(100%-3rem)]'}`}>
      
      {/* Toggle Handle */}
      <div className="flex justify-center -mb-px">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="bg-black/80 backdrop-blur-md text-white px-6 py-2 rounded-t-xl border-t border-x border-white/20 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors"
        >
          {isOpen ? 'Hide Controls' : 'Show Controls'}
        </button>
      </div>

      {/* Main Panel */}
      <div className="bg-black/80 backdrop-blur-xl border-t border-white/10 p-4 md:p-6 pb-8 shadow-2xl">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Top Row: AI Generator & Current Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* AI Input */}
             <div className="flex gap-2">
              <input 
                type="text" 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe a style (e.g., 'Cyberpunk Rain', 'Van Gogh Starry Night')"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              />
              <button 
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-purple-900/20"
              >
                {isGenerating ? 'Thinking...' : 'Generate'}
              </button>
            </div>

            {/* Current Style Info */}
            <div className="flex items-center justify-between md:justify-end gap-4 text-white/80 text-sm">
                <div>
                    <span className="block text-xs text-white/40 uppercase tracking-wider">Current Style</span>
                    <span className="font-bold text-white">{currentStyle.name}</span>
                </div>
                <div className="flex gap-1">
                    {currentStyle.colors.map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: c }} />
                    ))}
                </div>
            </div>
          </div>

          <hr className="border-white/10" />

          {/* Presets Carousel */}
          <div>
            <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Presets</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {presetStyles.map((style, idx) => (
                    <button
                        key={idx}
                        onClick={() => onStyleChange(style)}
                        className={`flex-shrink-0 px-4 py-3 rounded-lg border text-left min-w-[140px] transition-all
                            ${currentStyle.name === style.name 
                                ? 'bg-white/10 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                                : 'bg-transparent border-white/10 hover:bg-white/5'}`}
                    >
                        <div className="font-bold text-sm text-white mb-1 truncate">{style.name}</div>
                        <div className="flex gap-1">
                            {style.colors.slice(0, 3).map((c, i) => (
                                <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </button>
                ))}
            </div>
          </div>

          {/* Manual Adjustments */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8">
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <span>Density</span>
                    <span>{currentStyle.density}</span>
                </div>
                <input 
                    type="range" 
                    min="4" max="25" step="1"
                    value={currentStyle.density}
                    onChange={(e) => onStyleChange({...currentStyle, density: parseInt(e.target.value)})}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
            </div>
            
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <span>Speed</span>
                    <span>{currentStyle.speed.toFixed(1)}</span>
                </div>
                <input 
                    type="range" 
                    min="0" max="5" step="0.1"
                    value={currentStyle.speed}
                    onChange={(e) => onStyleChange({...currentStyle, speed: parseFloat(e.target.value)})}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <span>Max Size</span>
                    <span>{currentStyle.particleSizeMax}</span>
                </div>
                <input 
                    type="range" 
                    min="2" max="30" step="1"
                    value={currentStyle.particleSizeMax}
                    onChange={(e) => onStyleChange({...currentStyle, particleSizeMax: parseInt(e.target.value)})}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;
