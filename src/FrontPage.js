import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Ensure Playfair Display is loaded
const playfairFont = document.createElement('link');
playfairFont.rel = 'stylesheet';
playfairFont.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap';
document.head.appendChild(playfairFont);

const SPLASH_DURATION = 1500; // ms

const FrontPage = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [fadeSplash, setFadeSplash] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeSplash(true);
      setTimeout(() => setShowSplash(false), 600); // match fade duration
    }, SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, hsl(230, 45%, 9%), hsl(280, 50%, 20%))', position: 'relative' }}>
      {/* Splash Screen */}
      {showSplash && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(180deg, hsl(230, 45%, 9%), hsl(280, 50%, 20%))',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.6s',
            opacity: fadeSplash ? 0 : 1,
            pointerEvents: fadeSplash ? 'none' : 'auto',
          }}
        >
          {/* Clean Filled Crescent Moon SVG Logo (less fat version) */}
          <svg width="180" height="180" viewBox="0 0 100 100" fill="none" style={{ display: 'block', filter: 'drop-shadow(0 0 32px #ff3ecb99)' }}>
            <defs>
              <linearGradient id="crescentFill" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ff3ecb" />
                <stop offset="1" stopColor="#7b1fa2" />
              </linearGradient>
            </defs>
            <path
              d="M50,10
                 A40,40 0 1,0 90,50
                 A32,32 0 1,1 50,10
                 Z"
              fill="url(#crescentFill)"
            />
          </svg>
        </div>
      )}
      {/* Main Front Page Content */}
      {!showSplash && (
        <div className="text-center px-6 max-w-md mx-auto">
          {/* No moon image here */}
          <h1
            className="text-5xl font-playfair font-medium mb-8 tracking-wide"
            style={{ fontFamily: 'Playfair Display, serif', color: '#F2F2F2' }}
          >
            Nocta
          </h1>
          <div className="mb-12 space-y-2">
            <h2 className="text-xl font-medium" style={{ color: '#fff' }}>
              Welcome to Nocta
            </h2>
            <p className="text-muted-foreground" style={{ color: '#ccc' }}>
              Your nightlife companion
            </p>
          </div>
          <Link
            to="/select-type"
            style={{
              display: 'block',
              fontSize: 18,
              color: '#FFFFFF',
              background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
              padding: '16px 48px',
              borderRadius: 32,
              textAlign: 'center',
              marginTop: 40,
              textDecoration: 'none',
              fontWeight: 600,
              boxShadow: '0 4px 24px #3E29F055',
              maxWidth: 340,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            Get Started
          </Link>
        </div>
      )}
    </div>
  );
};

export default FrontPage; 