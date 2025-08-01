import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';

function SignupPrivate() {
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
      navigate('/profile-setup');
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
      await signInWithPopup(auth, provider);
      navigate('/profile-setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: 1 }}>Nocta</h1>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: 0, textAlign: 'center' }}>Welcome to Nocta</h2>
        <p style={{ color: '#ccc', fontSize: 16, margin: '8px 0 32px 0', opacity: 0.85, textAlign: 'center' }}>
          Your nightlife companion
        </p>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              fontSize: 16,
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              outline: 'none',
              boxShadow: '0 2px 8px #a445ff22',
              marginBottom: 0,
            }}
          />
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              fontSize: 16,
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              outline: 'none',
              boxShadow: '0 2px 8px #a445ff22',
              marginBottom: 0,
            }}
          />
          <input
            type={showConfirm ? 'text' : 'password'}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: 'none',
              fontSize: 16,
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              outline: 'none',
              boxShadow: '0 2px 8px #a445ff22',
              marginBottom: 0,
            }}
          />
          {error && <div style={{ color: '#ffb3ff', fontSize: 14, marginBottom: 8 }}>{error}</div>}
          <button
            type="submit"
            style={{
              width: '100%',
              padding: '16px 0',
              borderRadius: 32,
              background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
              color: 'white',
              fontWeight: 700,
              fontSize: 19,
              border: 'none',
              marginTop: 8,
              cursor: 'pointer',
              boxShadow: '0 4px 24px #3E29F055',
              transition: 'background 0.2s, box-shadow 0.2s',
              letterSpacing: 0.5,
              display: 'block',
            }}
            disabled={loading}
          >
            Sign Up
          </button>
        </form>
        <button
          onClick={handleGoogle}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 32,
            background: '#fff',
            color: '#12002f',
            fontWeight: 700,
            fontSize: 16,
            border: 'none',
            marginTop: 16,
            boxShadow: '0 2px 8px #a445ff22',
            cursor: 'pointer',
            display: 'block',
          }}
          disabled={loading}
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}

export default SignupPrivate; 