import React, { useRef, useEffect, useState } from 'react';
import { ArtStyleConfig, MouseState, Particle, ParticleShape } from '../types';

// Declare MediaPipe globals
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
  
  // Mouse interaction state
  const mouseRef = useRef<MouseState>({ x: 0, y: 0, isActive: false });

  // Initialize MediaPipe Hands
  useEffect(() => {
    if (window.Hands && videoRef.current && !handTrackerRef.current) {
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
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const hand = results.multiHandLandmarks[0];
          // Landmark 8 is the Index Finger Tip
          const indexTip = hand[8];
          
          if (canvasRef.current) {
            // MediaPipe coordinates are normalized (0-1).
            // Since we CSS-mirror the canvas (scale-x-[-1]), the visual "right" is the logical "left".
            // However, MediaPipe analyzes the raw video.
            // If I raise my right hand, it appears on the left side of the raw video (x ~ 0.2).
            // On a mirrored canvas, the left side of the drawing surface is displayed on the right.
            // So: A raw video coordinate of 0.2 means we should affect the physics at 0.2.
            // When drawn, that physics at 0.2 will appear on the right side (mirror). 
            // So direct mapping is correct for mirrored display.
            
            mouseRef.current = {
              x: indexTip.x * canvasRef.current.width,
              y: indexTip.y * canvasRef.current.height,
              isActive: true
            };
          }
        } else {
            // Only deactivate if no mouse is also present (optional, but let's prioritize hands)
            // For smoother hybrid use, we might want a timeout, but simpler is better here.
            // We won't auto-deactivate here to allow mouse to take over if hand is lost,
            // or we can implement a "last active" logic. For now, let's let mouse events clear it
            // or keep it active if hand just flickered.
            // Actually, let's not clear it immediately to avoid flickering.
        }
      });

      handTrackerRef.current = hands;

      // Start Camera
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (handTrackerRef.current) {
            await handTrackerRef.current.send({ image: videoRef.current });
          }
        },
        width: 640,
        height: 480
      });
      camera.start();
      cameraRef.current = camera;
    }

    return () => {
        // Cleanup if necessary (Camera utils doesn't have a clear stop method exposed easily without instance ref)
    };
  }, []);

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
            // Draw video to temp canvas
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
                
                // Edge Detection Logic (Simplified)
                // If brightness changes drastically from neighbors, it's an edge.
                // We'll approximate using simple brightness threshold for anchoring.
                // A better approach would be sampling neighbors here, but that's expensive inside the loop.
                // We'll use the 'brightness' itself as a simple anchor weight.
                // Darker areas (often background) flow more, lighter areas (face) anchor more? 
                // Or high contrast edges? Let's use Flow Field Strength to also control "Edge Anchoring".
                
                // If the particle is bright enough to be visible
                if (brightness > 15) {
                    p.brightness = brightness;
                    p.color = mapBrightnessToColor(brightness, styleConfig.colors);
                    
                    const sizeRange = styleConfig.particleSizeMax - styleConfig.particleSizeMin;
                    const targetSize = styleConfig.particleSizeMin + (brightness / 255) * sizeRange;
                    p.size += (targetSize - p.size) * 0.1;

                    // --- PHYSICS: MOUSE & HAND INTERACTION ---
                    if (mouseRef.current.isActive) {
                        const dx = mouseRef.current.x - p.x;
                        const dy = mouseRef.current.y - p.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const forceRadius = 150;

                        if (dist < forceRadius) {
                            const force = (forceRadius - dist) / forceRadius;
                            const angle = Math.atan2(dy, dx);
                            // Repel force
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

                    // --- PHYSICS: EDGE ANCHORING & RETURN ---
                    // "Anchoring": If this pixel is part of a strong edge, we want it to stay closer to origin.
                    // We can approximate edge strength by the magnitude of gradient calculated above.
                    // But for performance, let's just use a balanced Return Force.
                    
                    const dxOrigin = p.originX - p.x;
                    const dyOrigin = p.originY - p.y;
                    
                    // If flow field is strong (Van Gogh), return force is weak to allow strokes.
                    // If it's chaos, weak return.
                    // If it's normal (Constellation), strong return to keep shape.
                    let returnStrength = 0.05; // Base strength
                    
                    if (styleConfig.flowFieldStrength > 2) {
                        returnStrength = 0.02; // Loose, flowy
                    } else if (styleConfig.shape === ParticleShape.CROSS) {
                        returnStrength = 0.01; // Chaotic
                    }
                    
                    // Edge Anchoring Boost:
                    // If we want accurate silhouettes, increase return strength based on brightness (assuming subject is lit).
                    if (styleConfig.density <= 6) { // High def modes
                         returnStrength += (brightness / 255) * 0.05;
                    }

                    p.vx += dxOrigin * returnStrength * styleConfig.speed;
                    p.vy += dyOrigin * returnStrength * styleConfig.speed;

                    // --- PHYSICS: NOISE ---
                    if (styleConfig.noiseStrength > 0) {
                        // Directional noise for Chaos Theory
                        if (styleConfig.shape === ParticleShape.CROSS) {
                             p.vx += (Math.random() - 0.5) * styleConfig.noiseStrength;
                             p.vy += (Math.random() - 0.5) * styleConfig.noiseStrength;
                        } else {
                             // General jitter
                             p.vx += (Math.random() - 0.5) * styleConfig.noiseStrength;
                             p.vy += (Math.random() - 0.5) * styleConfig.noiseStrength;
                        }
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
  // Note: Because of scale-x-[-1] mirroring, visual Left is logical Right.
  // Standard mouse events report clientX from Top-Left.
  // So we must invert X (width - clientX) to match the physics world.
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

    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    mouseRef.current = {
      // Invert X because of CSS mirror
      x: rect.width - offsetX,
      y: offsetY,
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
      // Added scale-x-[-1] for Mirror Effect
      className="absolute top-0 left-0 w-full h-full block touch-none scale-x-[-1]"
    />
  );
};

export default Renderer;