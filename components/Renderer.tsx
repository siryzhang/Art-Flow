import React, { useRef, useEffect, useState } from 'react';
import { ArtStyleConfig, MouseState, Particle, ParticleShape } from '../types';

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
  
  // Mouse interaction state
  const mouseRef = useRef<MouseState>({ x: 0, y: 0, isActive: false });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const { innerWidth, innerHeight } = window;
        // Ensure dimensions are valid
        if (innerWidth === 0 || innerHeight === 0) return;

        canvasRef.current.width = innerWidth;
        canvasRef.current.height = innerHeight;
        setDimensions({ width: innerWidth, height: innerHeight });
        initParticles(innerWidth, innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleConfig.density]); // Re-init when density changes

  // Initialize Particles Grid
  const initParticles = (width: number, height: number) => {
    particlesRef.current = [];
    const gap = styleConfig.density;
    
    // Safety check for infinite loop
    if (gap <= 0) return;

    for (let y = 0; y < height; y += gap) {
      for (let x = 0; x < width; x += gap) {
        particlesRef.current.push({
          x: x,
          y: y,
          originX: x,
          originY: y,
          vx: 0,
          vy: 0,
          size: styleConfig.particleSizeMin,
          color: '#ffffff',
          brightness: 0
        });
      }
    }
  };

  const mapBrightnessToColor = (brightness: number, palette: string[]) => {
    const index = Math.floor((brightness / 255) * (palette.length - 1));
    return palette[index] || palette[0];
  };

  const drawShape = (ctx: CanvasRenderingContext2D, p: Particle, shape: ParticleShape) => {
    switch (shape) {
      case ParticleShape.CIRCLE:
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      case ParticleShape.SQUARE:
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        break;
      case ParticleShape.LINE:
        ctx.beginPath();
        // Dynamic Rotation: Align line with velocity vector to simulate flow/brush strokes
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        // If moving fast enough, use velocity. Otherwise use a default or noise-based angle.
        let angle = speed > 0.1 ? Math.atan2(p.vy, p.vx) : Math.PI / 2;
        
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const len = p.size; 
        ctx.moveTo(p.x - cos * len, p.y - sin * len);
        ctx.lineTo(p.x + cos * len, p.y + sin * len);
        ctx.stroke();
        break;
      case ParticleShape.CROSS:
        ctx.beginPath();
        ctx.moveTo(p.x - p.size, p.y);
        ctx.lineTo(p.x + p.size, p.y);
        ctx.moveTo(p.x, p.y - p.size);
        ctx.lineTo(p.x, p.y + p.size);
        ctx.stroke();
        break;
    }
  };

  // Main Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Off-screen canvas for pixel analysis (performance optimization)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // Helper to safely get pixel brightness
    const getBrightness = (data: Uint8ClampedArray, width: number, x: number, y: number) => {
        const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
        if (idx < 0 || idx >= data.length) return 0;
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    };

    let time = 0;

    const animate = () => {
      if (!isPaused && video.readyState === 4) {
        time += 0.01;
        
        // 1. Process Video Data
        const analysisScale = 0.15; // Lower scale for performance
        const w = Math.floor(dimensions.width * analysisScale);
        const h = Math.floor(dimensions.height * analysisScale);
        
        // CRITICAL FIX: Prevent IndexSizeError by ensuring non-zero dimensions
        if (w > 0 && h > 0 && tempCtx) {
            
            tempCanvas.width = w;
            tempCanvas.height = h;
            tempCtx.drawImage(video, 0, 0, w, h);
            
            const imageData = tempCtx.getImageData(0, 0, w, h).data;

            // 2. Clear Main Canvas with Trail Effect
            ctx.fillStyle = `rgba(0, 0, 0, ${styleConfig.trailEffect})`;
            ctx.fillRect(0, 0, dimensions.width, dimensions.height);

            // Spatial Grid for Connections
            // We use a spatial hash grid to find neighbors efficiently (O(1) lookup vs O(N) scan)
            const grid: Record<string, number[]> = {};
            const cellSize = Math.max(styleConfig.connectionDistance, 40); // Minimum cell size prevents overhead
            const useConnections = styleConfig.connectionDistance > 0;

            // 3. Update & Draw Particles
            for (let i = 0; i < particlesRef.current.length; i++) {
                const p = particlesRef.current[i];
                
                // Map particle position to analysis grid
                let pixelX = Math.floor(p.x * analysisScale);
                let pixelY = Math.floor(p.y * analysisScale);
                
                // Clamp to bounds
                pixelX = Math.max(0, Math.min(w - 1, pixelX));
                pixelY = Math.max(0, Math.min(h - 1, pixelY));

                const pixelIndex = (pixelY * w + pixelX) * 4;

                const r = imageData[pixelIndex];
                const g = imageData[pixelIndex + 1];
                const b = imageData[pixelIndex + 2];
                const brightness = (r + g + b) / 3;
                
                if (brightness > 15) {
                    p.brightness = brightness;
                    p.color = mapBrightnessToColor(brightness, styleConfig.colors);
                    
                    const sizeRange = styleConfig.particleSizeMax - styleConfig.particleSizeMin;
                    const targetSize = styleConfig.particleSizeMin + (brightness / 255) * sizeRange;
                    p.size += (targetSize - p.size) * 0.1;

                    // --- PHYSICS: MOUSE ---
                    if (mouseRef.current.isActive) {
                        const dx = mouseRef.current.x - p.x;
                        const dy = mouseRef.current.y - p.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const forceRadius = 150;

                        if (dist < forceRadius) {
                            const force = (forceRadius - dist) / forceRadius;
                            const angle = Math.atan2(dy, dx);
                            p.vx -= Math.cos(angle) * force * 5 * styleConfig.speed;
                            p.vy -= Math.sin(angle) * force * 5 * styleConfig.speed;
                        }
                    }

                    // --- PHYSICS: FLOW FIELD (The "Curve" Effect) ---
                    if (styleConfig.flowFieldStrength > 0) {
                        // Calculate Gradient (Sobel-like operator)
                        const lookAhead = 2;
                        const bL = getBrightness(imageData, w, pixelX - lookAhead, pixelY);
                        const bR = getBrightness(imageData, w, pixelX + lookAhead, pixelY);
                        const bU = getBrightness(imageData, w, pixelX, pixelY - lookAhead);
                        const bD = getBrightness(imageData, w, pixelX, pixelY + lookAhead);

                        const dx = bR - bL;
                        const dy = bD - bU;

                        // Perpendicular to gradient is the contour (the "stroke" direction)
                        const angle = Math.atan2(dy, dx) + Math.PI / 2;
                        
                        // Add some curl noise for "Starry Night" turbulence
                        const noise = Math.sin(p.x * 0.01 + time) * Math.cos(p.y * 0.01 + time);
                        const turbulentAngle = angle + (noise * 0.5);

                        p.vx += Math.cos(turbulentAngle) * styleConfig.flowFieldStrength * styleConfig.speed;
                        p.vy += Math.sin(turbulentAngle) * styleConfig.flowFieldStrength * styleConfig.speed;
                    }

                    // --- PHYSICS: RETURN TO ORIGIN ---
                    const dxOrigin = p.originX - p.x;
                    const dyOrigin = p.originY - p.y;
                    const returnStrength = styleConfig.flowFieldStrength > 0 ? 0.02 : 0.05;
                    p.vx += dxOrigin * returnStrength * styleConfig.speed;
                    p.vy += dyOrigin * returnStrength * styleConfig.speed;

                    // --- PHYSICS: NOISE ---
                    if (styleConfig.noiseStrength > 0) {
                        p.vx += (Math.random() - 0.5) * styleConfig.noiseStrength;
                        p.vy += (Math.random() - 0.5) * styleConfig.noiseStrength;
                    }

                    // Apply Velocity
                    p.vx *= styleConfig.friction;
                    p.vy *= styleConfig.friction;
                    p.x += p.vx;
                    p.y += p.vy;

                    // Draw Shape
                    ctx.fillStyle = p.color;
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = Math.min(3, p.size / 2); // Thicker lines for brush effect
                    ctx.lineCap = 'round';
                    drawShape(ctx, p, styleConfig.shape);

                    // Add to Spatial Grid (if connections enabled)
                    if (useConnections) {
                        const gx = Math.floor(p.x / cellSize);
                        const gy = Math.floor(p.y / cellSize);
                        const key = `${gx},${gy}`;
                        if (!grid[key]) grid[key] = [];
                        grid[key].push(i);
                    }
                }
            }

            // 4. Draw Connections (Spatial Grid Pass)
            if (useConnections) {
                const connDistSq = styleConfig.connectionDistance * styleConfig.connectionDistance;
                ctx.lineWidth = 1;

                // Iterate only through populated cells
                for (const key in grid) {
                    const [gx, gy] = key.split(',').map(Number);
                    const cellParticles = grid[key];

                    // For each particle in this cell
                    for (const p1Idx of cellParticles) {
                         const p1 = particlesRef.current[p1Idx];

                         // Check neighbors (3x3 grid around current cell)
                         for (let ox = -1; ox <= 1; ox++) {
                             for (let oy = -1; oy <= 1; oy++) {
                                 const neighborKey = `${gx + ox},${gy + oy}`;
                                 const neighborParticles = grid[neighborKey];
                                 
                                 if (neighborParticles) {
                                     for (const p2Idx of neighborParticles) {
                                         // Avoid duplicates and self-connection by index check
                                         if (p1Idx < p2Idx) {
                                             const p2 = particlesRef.current[p2Idx];
                                             const dx = p1.x - p2.x;
                                             const dy = p1.y - p2.y;
                                             
                                             // Fast bounding box check before sqrt
                                             if (Math.abs(dx) > styleConfig.connectionDistance || Math.abs(dy) > styleConfig.connectionDistance) {
                                                 continue;
                                             }

                                             const distSq = dx * dx + dy * dy;
                                             if (distSq < connDistSq) {
                                                 const alpha = 1 - (Math.sqrt(distSq) / styleConfig.connectionDistance);
                                                 ctx.beginPath();
                                                 ctx.moveTo(p1.x, p1.y);
                                                 ctx.lineTo(p2.x, p2.y);
                                                 ctx.strokeStyle = p1.color;
                                                 ctx.globalAlpha = alpha;
                                                 ctx.stroke();
                                                 ctx.globalAlpha = 1.0;
                                             }
                                         }
                                     }
                                 }
                             }
                         }
                    }
                }
            }
        }
      }
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      tempCanvas.remove();
    };
  }, [styleConfig, dimensions, isPaused]);

  // Handle Mouse/Touch Events
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    mouseRef.current = {
      x: clientX - rect.left,
      y: clientY - rect.top,
      isActive: true
    };
  };

  const handleMouseLeave = () => {
    mouseRef.current.isActive = false;
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchEnd={handleMouseLeave}
      className="absolute top-0 left-0 w-full h-full block touch-none"
    />
  );
};

export default Renderer;