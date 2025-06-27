

import React, { useState, useCallback, useRef } from 'react';
import JSZip from 'https://esm.sh/jszip@3.10.1';
import saveAs from 'https://esm.sh/file-saver@2.0.5';

/**
 * AssetDownloader Component
 * 
 * This component provides functionality to download all game assets
 * as a zip file for offline use. Based on the Discord community example.
 * 
 * Features:
 * - Downloads all 3D models (.glb files)
 * - Downloads audio files (.mp3, .wav)
 * - Progress tracking with visual feedback
 * - Cancellation support
 * - Error handling for missing assets
 */

// Asset list with actual URLs used in the game
const assets = [
  { 
    name: 'Mech-D5Ww2Jdo42', 
    url: 'https://play.rosebud.ai/assets/Mech-D5Ww2Jdo42.glb?zjzc', 
    file_type: 'glb',
    description: 'Player mech model'
  },
  { 
    name: 'Mech-4Uvihxnosr-1', 
    url: 'https://play.rosebud.ai/assets/Mech-4Uvihxnosr.glb?JhXI', 
    file_type: 'glb',
    description: 'AI mech model variant 1'
  },
  { 
    name: 'Mech-4Uvihxnosr-2', 
    url: 'https://play.rosebud.ai/assets/Mech-4Uvihxnosr.glb?vU5V', 
    file_type: 'glb',
    description: 'AI mech model variant 2'
  },
  { 
    name: 'Glub-Evolved', 
    url: 'https://play.rosebud.ai/assets/Glub Evolved.glb?Qhxz', 
    file_type: 'glb',
    description: 'Flying monster enemy'
  },
  { 
    name: 'Blue-Demon', 
    url: 'https://play.rosebud.ai/assets/Blue Demon.glb?izLD', 
    file_type: 'glb',
    description: 'Decorative statue model'
  },
  { 
    name: 'Hazard-Spike-Trap', 
    url: 'https://play.rosebud.ai/assets/Hazard Spike Trap.glb?ZAeD', 
    file_type: 'glb',
    description: 'Animated spike trap hazard'
  }
];

// Styling constants for the downloader UI
const buttonStyle = {
  padding: '12px 24px',
  backgroundColor: '#4a4a88',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '16px',
  fontWeight: 'bold',
  zIndex: 9999,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  transition: 'background-color 0.3s ease, transform 0.2s ease',
  overflow: 'hidden'
};

const disabledStyle = {
  ...buttonStyle,
  backgroundColor: '#7878a8',
  cursor: 'not-allowed'
};

const progressContainerStyle = {
  width: '250px',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  borderRadius: '8px',
  padding: '8px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  marginTop: '8px'
};

const progressBarBackStyle = {
  backgroundColor: '#333',
  borderRadius: '4px',
  height: '10px',
  overflow: 'hidden',
  width: '100%'
};

const progressBarFrontStyle = {
  height: '100%',
  backgroundColor: '#6a6ad8',
  transition: 'width 0.2s ease-in-out',
  borderRadius: '4px'
};

const buttonTextStyle = {
  color: 'white',
  fontSize: '14px',
  marginBottom: '4px',
  textAlign: 'left'
};

/**
 * AssetDownloader React Component
 * 
 * Renders a download button that fetches all game assets and packages them
 * into a zip file for offline use.
 */
export const AssetDownloader = () => {
  // Component state
  const [isLoading, setIsLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Download Assets');
  const cancelRequest = useRef(false);

  /**
   * Cancel the current download operation
   */
  const handleCancel = () => {
    cancelRequest.current = true;
  };

  /**
   * Main download handler
   * Fetches all assets, creates a zip file, and triggers download
   */
  const handleDownload = useCallback(async () => {
    // Prevent multiple simultaneous downloads
    if (isLoading) return;

    // Initialize download state
    setIsLoading(true);
    setDownloadProgress(0);
    cancelRequest.current = false;
    setStatusMessage('Downloading... 0%');
    
    console.log('Starting asset download...');

    // Validate asset list
    if (assets.length === 0) {
      console.warn('No assets to download.');
      alert('There are no assets defined to download.');
      setIsLoading(false);
      setStatusMessage('Download Assets');
      return;
    }

    // Create new zip archive
    const zip = new JSZip();
    let downloadedCount = 0;
    let cancelled = false;

    try {
      // Download each asset
      for (const asset of assets) {
        // Check for cancellation
        if (cancelRequest.current) {
          cancelled = true;
          console.log('Download cancelled by user.');
          break;
        }

        try {
          console.log(`Downloading ${asset.name}...`);
          
          // Fetch the asset
          const response = await fetch(asset.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${asset.name}: ${response.statusText}`);
          }

          // Convert to blob and add to zip
          const blob = await response.blob();
          const fileName = `${asset.name}.${asset.file_type}`;
          zip.file(fileName, blob);

          // Update progress
          downloadedCount++;
          const progress = Math.round((downloadedCount / assets.length) * 100);
          setDownloadProgress(progress);
          setStatusMessage(`Downloading ${downloadedCount} / ${assets.length} assets...`);
          
          console.log(`Successfully downloaded ${asset.name}`);
        } catch (error) {
          console.error(`Skipping asset due to error: ${error.message}`);
          // Continue with other assets even if one fails
        }
      }

      // Generate and download zip file if not cancelled
      if (!cancelled && downloadedCount > 0) {
        console.log('Generating zip file...');
        setStatusMessage('Creating zip file...');
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, 'Garbage_Grab_Assets.zip');
        
        setStatusMessage('Download Complete!');
        console.log('Asset download completed successfully.');
        
        // Reset status after delay
        setTimeout(() => {
          setStatusMessage('Download Assets');
        }, 3000);
      } else if (cancelled) {
        setStatusMessage('Download Cancelled');
        setTimeout(() => {
          setStatusMessage('Download Assets');
        }, 2000);
      }
    } catch (error) {
      console.error('Download failed:', error);
      setStatusMessage('Download Failed');
      
      // Reset status after delay
      setTimeout(() => {
        setStatusMessage('Download Assets');
      }, 3000);
    }

    // Reset loading state
    setIsLoading(false);
    setDownloadProgress(0);
  }, [isLoading]);

  // Render the download UI
  return (
    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10000 }}>
      <button
        style={isLoading ? disabledStyle : buttonStyle}
        onClick={handleDownload}
        disabled={isLoading}
        title="Download all game assets as a zip file for offline use"
      >
        <div style={buttonTextStyle}>{statusMessage}</div>
      </button>
      
      {/* Progress bar - only shown during download */}
      {isLoading && (
        <div style={progressContainerStyle}>
          <div style={progressBarBackStyle}>
            <div style={{ ...progressBarFrontStyle, width: `${downloadProgress}%` }} />
          </div>
        </div>
      )}
      
      {/* Cancel button - only shown during download */}
      {isLoading && (
        <button
          style={{ ...buttonStyle, padding: '8px 16px', marginTop: '8px' }}
          onClick={handleCancel}
          title="Cancel the current download"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

