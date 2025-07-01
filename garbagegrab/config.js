/**
 * Garbage Grab - Game Configuration
 */
export const CONFIG = {
  // Display Settings
  display: { width: 800, height: 600, fullscreen: true },
  // Game Timer (in seconds)
  gameTimer: 300, // 5 minutes
  // Scoring System
  scores: { coin: 10, usb: 25, laptop: 50 },
  // Player Settings
  player: { moveSpeed: 8, health: 100, maxHealth: 100, groundLevel: 0.5 },
  // AI Settings
  ai: { mechCount: 2, moveSpeed: 3, searchInterval: 0.5 },
  // Monster Settings
  monster: { speed: 2, detectionRadius: 8, damage: 20, baseHeight: 3.5, hoverAmplitude: 0.8, hoverFrequency: 2.0 },
  // Arena Settings
  arena: { size: 40, divisions: 40, bounds: 18 },
  // Collectible Settings
  collectibles: { coin: { count: 15, respawnDelay: 5000 }, usb: { count: 8, respawnDelay: 7000 }, laptop: { count: 5, respawnDelay: 10000 } },
  // Spike Trap Settings
  spikeTrap: { damage: 25, cooldown: 3000, activationRadius: 0.8 },
  // Asset Paths
  assets: {
    models: {
      playerMech: '/assets/Mech-D5Ww2Jdo42.glb',
      aiMech1: '/assets/Mech-4Uvihxnosr.glb',
      aiMech2: '/assets/Mech-4Uvihxnosr.glb',
      monster: '/assets/Glub-Evolved.glb',
      blueDemon: '/assets/Blue-Demon.glb',
      spikeTrap: '/assets/Hazard-Spike-Trap.glb',
      miniMech: '/assets/Mech-4Uvihxnosr.glb'
    },
    audio: {
      backgroundMusic: '/assets/background-music.mp3',
      clickSound: '/assets/click-1.wav',
      hitSound: '/assets/hit-sound.wav',
      collectSound: '/assets/collect-sound.wav'
    }
  },
  // Graphics Settings
  graphics: { shadowMap: true, shadowMapSize: 2048, antialias: true, fog: { color: 0x000033, near: 10, far: 100 } },
  // UI Colors
  colors: { primary: '#00ffff', secondary: '#ff00ff', accent: '#00ff00', warning: '#ffff00', danger: '#ff0000', background: '#000011', neon1: '#ff0088', neon2: '#00ffff', neon3: '#88ff00' },
  // Blockchain Settings
  blockchain: {
    rpcUrl: 'https://rpc.gorbagana.wtf',
    programId: '6t7gLJEudrC9JNw8ZXSnnwyMgmofdGxtQVQErA67nxhN'
    // Removed scoreAccount as it’s now PDA-based and derived per player
  }
};

// Asset list for downloader
export const DOWNLOADABLE_ASSETS = [
  { name: 'Mech-D5Ww2Jdo42', url: 'https://play.rosebud.ai/assets/Mech-D5Ww2Jdo42.glb?zjzc', localPath: '/assets/Mech-D5Ww2Jdo42.glb', file_type: 'glb', description: 'Player mech model' },
  { name: 'Mech-4Uvihxnosr-1', url: 'https://play.rosebud.ai/assets/Mech-4Uvihxnosr.glb?JhXI', localPath: '/assets/Mech-4Uvihxnosr-1.glb', file_type: 'glb', description: 'AI mech model variant 1' },
  { name: 'Mech-4Uvihxnosr-2', url: 'https://play.rosebud.ai/assets/Mech-4Uvihxnosr.glb?vU5V', localPath: '/assets/Mech-4Uvihxnosr-2.glb', file_type: 'glb', description: 'AI mech model variant 2' },
  { name: 'Glub-Evolved', url: 'https://play.rosebud.ai/assets/Glub Evolved.glb?Qhxz', localPath: '/assets/Glub-Evolved.glb', file_type: 'glb', description: 'Flying monster enemy' },
  { name: 'Blue-Demon', url: 'https://play.rosebud.ai/assets/Blue Demon.glb?izLD', localPath: '/assets/Blue-Demon.glb', file_type: 'glb', description: 'Decorative statue model' },
  { name: 'Hazard-Spike-Trap', url: 'https://play.rosebud.ai/assets/Hazard Spike Trap.glb?ZAeD', localPath: '/assets/Hazard-Spike-Trap.glb', file_type: 'glb', description: 'Animated spike trap hazard' }
];

// Validation function
export function validateConfig() {
  const requiredPaths = ['display.width', 'display.height', 'gameTimer', 'scores.coin', 'scores.usb', 'scores.laptop', 'blockchain.rpcUrl', 'blockchain.programId'];
  for (const path of requiredPaths) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], CONFIG);
    if (value === undefined) {
      console.warn(`Missing required config value: ${path}`);
      return false;
    }
  }
  return true;
}