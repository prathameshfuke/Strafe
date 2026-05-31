import React, { useState, useEffect, useRef } from 'react';

export const GameImage = ({ src, alt, className, style }) => {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // If IntersectionObserver is not supported, fall back to eager loading
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect(); // stop watching once visible
        }
      },
      { rootMargin: '100px' } // start loading 100px before visible
    );

    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          className="w-full h-full object-cover"
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}
      {!loaded && (
        <div className="absolute inset-0 bg-[var(--bg-hover)] animate-pulse" style={{ minHeight: '100%' }} />
      )}
    </div>
  );
};

export default GameImage;
