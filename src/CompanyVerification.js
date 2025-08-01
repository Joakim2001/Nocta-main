import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

function CompanyVerification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [companyData, setCompanyData] = useState(null);
  const [requestSent, setRequestSent] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadCompanyData();
  }, []);

  const loadCompanyData = async () => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        navigate('/company-login');
        return;
      }

      const companyDoc = await getDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid));
      if (!companyDoc.exists()) {
        navigate('/company-verification-setup');
        return;
      }

      const data = companyDoc.data();
      setCompanyData(data);

      // If already verified, redirect to dashboard
      if (data.verificationStatus === 'verified' || data.verificationStatus === 'approved') {
        navigate('/company-events');
      }

      // If verification code exists, they can log in
      if (data.verificationCode) {
        navigate('/company-login');
      }

      // Auto-send verification request if not already sent
      if (data.verificationStatus === 'pending' && !requestSent) {
        sendVerificationRequest(data);
      }
    } catch (err) {
      console.error('Error loading company data:', err);
      setError('Failed to load company data');
    }
  };

  const sendVerificationRequest = async (data) => {
    setLoading(true);
    setError('');

    try {
      // Send verification request to Firebase function
      const response = await fetch('https://us-central1-nocta-d1113.cloudfunctions.net/requestCompanyVerification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyData: {
            uid: data.uid,
            name: data.name,
            email: data.email,
            country: data.country,
            key: data.key,
            phone: data.phone,
            instagramUsername: data.instagramUsername,
            instagramScreenshotUrl: data.instagramScreenshotUrl,
            createdAt: data.createdAt
          }
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setRequestSent(true);
      } else {
        throw new Error(result.error || 'Failed to send verification request');
      }
    } catch (err) {
      setError('Failed to send verification request: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  if (!companyData) {
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
            width: 40, 
            height: 40, 
            border: '4px solid rgba(255,255,255,0.3)', 
            borderTop: '4px solid #fff', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px auto'
          }}></div>
          <p style={{ color: '#ccc', fontSize: 16 }}>Loading...</p>
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
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: 1 }}>Nocta</h1>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: 0, textAlign: 'center' }}>Verification Pending</h2>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)', 
          borderRadius: 16, 
          padding: 32, 
          textAlign: 'center',
          border: '2px solid rgba(255,255,255,0.2)',
          marginBottom: 24,
          width: '100%',
          maxWidth: 340
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
          <h3 style={{ color: '#fff', fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>
            Verification Request Sent!
          </h3>
          <p style={{ color: '#fff', fontSize: 16, margin: 0, opacity: 0.9 }}>
            We've sent your verification request to our admin team.
          </p>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 16, marginBottom: 24, width: '100%', maxWidth: 340 }}>
          <p style={{ color: '#fff', fontSize: 14, margin: '0 0 12px 0', textAlign: 'left' }}>
            <strong>What happens next:</strong>
          </p>
          <ul style={{ color: '#ccc', fontSize: 13, margin: 0, paddingLeft: 20, textAlign: 'left' }}>
            <li>Our admin team will review your company details</li>
            <li>They'll verify your Instagram profile screenshot</li>
            <li>Verification typically takes 1-3 business days</li>
            <li>You'll receive an email with the decision</li>
            <li>If approved, you'll get a verification code to log in</li>
          </ul>
        </div>

        {error && <div style={{ color: '#ffb3ff', fontSize: 14, marginBottom: 16, minHeight: 18 }}>{error}</div>}

        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%',
            maxWidth: 340,
            padding: '12px 0',
            borderRadius: 24,
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            fontWeight: 600,
            fontSize: 16,
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer',
            marginTop: 8,
          }}
        >
          Go to Homepage
        </button>
      </div>
    </div>
  );
}

export default CompanyVerification; 