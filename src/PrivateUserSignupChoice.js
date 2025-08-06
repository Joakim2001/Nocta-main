import React from 'react';
import { useNavigate } from 'react-router-dom';

function PrivateUserSignupChoice() {
  const navigate = useNavigate();

  const handleSignUpNow = () => {
    navigate('/signup');
  };

  const handleSignUpLater = () => {
    navigate('/home');
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(180deg, hsl(230, 45%, 9%), hsl(280, 50%, 20%))',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Back Button */}
      <button 
        onClick={() => navigate('/select-type')}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#00b3ff',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.2)';
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.1)';
          e.target.style.transform = 'scale(1)';
        }}
      >
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </button>
      {/* No card, just centered content */}
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 32px 0', letterSpacing: 1 }}>Nocta</h1>
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: '#ccc', fontSize: 16, margin: '8px 0 0 0', opacity: 0.85, textAlign: 'center' }}>
            Ready to get started?
          </p>
        </div>
        <button
          style={{
            display: 'block',
            fontSize: 18,
            color: '#FFFFFF',
            background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
            padding: '16px 48px',
            borderRadius: 32,
            textAlign: 'center',
            marginBottom: 24,
            textDecoration: 'none',
            fontWeight: 600,
            boxShadow: '0 4px 24px #3E29F055',
            maxWidth: 340,
            marginLeft: 'auto',
            marginRight: 'auto',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
          onClick={handleSignUpNow}
        >
          Sign up now
        </button>
        <button
          style={{
            display: 'block',
            fontSize: 18,
            color: '#FFFFFF',
            background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
            padding: '16px 48px',
            borderRadius: 32,
            textAlign: 'center',
            marginBottom: 16,
            textDecoration: 'none',
            fontWeight: 600,
            boxShadow: '0 4px 24px #3E29F055',
            maxWidth: 340,
            marginLeft: 'auto',
            marginRight: 'auto',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
          onClick={handleSignUpLater}
        >
          Sign up later
        </button>
      </div>
    </div>
  );
}

export default PrivateUserSignupChoice; 