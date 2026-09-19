import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    let scanner: any;
    const video = videoRef.current;
    if (!video) return;

    QrScanner.hasCamera().then((has) => {
      if (!has) {
        setMessage('No camera found');
        return;
      }
      scanner = new QrScanner(video, async (result: any) => {
        try {
          const data = result?.data || result;
          // Expect URL with token at the end
          const parts = data.split('/');
          const token = parts[parts.length - 1];
          setMessage('Scanning...');
          const res = await fetch('/api/attendance/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
          const json = await res.json();
          if (json.success) {
            setMessage(`✓ Attendance Confirmed\n${json.data.fullName} — ${json.data.company}`);
          } else {
            setMessage(`⚠ ${json.message}`);
          }
        } catch (err: any) {
          setMessage('Scan error');
        }
      });
      scanner.start();
      scannerRef.current = scanner;
    });

    return () => {
      scannerRef.current?.stop();
    };
  }, []);

  return (
    <div className="card">
      <video className="video-preview" ref={videoRef} />
      <div className="whitespace-pre-wrap mt-3 text-sm text-slate-700">{message}</div>
    </div>
  );
}
