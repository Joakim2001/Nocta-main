import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db, storage } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
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
  { value: 'Vietnam', label: 'Vietnam' },
];

const phoneCountryCodeOptions = [
  { value: '+45', label: '🇩🇰 Denmark (+45)' },
  { value: '+46', label: '🇸🇪 Sweden (+46)' },
  { value: '+47', label: '🇳🇴 Norway (+47)' },
  { value: '+358', label: '🇫🇮 Finland (+358)' },
  { value: '+31', label: '🇳🇱 Netherlands (+31)' },
  { value: '+32', label: '🇧🇪 Belgium (+32)' },
  { value: '+33', label: '🇫🇷 France (+33)' },
  { value: '+49', label: '🇩🇪 Germany (+49)' },
  { value: '+44', label: '🇬🇧 United Kingdom (+44)' },
  { value: '+1', label: '🇺🇸 United States (+1)' },
  { value: '+86', label: '🇨🇳 China (+86)' },
  { value: '+81', label: '🇯🇵 Japan (+81)' },
  { value: '+82', label: '🇰🇷 South Korea (+82)' },
  { value: '+91', label: '🇮🇳 India (+91)' },
  { value: '+61', label: '🇦🇺 Australia (+61)' },
  { value: '+64', label: '🇳🇿 New Zealand (+64)' },
  { value: '+55', label: '🇧🇷 Brazil (+55)' },
  { value: '+52', label: '🇲🇽 Mexico (+52)' },
  { value: '+34', label: '🇪🇸 Spain (+34)' },
  { value: '+39', label: '🇮🇹 Italy (+39)' },
  { value: '+41', label: '🇨🇭 Switzerland (+41)' },
  { value: '+43', label: '🇦🇹 Austria (+43)' },
  { value: '+48', label: '🇵🇱 Poland (+48)' },
  { value: '+420', label: '🇨🇿 Czech Republic (+420)' },
  { value: '+36', label: '🇭🇺 Hungary (+36)' },
  { value: '+380', label: '🇺🇦 Ukraine (+380)' },
  { value: '+7', label: '🇷🇺 Russia (+7)' },
  { value: '+90', label: '🇹🇷 Turkey (+90)' },
  { value: '+971', label: '🇦🇪 UAE (+971)' },
  { value: '+966', label: '🇸🇦 Saudi Arabia (+966)' },
  { value: '+27', label: '🇿🇦 South Africa (+27)' },
  { value: '+234', label: '🇳🇬 Nigeria (+234)' },
  { value: '+254', label: '🇰🇪 Kenya (+254)' },
  { value: '+20', label: '🇪🇬 Egypt (+20)' },
  { value: '+212', label: '🇲🇦 Morocco (+212)' },
  { value: '+216', label: '🇹🇳 Tunisia (+216)' },
  { value: '+351', label: '🇵🇹 Portugal (+351)' },
  { value: '+30', label: '🇬🇷 Greece (+30)' },
  { value: '+385', label: '🇭🇷 Croatia (+385)' },
  { value: '+386', label: '🇸🇮 Slovenia (+386)' },
  { value: '+421', label: '🇸🇰 Slovakia (+421)' },
  { value: '+40', label: '🇷🇴 Romania (+40)' },
  { value: '+359', label: '🇧🇬 Bulgaria (+359)' },
  { value: '+371', label: '🇱🇻 Latvia (+371)' },
  { value: '+372', label: '🇪🇪 Estonia (+372)' },
  { value: '+370', label: '🇱🇹 Lithuania (+370)' },
  { value: '+353', label: '🇮🇪 Ireland (+353)' },
  { value: '+354', label: '🇮🇸 Iceland (+354)' },
  { value: '+47', label: '🇳🇴 Norway (+47)' },
  { value: '+46', label: '🇸🇪 Sweden (+46)' },
  { value: '+358', label: '🇫🇮 Finland (+358)' },
  { value: '+45', label: '🇩🇰 Denmark (+45)' },
];

function CompanySetup() {
  console.log('CompanySetup: NEW VERSION LOADED - v2.0'); // Force cache refresh check
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uidFromUrl = searchParams.get('uid');
  
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
  
  // Log the UID from URL
  if (uidFromUrl) {
    console.log('CompanySetup: UID from URL:', uidFromUrl);
  }

  // Simple Firebase Auth listener (only for non-UID cases)
  useEffect(() => {
    if (!uidFromUrl) {
      const auth = getAuth();
      console.log('CompanySetup: Setting up auth listener for non-UID case...');
      
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log('CompanySetup: Auth state changed, user:', user ? user.uid : 'null');
        setCurrentUser(user);
      });
      return unsubscribe;
    }
  }, [uidFromUrl]);

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
    
    if (!name.trim() || !country || !phone.trim() || !instagramUsername.trim() || !screenshotFile) {
      setError('Please fill out all fields and upload a screenshot.');
      setLoading(false);
      return;
    }

    try {
      console.log('CompanySetup: handleSubmit - currentUser:', currentUser ? currentUser.uid : 'null', 'uidFromUrl:', uidFromUrl);
      
      // Determine which user to use
      let userToUse = null;
      
      // Try to get the real Firebase Auth user first
      const auth = getAuth();
      const realUser = auth.currentUser;
      console.log('CompanySetup: Real Firebase Auth user:', realUser ? realUser.uid : 'null');
      
      if (realUser) {
        userToUse = realUser;
        console.log('CompanySetup: Using real Firebase Auth user:', userToUse.uid);
      } else if (currentUser) {
        userToUse = currentUser;
        console.log('CompanySetup: Using currentUser (mock):', userToUse.uid);
      } else if (uidFromUrl) {
        userToUse = { uid: uidFromUrl, email: null };
        console.log('CompanySetup: Using UID from URL:', userToUse.uid);
      } else {
        throw new Error('No user available for operations');
      }

      // Upload screenshot to Firebase Storage
      const screenshotRef = ref(storage, `company-verification/${userToUse.uid}/${screenshotFile.name}`);
      const uploadResult = await uploadBytes(screenshotRef, screenshotFile);
      const screenshotUrl = await getDownloadURL(uploadResult.ref);

      // Save company profile with verification data
      await setDoc(doc(db, 'Club_Bar_Festival_profiles', userToUse.uid), {
        name,
        country: country.value || country,
        phone: phoneCountryCode + ' ' + phone,
        email: realUser ? realUser.email : '',
        uid: userToUse.uid,
        instagramUsername: instagramUsername.trim(),
        instagramScreenshotUrl: screenshotUrl,
        verificationStatus: 'pending',
        verificationCode: null, // Will be set when approved
        createdAt: new Date().toISOString(),
      }, { merge: true });

      setLoading(false);
      navigate('/verification-pending');
    } catch (err) {
      setError('Failed to save profile: ' + (err.message || err));
      setLoading(false);
    }
  };

  // NEW SIMPLE LOGIC - If we have UID from URL, render immediately
  if (uidFromUrl) {
    console.log('CompanySetup: NEW VERSION - Rendering form immediately with UID:', uidFromUrl);
  } else if (!currentUser) {
    console.log('CompanySetup: NEW VERSION - No UID and no user, showing loading...');
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
              input: (base) => ({ ...base, color: 'white', textAlign: 'left' }),
              menu: (base) => ({ ...base, background: 'rgba(30,30,50,0.98)', color: 'white', borderRadius: 12, textAlign: 'left' }),
              option: (base, state) => ({
                ...base,
                background: state.isFocused ? 'rgba(249,65,249,0.15)' : 'transparent',
                color: 'white',
                cursor: 'pointer',
                textAlign: 'left',
              }),
              placeholder: (base) => ({ ...base, color: '#ccc', opacity: 0.85, textAlign: 'left' }),
            }}
          />
          <div style={{ display: 'flex', gap: 8, maxWidth: '100%' }}>
            <Select
              options={phoneCountryCodeOptions}
              value={{ value: phoneCountryCode, label: phoneCountryCode }}
              onChange={(option) => setPhoneCountryCode(option.value)}
              placeholder="Code"
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
                  minWidth: 120,
                  maxWidth: 120,
                }),
                singleValue: (base) => ({ ...base, color: 'white', textAlign: 'left', fontSize: 14 }),
                input: (base) => ({ ...base, color: 'white', textAlign: 'left' }),
                menu: (base) => ({ ...base, background: 'rgba(30,30,50,0.98)', color: 'white', borderRadius: 12, textAlign: 'left' }),
                option: (base, state) => ({
                  ...base,
                  background: state.isFocused ? 'rgba(249,65,249,0.15)' : 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 14,
                }),
                placeholder: (base) => ({ ...base, color: '#ccc', opacity: 0.85, textAlign: 'left' }),
              }}
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{
                flex: 1,
                maxWidth: 'calc(100% - 128px)',
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
          </div>

          {/* Instagram Verification Section */}
          <div style={{ 
            border: '1px solid rgba(255,255,255,0.2)', 
            borderRadius: 12, 
            padding: 16, 
            marginTop: 8,
            background: 'rgba(255,255,255,0.05)'
          }}>
            <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, margin: '0 0 12px 0', textAlign: 'left' }}>
              Instagram Verification
            </h3>
            <p style={{ color: '#ccc', fontSize: 14, margin: '0 0 16px 0', textAlign: 'left' }}>
              Please provide your Instagram username and upload a screenshot of your Instagram profile page for verification.
            </p>
            
            <input
              type="text"
              placeholder="Instagram Username (without @)"
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
                marginBottom: 12,
              }}
            />

            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setShowExample(!showExample)}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#ffb3ff',
                  fontSize: 14,
                  cursor: 'pointer',
                  marginBottom: 8,
                }}
              >
                {showExample ? 'Hide Example' : 'Show Example'} 📸
              </button>
              
              {showExample && (
                <div style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  borderRadius: 8, 
                  padding: 12, 
                  marginBottom: 12,
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <p style={{ color: '#ccc', fontSize: 13, margin: '0 0 8px 0', textAlign: 'left' }}>
                    <strong>Example:</strong> Take a screenshot of your Instagram profile page showing your username at the top. 
                    Make sure the username is clearly visible.
                  </p>
                  <img 
                    src="/instagram-example.png" 
                    alt="Instagram profile example" 
                    style={{ 
                      width: '100%', 
                      maxWidth: 300,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.2)',
                      marginTop: 8
                    }} 
                  />
                </div>
              )}
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={handleScreenshotChange}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                border: '2px dashed rgba(255,255,255,0.3)',
                fontSize: 16,
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                outline: 'none',
                cursor: 'pointer',
              }}
            />
            
            {screenshotPreview && (
              <div style={{ marginTop: 12 }}>
                <p style={{ color: '#4CAF50', fontSize: 14, margin: '0 0 8px 0', textAlign: 'left' }}>
                  ✅ Screenshot uploaded successfully
                </p>
                <img 
                  src={screenshotPreview} 
                  alt="Screenshot preview" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: 200, 
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)'
                  }} 
                />
              </div>
            )}
          </div>

          <div style={{ color: '#ffb3ff', fontSize: 14, marginBottom: 8, minHeight: 18 }}>{error}</div>
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
            {loading ? 'Uploading...' : 'Send Verification Request'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default CompanySetup; 