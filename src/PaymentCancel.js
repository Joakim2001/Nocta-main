import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PaymentCancel() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      color: 'white',
      textAlign: 'center'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '400px',
        width: '100%'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: '#f44336',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '40px'
        }}>
          ✗
        </div>
        
        <h1 style={{ 
          fontSize: '28px', 
          marginBottom: '15px',
          fontWeight: 'bold'
        }}>
          Payment Cancelled
        </h1>
        
        <p style={{ 
          fontSize: '16px', 
          marginBottom: '30px',
          opacity: 0.9
        }}>
          Your payment was cancelled. No charges were made to your account.
        </p>
        
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '25px',
              padding: '15px 30px',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            Go Back
          </button>
          
          <button
            onClick={() => navigate('/home')}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '25px',
              padding: '15px 30px',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.3)'}
            onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.2)'}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
} 