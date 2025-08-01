import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { auth } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc, setDoc, query, where, getDocs, collection } from 'firebase/firestore';
import EventsList from "./EventsList";
import EventsListWithNav from "./EventsListWithNav";
import EventDetailPage from "./EventDetailPage";
import BarsList from "./BarsList";
import FrontPage from './FrontPage';
import UserTypeSelect from './UserTypeSelect';
import { useUserType } from './UserTypeContext';
import CompanyVerificationSetup from './CompanyVerificationSetup';
import CompanyVerification from './CompanyVerification';
import CompanyVerificationCode from './CompanyVerificationCode';
import AdminApproveCompany from './AdminApproveCompany';
import EventsListCompany from './EventsListCompany';
import BottomNav from './BottomNav';
import BottomNavCompany from './BottomNavCompany';
import AuthPageCompany from './AuthPageCompany';
import CreateCompanyEvent from './CreateCompanyEvent';
import TicketConfiguration from './TicketConfiguration';
import EventDetailPageCompany from "./EventDetailPageCompany";
import ChatPagePrivate from "./ChatPagePrivate";
import ChatPageCompany from "./ChatPageCompany";
import ProfileSetup from './ProfileSetup';
import ProfilePage from './ProfilePage';
import FavoritesSetupNew from './FavoritesSetupNew';
import EventDetailPageDeletedCompany from "./EventDetailPageDeletedCompany";
import CompanyCreateSelect from './CompanyCreateSelect';
import MyTickets from './MyTickets';
import PaymentSuccess from './PaymentSuccess';
import PaymentCancel from './PaymentCancel';
import AdminDashboard from './AdminDashboard';
import UserTypeDetector from './UserTypeDetector';
import { autoArchiveAllOutdatedEvents } from './autoArchiveUtils';
import { debugSpecificEvent, debugAllEvents } from './debugAutoArchive';
import { cleanupDuplicates } from './autoArchiveUtils';

// Firebase config for Safari PWA handling
const firebaseConfig = {
  apiKey: "AIzaSyDH5VmKvzsnX8CemnNxKIvHrnMSE6o_JiY",
  authDomain: "nocta-d1113.firebaseapp.com",
  projectId: "nocta-d1113",
  storageBucket: "nocta_bucket.appspot.com",
  messagingSenderId: "292774630791",
  appId: "1:292774630791:web:fd99e5bb63f7fb8e196f22"
};

// Theme context for light/dark mode
const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

// Profile context for profileLoaded/profileComplete state
export const ProfileContext = createContext();
export const useProfile = () => useContext(ProfileContext);

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function AuthPage() {
  const [tab, setTab] = useState(() => {
    const path = window.location.pathname;
    if (path === '/login') return 'login';
    return 'signup';
  });
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [shouldPreventErrorClear, setShouldPreventErrorClear] = useState(false);
  const navigate = useNavigate();
  const { userType } = useUserType();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/login') setTab('login');
    else setTab('signup');
    
    // Check for any stored error messages
    const storedError = localStorage.getItem('loginError');
    if (storedError) {
      console.log('🔍 AuthPage: Retrieved error from localStorage:', storedError);
      setError(storedError);
      localStorage.removeItem('loginError');
      setShouldPreventErrorClear(true);
      // Don't clear error immediately - let it display
      return;
    }
    
    // Check if we should prevent error clearing
    const preventErrorClear = localStorage.getItem('preventErrorClear');
    if (preventErrorClear || shouldPreventErrorClear) {
      console.log('🔍 AuthPage: Error clearing prevented by flag');
      return;
    }
    
    // Additional check: if there's an error currently set, don't clear it
    if (error && error.length > 0) {
      console.log('🔍 AuthPage: Error currently set, preventing clear');
      return;
    }
    
    // Only clear error if not prevented and no stored error
    setError('');
  }, [location.pathname, shouldPreventErrorClear]);

  // New useEffect to watch for error changes in localStorage
  useEffect(() => {
    const checkForError = () => {
      const storedError = localStorage.getItem('loginError');
      if (storedError) {
        console.log('🔍 AuthPage: Found error in localStorage, setting it:', storedError);
        setError(storedError);
        setShouldPreventErrorClear(true);
        localStorage.removeItem('loginError');
        // Clear the prevent flag after 10 seconds (longer to keep error visible)
        setTimeout(() => {
          setShouldPreventErrorClear(false);
          localStorage.removeItem('preventErrorClear');
        }, 10000);
      }
    };

    // Check immediately
    checkForError();

    // Set up an interval to check for errors (faster for immediate response)
    const interval = setInterval(checkForError, 50);

    // Clean up interval after 10 seconds
    setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleGoogle = async () => {
    console.log('handleGoogle called'); // Debug log
    setError('');
    setLoading(true);
    
    // Clear any previous error from localStorage
    localStorage.removeItem('loginError');
    
    // Set a flag to prevent error clearing during sign-out
    localStorage.setItem('preventErrorClear', 'true');
    setShouldPreventErrorClear(true);
    
    // Retry logic for better reliability
    const maxRetries = 2;
    let retryCount = 0;
    
    const attemptGoogleSignIn = async () => {
      try {
        const provider = new GoogleAuthProvider();
        
        // Add custom parameters for better mobile experience
        provider.setCustomParameters({
          prompt: 'select_account'
        });
        
        // Detect if we're on mobile or in PWA mode
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isPWA = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isSafariPWA = isSafari && isPWA;
        
        console.log('🔍 AuthPage: Device detection - Mobile:', isMobile, 'PWA:', isPWA, 'Safari:', isSafari, 'SafariPWA:', isSafariPWA);
        
        // Safari PWA mode needs special handling
        if (isSafariPWA) {
          console.log('🔍 AuthPage: Safari PWA detected - using special handling');
          
          // For Safari PWA, try the redirect method first
          try {
            setError('Redirecting to Google... Please wait.');
            await signInWithRedirect(auth, provider);
            return; // The page will redirect
          } catch (redirectError) {
            console.log('🔍 AuthPage: Safari PWA redirect failed, showing fallback message:', redirectError);
            
            // If redirect fails, show a helpful message
            setError('Safari app mode detected. For the best experience, please open this website in Safari browser instead of the app, or try signing in with email/password.');
            setLoading(false);
            return;
          }
        } else if (isMobile || isPWA) {
          console.log('🔍 AuthPage: Using redirect-based sign-in for mobile/PWA');
          // Show a message to the user that they're being redirected
          setError('Redirecting to Google... Please wait.');
          await signInWithRedirect(auth, provider);
          // Don't set loading to false here - let the redirect happen
          return; // The page will redirect, so we don't need to continue
        } else {
          console.log('🔍 AuthPage: Using popup-based sign-in for desktop');
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          
          if (user) {
            console.log('🔍 AuthPage: Google user authenticated:', user.email);
            console.log('🔍 AuthPage: Current pathname:', location.pathname);
            
            // If we're on signup page, skip login validation and let signup continue
            if (location.pathname === '/signup') {
              console.log('🔍 AuthPage: On signup page, allowing signup to continue');
              
              // Set the new signup flag to prevent immediate redirect
              localStorage.setItem('isNewSignup', 'true');
              localStorage.setItem('wasInSignupFlow', 'true');
              
              // Navigate to appropriate setup page based on user type
              const currentUserType = localStorage.getItem('userType');
              if (currentUserType === 'company') {
                console.log('🔍 AuthPage: Navigating to company verification setup');
                navigate('/company-verification-setup');
              } else {
                console.log('🔍 AuthPage: Navigating to profile setup');
                navigate('/profile-setup');
              }
              
              setLoading(false);
              return;
            }
            
            // Check if email exists in profiles collection (private users)
            const profilesQuery = query(collection(db, 'profiles'), where('email', '==', user.email));
            const profilesSnapshot = await getDocs(profilesQuery);
            
            // Check if email exists in Club_Bar_Festival_profiles collection (companies)
            const companyQuery = query(collection(db, 'Club_Bar_Festival_profiles'), where('email', '==', user.email));
            const companySnapshot = await getDocs(companyQuery);
            
            if (profilesSnapshot.empty && companySnapshot.empty) {
              // Email doesn't exist in any collection - sign out and show error
              console.log('🔍 AuthPage: Email not found in any collection, signing out');
              await signOut(auth);
              setError('No account exists with this email. Please sign up first.');
              setLoading(false);
              return;
            }
            
            // Email exists, proceed with login
            console.log('🔍 AuthPage: Email found, proceeding with login');
            
            // Check if user exists in profiles collection (for private users)
            const profilesRef = doc(db, 'profiles', user.uid);
            const profilesSnap = await getDoc(profilesRef);
            
            if (profilesSnap.exists()) {
              console.log('🔍 AuthPage: User found in profiles, navigating to home');
              navigate('/home');
            } else {
              // Check if user exists in Club_Bar_Festival_profiles (for companies)
              const companyRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
              const companySnap = await getDoc(companyRef);
              
              if (companySnap.exists()) {
                console.log('🔍 AuthPage: User found in company profiles, navigating to home');
                navigate('/home');
              } else {
                // User exists in one collection but not the other - this shouldn't happen
                console.log('🔍 AuthPage: User exists in email query but not in UID query - signing out');
                const errorMessage = 'No account exists with this email. Please sign up first.';
                console.log('🔍 AuthPage: Setting error message:', errorMessage);
                localStorage.setItem('loginError', errorMessage);
                setLoading(false);
                await signOut(auth);
                // Add a small delay to ensure the error is set after re-render
                setTimeout(() => {
                  const storedError = localStorage.getItem('loginError');
                  if (storedError) {
                    console.log('🔍 AuthPage: Setting error after sign-out:', storedError);
                    setError(storedError);
                    localStorage.removeItem('loginError');
                  }
                }, 100);
                return;
              }
            }
          }
        }
      } catch (error) {
        console.error('🔍 AuthPage: Google sign-in error:', error);
        
        // Retry logic for certain errors
        if (retryCount < maxRetries && (
          error.code === 'auth/popup-closed-by-user' ||
          error.code === 'auth/cancelled-popup-request' ||
          error.code === 'auth/popup-blocked' ||
          error.code === 'auth/network-request-failed'
        )) {
          retryCount++;
          console.log(`🔍 AuthPage: Retrying Google sign-in (attempt ${retryCount}/${maxRetries})`);
          setError(`Retrying... (${retryCount}/${maxRetries})`);
          
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          return attemptGoogleSignIn();
        }
        
        // Handle specific error cases
        if (error.code === 'auth/account-exists-with-different-credential') {
          setError('An account with this email already exists. Please sign in with a different method.');
        } else if (error.code === 'auth/popup-blocked') {
          setError('Pop-up was blocked. Please allow pop-ups for this site and try again.');
        } else if (error.code === 'auth/network-request-failed') {
          setError('Network error. Please check your connection and try again.');
        } else {
          setError('Google sign-in failed. Please try again.');
        }
        
        setLoading(false);
      }
    };
    
    await attemptGoogleSignIn();
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
        console.log('🔍 AuthPage: Facebook user authenticated:', user.email);
        console.log('🔍 AuthPage: Current pathname:', location.pathname);
        
        // If we're on signup page, skip login validation and let signup continue
        if (location.pathname === '/signup') {
          console.log('🔍 AuthPage: On signup page, allowing signup to continue');
          
          // Set the new signup flag to prevent immediate redirect
          localStorage.setItem('isNewSignup', 'true');
          localStorage.setItem('wasInSignupFlow', 'true');
          
          // Navigate to appropriate setup page based on user type
          const currentUserType = localStorage.getItem('userType');
          if (currentUserType === 'company') {
            console.log('🔍 AuthPage: Navigating to company verification setup');
            navigate('/company-verification-setup');
          } else {
            console.log('🔍 AuthPage: Navigating to profile setup');
            navigate('/profile-setup');
          }
          
          setLoading(false);
          return;
        }
        
        // Check if email exists in profiles collection (private users)
        const profilesQuery = query(collection(db, 'profiles'), where('email', '==', user.email));
        const profilesSnapshot = await getDocs(profilesQuery);
        
        // Check if email exists in Club_Bar_Festival_profiles collection (companies)
        const companyQuery = query(collection(db, 'Club_Bar_Festival_profiles'), where('email', '==', user.email));
        const companySnapshot = await getDocs(companyQuery);
        
        if (profilesSnapshot.empty && companySnapshot.empty) {
          // Email doesn't exist in any collection - sign out and show error
          console.log('🔍 AuthPage: Email not found in any collection, signing out');
          await signOut(auth);
          setError('No account exists with this email. Please sign up first.');
          setLoading(false);
          return;
        }
        
        // Email exists, proceed with login
        console.log('🔍 AuthPage: Email found, proceeding with login');
        
        // Check if user exists in profiles collection (for private users)
        const profilesRef = doc(db, 'profiles', user.uid);
        const profilesSnap = await getDoc(profilesRef);
          
        if (profilesSnap.exists()) {
          console.log('🔍 AuthPage: User found in profiles, navigating to home');
          navigate('/home');
        } else {
          // Check if user exists in Club_Bar_Festival_profiles (for companies)
          const companyRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
          const companySnap = await getDoc(companyRef);
          
          if (companySnap.exists()) {
            console.log('🔍 AuthPage: User found in company profiles, navigating to home');
              navigate('/home');
          } else {
            // User exists in one collection but not the other - this shouldn't happen
            console.log('🔍 AuthPage: User exists in email query but not in UID query - signing out');
            const errorMessage = 'No account exists with this email. Please sign up first.';
            console.log('🔍 AuthPage: Setting error message:', errorMessage);
            localStorage.setItem('loginError', errorMessage);
            setLoading(false);
            await signOut(auth);
            // Add a small delay to ensure the error is set after re-render
            setTimeout(() => {
              const storedError = localStorage.getItem('loginError');
              if (storedError) {
                console.log('🔍 AuthPage: Setting error after sign-out:', storedError);
                setError(storedError);
                localStorage.removeItem('loginError');
              }
            }, 100);
            return;
          }
          }
      }
    } catch (err) {
      console.error('Facebook sign-in error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Facebook Sign-In is not enabled. Please contact support.');
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account with this email already exists. Please sign in with a different method.');
      } else {
        setError('Facebook Sign-In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    console.log('🔍 AuthPage: handleSubmit called, tab:', tab, 'userType:', userType);
    console.log('🔍 AuthPage: localStorage userType:', localStorage.getItem('userType'));
    
    try {
      if (tab === 'signup') {
        console.log('🔍 AuthPage: Starting signup process');
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        
        // Set flag BEFORE creating the user to prevent immediate signout
        if (userType !== 'company') {
          localStorage.setItem('isNewSignup', 'true');
          localStorage.setItem('wasInSignupFlow', 'true');
          console.log('🔍 AuthPage: Setting isNewSignup and wasInSignupFlow flags BEFORE user creation');
        }
        
        console.log('🔍 AuthPage: Creating user with email:', email);
        await createUserWithEmailAndPassword(auth, email, password);
        console.log('🔍 AuthPage: User created successfully');
        
        if (userType === 'company') {
          console.log('🔍 AuthPage: Navigating to company verification');
          navigate('/company-verification-setup');
        } else {
          console.log('🔍 AuthPage: Navigating to profile-setup');
          navigate('/profile-setup');
        }
      } else {
        // For login, first check if the email exists in any collection
        console.log('🔍 AuthPage: Checking if email exists before login attempt');
        
        // Check in profiles collection (private users)
        const profilesQuery = query(collection(db, 'profiles'), where('email', '==', email));
        const profilesSnapshot = await getDocs(profilesQuery);
        
        // Check in Club_Bar_Festival_profiles collection (companies)
        const companyQuery = query(collection(db, 'Club_Bar_Festival_profiles'), where('email', '==', email));
        const companySnapshot = await getDocs(companyQuery);
        
        if (profilesSnapshot.empty && companySnapshot.empty) {
          // Email doesn't exist in any collection
          setError('No account exists with this email. Please sign up first.');
          setLoading(false);
          return;
        }
        
        // Email exists, proceed with login
        await signInWithEmailAndPassword(auth, email, password);
        const user = auth.currentUser;
        if (user) {
            let collectionName = userType === 'company' ? 'Club_Bar_Festival_profiles' : 'profiles';
            const docRef = doc(db, collectionName, user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                navigate(userType === 'company' ? '/company-events' : '/home');
            } else {
                navigate(userType === 'company' ? '/company-verification-setup' : '/profile-setup');
            }
        }
      }
    } catch (err) {
      console.error('🔍 AuthPage: Error during signup/login:', err);
      
      // Handle specific Firebase auth errors
      if (err.code === 'auth/user-not-found') {
        setError('No account exists with this email. Please sign up first.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address. Please enter a valid email.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else {
      setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle authenticated user after Safari PWA sign-in
  const handleAuthenticatedUser = async (user) => {
    console.log('🔍 AuthPage: Handling authenticated user:', user.email);
    
    // If we're on signup page, skip login validation and let signup continue
    if (location.pathname === '/signup') {
      console.log('🔍 AuthPage: On signup page, allowing signup to continue');
      
      // Set the new signup flag to prevent immediate redirect
      localStorage.setItem('isNewSignup', 'true');
      localStorage.setItem('wasInSignupFlow', 'true');
      
      // Navigate to appropriate setup page based on user type
      const currentUserType = localStorage.getItem('userType');
      if (currentUserType === 'company') {
        console.log('🔍 AuthPage: Navigating to company verification setup');
        navigate('/company-verification-setup');
      } else {
        console.log('🔍 AuthPage: Navigating to profile setup');
        navigate('/profile-setup');
      }
      
      setLoading(false);
      return;
    }
    
    // Check if email exists in profiles collection (private users)
    const profilesQuery = query(collection(db, 'profiles'), where('email', '==', user.email));
    const profilesSnapshot = await getDocs(profilesQuery);
    
    // Check if email exists in Club_Bar_Festival_profiles collection (companies)
    const companyQuery = query(collection(db, 'Club_Bar_Festival_profiles'), where('email', '==', user.email));
    const companySnapshot = await getDocs(companyQuery);
    
    if (profilesSnapshot.empty && companySnapshot.empty) {
      // Email doesn't exist in any collection - sign out and show error
      console.log('🔍 AuthPage: Email not found in any collection, signing out');
      await signOut(auth);
      setError('No account exists with this email. Please sign up first.');
      setLoading(false);
      return;
    }
    
    // Email exists, proceed with login
    console.log('🔍 AuthPage: Email found, proceeding with login');
    
    // Check if user exists in profiles collection (for private users)
    const profilesRef = doc(db, 'profiles', user.uid);
    const profilesSnap = await getDoc(profilesRef);
    
    if (profilesSnap.exists()) {
      console.log('🔍 AuthPage: User found in profiles, navigating to home');
      navigate('/home');
    } else {
      // Check if user exists in Club_Bar_Festival_profiles (for companies)
      const companyRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
      const companySnap = await getDoc(companyRef);
      
      if (companySnap.exists()) {
        console.log('🔍 AuthPage: User found in company profiles, navigating to home');
        navigate('/home');
      } else {
        // User exists in one collection but not the other - this shouldn't happen
        console.log('🔍 AuthPage: User exists in email query but not in UID query - signing out');
        await signOut(auth);
        setError('No account exists with this email. Please sign up first.');
        setLoading(false);
      }
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
      padding: '20px',
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
      
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 360, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 24px 0', letterSpacing: 1 }}>Nocta</h1>
        <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid #a445ff55', width: '100%' }}>
            <button onClick={() => { setTab('signup'); navigate('/signup'); }} style={{ flex: 1, fontSize: 18, fontWeight: 600, padding: '12px 0', background: 'none', border: 'none', color: tab === 'signup' ? '#fff' : '#a445ff', borderBottom: tab === 'signup' ? '3px solid #a445ff' : 'none', cursor: 'pointer', outline: 'none', transition: 'color 0.2s, border-bottom 0.2s' }}>Sign up</button>
            <button onClick={() => { setTab('login'); navigate('/login'); }} style={{ flex: 1, fontSize: 18, fontWeight: 600, padding: '12px 0', background: 'none', border: 'none', color: tab === 'login' ? '#fff' : '#a445ff', borderBottom: tab === 'login' ? '3px solid #a445ff' : 'none', cursor: 'pointer', outline: 'none', transition: 'color 0.2s, border-bottom 0.2s' }}>Log in</button>
        </div>
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', fontSize: 16, background: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />
            {tab === 'signup' && email && <input type="email" placeholder="Confirm Email" value={confirmEmail} onChange={e => setConfirmEmail(e.target.value)} required style={{ padding: '14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', fontSize: 16, background: 'rgba(255,255,255,0.1)', color: 'white', outline: 'none' }} />}
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="Password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                style={{ 
                  padding: '14px', 
                  borderRadius: 12, 
                  border: '1px solid rgba(255,255,255,0.2)', 
                  fontSize: 16, 
                  background: 'rgba(255,255,255,0.1)', 
                  color: 'white', 
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }} 
              />
              <button 
                type="button" 
                style={{ 
                  position: 'absolute', 
                  right: 12, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'none', 
                  border: 'none', 
                  color: '#a445ff', 
                  cursor: 'pointer' 
                }} 
                onClick={() => setShowPassword(v => !v)}
              >
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
            {tab === 'signup' && password && (
              <div style={{ position: 'relative' }}>
                <input 
                  type={showConfirm ? 'text' : 'password'} 
                  placeholder="Confirm Password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  required 
                  style={{ 
                    padding: '14px', 
                    borderRadius: 12, 
                    border: '1px solid rgba(255,255,255,0.2)', 
                    fontSize: 16, 
                    background: 'rgba(255,255,255,0.1)', 
                    color: 'white', 
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }} 
                />
                <button 
                  type="button" 
                  style={{ 
                    position: 'absolute', 
                    right: 12, 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    background: 'none', 
                    border: 'none', 
                    color: '#a445ff', 
                    cursor: 'pointer' 
                  }} 
                  onClick={() => setShowConfirm(v => !v)}
                >
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
            <button type="submit" disabled={loading} style={{ padding: '16px 0', borderRadius: 32, background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)', color: 'white', fontWeight: 700, fontSize: 19, border: 'none', marginTop: 8, boxShadow: '0 4px 24px #3E29F055' }}>
                {loading ? 'Processing...' : (tab === 'signup' ? 'Sign Up' : 'Log In')}
          </button>
          {error && <p style={{ color: '#ff4444', fontSize: 14, margin: '8px 0 0 0', textAlign: 'center', fontWeight: 500 }}>{error}</p>}
          {console.log('🔍 AuthPage: Error state:', error, 'Error length:', error.length, 'Error type:', typeof error)}
        </form>

        <button onClick={handleGoogle} disabled={loading || refreshing} style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: 16, marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.19,4.73C14.03,4.73 15.6,5.33 16.73,6.36L19.05,4.04C17.22,2.37 14.82,1.5 12.19,1.5C7.22,1.5 3.31,5.38 3.31,12C3.31,18.62 7.22,22.5 12.19,22.5C17.5,22.5 21.5,18.42 21.5,12.33C21.5,11.76 21.45,11.43 21.35,11.1Z"></path></svg>
          {refreshing ? 'Refreshing...' : loading ? 'Processing...' : 'Continue with Google'}
        </button>
        {loading && (
          <div style={{ 
            fontSize: 12, 
            color: '#ef4444', 
            textAlign: 'center', 
            marginTop: 8,
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 6,
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            ⚠️ If you cancel the Google sign-in, page refresh may take up to 10 seconds
          </div>
        )}
        
        <button onClick={handleFacebook} disabled={loading} style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, fontSize: 16, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: loading ? 'not-allowed' : 'pointer' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Continue with Facebook
        </button>

        <div style={{ marginTop: 24, color: '#ccc', fontSize: 15 }}>
          {tab === 'login' ? (
            <>Don’t have an account? <span style={{ color: '#F941F9', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setTab('signup'); navigate('/signup'); }}>Sign Up</span></>
          ) : (
            <>Already have an account? <span style={{ color: '#F941F9', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setTab('login'); navigate('/login'); }}>Log In</span></>
          )}
        </div>
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


function Home() {
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#0f172a' }}>
      <div style={{ width: '100vw', background: '#0f172a', padding: '22px 0 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #334155', margin: 0, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '448px', padding: '0 18px' }}>
          <span style={{ display: 'flex', alignItems: 'center', background: '#2a0845', color: '#fff', fontWeight: 700, fontSize: 18, borderRadius: 24, padding: '8px 22px', boxShadow: '0 2px 12px #0004', letterSpacing: 0.5, border: '2px solid #fff', textShadow: '0 2px 8px #3E29F099' }}>
            <svg style={{ width: 18, height: 18, color: '#b3e0ff', marginRight: 8 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            København
            <svg style={{ width: 18, height: 18, color: '#b3e0ff', marginLeft: 6 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={{ background: '#2a0845', border: '2px solid #fff', color: '#ffffff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px #0004' }}>
              <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
            </button>
            <button style={{ background: '#2a0845', border: '2px solid #fff', color: '#ffffff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px #0004' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            </button>
          </div>
        </div>
      </div>
      <div style={{ width: '100vw', background: '#3b1a5c', minHeight: '90vh' }}>
        <div style={{ maxWidth: 448, margin: '0 auto' }}>
            <div style={{ padding: '18px 0 80px 0', flex: 1, overflowY: 'auto' }}>
          <EventsList />
      </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(localStorage.getItem('userType'));
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatPageRef = useRef();
  const location = useLocation();
  const navigate = useNavigate();

  // TEMPORARILY DISABLED: Global auto-archive trigger - runs once when app starts
  // The auto-archiving was too aggressive and moving current events
  // useEffect(() => {
  //   const triggerGlobalAutoArchive = async () => {
  //     try {
  //       console.log('🔄 App.js: Triggering global auto-archive on app start...');
  //       const archivedCount = await autoArchiveAllOutdatedEvents();
  //       if (archivedCount > 0) {
  //         console.log('✅ App.js: Global auto-archive completed, archived', archivedCount, 'events');
  //       } else {
  //         console.log('✅ App.js: Global auto-archive completed, no events to archive');
  //       }
  //     } catch (error) {
  //       console.error('❌ App.js: Error in global auto-archive:', error);
  //     }
  //   };

  //   // Run auto-archive once when app starts
  //   triggerGlobalAutoArchive();
    
  //   // Add debug functions to global scope for testing
  //   window.debugAutoArchive = {
  //     debugSpecificEvent: (eventId) => debugSpecificEvent(eventId),
  //     debugAllEvents: () => debugAllEvents(),
  //     autoArchiveAll: () => autoArchiveAllOutdatedEvents(),
  //     cleanupDuplicates: () => cleanupDuplicates()
  //   };
    
  //   console.log('🔧 Debug: Auto-archive debug functions added to window.debugAutoArchive');
  // }, []);

  // Handle redirect results from Google Sign-In
  useEffect(() => {
    const handleRedirectResult = async () => {
      console.log('🔍 App.js: Checking for redirect result...');
      try {
        const result = await getRedirectResult(auth);
        console.log('🔍 App.js: Redirect result:', result ? 'Found' : 'None');
        
        if (result) {
          console.log('🔍 App.js: Redirect result received:', result.user.email);
          
          // Clear any loading state that might be stuck
          localStorage.removeItem('googleSignInLoading');
          
          // Check if we're on signup page
          if (location.pathname === '/signup') {
            console.log('🔍 App.js: On signup page, allowing signup to continue');
            localStorage.setItem('isNewSignup', 'true');
            localStorage.setItem('wasInSignupFlow', 'true');
            
            // Navigate to appropriate setup page based on user type
            const currentUserType = localStorage.getItem('userType');
            if (currentUserType === 'company') {
              navigate('/company-verification-setup');
            } else {
              navigate('/profile-setup');
            }
            return;
          }
          
          // For login flow, check if user exists
          const user = result.user;
          
          // Check if email exists in profiles collection (private users)
          const profilesQuery = query(collection(db, 'profiles'), where('email', '==', user.email));
          const profilesSnapshot = await getDocs(profilesQuery);
          
          // Check if email exists in Club_Bar_Festival_profiles collection (companies)
          const companyQuery = query(collection(db, 'Club_Bar_Festival_profiles'), where('email', '==', user.email));
          const companySnapshot = await getDocs(companyQuery);
          
          if (profilesSnapshot.empty && companySnapshot.empty) {
            // Email doesn't exist in any collection - sign out and show error
            console.log('🔍 App.js: Email not found in any collection, signing out');
            await signOut(auth);
            // Store error in localStorage to show on next render
            localStorage.setItem('loginError', 'No account exists with this email. Please sign up first.');
            return;
          }
          
          // Email exists, proceed with login
          console.log('🔍 App.js: Email found, proceeding with login');
          
          // Check if user exists in profiles collection (for private users)
          const profilesRef = doc(db, 'profiles', user.uid);
          const profilesSnap = await getDoc(profilesRef);
          
          if (profilesSnap.exists()) {
            console.log('🔍 App.js: User found in profiles, navigating to home');
            navigate('/home');
          } else {
            // Check if user exists in Club_Bar_Festival_profiles (for companies)
            const companyRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
            const companySnap = await getDoc(companyRef);
            
            if (companySnap.exists()) {
              console.log('🔍 App.js: User found in company profiles, navigating to home');
              navigate('/home');
            } else {
              // User exists in one collection but not the other - this shouldn't happen
              console.log('🔍 App.js: User exists in email query but not in UID query - signing out');
              await signOut(auth);
              localStorage.setItem('loginError', 'No account exists with this email. Please sign up first.');
            }
          }
        } else {
          console.log('🔍 App.js: No redirect result found');
        }
      } catch (error) {
        console.error('🔍 App.js: Error handling redirect result:', error);
        // Handle specific error cases
        if (error.code === 'auth/account-exists-with-different-credential') {
          localStorage.setItem('loginError', 'An account with this email already exists. Please sign in with a different method.');
        } else {
          localStorage.setItem('loginError', 'Google sign-in failed. Please try again.');
        }
      }
    };

    // Run immediately
    handleRedirectResult();
    
    // Also set up a small delay to catch any late redirects
    const timeoutId = setTimeout(() => {
      console.log('🔍 App.js: Running delayed redirect result check...');
      handleRedirectResult();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [location.pathname, navigate]);

  useEffect(() => {
    console.log('🔍 App.js: useEffect triggered, location:', location.pathname);
    const unsub = onAuthStateChanged(auth, async (user) => {
      console.log('🔍 App.js: Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      console.log('🔍 App.js: Current location:', location.pathname);
      console.log('🔍 App.js: localStorage isNewSignup:', localStorage.getItem('isNewSignup'));
      
      setCheckingProfile(true);
      if (user) {
          let type = userType || localStorage.getItem('userType');
          let collectionName = type === 'company' ? 'Club_Bar_Festival_profiles' : 'profiles';
          const docRef = doc(db, collectionName, user.uid);
        try {
          const docSnap = await getDoc(docRef);
          console.log('🔍 App.js: Firestore doc exists:', docSnap.exists());
          if (docSnap.exists()) {
            const userData = docSnap.data();
            
            // For companies, check verification status
            if (type === 'company') {
              if (userData.verificationStatus === 'rejected') {
                await auth.signOut();
                setProfileLoaded(false);
                setProfileComplete(false);
                setCheckingProfile(false);
                return;
              }
              
              if (userData.verificationStatus === 'pending') {
                await auth.signOut();
                setProfileLoaded(false);
                setProfileComplete(false);
                setCheckingProfile(false);
                return;
              }
            }
            
            // For private users, check if profile is complete (has all required fields)
            if (type !== 'company') {
              const requiredFields = ['firstName', 'lastName', 'gender', 'dob', 'country', 'phone'];
              const hasAllRequiredFields = requiredFields.every(field => userData[field]);
              
              console.log('🔍 App.js: Profile completeness check:', {
                hasAllRequiredFields,
                missingFields: requiredFields.filter(field => !userData[field]),
                userData: Object.keys(userData)
              });
              
              if (!hasAllRequiredFields) {
                console.log('🔍 App.js: Profile incomplete, redirecting to profile setup');
                setProfileLoaded(true);
                setProfileComplete(false);
                setCheckingProfile(false);
                
                // Redirect to profile setup if not already there
                if (location.pathname !== '/profile-setup' && location.pathname !== '/favorites-setup') {
                  window.location.href = '/profile-setup';
                }
                return;
              }
            }
            
            setProfileLoaded(true);
            setProfileComplete(true);
          } else {
            // User doesn't exist in Firestore - but don't sign them out if they're on profile setup
            const isNewSignupFlag = localStorage.getItem('isNewSignup') === 'true';
            console.log('🔍 App.js: User not in Firestore, current path:', location.pathname, 'isNewSignup:', isNewSignupFlag);
            
            // Always allow users on profile-setup and favorites-setup pages, regardless of flag
            if (location.pathname === '/profile-setup') {
              console.log('🔍 App.js: Allowing user to stay on profile setup (path check)');
              setProfileLoaded(true);
              setProfileComplete(false);
            } else if (location.pathname === '/favorites-setup') {
              console.log('🔍 App.js: Allowing user to stay on favorites setup (path check)');
              setProfileLoaded(true);
              setProfileComplete(false);
            } else if (isNewSignupFlag) {
              console.log('🔍 App.js: Allowing user to stay (new signup flag)');
            setProfileLoaded(true);
            setProfileComplete(false);
            } else {
              // Sign them out for other pages
              console.log('🔍 App.js: Signing out user - not on profile/favorites setup and no new signup flag');
              await auth.signOut();
              setProfileLoaded(false);
              setProfileComplete(false);
            }
          }
        } catch (err) {
          setProfileError('Failed to load profile.');
          await auth.signOut();
          setProfileLoaded(false);
          setProfileComplete(false);
        }
      } else {
        // Check if user was recently in signup flow and allow them to continue
        const isNewSignupFlag = localStorage.getItem('isNewSignup') === 'true';
        const wasInSignupFlow = localStorage.getItem('wasInSignupFlow') === 'true';
        
        if ((isNewSignupFlag || wasInSignupFlow) && 
            (location.pathname === '/profile-setup' || location.pathname === '/favorites-setup')) {
          console.log('🔍 App.js: User signed out but allowing to continue in signup flow');
          setProfileLoaded(true);
          setProfileComplete(false);
      } else {
        setProfileLoaded(false);
        setProfileComplete(false);
        }
      }
      setCheckingProfile(false);
    });
    return () => unsub();
  }, [userType, setProfileLoaded, setProfileComplete, location.pathname]);

  const hideNavRoutes = ['/', '/login', '/signup', '/profile-setup', '/favorites-setup', '/select-type', '/company-setup', '/company-setup-final', '/company-verification-setup', '/company-verification', '/verification-pending', '/company-login', '/company-signup'];
  const shouldShowBottomNav = !hideNavRoutes.includes(location.pathname) && !location.pathname.startsWith('/company-event/') && !location.pathname.startsWith('/company-deleted-event/') && !location.pathname.startsWith('/event/');

  if (checkingProfile) {
    return <div className="flex justify-center items-center min-h-screen text-white">Loading profile...</div>;
  }

  return (
    <ThemeProvider>
        <UserTypeDetector />
        {profileError && <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-center py-2 z-50">{profileError}</div>}
        
            <Routes>
              <Route path="/" element={<FrontPage />} />
              <Route path="/select-type" element={<UserTypeSelect />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/signup" element={<AuthPage />} />
              <Route path="/company-signup" element={<AuthPageCompany />} />
              <Route path="/company-login" element={<AuthPageCompany />} />
          <Route path="/company-create-event" element={<CompanyCreateSelect />} />
          <Route path="/company-create-event/new" element={<CreateCompanyEvent />} />
        <Route path="/ticket-configuration" element={<TicketConfiguration />} />
              <Route path="/profile-setup" element={<ProfileSetup />} />
              <Route path="/favorites-setup" element={<FavoritesSetupNew />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/company-setup" element={<CompanyVerificationSetup />} />
        <Route path="/company-setup-final" element={<CompanyVerificationSetup />} />
        <Route path="/company-verification-setup" element={<CompanyVerificationSetup />} />
                      <Route path="/company-verification" element={<CompanyVerification />} />
        <Route path="/verification-pending" element={<CompanyVerification />} />
        <Route path="/company-verification-code" element={<CompanyVerificationCode />} />
        <Route path="/admin-approve-company" element={<AdminApproveCompany />} />
        <Route path="/admin-reject-company" element={<AdminApproveCompany />} />
          <Route path="/home" element={
            (() => {
              console.log('🔍 App.js: /home route check - profileLoaded:', profileLoaded, 'profileComplete:', profileComplete);
              return profileLoaded && profileComplete ? <EventsListWithNav /> : <Navigate to={userType === 'company' ? "/company-verification-setup" : "/profile-setup"} replace />;
            })()
          } />
              <Route path="/bars" element={<BarsList />} />
              <Route path="/event/:id" element={<EventDetailPage />} />
              <Route path="/company-events" element={<EventsListCompany />} />
              <Route path="/company-event/:id" element={<EventDetailPageCompany />} />
              <Route path="/company-deleted-event/:id" element={<EventDetailPageDeletedCompany />} />
              <Route path="/chats" element={
                userType === 'company' ? 
                  <ChatPageCompany ref={chatPageRef} unreadCount={unreadCount} setUnreadCount={setUnreadCount} /> : 
                  <ChatPagePrivate ref={chatPageRef} unreadCount={unreadCount} setUnreadCount={setUnreadCount} />
              } />
                        <Route path="/my-tickets" element={<MyTickets />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/payment-cancel" element={<PaymentCancel />} />
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        {shouldShowBottomNav && (userType === 'company' ? <BottomNavCompany unreadCount={unreadCount} /> : <BottomNav unreadCount={unreadCount} />)}
    </ThemeProvider>
  );
}

export default App;
