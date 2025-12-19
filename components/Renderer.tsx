
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
  videoRef: React.RefObject<HTMLVideoElement>;
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

  useEffect(() => {
    if (window.Hands && videoRef.current && !handTrackerRef.current) {
      const hands = new window.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults((results: any) => {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const indexTip = results.multiHandLandmarks[0][8];
          if (canvasRef.current) {
            mouseRef.current = { x: indexTip.x * canvasRef.current.width, y: indexTip.y * canvasRef.current.height, isActive: true };
          }
        }
      });
      handTrackerRef.current = hands;
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => { if (handTrackerRef.current) await handTrackerRef.current.send({ image: videoRef.current }); },
        width: 640, height: 480
      });
      camera.start();
      cameraRef.current = camera;
    }
  }, []);

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
    particlesRef.current = [];
    const gap = Math.max(3, styleConfig.density);
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
      const len = size * 2.2;
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
      if (!isPaused && video.readyState === 4 && tempCtx) {
        time += 0.015;
        const sampleScale = 0.12; 
        const w = Math.floor(dimensions.width * sampleScale);
        const h = Math.floor(dimensions.height * sampleScale);
        tempCanvas.width = w; tempCanvas.height = h;
        tempCtx.drawImage(video, 0, 0, w, h);
        const img = tempCtx.getImageData(0, 0, w, h).data;

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(0, 0, 0, ${styleConfig.trailEffect})`;
        ctx.fillRect(0, 0, dimensions.width, dimensions.height);
        
        ctx.globalCompositeOperation = styleConfig.blendingMode;

        const pCount = particlesRef.current.length;
        for (let i = 0; i < pCount; i++) {
          const p = particlesRef.current[i];
          const px = Math.min(w - 1, Math.max(0, Math.floor(p.originX * sampleScale)));
          const py = Math.min(h - 1, Math.max(0, Math.floor(p.originY * sampleScale)));
          const idx = (py * w + px) * 4;
          
          const r = img[idx], g = img[idx+1], b_val = img[idx+2];
          const brightness = (r + g + b_val) / 3;

          if (brightness < 8) {
            if (p.size > 0.1) p.size *= 0.85;
            continue; 
          }

          p.brightness = brightness;
          p.color = mapBrightnessToColor(brightness, styleConfig.colors);
          p.size += (styleConfig.particleSizeMin + (brightness/255)*(styleConfig.particleSizeMax-styleConfig.particleSizeMin) - p.size) * 0.2;

          // --- 核心优化：具象度增强逻辑 ---
          // 亮度越高（越是人物主体），回位拉力越强。bNorm 范围 0.2-1.2
          const bNorm = (brightness / 255) + 0.2;
          const snapForce = 0.06 * styleConfig.speed * bNorm;
          
          p.vx += (p.originX - p.x) * snapForce;
          p.vy += (p.originY - p.y) * snapForce;

          // 流场逻辑：在人物高亮区域适当减弱，在背景区域增强流动感
          if (styleConfig.flowFieldStrength > 0 && px < w - 2 && py < h - 2) {
              const b_r = (img[idx+4] + img[idx+5] + img[idx+6]) / 3;
              const b_d = (img[idx + w*4] + img[idx + w*4 + 1] + img[idx + w*4 + 2]) / 3;
              
              // 边缘力
              const edgeForceX = (brightness - b_d) * 0.18;
              const edgeForceY = (b_r - brightness) * 0.18;

              // 噪声力：随亮度反向调节，越亮（人）越稳，越暗（景）越飘
              const stability = 1.0 - (brightness / 255) * 0.5;
              const n = Math.sin(p.x * 0.01 + time) * Math.cos(p.y * 0.01 + time);
              const noiseX = Math.cos(n * Math.PI) * styleConfig.noiseStrength * stability;
              const noiseY = Math.sin(n * Math.PI) * styleConfig.noiseStrength * stability;

              p.vx += (edgeForceX + noiseX) * styleConfig.flowFieldStrength * 0.1;
              p.vy += (edgeForceY + noiseY) * styleConfig.flowFieldStrength * 0.1;
          }

          if (mouseRef.current.isActive) {
            const dx = mouseRef.current.x - p.x;
            const dy = mouseRef.current.y - p.y;
            const d2 = dx*dx + dy*dy;
            if (d2 < 22000) {
              const dist = Math.sqrt(d2);
              const f = (1 - dist/148) * 22 * styleConfig.speed;
              p.vx -= (dx/dist) * f; p.vy -= (dy/dist) * f;
            }
          }

          p.vx *= styleConfig.friction; p.vy *= styleConfig.friction;
          p.x += p.vx; p.y += p.vy;

          ctx.fillStyle = p.color; 
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.size / 3.5);
          drawShape(ctx, p, styleConfig.shape);
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [styleConfig, dimensions, isPaused]);

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={(e) => (mouseRef.current = { x: dimensions.width - e.clientX, y: e.clientY, isActive: true })}
      onMouseLeave={() => (mouseRef.current.isActive = false)}
      className="absolute top-0 left-0 w-full h-full block touch-none scale-x-[-1] bg-black"
    />
  );
};

export default Renderer;
