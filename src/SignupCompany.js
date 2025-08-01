import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from './firebase';
import { setDoc, doc } from 'firebase/firestore';

function SignupCompany() {
  const [tab, setTab] = useState('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Switch tab
  const handleTab = (tab) => {
    setTab(tab);
    if (tab === 'login') navigate('/login');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (password !== confirmPassword) throw new Error('Passwords do not match');
      await createUserWithEmailAndPassword(auth, email, password);
      navigate('/company-verification-setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (user) {
        await setDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid), {
          email: user.email,
          fullname: user.displayName,
          createdAt: new Date(),
          provider: 'google'
        });
      navigate('/company-verification-setup');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFacebook = async () => {
    setError('');
    setLoading(true);
    try {
      // Try using Facebook's basic OAuth without any custom scopes
      const provider = new OAuthProvider('facebook.com');
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      if (user) {
        await setDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid), {
          email: user.email,
          fullname: user.displayName || 'Facebook User',
          createdAt: new Date(),
          provider: 'facebook'
        });
        navigate('/company-verification-setup');
      }
    } catch (err) {
      console.error('Facebook sign-in error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Facebook Sign-In is not enabled. Please contact support.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account with this email already exists. Please sign in with Google or email/password instead.');
      } else {
        setError('Facebook Sign-In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(180deg, #2d006e 0%, #7b1fa2 40%, #ff0080 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{
        width: 375,
        maxWidth: '95vw',
        minHeight: 700,
        borderRadius: 36,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(18,0,47,0.95)',
        position: 'relative',
        padding: '0 0 32px 0',
        zIndex: 1,
      }}>
        {/* Logo and Title */}
        <div style={{ marginBottom: 32, marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="72" height="72" viewBox="0 0 72 72" fill="none" style={{ transform: 'scaleX(-1)', filter: 'drop-shadow(0 0 24px #ff00cc88) drop-shadow(0 0 8px #a445ff)' }}>
            <path d="M54 36C54 49.2548 42.2548 61 29 61C25.8579 61 22.8232 60.4202 20 59.3431C32.2548 59.3431 43 48.5979 43 36C43 23.4021 32.2548 12.6569 20 12.6569C22.8232 11.5798 25.8579 11 29 11C42.2548 11 54 22.7452 54 36Z" fill="url(#paint0_linear)" />
            <defs>
              <linearGradient id="paint0_linear" x1="29" y1="11" x2="29" y2="61" gradientUnits="userSpaceOnUse">
                <stop stopColor="#a445ff" />
                <stop offset="1" stopColor="#ff0080" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid #a445ff55', width: '80%' }}>
          <button
            style={{
              flex: 1,
              fontSize: 18,
              fontWeight: 600,
              padding: '12px 0',
              background: 'none',
              border: 'none',
              color: tab === 'signup' ? '#fff' : '#a445ff',
              borderBottom: tab === 'signup' ? '3px solid #a445ff' : 'none',
              cursor: 'pointer',
              outline: 'none',
              transition: 'color 0.2s, border-bottom 0.2s',
            }}
            onClick={() => handleTab('signup')}
          >
            Sign up
          </button>
          <button
            style={{
              flex: 1,
              fontSize: 18,
              fontWeight: 600,
              padding: '12px 0',
              background: 'none',
              border: 'none',
              color: tab === 'login' ? '#fff' : '#a445ff',
              borderBottom: tab === 'login' ? '3px solid #a445ff' : 'none',
              cursor: 'pointer',
              outline: 'none',
              transition: 'color 0.2s, border-bottom 0.2s',
            }}
            onClick={() => handleTab('login')}
          >
            Log in
          </button>
        </div>
        {/* Signup Form */}
        <form onSubmit={handleSubmit} style={{ width: '80%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="email"
            placeholder="Email"
            style={{
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              marginBottom: 12,
              fontSize: 16,
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              outline: 'none',
              boxShadow: '0 2px 8px #a445ff22',
            }}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              style={{
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                marginBottom: 12,
                fontSize: 16,
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                outline: 'none',
                boxShadow: '0 2px 8px #a445ff22',
                width: '100%',
              }}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="button" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a445ff', cursor: 'pointer' }} onClick={() => setShowPassword(v => !v)}>
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          {password && (
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm password"
              style={{
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                marginBottom: 12,
                fontSize: 16,
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                outline: 'none',
                boxShadow: '0 2px 8px #a445ff22',
                width: '100%',
              }}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
            <button type="button" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a445ff', cursor: 'pointer' }} onClick={() => setShowConfirm(v => !v)}>
              {showConfirm ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
          )}
          {error && <div style={{ color: '#ffb3ff', fontSize: 14, marginBottom: 8 }}>{error}</div>}
          <button
            type="submit"
            style={{
              background: 'linear-gradient(90deg, #a445ff 0%, #ff0080 100%)',
              color: 'white',
              fontWeight: 700,
              fontSize: 20,
              border: '2px solid rgba(255,255,255,0.7)',
              borderRadius: 16,
              padding: '14px 0',
              marginTop: 8,
              boxShadow: '0 0 12px #ff00cc55, 0 2px 8px rgba(0,0,0,0.12)',
              filter: 'drop-shadow(0 0 8px #ff00cc55)',
              cursor: 'pointer',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
            disabled={loading}
          >
            Get Started
          </button>
          {/* Social login buttons */}
          <div style={{ width: '80%', margin: '24px auto 0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              onClick={handleGoogle}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                color: '#12002f',
                fontWeight: 700,
                fontSize: 16,
                borderRadius: 12,
                padding: '12px 0',
                border: 'none',
                boxShadow: '0 2px 8px #a445ff22',
                cursor: 'pointer',
                marginBottom: 8,
              }}
              disabled={loading}
            >
              Continue with Google
            </button>
            <button
              onClick={handleFacebook}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                color: '#12002f',
                fontWeight: 700,
                fontSize: 16,
                borderRadius: 12,
                padding: '12px 0',
                border: 'none',
                boxShadow: '0 2px 8px #a445ff22',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              disabled={loading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 8 }}>
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continue with Facebook
            </button>
            
          </div>
        </form>
        <div style={{ color: '#fff', fontSize: 13, marginTop: 24, opacity: 0.7, textAlign: 'center', width: '75%' }}>
          *By logging in, you agree to continue abiding by our <a href="#" style={{ color: '#ffb3ff', textDecoration: 'underline' }}>Terms & Conditions</a> and acknowledge our <a href="#" style={{ color: '#ffb3ff', textDecoration: 'underline' }}>Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}

export default SignupCompany; 