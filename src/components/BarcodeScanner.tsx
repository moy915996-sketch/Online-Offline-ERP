import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose, isOpen }) => {
  const { t } = useTranslation();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setError(null);

    // Delay initialization slightly to ensure the container is rendered
    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          "reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ]
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            // Success
            onScan(decodedText);
            scanner.clear();
            onClose();
          },
          (errorMessage) => {
            // Error (usually just "no code found in frame", so we ignore it)
            // console.log(errorMessage);
          }
        );

        scannerRef.current = scanner;
        setIsLoading(false);
      } catch (err) {
        console.error("Scanner initialization failed", err);
        setError(t('cameraPermissionDenied') || 'Camera permission denied or not available');
        setIsLoading(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [isOpen, onScan, onClose, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
              <Camera className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('scanWithCamera')}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('pointCameraAtCode')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative aspect-square bg-slate-900 flex items-center justify-center">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 z-10 bg-slate-900">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-sm font-medium">{t('initializingCamera')}</span>
            </div>
          )}
          
          {error ? (
            <div className="p-8 text-center text-white">
              <p className="text-red-400 font-medium mb-4">{error}</p>
              <button 
                onClick={onClose} 
                className="px-4 py-2 border border-white rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('close')}
              </button>
            </div>
          ) : (
            <div id="reader" className="w-full h-full"></div>
          )}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('supportsQRAndBarcode')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
