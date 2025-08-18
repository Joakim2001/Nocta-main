import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserTypeContext } from './UserTypeContext';

function UserTypeSelect() {
  const navigate = useNavigate();
  const { setUserType } = useContext(UserTypeContext);

  const handleSelect = (type) => {
    setUserType(type);
    localStorage.setItem('userType', type); // Redundant, but ensures persistence
    if (type === 'company') {
      navigate('/company-signup');
    } else {
      navigate('/signup');
    }
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
      {/* No card, just centered content */}
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 32px 0', letterSpacing: 1 }}>Nocta</h1>
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: '#ccc', fontSize: 16, margin: '8px 0 0 0', opacity: 0.85, textAlign: 'center' }}>
            Select your user type
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
          onClick={() => handleSelect('private')}
        >
          Private User
        </button>
        <button
          style={{
            display: 'block',
            fontSize: 18,
            color: '#FFFFFF',
            background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
            padding: '16px 60px',
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
          onClick={() => handleSelect('company')}
        >
          Company
        </button>
      </div>
    </div>
  );
}

export default UserTypeSelect; 