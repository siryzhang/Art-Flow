export enum ParticleShape {
  CIRCLE = 'circle',
  SQUARE = 'square',
  LINE = 'line',
  CROSS = 'cross'
}

export interface ArtStyleConfig {
  name: string;
  description: string;
  colors: string[];
  particleSizeMin: number;
  particleSizeMax: number;
  density: number; // 1-20, higher is less dense (gap)
  speed: number;
  friction: number;
  shape: ParticleShape;
  connectionDistance: number; // 0 to disable
  trailEffect: number; // 0 to 1, persistence
  noiseStrength: number;
  flowFieldStrength: number; // 0 to 5, how much particles follow image contours
  zDepth: number; // 0 to 500, strength of 3D displacement
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vz: number; // Velocity Z for 3D physics
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  brightness: number;
}

export interface MouseState {
  x: number;
  y: number;
  isActive: boolean;
}