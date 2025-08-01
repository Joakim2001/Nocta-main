import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db, storage } from './firebase';

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Select from 'react-select';

const countryOptions = [
  { value: 'Afghanistan', label: 'Afghanistan' },
  { value: 'Albania', label: 'Albania' },
  { value: 'Algeria', label: 'Algeria' },
  { value: 'Andorra', label: 'Andorra' },
  { value: 'Angola', label: 'Angola' },
  { value: 'Argentina', label: 'Argentina' },
  { value: 'Armenia', label: 'Armenia' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Austria', label: 'Austria' },
  { value: 'Azerbaijan', label: 'Azerbaijan' },
  { value: 'Bahamas', label: 'Bahamas' },
  { value: 'Bahrain', label: 'Bahrain' },
  { value: 'Bangladesh', label: 'Bangladesh' },
  { value: 'Barbados', label: 'Barbados' },
  { value: 'Belarus', label: 'Belarus' },
  { value: 'Belgium', label: 'Belgium' },
  { value: 'Belize', label: 'Belize' },
  { value: 'Benin', label: 'Benin' },
  { value: 'Bhutan', label: 'Bhutan' },
  { value: 'Bolivia', label: 'Bolivia' },
  { value: 'Bosnia and Herzegovina', label: 'Bosnia and Herzegovina' },
  { value: 'Botswana', label: 'Botswana' },
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Brunei', label: 'Brunei' },
  { value: 'Bulgaria', label: 'Bulgaria' },
  { value: 'Burkina Faso', label: 'Burkina Faso' },
  { value: 'Burundi', label: 'Burundi' },
  { value: 'Cambodia', label: 'Cambodia' },
  { value: 'Cameroon', label: 'Cameroon' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Chile', label: 'Chile' },
  { value: 'China', label: 'China' },
  { value: 'Colombia', label: 'Colombia' },
  { value: 'Congo', label: 'Congo' },
  { value: 'Costa Rica', label: 'Costa Rica' },
  { value: 'Croatia', label: 'Croatia' },
  { value: 'Cuba', label: 'Cuba' },
  { value: 'Cyprus', label: 'Cyprus' },
  { value: 'Czechia', label: 'Czechia' },
  { value: 'Denmark', label: 'Denmark' },
  { value: 'Dominican Republic', label: 'Dominican Republic' },
  { value: 'Ecuador', label: 'Ecuador' },
  { value: 'Egypt', label: 'Egypt' },
  { value: 'Estonia', label: 'Estonia' },
  { value: 'Finland', label: 'Finland' },
  { value: 'France', label: 'France' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Greece', label: 'Greece' },
  { value: 'Hungary', label: 'Hungary' },
  { value: 'Iceland', label: 'Iceland' },
  { value: 'India', label: 'India' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Israel', label: 'Israel' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Jamaica', label: 'Jamaica' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Latvia', label: 'Latvia' },
  { value: 'Lithuania', label: 'Lithuania' },
  { value: 'Luxembourg', label: 'Luxembourg' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Malta', label: 'Malta' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'Norway', label: 'Norway' },
  { value: 'Pakistan', label: 'Pakistan' },
  { value: 'Peru', label: 'Peru' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Romania', label: 'Romania' },
  { value: 'Russia', label: 'Russia' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia' },
  { value: 'Serbia', label: 'Serbia' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Slovakia', label: 'Slovakia' },
  { value: 'Slovenia', label: 'Slovenia' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Switzerland', label: 'Switzerland' },
  { value: 'Thailand', label: 'Thailand' },
  { value: 'Turkey', label: 'Turkey' },
  { value: 'Ukraine', label: 'Ukraine' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States', label: 'United States' },
  { value: 'Uruguay', label: 'Uruguay' },
  { value: 'Venezuela', label: 'Venezuela' },
  { value: 'Vietnam', label: 'Vietnam' },
  { value: 'Yemen', label: 'Yemen' },
  { value: 'Zambia', label: 'Zambia' },
  { value: 'Zimbabwe', label: 'Zimbabwe' }
];

function CompanyVerificationSetup() {
  console.log('🚀 CompanyVerificationSetup: NEW COMPONENT LOADED SUCCESSFULLY!');
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uidFromUrl = searchParams.get('uid');
  const emailFromUrl = searchParams.get('email');
  
  const [name, setName] = useState("");
  const [country, setCountry] = useState(null);
  const [phoneCountryCode, setPhoneCountryCode] = useState("+45"); // Default to Denmark
  const [phone, setPhone] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [showExample, setShowExample] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  // Log the UID and email from URL
  if (uidFromUrl) {
    console.log('🔑 CompanyVerificationSetup: UID from URL:', uidFromUrl);
  }
  if (emailFromUrl) {
    console.log('📧 CompanyVerificationSetup: Email from URL:', emailFromUrl);
  }

  // Firebase Auth listener - always run to get authenticated user
  useEffect(() => {
    const auth = getAuth();
    console.log('🔥 CompanyVerificationSetup: Setting up Firebase Auth listener...');
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('👤 CompanyVerificationSetup: Auth state changed, user:', user ? user.uid : 'null');
      setCurrentUser(user);
      setAuthInitialized(true);
    });

    // Set a timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('⏰ CompanyVerificationSetup: Auth timeout reached, proceeding anyway...');
      setAuthInitialized(true);
    }, 2000); // 2 seconds timeout - much faster

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Screenshot must be smaller than 5MB');
        return;
      }
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setScreenshotPreview(e.target.result);
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    console.log('📝 CompanyVerificationSetup: Form submission started');
    
    if (!name.trim() || !country || !phone.trim() || !instagramUsername.trim() || !screenshotFile) {
      setError('Please fill out all fields and upload a screenshot.');
      setLoading(false);
      return;
    }

    try {
      console.log('🔐 CompanyVerificationSetup: Checking authenticated user...');
      
      // Use currentUser if available, otherwise use UID and email from URL
      let userToUse = currentUser;
      if (!currentUser && uidFromUrl) {
        console.log('⚠️ CompanyVerificationSetup: No authenticated user, using UID from URL:', uidFromUrl);
        userToUse = {
          uid: uidFromUrl,
          email: emailFromUrl || 'temp@example.com' // Use email from URL if available
        };
      }
      
      if (!userToUse) {
        throw new Error('No authenticated user available for operations');
      }
      
      console.log('✅ CompanyVerificationSetup: Using user for operations:', userToUse.uid);

      // Upload screenshot to Firebase Storage
      console.log('📸 CompanyVerificationSetup: Uploading screenshot...');
      const screenshotRef = ref(storage, `company-verification/${userToUse.uid}/${screenshotFile.name}`);
      const uploadResult = await uploadBytes(screenshotRef, screenshotFile);
      const screenshotUrl = await getDownloadURL(uploadResult.ref);
      console.log('✅ CompanyVerificationSetup: Screenshot uploaded successfully');

      // Use the new Cloud Function to handle everything
      console.log('🚀 CompanyVerificationSetup: Calling setupCompanyProfile Cloud Function...');
      
      const response = await fetch('https://us-central1-nocta-d1113.cloudfunctions.net/setupCompanyProfile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: userToUse.uid,
          name: name.trim(),
          country: country.value || country,
          phone: phoneCountryCode + ' ' + phone,
          instagramUsername: instagramUsername.trim(),
          instagramScreenshotUrl: screenshotUrl,
          email: userToUse.email || 'temp@example.com'
        }),
      });

      console.log('🚀 CompanyVerificationSetup: Cloud Function response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ CompanyVerificationSetup: Cloud Function error:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ CompanyVerificationSetup: Cloud Function completed successfully:', result);

      setLoading(false);
      console.log('🎉 CompanyVerificationSetup: Process completed, navigating to login with success message');
      
      // Navigate to login page with success parameter immediately
      navigate('/company-login?success=verification-sent');
    } catch (err) {
      console.error('❌ CompanyVerificationSetup: Error in submission process:', err);
      setError('Failed to save profile: ' + (err.message || err));
      setLoading(false);
    }
  };

  // If we have a UID from URL but no authenticated user, try to use the UID directly
  if (uidFromUrl && !currentUser && authInitialized) {
    console.log('🔧 CompanyVerificationSetup: Using UID from URL for operations:', uidFromUrl);
    // We'll use uidFromUrl for operations but still wait for auth to be properly established
  }

  // Wait for Firebase Auth to be initialized
  if (!authInitialized) {
    console.log('⏳ CompanyVerificationSetup: Auth not initialized yet, showing loading...');
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(180deg, hsl(230, 45%, 9%), hsl(280, 50%, 20%))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: 'white', fontSize: 18 }}>Loading...</div>
      </div>
    );
  }

  // If no authenticated user and no UID from URL, redirect to login
  if (!currentUser && !uidFromUrl) {
    console.log('❌ CompanyVerificationSetup: No user and no UID, redirecting to login...');
    navigate('/company-login');
    return null;
  }

  // If we have UID from URL but no authenticated user, proceed with the form anyway
  if (!currentUser && uidFromUrl) {
    console.log('🔧 CompanyVerificationSetup: Proceeding with form using UID from URL:', uidFromUrl);
    // We'll proceed to render the form and use uidFromUrl for operations
    // Don't wait for authentication - proceed immediately
  }

  console.log('🎨 CompanyVerificationSetup: Rendering form with user:', currentUser ? currentUser.uid : uidFromUrl);

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

        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: 0, textAlign: 'center' }}>Company Setup</h2>
        <p style={{ color: '#ccc', fontSize: 16, margin: '8px 0 32px 0', opacity: 0.85, textAlign: 'center' }}>
          Complete your company profile
        </p>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="text"
            placeholder="Company Name"
            value={name}
            onChange={e => setName(e.target.value)}
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

          <Select
            options={countryOptions}
            value={country}
            onChange={setCountry}
            placeholder="Country"
            isSearchable
            styles={{
              control: (base) => ({
                ...base,
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: 12,
                color: 'white',
                boxShadow: '0 2px 8px #a445ff22',
                minHeight: 48,
                marginBottom: 0,
              }),
              singleValue: (base) => ({ ...base, color: 'white', textAlign: 'left' }),
              placeholder: (base) => ({ ...base, color: 'rgba(255,255,255,0.6)', textAlign: 'left' }),
              menu: (base) => ({ ...base, background: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }),
              option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' }
              }),
              input: (base) => ({ ...base, color: 'white' }),
            }}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={phoneCountryCode}
              onChange={e => setPhoneCountryCode(e.target.value)}
              style={{
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                fontSize: 16,
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                outline: 'none',
                boxShadow: '0 2px 8px #a445ff22',
                minWidth: 80,
              }}
            >
              <option value="+45">+45</option>
              <option value="+1">+1</option>
              <option value="+44">+44</option>
              <option value="+49">+49</option>
              <option value="+33">+33</option>
              <option value="+39">+39</option>
              <option value="+34">+34</option>
              <option value="+31">+31</option>
              <option value="+46">+46</option>
              <option value="+47">+47</option>
              <option value="+358">+358</option>
              <option value="+45">+45</option>
            </select>
            <input
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                fontSize: 16,
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                outline: 'none',
                boxShadow: '0 2px 8px #a445ff22',
              }}
            />
          </div>

          <input
            type="text"
            placeholder="Instagram Username"
            value={instagramUsername}
            onChange={e => setInstagramUsername(e.target.value)}
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
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowExample(!showExample)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent',
                color: 'white',
                fontSize: 14,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Show Example
            </button>
            {showExample && (
              <div style={{ flex: 1, textAlign: 'left', fontSize: 14, color: '#ccc' }}>
                Upload a screenshot of your Instagram profile
              </div>
            )}
          </div>

          {showExample && (
            <div style={{ 
              padding: '16px', 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: 12, 
              border: '1px solid rgba(255,255,255,0.1)',
              textAlign: 'center'
            }}>
              <img 
                src="/instagram-example.png" 
                alt="Instagram Example" 
                style={{ 
                  maxWidth: '100%', 
                  height: 'auto', 
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)'
                }} 
              />
              <p style={{ color: '#ccc', fontSize: 14, margin: '8px 0 0 0' }}>
                Example: Screenshot of your Instagram profile
              </p>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={handleScreenshotChange}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 12,
              border: '2px dashed rgba(255,255,255,0.3)',
              fontSize: 16,
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              outline: 'none',
              cursor: 'pointer',
            }}
          />

          {screenshotPreview && (
            <div style={{ textAlign: 'center' }}>
              <img 
                src={screenshotPreview} 
                alt="Preview" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: 200, 
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)'
                }} 
              />
            </div>
          )}

          {error && (
            <div style={{ 
              color: '#ff6b6b', 
              fontSize: 14, 
              textAlign: 'center',
              padding: '8px',
              background: 'rgba(255,107,107,0.1)',
              borderRadius: 8,
              border: '1px solid rgba(255,107,107,0.3)'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 12,
              border: 'none',
              fontSize: 16,
              fontWeight: 600,
              background: loading ? 'rgba(255,255,255,0.3)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
              transition: 'all 0.3s ease',
            }}
          >
            {loading ? 'Sending...' : 'Send Verification Request'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CompanyVerificationSetup; 