import React, { useEffect, useRef, useState } from 'react';
import 'aframe';

const Video360Player = ({ videoUrl, posterUrl, title }) => {
  const sceneRef = useRef(null);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Wait for A-Frame to be ready
    const checkAFrame = setInterval(() => {
      if (window.AFRAME) {
        clearInterval(checkAFrame);
        setIsLoaded(true);
      }
    }, 100);

    return () => clearInterval(checkAFrame);
  }, []);

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    const video = videoRef.current;
    
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoUrl]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    videoRef.current.currentTime = percentage * duration;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    const container = sceneRef.current?.parentElement;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  if (!isLoaded) {
    return (
      <div className="w-full h-[500px] bg-black flex items-center justify-center rounded-xl">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Cargando reproductor 360°...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden" style={{ height: isFullscreen ? '100vh' : '500px' }}>
      {/* Hidden video element for A-Frame */}
      <video
        ref={videoRef}
        id="video360"
        loop={false}
        crossOrigin="anonymous"
        playsInline
        style={{ display: 'none' }}
      />

      {/* A-Frame Scene */}
      <a-scene
        ref={sceneRef}
        embedded
        vr-mode-ui="enabled: true"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Video sphere - inverted so we see inside */}
        <a-videosphere
          src="#video360"
          rotation="0 -90 0"
          play-on-click
        />

        {/* Camera with look controls */}
        <a-camera
          look-controls="reverseMouseDrag: true; touchEnabled: true"
          wasd-controls="enabled: false"
        />

        {/* Sky as fallback/poster */}
        {posterUrl && !isPlaying && (
          <a-sky src={posterUrl} rotation="0 -90 0" />
        )}
      </a-scene>

      {/* Custom Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
        {/* Progress bar */}
        <div 
          className="w-full h-2 bg-white/30 rounded-full cursor-pointer mb-3"
          onClick={handleSeek}
        >
          <div 
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="w-12 h-12 bg-amber-500 hover:bg-amber-600 rounded-full flex items-center justify-center text-white transition-colors"
            >
              {isPlaying ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>

            {/* Time */}
            <span className="text-white text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 360 indicator */}
            <span className="text-white text-xs bg-amber-600 px-2 py-1 rounded-full font-bold">
              360°
            </span>

            {/* VR Mode button */}
            <button
              onClick={() => sceneRef.current?.enterVR?.()}
              className="text-white hover:text-amber-400 transition-colors"
              title="Modo VR"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.74 6H3.21C2.54 6 2 6.54 2 7.21v9.58C2 17.46 2.54 18 3.21 18h4.75c.54 0 1.03-.34 1.19-.86l.5-1.64c.15-.51.65-.86 1.19-.86h2.32c.54 0 1.03.34 1.19.86l.5 1.64c.15.51.65.86 1.19.86h4.71c.67 0 1.21-.54 1.21-1.21V7.21C22 6.54 21.46 6 20.74 6zM7.5 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm9 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
              </svg>
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-amber-400 transition-colors"
              title="Pantalla completa"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                {isFullscreen ? (
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                ) : (
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-white/70 text-xs text-center mt-2">
          Arrastra para mirar alrededor • Usa el botón VR para experiencia inmersiva
        </p>
      </div>
    </div>
  );
};

export default Video360Player;
