import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, RefreshCw, X } from 'lucide-react';
import type { CompressedPhotoPayload } from '../utils/imageCompress';
import { compressCanvasPhoto } from '../utils/imageCompress';

interface ContinuousCameraModalProps {
  startingPageNumber: number;
  maxRemaining: number;
  onDone: (photos: CompressedPhotoPayload[]) => void;
  onCancel: () => void;
  onFallbackNativeCamera: () => void;
}

export const ContinuousCameraModal: React.FC<ContinuousCameraModalProps> = ({
  startingPageNumber,
  maxRemaining,
  onDone,
  onCancel,
  onFallbackNativeCamera,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraState, setCameraState] = useState<'starting' | 'ready' | 'error'>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<CompressedPhotoPayload[]>([]);
  const [flashActive, setFlashActive] = useState(false);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      stopStream();
      setCameraState('starting');
      setCameraError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (!cancelled) {
          setCameraState('error');
          setCameraError('Live camera preview is not supported in this browser.');
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraState('ready');
      } catch (err) {
        if (cancelled) return;
        setCameraState('error');
        const name =
          typeof err === 'object' && err !== null && 'name' in err
            ? String((err as { name?: unknown }).name)
            : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setCameraError(
            'Camera permission was denied. Allow camera access in browser settings or use your phone camera directly.'
          );
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setCameraError('No camera was detected on this device.');
        } else {
          setCameraError('Could not start the live camera. You can still use your phone camera directly.');
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (stripRef.current) {
      stripRef.current.scrollLeft = stripRef.current.scrollWidth;
    }
  }, [captured.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopStream();
        if (captured.length > 0) {
          onDone(captured);
        } else {
          onCancel();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [captured, onCancel, onDone, stopStream]);

  const handleCapture = () => {
    if (cameraState !== 'ready' || capturing) return;
    if (captured.length >= maxRemaining) {
      setCaptureNotice(`Reached maximum of ${startingPageNumber + maxRemaining - 1} pages for this chapter.`);
      return;
    }

    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Camera capture canvas unavailable.');
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const payload = compressCanvasPhoto(canvas);
      const pageNum = startingPageNumber + captured.length;

      setCaptured((prev) => [...prev, payload]);
      setCaptureNotice(`Page ${pageNum} captured — ready for next`);
      setFlashActive(true);
      window.setTimeout(() => setFlashActive(false), 120);
    } catch (err) {
      setCaptureNotice(err instanceof Error ? err.message : 'Could not capture photo. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const handleDone = () => {
    stopStream();
    onDone(captured);
  };

  const handleClose = () => {
    stopStream();
    if (captured.length > 0) {
      onDone(captured);
    } else {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Continuous page camera"
    >
      {/* Top Bar */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 bg-slate-950/90 border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold tabular-nums">
            {captured.length === 0
              ? `Ready for Page ${startingPageNumber}`
              : `${captured.length} photo${captured.length === 1 ? '' : 's'} taken`}
          </div>
          {captureNotice && (
            <p className="text-xs text-emerald-400 truncate mt-0.5">{captureNotice}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            aria-label="Switch camera"
            title="Switch camera"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close camera"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Live Viewfinder Area */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-contain ${cameraState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        />

        {flashActive && (
          <div className="absolute inset-0 bg-white/75 pointer-events-none transition-opacity duration-100" />
        )}

        {cameraState === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-slate-300 px-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
            Starting camera...
          </div>
        )}

        {cameraState === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center max-w-sm mx-auto">
            <Camera className="w-9 h-9 text-slate-400 mb-3" />
            <p className="text-sm text-slate-200 leading-relaxed mb-5">
              {cameraError}
            </p>
            <button
              type="button"
              onClick={() => {
                stopStream();
                onCancel();
                onFallbackNativeCamera();
              }}
              className="min-h-[48px] px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              Use Phone Camera
            </button>
          </div>
        )}
      </div>

      {/* Bottom Thumbnail Strip & Shutter + Done Controls */}
      <div className="bg-slate-950/95 border-t border-white/10 px-4 pt-3 pb-5 shrink-0">
        {captured.length > 0 && (
          <div
            ref={stripRef}
            className="flex items-center gap-2 overflow-x-auto pb-3 mb-2"
          >
            {captured.map((photo, idx) => (
              <div
                key={`${idx}-${photo.previewUrl.slice(-16)}`}
                className="relative w-11 h-14 rounded-lg overflow-hidden border border-white/25 bg-slate-900 shrink-0"
              >
                <img
                  src={photo.previewUrl}
                  alt={`Captured page ${startingPageNumber + idx}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-[10px] font-semibold text-white text-center py-0.5 tabular-nums">
                  P{startingPageNumber + idx}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="max-w-md mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleClose}
            className="min-w-[84px] min-h-[48px] px-3 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            {captured.length === 0 ? 'Cancel' : 'Back'}
          </button>

          <button
            type="button"
            disabled={cameraState !== 'ready' || capturing || captured.length >= maxRemaining}
            onClick={handleCapture}
            aria-label="Capture page photo"
            className="w-[72px] h-[72px] rounded-full bg-white border-4 border-slate-400 active:scale-95 disabled:opacity-40 transition-transform flex items-center justify-center shrink-0"
          >
            <span className="w-12 h-12 rounded-full bg-white border border-slate-300" />
          </button>

          <button
            type="button"
            onClick={handleDone}
            className="min-w-[84px] min-h-[48px] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Check className="w-4 h-4 shrink-0" />
            Done{captured.length > 0 ? ` (${captured.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
