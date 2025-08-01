import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, onAuthStateChanged, getAuth } from 'firebase/auth';
import { db } from './firebase';
import { setDoc, doc, getDoc } from 'firebase/firestore';

function AuthPageCompany() {
  const [tab, setTab] = useState('signup');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Switch tab based on route
  React.useEffect(() => {
    if (location.pathname === '/company-login') setTab('login');
    else setTab('signup');
  }, [location.pathname]);

  // Prefill login fields if stored in localStorage (after signup)
  React.useEffect(() => {
    if (tab === 'login') {
      const storedEmail = localStorage.getItem('companySignupEmail');
      const storedPassword = localStorage.getItem('companySignupPassword');
      if (storedEmail) setEmail(storedEmail);
      if (storedPassword) setPassword(storedPassword);
    }
  }, [tab]);

  // Check for success message from verification setup
  React.useEffect(() => {
    const successParam = searchParams.get('success');
    console.log('🔍 AuthPageCompany: Checking for success parameter:', successParam);
    if (successParam === 'verification-sent') {
      console.log('✅ AuthPageCompany: Setting success message to true');
      setShowSuccessMessage(true);
      // Ensure we're on the login tab
      setTab('login');
      // Clear the URL parameter after a short delay to ensure state is set
      setTimeout(() => {
        navigate('/company-login', { replace: true });
      }, 100);
    }
  }, [searchParams, navigate]);

  // Debug success message state
  React.useEffect(() => {
    console.log('🔍 AuthPageCompany: Success message state changed to:', showSuccessMessage);
  }, [showSuccessMessage]);

  // Auth handlers
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Test Firebase Auth connection
    console.log('Testing Firebase Auth connection...');
    console.log('Auth object:', auth);
    console.log('Auth app:', auth.app);
    console.log('Auth config:', auth.app.options);

    if (tab === 'signup') {
      // Validate signup fields
      if (!email || !password || !confirmPassword || !confirmEmail) {
        setError('Please fill in all fields.');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }

      if (email !== confirmEmail) {
        setError('Email addresses do not match.');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        setLoading(false);
      return;
    }

      try {
        console.log('Attempting to create user with email:', email);
        console.log('Password length:', password.length);
        // Try to create the account
        console.log('About to call createUserWithEmailAndPassword...');
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('User created successfully:', user.uid);
        
        // Store user type in localStorage
        localStorage.setItem('userType', 'company');
        console.log('Initial signup successful, navigating to company setup...');
        console.log('User created with UID:', user.uid);
        console.log('User email:', user.email);
        
        // Wait for Firebase Auth state to be established using Promise
        console.log('Waiting for Firebase Auth state to be established...');
        await new Promise((resolve) => {
          const auth = getAuth();
          const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            if (authUser && authUser.uid === user.uid) {
              console.log('Auth state established for user:', authUser.uid);
              unsubscribe();
              resolve();
            }
          });
          
          // Timeout after 5 seconds
          setTimeout(() => {
            console.log('Auth state timeout, proceeding anyway...');
            unsubscribe();
            resolve();
          }, 5000);
        });
        
        // Navigate to company setup with user ID and email as parameters
        navigate(`/company-verification-setup?uid=${user.uid}&email=${encodeURIComponent(user.email)}`);
        console.log('Initial navigation called with UID and email parameters');
      } catch (err) {
        console.log('Caught error in signup:', err);
        console.log('Error type:', typeof err);
        console.log('Error keys:', Object.keys(err));
        
        if (err.code === 'auth/email-already-in-use') {
          // Check if the user exists in Firestore and clean up if needed
          try {
            const response = await fetch('https://us-central1-nocta-d1113.cloudfunctions.net/checkAndCleanupAccount', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email }),
            });

            const result = await response.json();

            if (response.ok && result.success && result.action === 'deleted') {
              // Firebase Auth account was deleted, now try signup again
              try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Store user type in localStorage
                localStorage.setItem('userType', 'company');
                console.log('User type stored, navigating to company setup...');
                console.log('User created with UID:', user.uid);
                console.log('User email:', user.email);
                
                // Wait for Firebase Auth state to be established using Promise
                console.log('Waiting for Firebase Auth state to be established...');
                await new Promise((resolve) => {
                  const auth = getAuth();
                  const unsubscribe = onAuthStateChanged(auth, (authUser) => {
                    if (authUser && authUser.uid === user.uid) {
                      console.log('Auth state established for user:', authUser.uid);
                      unsubscribe();
                      resolve();
                    }
                  });
                  
                  // Timeout after 5 seconds
                  setTimeout(() => {
                    console.log('Auth state timeout, proceeding anyway...');
                    unsubscribe();
                    resolve();
                  }, 5000);
                });
                
                // Navigate to company setup with user ID and email as parameters
                navigate(`/company-verification-setup?uid=${user.uid}&email=${encodeURIComponent(user.email)}`);
                console.log('Navigation called with UID and email parameters');
                return;
              } catch (retryErr) {
                setError(retryErr.message);
              }
            } else {
              // Account still exists in both Auth and Club_Bar_Festival_profiles collection
              setError('This email is already in use. Please log in instead.');
              setTab('login');
              navigate('/company-login');
            }
          } catch (cleanupErr) {
            console.error('Cleanup error:', cleanupErr);
            // If cleanup fails, show standard message
            setError('This email is already in use. Please log in instead.');
            setTab('login');
            navigate('/company-login');
          }
        } else {
          console.error('Signup error details:', {
            code: err.code,
            message: err.message,
            fullError: err
          });
          if (err.code === 'auth/invalid-email') {
            setError('Please enter a valid email address.');
          } else if (err.code === 'auth/weak-password') {
            setError('Password is too weak. Please choose a stronger password.');
          } else if (err.code === 'auth/operation-not-allowed') {
            setError('Email/password signup is not enabled. Please contact support.');
          } else if (err.code === 'auth/email-already-in-use') {
            setError('This email is already in use. Please log in instead.');
          } else {
            setError('Signup failed: ' + (err.message || 'Unknown error occurred'));
          }
        }
      } finally {
        setLoading(false);
      }
      } else {
      // Login flow
      if (!email || !password) {
        setError('Please fill in all fields.');
        setLoading(false);
        return;
      }

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Check if user exists in Firestore
        const companyDoc = await getDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid));
        
        if (!companyDoc.exists()) {
          await auth.signOut();
          setError('Account not found. Please sign up first.');
          setLoading(false);
          return;
        }
        
        const companyData = companyDoc.data();
        
        // Check if company is approved
        if (companyData.verificationStatus === 'rejected') {
          await auth.signOut();
          setError('Your company verification was rejected. Please contact support.');
          setLoading(false);
          return;
        }
        
        if (companyData.verificationStatus === 'pending') {
          await auth.signOut();
          setError('Your company verification is still pending. Please wait for approval.');
          setLoading(false);
          return;
        }
        
        // If company has verification code, require it for login
        if (companyData.verificationCode) {
          if (!verificationCode.trim()) {
            await auth.signOut();
            setError('Please enter your verification code');
            setLoading(false);
            return;
          }
          
          if (verificationCode.trim().toUpperCase() !== companyData.verificationCode) {
            await auth.signOut();
            setError('Invalid verification code');
            setLoading(false);
            return;
          }
        }
        
        // Clear credentials after successful login
        localStorage.removeItem('companySignupEmail');
        localStorage.removeItem('companySignupPassword');
        navigate('/company-events');
    } catch (err) {
        setError(err.message);
    } finally {
      setLoading(false);
      }
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
        const docRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const companyData = docSnap.data();
          
          // Check if company is approved
          if (companyData.verificationStatus === 'rejected') {
            await auth.signOut();
            setError('Your company verification was rejected. Please contact support.');
            setLoading(false);
            return;
          }
          
          if (companyData.verificationStatus === 'pending') {
            await auth.signOut();
            setError('Your company verification is still pending. Please wait for approval.');
            setLoading(false);
            return;
          }
          
          // If company has verification code, redirect to login page to enter it
          if (companyData.verificationCode) {
            await auth.signOut();
            setError('Please log in with your verification code using email/password.');
            setTab('login');
            navigate('/company-login');
            setLoading(false);
            return;
          }
          
      navigate('/company-events');
        } else {
          await setDoc(docRef, {
            email: user.email,
            fullname: user.displayName,
            createdAt: new Date(),
            provider: 'google'
          });
          navigate('/company-verification-setup');
        }
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
        const docRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const companyData = docSnap.data();
          
          // Check if company is approved
          if (companyData.verificationStatus === 'rejected') {
            await auth.signOut();
            setError('Your company verification was rejected. Please contact support.');
            setLoading(false);
            return;
          }
          
          if (companyData.verificationStatus === 'pending') {
            await auth.signOut();
            setError('Your company verification is still pending. Please wait for approval.');
            setLoading(false);
            return;
          }
          
          // If company has verification code, redirect to login page to enter it
          if (companyData.verificationCode) {
            await auth.signOut();
            setError('Please log in with your verification code using email/password.');
            setTab('login');
            navigate('/company-login');
            setLoading(false);
            return;
          }
          
          navigate('/company-events');
        } else {
          await setDoc(docRef, {
            email: user.email,
            fullname: user.displayName || 'Facebook User',
            createdAt: new Date(),
            provider: 'facebook'
          });
          navigate('/company-verification-setup');
        }
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
      
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: 1 }}>Nocta</h1>
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
            onClick={() => { setTab('signup'); navigate('/company-signup'); }}
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
            onClick={() => { setTab('login'); navigate('/company-login'); }}
          >
            Log in
          </button>
        </div>
        
        {/* Success Message */}
        {console.log('🎨 AuthPageCompany: Rendering success message state:', showSuccessMessage)}
        {showSuccessMessage && (
          <div style={{
            background: 'rgba(40, 167, 69, 0.1)',
            border: '1px solid rgba(40, 167, 69, 0.3)',
            borderRadius: 12,
            padding: '20px',
            margin: '20px 0',
            textAlign: 'center',
            maxWidth: 340,
            width: '100%'
          }}>
            <div style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: '#28a745',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <span style={{ fontSize: 24, color: 'white' }}>✓</span>
            </div>
            <h3 style={{ 
              color: '#fff', 
              fontSize: 18, 
              fontWeight: 600, 
              margin: '0 0 12px 0',
              textAlign: 'center'
            }}>
              Verification Request Sent Successfully!
            </h3>
            <p style={{ 
              color: '#ccc', 
              fontSize: 14, 
              margin: '0 0 12px 0',
              lineHeight: 1.5,
              textAlign: 'center'
            }}>
              It may take 1-3 days before verification is approved. If approved, you will receive an email with a verification code you need to use when logging in.
            </p>
            <button
              onClick={() => setShowSuccessMessage(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: 8,
                padding: '8px 16px',
                color: '#fff',
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340, margin: '32px auto 0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          {tab === 'signup' && email && (
            <input
              type="email"
              placeholder="Confirm email"
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
              value={confirmEmail}
              onChange={e => setConfirmEmail(e.target.value)}
              required
            />
          )}
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
          {tab === 'login' && (
            <input
              type="text"
              placeholder="Verification Code"
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
                textTransform: 'uppercase',
              }}
              value={verificationCode}
              onChange={e => setVerificationCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          )}
          {tab === 'signup' && password && (
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
            {tab === 'signup' ? 'Sign Up' : 'Log In'}
          </button>
          {/* Social login buttons - removed from both signup and login */}
          {false && (
            <div style={{ width: '80%', margin: '24px auto 0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button
                onClick={handleGoogle}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  borderRadius: 16,
                  padding: '12px 0',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'white',
                  fontWeight: 500,
                  fontSize: 18,
                  cursor: 'pointer',
                  transition: 'background 0.2s, border 0.2s',
                }}
                disabled={loading}
              >
                <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Arial' }}>G</span> Continue with Google
              </button>
              <button
                onClick={handleFacebook}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  border: '1.5px solid rgba(255,255,255,0.4)',
                  borderRadius: 16,
                  padding: '12px 0',
                  background: 'rgba(255,255,255,0.04)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: 18,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, border 0.2s',
                }}
                disabled={loading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                Continue with Facebook
              </button>

            </div>
          )}
        </form>
        {/* Terms and Privacy Policy - always show */}
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, textAlign: 'center', marginTop: 24, maxWidth: 280 }}>
          *By logging in, you agree to continue abiding by our
          <a href="#" style={{ color: '#b3e0ff', textDecoration: 'underline', margin: '0 4px' }}>Terms & Conditions</a>
          and acknowledge our
          <a href="#" style={{ color: '#b3e0ff', textDecoration: 'underline', margin: '0 4px' }}>Privacy Policy</a>.
        </div>
      </div>
    </div>
  );
}

export default AuthPageCompany; 