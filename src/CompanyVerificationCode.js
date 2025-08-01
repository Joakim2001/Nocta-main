import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

function CompanyVerificationCode() {
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        checkVerificationStatus(user);
      } else {
        navigate('/company-login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const checkVerificationStatus = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.verificationStatus === 'verified' || userData.verificationStatus === 'approved') {
          navigate('/company-events');
        }
      }
    } catch (error) {
      console.error('Error checking verification status:', error);
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      setLoading(false);
      return;
    }

    try {
      // Check if the verification code exists and is approved
      const verificationDoc = await getDoc(doc(db, 'company_verifications', user.uid));
      
      if (!verificationDoc.exists()) {
        setError('Verification request not found. Please request verification first.');
        setLoading(false);
        return;
      }

      const verificationData = verificationDoc.data();
      
      if (verificationData.status !== 'approved') {
        setError('Your verification request has not been approved yet.');
        setLoading(false);
        return;
      }

      if (verificationData.code !== verificationCode.toUpperCase()) {
        setError('Invalid verification code. Please check and try again.');
        setLoading(false);
        return;
      }

      // Update the company profile to verified
      await updateDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid), {
        verificationStatus: 'verified',
        verifiedAt: new Date().toISOString(),
        verificationCode: verificationCode.toUpperCase()
      });

      setSuccess(true);
      setTimeout(() => {
        navigate('/company-events');
      }, 2000);

    } catch (error) {
      console.error('Error verifying code:', error);
      setError('Failed to verify code: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
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
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto' }}>
          <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: 1 }}>Nocta</h1>
          <div style={{ 
            background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', 
            borderRadius: 16, 
            padding: 32, 
            textAlign: 'center',
            border: '2px solid rgba(255,255,255,0.2)',
            marginBottom: 24
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h3 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>
              Verification Successful!
            </h3>
            <p style={{ color: '#fff', fontSize: 16, margin: 0, opacity: 0.9 }}>
              Your company has been verified. Redirecting to your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

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
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: 1 }}>Nocta</h1>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: '0 0 20px 0' }}>Enter Verification Code</h2>
        
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <p style={{ color: '#fff', fontSize: 14, margin: '0 0 12px 0', textAlign: 'left' }}>
            <strong>Instructions:</strong>
          </p>
          <ul style={{ color: '#ccc', fontSize: 13, margin: 0, paddingLeft: 20, textAlign: 'left' }}>
            <li>Check your email for the verification code</li>
            <li>Enter the 6-character code below</li>
            <li>Click "Verify & Access Platform"</li>
          </ul>
        </div>

        <form onSubmit={handleVerificationSubmit} style={{ width: '100%', maxWidth: 340, margin: '0 auto' }}>
          <input
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
            placeholder="Enter verification code"
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: 18,
              textAlign: 'center',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              outline: 'none',
              transition: 'border-color 0.2s',
              marginBottom: 16
            }}
            maxLength={6}
          />
          
          {error && <div style={{ color: '#ffb3ff', fontSize: 14, marginBottom: 16, minHeight: 18 }}>{error}</div>}
          
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px 0',
              borderRadius: 32,
              background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
              color: 'white',
              fontWeight: 700,
              fontSize: 19,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 24px #3E29F055',
              transition: 'background 0.2s, box-shadow 0.2s',
              letterSpacing: 0.5,
              display: 'block',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Verifying...' : 'Verify & Access Platform'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CompanyVerificationCode; 