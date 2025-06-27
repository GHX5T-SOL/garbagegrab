# Garbage Grab - Cyberpunk Arena Scavenging Game
## Overview
Garbage Grab is a 3D cyberpunk-themed arena scavenging game built with Three.js. Players control a mech to collect valuable items while avoiding hazards and competing against AI opponents in a futuristic arena.
## IMPORTANT: Local Testing Instructions
**To run locally, serve files with a local server and open index.html in a browser.**
### Quick Start:
```bash
# Using Node.js (recommended)
npx http-server
# Using Python 3
python -m http.server 8080
# Using Python 2
python -m SimpleHTTPServer 8080
```
Then open your browser to: http://localhost:8080
**Note:** This game requires a local server due to ES6 modules and CORS restrictions. Opening index.html directly in the browser will NOT work.
## Game Features
- 3D cyberpunk arena with dynamic lighting
- Player-controlled mech with WASD movement
- AI competitor mechs with autonomous behavior
- Flying monster enemy (Glub Evolved) with realistic movement
- Collectible items: Gold coins (10pts), USB drives (25pts), Laptops (50pts)
- Animated spike trap hazards
- Real-time leaderboard with blockchain-style wallet addresses
- Mobile-responsive controls with touch support
- 5-minute timed gameplay sessions
## File Structure
```
garbage-grab/
├── index.html          # Main HTML entry point with iframe support
├── main.js            # Application entry point and initialization
├── config.js          # Game configuration and settings
├── game.js            # Core game logic and state management
├── sceneManager.js    # 3D scene setup and lighting
├── gameLogic.js       # Game mechanics and entity management
├── ui.js              # User interface and HUD management
├── rosieControls.js   # Player controls and camera systems
├── rosieMobileControls.js # Mobile touch controls
├── AssetDownloader.js # Asset download utility component
├── assetLoader.js     # Asset loading utilities with retry logic
├── README.txt         # This documentation file
└── assets/            # Game assets folder (created after download)
    ├── models/        # 3D model files (.glb)
    └── audio/         # Sound files (.mp3, .wav)
```
## Installation and Setup
### Local Development
1. Download and extract all project files to a folder
2. **IMPORTANT:** You must use a local web server (required for ES6 modules)
3. Run a local server in the project directory:
   ```bash
   # Using Node.js (recommended)
   npx http-server
   
   # Using Python 3
   python -m http.server 8080
   
   # Using Python 2
   python -m SimpleHTTPServer 8080
   ```
4. Open your browser to: http://localhost:8080
5. Click "CLICK TO START" to begin playing
### iframe Embedding
The game is iframe-ready. Use this code to embed:
```html
<iframe src="index.html" width="800" height="600" frameborder="0"></iframe>
```
Adjust width/height to match your config.js display settings.
### Asset Management
- Click the "Download Assets" button in the top-right corner to download all 3D models
- Assets will be packaged as "Garbage_Grab_Assets.zip"
- Extract the assets to the project folder for offline play
- Update asset URLs in config.js to use local paths when running offline
### Controls
- **WASD**: Move mech around the arena
- **Mouse**: Control camera angle (drag to rotate)
- **Touch**: Mobile devices support touch controls with virtual joystick
### Game Objective
- Collect as many valuable items as possible within 5 minutes
- Avoid spike traps that deal 25 damage
- Stay away from the Glub Evolved monster (20 damage)
- Compete against AI mechs for the highest score
- Monitor your health and time remaining
## Technical Details
### Dependencies
- Three.js v0.160.0 (3D graphics engine)
- ES6 Modules (no build process required)
- Modern browser with WebGL support
- JSZip & FileSaver (for asset downloading)
### Browser Compatibility
- Chrome 91+ (recommended)
- Firefox 90+
- Safari 14+
- Edge 91+
### Performance Notes
- Game targets 60 FPS on modern hardware
- Shadows and post-processing effects may impact performance on lower-end devices
- Mobile devices automatically receive optimized settings
## Configuration
Edit `config.js` to modify:
- Game timer duration
- Scoring values for different items
- Player movement speed
- Arena size and bounds
- Asset file paths
- Graphics quality settings
## Troubleshooting
### Common Issues
1. **Game won't start**: Ensure you're running a local web server (not opening index.html directly)
2. **Models not loading**: Check browser console for network errors; ensure asset URLs are accessible
3. **Poor performance**: Try disabling shadows in config.js graphics settings
4. **Touch controls not working**: Ensure mobile device supports touch events
5. **CORS errors**: Make sure you're using a local server, not file:// protocol
### Debug Mode
Open browser developer tools (F12) to view console logs for:
- Asset loading progress
- Game state information
- Performance metrics
- Error messages
## Export and Distribution
This codebase is optimized for export and can be:
- Zipped and distributed as a standalone game
- Embedded in websites using iframes
- Deployed to web servers or CDNs
- Modified and extended with additional features
## Credits
- Built with Three.js WebGL library
- 3D models from Rosebud AI asset library
- Cyberpunk aesthetic inspired by classic sci-fi
- Created by Ghxst for the Gorbagana Blockchain ecosystem
- Asset downloader based on Discord community example
## License
This game is provided as-is for educational and entertainment purposes.
3D model assets are property of their respective creators.
## Version Information
- Game Version: 1.0
- Three.js Version: 0.160.0
- Target Platform: Modern web browsers
- Export Ready: Yes
- Last Updated: December 2024