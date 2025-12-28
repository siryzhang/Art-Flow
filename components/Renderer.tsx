import React, { useRef, useEffect, useState } from 'react';
import { ArtStyleConfig, MouseState, Particle, ParticleShape } from '../types';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

interface RendererProps {
  styleConfig: ArtStyleConfig;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isPaused: boolean;
}

const Renderer: React.FC<RendererProps> = ({ styleConfig, videoRef, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const handTrackerRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const mouseRef = useRef<MouseState>({ x: 0, y: 0, isActive: false });
  const [isHandDetected, setIsHandDetected] = useState(false);

  // Initialize MediaPipe Hands
  useEffect(() => {
    let isMounted = true;
    let pollInterval: any;

    const setupTracking = async () => {
      if (!window.Hands || !window.Camera) return;

      if (videoRef.current && !handTrackerRef.current) {
        clearInterval(pollInterval);
        
        const hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results: any) => {
          if (!isMounted || !canvasRef.current) return;

          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const indexTip = results.multiHandLandmarks[0][8]; 
            const w = canvasRef.current.width;
            const h = canvasRef.current.height;

            /**
             * MIRROR COORDINATE MAPPING (Systematic Solution):
             * Canvas is mirrored (scale-x-[-1]). 
             * Visual Right = Internal X=0.
             * Visual Left = Internal X=width.
             * 
             * Camera is unmirrored:
             * Physically moving hand to Right -> Camera sees it on Left (tip.x is small).
             * Internal X should be small (Right).
             * Result: Internal X = tip.x * w.
             */
            mouseRef.current = {
              x: indexTip.x * w,
              y: indexTip.y * h,
              isActive: true
            };
            if (!isHandDetected) setIsHandDetected(true);
          } else {
            if (isHandDetected) setIsHandDetected(false);
          }
        });

        handTrackerRef.current = hands;

        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (videoRef.current && isMounted) {
              await hands.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480
        });

        camera.start();
        cameraRef.current = camera;
      }
    };

    pollInterval = setInterval(() => {
      if (window.Hands && window.Camera) setupTracking();
    }, 500);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (cameraRef.current) cameraRef.current.stop();
      if (handTrackerRef.current) handTrackerRef.current.close();
    };
  }, []);

  // Window Resize & Particle Initialization
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const { innerWidth, innerHeight } = window;
        canvasRef.current.width = innerWidth;
        canvasRef.current.height = innerHeight;
        setDimensions({ width: innerWidth, height: innerHeight });
        initParticles(innerWidth, innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [styleConfig.density]);

  const initParticles = (width: number, height: number) => {
    if (width <= 0 || height <= 0) return;
    particlesRef.current = [];
    const gap = Math.max(4, styleConfig.density);
    for (let y = 0; y < height; y += gap) {
      for (let x = 0; x < width; x += gap) {
        particlesRef.current.push({
          x: x, y: y, originX: x, originY: y, vx: 0, vy: 0,
          size: styleConfig.particleSizeMin, color: '#ffffff', brightness: 0
        });
      }
    }
  };

  const mapBrightnessToColor = (brightness: number, palette: string[]) => {
    const index = Math.floor((brightness / 255) * (palette.length - 1));
    return palette[index] || palette[0];
  };

  const drawShape = (ctx: CanvasRenderingContext2D, p: Particle, shape: ParticleShape) => {
    const { x, y, size } = p;
    ctx.beginPath();
    if (shape === ParticleShape.CIRCLE) {
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === ParticleShape.SQUARE) {
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
    } else if (shape === ParticleShape.LINE) {
      const angle = Math.atan2(p.vy, p.vx) || 0;
      const len = size * 2.5;
      ctx.moveTo(x - Math.cos(angle) * len, y - Math.sin(angle) * len);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    } else if (shape === ParticleShape.CROSS) {
      ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    let time = 0;

    const animate = () => {
      if (!isPaused && video.readyState >= 2 && tempCtx && dimensions.width > 0 && dimensions.height > 0) {
        time += 0.02;
        const sampleScale = 0.15; 
        const w = Math.floor(dimensions.width * sampleScale);
        const h = Math.floor(dimensions.height * sampleScale);
        
        tempCanvas.width = w; 
        tempCanvas.height = h;
        tempCtx.drawImage(video, 0, 0, w, h);
        
        const imgData = tempCtx.getImageData(0, 0, w, h);
        const img = imgData.data;

        // Trail effect
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(0, 0, 0, ${styleConfig.trailEffect})`;
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);
        
        ctx.globalCompositeOperation = styleConfig.blendingMode;

        const tx = mouseRef.current.x;
        const ty = mouseRef.current.y;
        const active = mouseRef.current.isActive;

        for (let i = 0; i < particlesRef.current.length; i++) {
          const p = particlesRef.current[i];
          const px = Math.min(w - 1, Math.max(0, Math.floor(p.originX * sampleScale)));
          const py = Math.min(h - 1, Math.max(0, Math.floor(p.originY * sampleScale)));
          const idx = (py * w + px) * 4;
          
          const brightness = (img[idx] + img[idx+1] + img[idx+2]) / 3;

          if (brightness < 12) {
            if (p.size > 0.1) p.size *= 0.85;
            continue; 
          }

          p.brightness = brightness;
          p.color = mapBrightnessToColor(brightness, styleConfig.colors);
          
          const targetSize = styleConfig.particleSizeMin + (brightness/255) * (styleConfig.particleSizeMax - styleConfig.particleSizeMin);
          p.size += (targetSize - p.size) * 0.15;

          const snapForce = 0.12 * styleConfig.speed * (brightness/255 + 0.1);
          p.vx += (p.originX - p.x) * snapForce;
          p.vy += (p.originY - p.y) * snapForce;

          // INTERACTION (Unified Mouse & Hand)
          if (active) {
            const dx = tx - p.x;
            const dy = ty - p.y;
            const d2 = dx*dx + dy*dy;
            const radius = isHandDetected ? 80000 : 40000; // Hand tracking feels better with larger radius
            if (d2 < radius) {
              const dist = Math.sqrt(d2);
              const force = (1 - dist / Math.sqrt(radius)) * (isHandDetected ? 48 : 35) * styleConfig.speed;
              p.vx -= (dx / dist) * force;
              p.vy -= (dy / dist) * force;
            }
          }

          // Flow Field
          if (styleConfig.flowFieldStrength > 0 && px < w - 2 && py < h - 2) {
            const b_r = (img[idx+4] + img[idx+5] + img[idx+6]) / 3;
            const b_d = (img[idx + w*4] + img[idx + w*4 + 1] + img[idx + w*4 + 2]) / 3;
            const n = Math.sin(p.x * 0.005 + time) * Math.cos(p.y * 0.005 + time);
            p.vx += (brightness - b_d + Math.cos(n * Math.PI) * styleConfig.noiseStrength) * styleConfig.flowFieldStrength * 0.07;
            p.vy += (b_r - brightness + Math.sin(n * Math.PI) * styleConfig.noiseStrength) * styleConfig.flowFieldStrength * 0.07;
          }

          p.vx *= styleConfig.friction; 
          p.vy *= styleConfig.friction;
          p.x += p.vx; 
          p.y += p.vy;

          ctx.fillStyle = p.color; 
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.size / 3);
          drawShape(ctx, p, styleConfig.shape);
        }

        // DRAW TRACKING DOT (Visual Feedback)
        if (active) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.arc(tx, ty, isHandDetected ? 15 : 5, 0, Math.PI * 2);
          ctx.fillStyle = isHandDetected ? 'rgba(34, 211, 238, 0.4)' : 'rgba(255, 255, 255, 0.2)';
          ctx.fill();
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [styleConfig, dimensions, isPaused, isHandDetected]);

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          if (!isHandDetected) {
            mouseRef.current = { 
              x: dimensions.width - e.clientX, 
              y: e.clientY, 
              isActive: true 
            };
          }
        }}
        onMouseEnter={() => !isHandDetected && (mouseRef.current.isActive = true)}
        onMouseLeave={() => !isHandDetected && (mouseRef.current.isActive = false)}
        className="absolute top-0 left-0 w-full h-full block touch-none scale-x-[-1] bg-black cursor-none"
      />
      
      {/* HUD for tracking status */}
      <div className="absolute top-8 left-8 z-50 flex flex-col gap-2 pointer-events-none">
        {isHandDetected && (
          <div className="flex items-center gap-3 px-5 py-2 glass-panel rounded-full animate-fade-in border-cyan-400/40">
            <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-[0_0_12px_#22d3ee] animate-pulse"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-cyan-100">AI Sculpting Mode</span>
          </div>
        )}
      </div>
    </>
  );
};

export default Renderer;