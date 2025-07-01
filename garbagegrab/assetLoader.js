import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * AssetLoader - Centralized utility for loading 3D assets with retry logic and error handling
 */
export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map(); // Cache for loaded assets
  }

  /**
   * Load a GLTF model with retry logic and timeout
   * @param {string} url - The URL of the GLTF model to load
   * @param {Object} options - Loading options
   * @param {number} options.timeout - Timeout in milliseconds (default: 10000)
   * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
   * @param {boolean} options.useCache - Whether to use/store in cache (default: true)
   * @param {string} options.description - Description for logging (default: url)
   * @returns {Promise<Object>} Promise that resolves to the loaded GLTF object
   */
  async loadGLTF(url, options = {}) {
    const {
      timeout = 10000,
      maxRetries = 3,
      useCache = true,
      description = url
    } = options;

    // Check cache first
    if (useCache && this.cache.has(url)) {
      console.log(`Loading ${description} from cache`);
      return this.cache.get(url);
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Loading ${description} (attempt ${attempt}/${maxRetries})`);
        
        const gltf = await this.loadGLTFWithTimeout(url, timeout);
        
        // Store in cache if successful
        if (useCache) {
          this.cache.set(url, gltf);
        }
        
        console.log(`Successfully loaded ${description}`);
        return gltf;
        
      } catch (error) {
        lastError = error;
        console.warn(`${description} loading attempt ${attempt} failed:`, error.message || error);
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Retrying ${description} in ${delay}ms...`);
          await this.delay(delay);
        }
      }
    }
    
    // All retries failed
    console.error(`Failed to load ${description} after all retries:`, lastError);
    throw lastError;
  }

  /**
   * Load multiple GLTF models concurrently
   * @param {Array} assets - Array of asset objects with url and options
   * @returns {Promise<Array>} Promise that resolves to array of loaded GLTF objects
   */
  async loadMultipleGLTF(assets) {
    const promises = assets.map(asset => {
      const { url, ...options } = asset;
      return this.loadGLTF(url, options).catch(error => {
        console.warn(`Failed to load asset ${url}:`, error);
        return null; // Return null for failed assets
      });
    });

    return Promise.all(promises);
  }

  /**
   * Internal method to load GLTF with timeout
   * @private
   */
  loadGLTFWithTimeout(url, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Asset loading timeout after ${timeoutMs}ms: ${url}`));
      }, timeoutMs);
      
      this.loader.load(
        url,
        (gltf) => {
          clearTimeout(timeoutId);
          if (!gltf || !gltf.scene) {
            reject(new Error(`Invalid GLTF data received from: ${url}`));
            return;
          }
          resolve(gltf);
        },
        (progress) => {
          // Optional: Log loading progress for debugging
          if (progress.lengthComputable) {
            const percentComplete = (progress.loaded / progress.total) * 100;
            console.log(`Loading ${url}: ${percentComplete.toFixed(1)}%`);
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          const errorMessage = error?.message || `Failed to load asset: ${url}`;
          reject(new Error(errorMessage));
        }
      );
    });
  }

  /**
   * Helper method for delays in retry logic
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear the asset cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Asset cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Preload assets for better performance
   * @param {Array} urls - Array of URLs to preload
   * @param {Object} defaultOptions - Default options for all assets
   * @returns {Promise<Array>} Promise that resolves when all assets are loaded
   */
  async preloadAssets(urls, defaultOptions = {}) {
    console.log(`Preloading ${urls.length} assets...`);
    
    const assets = urls.map(url => ({
      url,
      ...defaultOptions,
      description: `preload: ${url}`
    }));

    const results = await this.loadMultipleGLTF(assets);
    const successCount = results.filter(result => result !== null).length;
    
    console.log(`Preloading complete: ${successCount}/${urls.length} assets loaded successfully`);
    return results;
  }
}

// Create and export a singleton instance
export const assetLoader = new AssetLoader();