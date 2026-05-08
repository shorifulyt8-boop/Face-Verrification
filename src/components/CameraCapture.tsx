import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { Camera, X, RefreshCw, ScanFace } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64Data: string) => void;
  onCancel: () => void;
  title?: string;
  description?: string;
}

export function CameraCapture({ onCapture, onCancel, title = "Facial Scan", description = "Align face within the targeting frame." }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setError(null);
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError' || err.message === 'Permission dismissed' || err.message?.includes('denied')) {
        setError("Camera access was denied or dismissed. Please allow camera access in your browser settings to continue.");
      } else if (err.name === 'NotFoundError') {
         setError("No camera device was found on this system.");
      } else {
        setError(`Could not access the camera: ${err.message || 'Unknown error'}`);
      }
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Data = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(base64Data);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-3xl flex flex-col font-sans overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="p-6 border-b border-white/10 flex justify-between items-center text-slate-50 bg-white/5">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
                <ScanFace size={20} />
             </div>
             <div>
               <h3 className="text-sm font-display font-bold uppercase tracking-wider">{title}</h3>
               <p className="text-xs text-slate-400 mt-0.5">{description}</p>
             </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <div className="relative bg-slate-900 aspect-video flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="text-red-400 p-6 text-center">
              <p className="text-sm">{error}</p>
              <button 
                onClick={startCamera}
                className="mt-6 px-4 py-3 bg-red-500/10 border border-red-400/30 text-red-400 rounded-xl flex items-center gap-2 mx-auto hover:bg-red-500/20 transition-colors text-xs uppercase tracking-widest font-bold"
              >
                <RefreshCw size={14} /> Reinitialize
              </button>
            </div>
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover transform scale-x-[-1] opacity-90 mix-blend-screen grayscale"
            />
          )}
          
          {!error && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
               <div className="w-64 h-80 relative flex items-center justify-center">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400 rounded-tl-2xl"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400 rounded-tr-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400 rounded-bl-2xl"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400 rounded-br-2xl"></div>
                  
                  <motion.div 
                    animate={{ top: ["0%", "100%", "0%"] }} 
                    transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                    className="absolute left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]"
                  />
               </div>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-white/10 flex justify-between items-center bg-white/5">
           <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </span>
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">Sensor Active</span>
           </div>
          <button 
            disabled={!!error}
            onClick={captureImage} 
            className="group relative px-6 py-3 font-display font-bold uppercase tracking-widest text-xs overflow-hidden rounded-xl bg-cyan-500 text-slate-950 transition-all hover:bg-cyan-400 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            <Camera size={16} /> Capture Baseline
          </button>
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </motion.div>
    </div>
  );
}
