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
            // Mapping for interaction (repel physics)
            // Due to scale-x-[-1] mirroring, visual right is logical left.
            // But physics happens in logical space.
            mouseRef.current = {
              x: indexTip.x * canvasRef.current.width,
              y: indexTip.y * canvasRef.current.height,
              isActive: true
            };
          }
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
        // Cleanup if necessary
    };
  }, []);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const { innerWidth, innerHeight } = window;
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
    
    if (gap <= 0) return;

    for (let y = 0; y < height; y += gap) {
      for (let x = 0; x < width; x += gap) {
        particlesRef.current.push({
          x: x,
          y: y,
          z: 0,
          vz: 0,
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

  const drawShape = (ctx: CanvasRenderingContext2D, x: number, y: number, zScale: number, p: Particle, shape: ParticleShape) => {
    const drawnSize = Math.max(0.5, p.size * zScale); // Scale size by 3D depth

    switch (shape) {
      case ParticleShape.CIRCLE:
        ctx.beginPath();
        ctx.arc(x, y, drawnSize, 0, Math.PI * 2);
        ctx.fill();
        break;
      case ParticleShape.SQUARE:
        ctx.fillRect(x - drawnSize / 2, y - drawnSize / 2, drawnSize, drawnSize);
        break;
      case ParticleShape.LINE:
        ctx.beginPath();
        // Just use velocity for angle for now, ignoring 3D rotation of vector for simplicity
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        let angle = speed > 0.1 ? Math.atan2(p.vy, p.vx) : Math.PI / 2;
        
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const len = drawnSize; 
        ctx.moveTo(x - cos * len, y - sin * len);
        ctx.lineTo(x + cos * len, y + sin * len);
        ctx.stroke();
        break;
      case ParticleShape.CROSS:
        ctx.beginPath();
        ctx.moveTo(x - drawnSize, y);
        ctx.lineTo(x + drawnSize, y);
        ctx.moveTo(x, y - drawnSize);
        ctx.lineTo(x, y + drawnSize);
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

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    const getBrightness = (data: Uint8ClampedArray, width: number, x: number, y: number) => {
        const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
        if (idx < 0 || idx >= data.length) return 0;
        return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
    };

    let time = 0;

    const animate = () => {
      if (!isPaused && video.readyState === 4) {
        time += 0.01;
        
        const analysisScale = 0.15;
        const w = Math.floor(dimensions.width * analysisScale);
        const h = Math.floor(dimensions.height * analysisScale);
        
        if (w > 0 && h > 0 && tempCtx) {
            
            tempCanvas.width = w;
            tempCanvas.height = h;
            tempCtx.drawImage(video, 0, 0, w, h);
            
            const imageData = tempCtx.getImageData(0, 0, w, h).data;

            // Clear with trail effect
            ctx.fillStyle = `rgba(0, 0, 0, ${styleConfig.trailEffect})`;
            ctx.fillRect(0, 0, dimensions.width, dimensions.height);

            // 3D Projection Setup
            const cx = dimensions.width / 2;
            const cy = dimensions.height / 2;
            const fov = dimensions.width * 0.8; 
            
            // Fixed gentle camera sway (automatic) instead of mouse control
            const autoRotX = Math.sin(time * 0.5) * 0.05; 
            const autoRotY = Math.cos(time * 0.3) * 0.05;

            const cosY = Math.cos(autoRotY);
            const sinY = Math.sin(autoRotY);
            const cosX = Math.cos(autoRotX);
            const sinX = Math.sin(autoRotX);

            const grid: Record<string, number[]> = {};
            const cellSize = Math.max(styleConfig.connectionDistance, 40); 
            const useConnections = styleConfig.connectionDistance > 0;

            const projectedCoords: {x: number, y: number, s: number}[] = new Array(particlesRef.current.length);

            // Virtual Mouse Z Position (The 'finger' depth)
            const mouseZ = -100; // Hovering in front of the screen plane (negative Z)

            for (let i = 0; i < particlesRef.current.length; i++) {
                const p = particlesRef.current[i];
                
                let pixelX = Math.floor(p.x * analysisScale);
                let pixelY = Math.floor(p.y * analysisScale);
                pixelX = Math.max(0, Math.min(w - 1, pixelX));
                pixelY = Math.max(0, Math.min(h - 1, pixelY));

                const pixelIndex = (pixelY * w + pixelX) * 4;
                const brightness = (imageData[pixelIndex] + imageData[pixelIndex + 1] + imageData[pixelIndex + 2]) / 3;

                if (brightness > 15) {
                    p.brightness = brightness;
                    p.color = mapBrightnessToColor(brightness, styleConfig.colors);
                    
                    const sizeRange = styleConfig.particleSizeMax - styleConfig.particleSizeMin;
                    const targetSize = styleConfig.particleSizeMin + (brightness / 255) * sizeRange;
                    p.size += (targetSize - p.size) * 0.1;

                    // --- 3D PHYSICS ENGINE ---
                    // Target Z based on brightness (Bas-Relief map)
                    const targetZ = (brightness / 255) * styleConfig.zDepth;
                    
                    // Spring force towards target Z
                    const k = 0.05; // Spring constant
                    const damping = 0.85; // Damping factor
                    const zForce = (targetZ - p.z) * k;
                    p.vz += zForce;
                    
                    // Home return force X/Y
                    const dxOrigin = p.originX - p.x;
                    const dyOrigin = p.originY - p.y;
                    let returnStrength = 0.05;
                    if (styleConfig.flowFieldStrength > 2) returnStrength = 0.02;
                    else if (styleConfig.shape === ParticleShape.CROSS) returnStrength = 0.01;
                    
                    p.vx += dxOrigin * returnStrength * styleConfig.speed;
                    p.vy += dyOrigin * returnStrength * styleConfig.speed;

                    // --- INTERACTION ---
                    if (mouseRef.current.isActive) {
                        const dx = mouseRef.current.x - p.x;
                        const dy = mouseRef.current.y - p.y;
                        const dz = mouseZ - p.z; // Distance in Z from mouse to particle

                        // 3D Distance squared
                        const distSq = dx*dx + dy*dy + dz*dz; 
                        const forceRadiusSq = 30000; // ~170px radius

                        if (distSq < forceRadiusSq) {
                            const dist = Math.sqrt(distSq);
                            const force = (1 - dist / Math.sqrt(forceRadiusSq));
                            
                            // Direction vector from mouse to particle
                            const nx = dx / dist; // Points towards mouse (attract) or away?
                            // We want repel: vector from Mouse TO Particle
                            // Vector = Particle - Mouse = (-dx, -dy, -dz)
                            
                            // Let's create a "Dent" effect.
                            // Push particles AWAY from mouse center in 3D.
                            // Since MouseZ is -100 (in front), particles are at Z ~ 0+.
                            // Vector P - M has positive Z component.
                            // So particles will be pushed deeper into the scene (+Z).
                            
                            const pushStrength = 20 * styleConfig.speed;
                            
                            // Invert dx/dy because dx was calculated as Mouse - Particle
                            p.vx -= (dx / dist) * force * pushStrength;
                            p.vy -= (dy / dist) * force * pushStrength;
                            p.vz -= (dz / dist) * force * pushStrength * 2; // Stronger kick in Z
                        }
                    }

                    // Flow Fields
                    if (styleConfig.flowFieldStrength > 0) {
                        const lookAhead = 2;
                        const bL = getBrightness(imageData, w, pixelX - lookAhead, pixelY);
                        const bR = getBrightness(imageData, w, pixelX + lookAhead, pixelY);
                        const bU = getBrightness(imageData, w, pixelX, pixelY - lookAhead);
                        const bD = getBrightness(imageData, w, pixelX, pixelY + lookAhead);
                        const dx = bR - bL;
                        const dy = bD - bU;
                        const angle = Math.atan2(dy, dx) + Math.PI / 2;
                        const noise = Math.sin(p.x * 0.01 + time) * Math.cos(p.y * 0.01 + time);
                        const turbulentAngle = angle + (noise * 0.5);
                        p.vx += Math.cos(turbulentAngle) * styleConfig.flowFieldStrength * styleConfig.speed;
                        p.vy += Math.sin(turbulentAngle) * styleConfig.flowFieldStrength * styleConfig.speed;
                    }

                    if (styleConfig.noiseStrength > 0) {
                        p.vx += (Math.random() - 0.5) * styleConfig.noiseStrength;
                        p.vy += (Math.random() - 0.5) * styleConfig.noiseStrength;
                    }

                    // Apply Physics
                    p.vx *= styleConfig.friction;
                    p.vy *= styleConfig.friction;
                    p.vz *= damping; // Z-damping

                    p.x += p.vx;
                    p.y += p.vy;
                    p.z += p.vz;

                    // --- 3D PROJECTION ---
                    const x0 = p.x - cx;
                    const y0 = p.y - cy;
                    const z0 = p.z; 

                    // Rotate Y
                    const x1 = x0 * cosY - z0 * sinY;
                    const z1 = x0 * sinY + z0 * cosY;

                    // Rotate X
                    const y2 = y0 * cosX - z1 * sinX;
                    const z2 = y0 * sinX + z1 * cosX;

                    // Perspective
                    const perspectiveZ = fov - z2; 
                    const scale = perspectiveZ > 0 ? fov / perspectiveZ : 100;

                    const screenX = x1 * scale + cx;
                    const screenY = y2 * scale + cy;
                    
                    projectedCoords[i] = { x: screenX, y: screenY, s: scale };

                    ctx.fillStyle = p.color;
                    ctx.strokeStyle = p.color;
                    ctx.lineWidth = Math.min(3, p.size / 2 * scale);
                    ctx.lineCap = 'round';
                    
                    if (scale > 0 && screenX > -50 && screenX < dimensions.width + 50 && screenY > -50 && screenY < dimensions.height + 50) {
                        drawShape(ctx, screenX, screenY, scale, p, styleConfig.shape);
                    }

                    if (useConnections) {
                        const gx = Math.floor(p.x / cellSize);
                        const gy = Math.floor(p.y / cellSize);
                        const key = `${gx},${gy}`;
                        if (!grid[key]) grid[key] = [];
                        grid[key].push(i);
                    }
                }
            }

            // Draw Connections
            if (useConnections) {
                const connDistSq = styleConfig.connectionDistance * styleConfig.connectionDistance;
                
                for (const key in grid) {
                    const [gx, gy] = key.split(',').map(Number);
                    const cellParticles = grid[key];

                    for (const p1Idx of cellParticles) {
                         const p1 = particlesRef.current[p1Idx];
                         const proj1 = projectedCoords[p1Idx];
                         if (!proj1) continue;

                         for (let ox = -1; ox <= 1; ox++) {
                             for (let oy = -1; oy <= 1; oy++) {
                                 const neighborKey = `${gx + ox},${gy + oy}`;
                                 const neighborParticles = grid[neighborKey];
                                 
                                 if (neighborParticles) {
                                     for (const p2Idx of neighborParticles) {
                                         if (p1Idx < p2Idx) {
                                             const p2 = particlesRef.current[p2Idx];
                                             const proj2 = projectedCoords[p2Idx];
                                             if (!proj2) continue;

                                             // Use physical distance for threshold
                                             const dx = p1.x - p2.x;
                                             const dy = p1.y - p2.y;
                                             const dz = p1.z - p2.z;
                                             
                                             if (Math.abs(dx) > styleConfig.connectionDistance || Math.abs(dy) > styleConfig.connectionDistance) continue;

                                             const distSq = dx * dx + dy * dy + dz * dz;
                                             if (distSq < connDistSq) {
                                                 const alpha = 1 - (Math.sqrt(distSq) / styleConfig.connectionDistance);
                                                 ctx.beginPath();
                                                 ctx.moveTo(proj1.x, proj1.y);
                                                 ctx.lineTo(proj2.x, proj2.y);
                                                 ctx.strokeStyle = p1.color;
                                                 ctx.lineWidth = 1 * ((proj1.s + proj2.s) / 2);
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

    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    // Physics Interaction (Inverted X due to scale-x-[-1])
    mouseRef.current = {
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
      className="absolute top-0 left-0 w-full h-full block touch-none scale-x-[-1]"
    />
  );
};

export default Renderer;