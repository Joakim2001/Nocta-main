import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from './App';
import Select from 'react-select';
import { db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const countryOptions = [
  { value: 'Afghanistan', label: 'Afghanistan' },
  { value: 'Albania', label: 'Albania' },
  { value: 'Algeria', label: 'Algeria' },
  { value: 'Andorra', label: 'Andorra' },
  { value: 'Angola', label: 'Angola' },
  { value: 'Antigua and Barbuda', label: 'Antigua and Barbuda' },
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
  { value: 'Cabo Verde', label: 'Cabo Verde' },
  { value: 'Cambodia', label: 'Cambodia' },
  { value: 'Cameroon', label: 'Cameroon' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Central African Republic', label: 'Central African Republic' },
  { value: 'Chad', label: 'Chad' },
  { value: 'Chile', label: 'Chile' },
  { value: 'China', label: 'China' },
  { value: 'Colombia', label: 'Colombia' },
  { value: 'Comoros', label: 'Comoros' },
  { value: 'Congo (Congo-Brazzaville)', label: 'Congo (Congo-Brazzaville)' },
  { value: 'Costa Rica', label: 'Costa Rica' },
  { value: 'Croatia', label: 'Croatia' },
  { value: 'Cuba', label: 'Cuba' },
  { value: 'Cyprus', label: 'Cyprus' },
  { value: 'Czechia (Czech Republic)', label: 'Czechia (Czech Republic)' },
  { value: 'Democratic Republic of the Congo', label: 'Democratic Republic of the Congo' },
  { value: 'Denmark', label: 'Denmark' },
  { value: 'Djibouti', label: 'Djibouti' },
  { value: 'Dominica', label: 'Dominica' },
  { value: 'Dominican Republic', label: 'Dominican Republic' },
  { value: 'Ecuador', label: 'Ecuador' },
  { value: 'Egypt', label: 'Egypt' },
  { value: 'El Salvador', label: 'El Salvador' },
  { value: 'Equatorial Guinea', label: 'Equatorial Guinea' },
  { value: 'Eritrea', label: 'Eritrea' },
  { value: 'Estonia', label: 'Estonia' },
  { value: 'Eswatini (fmr. "Swaziland")', label: 'Eswatini (fmr. "Swaziland")' },
  { value: 'Ethiopia', label: 'Ethiopia' },
  { value: 'Fiji', label: 'Fiji' },
  { value: 'Finland', label: 'Finland' },
  { value: 'France', label: 'France' },
  { value: 'Gabon', label: 'Gabon' },
  { value: 'Gambia', label: 'Gambia' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Ghana', label: 'Ghana' },
  { value: 'Greece', label: 'Greece' },
  { value: 'Grenada', label: 'Grenada' },
  { value: 'Guatemala', label: 'Guatemala' },
  { value: 'Guinea', label: 'Guinea' },
  { value: 'Guinea-Bissau', label: 'Guinea-Bissau' },
  { value: 'Guyana', label: 'Guyana' },
  { value: 'Haiti', label: 'Haiti' },
  { value: 'Holy See', label: 'Holy See' },
  { value: 'Honduras', label: 'Honduras' },
  { value: 'Hungary', label: 'Hungary' },
  { value: 'Iceland', label: 'Iceland' },
  { value: 'India', label: 'India' },
  { value: 'Indonesia', label: 'Indonesia' },
  { value: 'Iran', label: 'Iran' },
  { value: 'Iraq', label: 'Iraq' },
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Israel', label: 'Israel' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Jamaica', label: 'Jamaica' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Jordan', label: 'Jordan' },
  { value: 'Kazakhstan', label: 'Kazakhstan' },
  { value: 'Kenya', label: 'Kenya' },
  { value: 'Kiribati', label: 'Kiribati' },
  { value: 'Kuwait', label: 'Kuwait' },
  { value: 'Kyrgyzstan', label: 'Kyrgyzstan' },
  { value: 'Laos', label: 'Laos' },
  { value: 'Latvia', label: 'Latvia' },
  { value: 'Lebanon', label: 'Lebanon' },
  { value: 'Lesotho', label: 'Lesotho' },
  { value: 'Liberia', label: 'Liberia' },
  { value: 'Libya', label: 'Libya' },
  { value: 'Liechtenstein', label: 'Liechtenstein' },
  { value: 'Lithuania', label: 'Lithuania' },
  { value: 'Luxembourg', label: 'Luxembourg' },
  { value: 'Madagascar', label: 'Madagascar' },
  { value: 'Malawi', label: 'Malawi' },
  { value: 'Malaysia', label: 'Malaysia' },
  { value: 'Maldives', label: 'Maldives' },
  { value: 'Mali', label: 'Mali' },
  { value: 'Malta', label: 'Malta' },
  { value: 'Marshall Islands', label: 'Marshall Islands' },
  { value: 'Mauritania', label: 'Mauritania' },
  { value: 'Mauritius', label: 'Mauritius' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Micronesia', label: 'Micronesia' },
  { value: 'Moldova', label: 'Moldova' },
  { value: 'Monaco', label: 'Monaco' },
  { value: 'Mongolia', label: 'Mongolia' },
  { value: 'Montenegro', label: 'Montenegro' },
  { value: 'Morocco', label: 'Morocco' },
  { value: 'Mozambique', label: 'Mozambique' },
  { value: 'Myanmar (formerly Burma)', label: 'Myanmar (formerly Burma)' },
  { value: 'Namibia', label: 'Namibia' },
  { value: 'Nauru', label: 'Nauru' },
  { value: 'Nepal', label: 'Nepal' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'New Zealand', label: 'New Zealand' },
  { value: 'Nicaragua', label: 'Nicaragua' },
  { value: 'Niger', label: 'Niger' },
  { value: 'Nigeria', label: 'Nigeria' },
  { value: 'North Korea', label: 'North Korea' },
  { value: 'North Macedonia', label: 'North Macedonia' },
  { value: 'Norway', label: 'Norway' },
  { value: 'Oman', label: 'Oman' },
  { value: 'Pakistan', label: 'Pakistan' },
  { value: 'Palau', label: 'Palau' },
  { value: 'Palestine State', label: 'Palestine State' },
  { value: 'Panama', label: 'Panama' },
  { value: 'Papua New Guinea', label: 'Papua New Guinea' },
  { value: 'Paraguay', label: 'Paraguay' },
  { value: 'Peru', label: 'Peru' },
  { value: 'Philippines', label: 'Philippines' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Portugal', label: 'Portugal' },
  { value: 'Qatar', label: 'Qatar' },
  { value: 'Romania', label: 'Romania' },
  { value: 'Russia', label: 'Russia' },
  { value: 'Rwanda', label: 'Rwanda' },
  { value: 'Saint Kitts and Nevis', label: 'Saint Kitts and Nevis' },
  { value: 'Saint Lucia', label: 'Saint Lucia' },
  { value: 'Saint Vincent and the Grenadines', label: 'Saint Vincent and the Grenadines' },
  { value: 'Samoa', label: 'Samoa' },
  { value: 'San Marino', label: 'San Marino' },
  { value: 'Sao Tome and Principe', label: 'Sao Tome and Principe' },
  { value: 'Saudi Arabia', label: 'Saudi Arabia' },
  { value: 'Senegal', label: 'Senegal' },
  { value: 'Serbia', label: 'Serbia' },
  { value: 'Seychelles', label: 'Seychelles' },
  { value: 'Sierra Leone', label: 'Sierra Leone' },
  { value: 'Singapore', label: 'Singapore' },
  { value: 'Slovakia', label: 'Slovakia' },
  { value: 'Slovenia', label: 'Slovenia' },
  { value: 'Solomon Islands', label: 'Solomon Islands' },
  { value: 'Somalia', label: 'Somalia' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'South Korea', label: 'South Korea' },
  { value: 'South Sudan', label: 'South Sudan' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Sri Lanka', label: 'Sri Lanka' },
  { value: 'Sudan', label: 'Sudan' },
  { value: 'Suriname', label: 'Suriname' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Switzerland', label: 'Switzerland' },
  { value: 'Syria', label: 'Syria' },
  { value: 'Tajikistan', label: 'Tajikistan' },
  { value: 'Tanzania', label: 'Tanzania' },
  { value: 'Thailand', label: 'Thailand' },
  { value: 'Timor-Leste', label: 'Timor-Leste' },
  { value: 'Togo', label: 'Togo' },
  { value: 'Tonga', label: 'Tonga' },
  { value: 'Trinidad and Tobago', label: 'Trinidad and Tobago' },
  { value: 'Tunisia', label: 'Tunisia' },
  { value: 'Turkey', label: 'Turkey' },
  { value: 'Turkmenistan', label: 'Turkmenistan' },
  { value: 'Tuvalu', label: 'Tuvalu' },
  { value: 'Uganda', label: 'Uganda' },
  { value: 'Ukraine', label: 'Ukraine' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'United States', label: 'United States' },
  { value: 'Uruguay', label: 'Uruguay' },
  { value: 'Uzbekistan', label: 'Uzbekistan' },
  { value: 'Vanuatu', label: 'Vanuatu' },
  { value: 'Venezuela', label: 'Venezuela' },
  { value: 'Vietnam', label: 'Vietnam' },
  { value: 'Yemen', label: 'Yemen' },
  { value: 'Zambia', label: 'Zambia' },
  { value: 'Zimbabwe', label: 'Zimbabwe' },
];

const phoneCountryCodeOptions = [
  { value: '+45', label: '🇩🇰 Denmark (+45)' },
  { value: '+46', label: '🇸🇪 Sweden (+46)' },
  { value: '+47', label: '🇳🇴 Norway (+47)' },
  { value: '+358', label: '🇫🇮 Finland (+358)' },
  { value: '+49', label: '🇩🇪 Germany (+49)' },
  { value: '+33', label: '🇫🇷 France (+33)' },
  { value: '+44', label: '🇬🇧 United Kingdom (+44)' },
  { value: '+31', label: '🇳🇱 Netherlands (+31)' },
  { value: '+32', label: '🇧🇪 Belgium (+32)' },
  { value: '+41', label: '🇨🇭 Switzerland (+41)' },
  { value: '+43', label: '🇦🇹 Austria (+43)' },
  { value: '+39', label: '🇮🇹 Italy (+39)' },
  { value: '+34', label: '🇪🇸 Spain (+34)' },
  { value: '+351', label: '🇵🇹 Portugal (+351)' },
  { value: '+30', label: '🇬🇷 Greece (+30)' },
  { value: '+48', label: '🇵🇱 Poland (+48)' },
  { value: '+420', label: '🇨🇿 Czech Republic (+420)' },
  { value: '+36', label: '🇭🇺 Hungary (+36)' },
  { value: '+421', label: '🇸🇰 Slovakia (+421)' },
  { value: '+386', label: '🇸🇮 Slovenia (+386)' },
  { value: '+385', label: '🇭🇷 Croatia (+385)' },
  { value: '+371', label: '🇱🇻 Latvia (+371)' },
  { value: '+372', label: '🇪🇪 Estonia (+372)' },
  { value: '+370', label: '🇱🇹 Lithuania (+370)' },
  { value: '+1', label: '🇺🇸 United States (+1)' },
  { value: '+1', label: '🇨🇦 Canada (+1)' },
  { value: '+52', label: '🇲🇽 Mexico (+52)' },
  { value: '+55', label: '🇧🇷 Brazil (+55)' },
  { value: '+54', label: '🇦🇷 Argentina (+54)' },
  { value: '+56', label: '🇨🇱 Chile (+56)' },
  { value: '+57', label: '🇨🇴 Colombia (+57)' },
  { value: '+51', label: '🇵🇪 Peru (+51)' },
  { value: '+58', label: '🇻🇪 Venezuela (+58)' },
  { value: '+593', label: '🇪🇨 Ecuador (+593)' },
  { value: '+595', label: '🇵🇾 Paraguay (+595)' },
  { value: '+598', label: '🇺🇾 Uruguay (+598)' },
  { value: '+591', label: '🇧🇴 Bolivia (+591)' },
  { value: '+81', label: '🇯🇵 Japan (+81)' },
  { value: '+82', label: '🇰🇷 South Korea (+82)' },
  { value: '+86', label: '🇨🇳 China (+86)' },
  { value: '+91', label: '🇮🇳 India (+91)' },
  { value: '+61', label: '🇦🇺 Australia (+61)' },
  { value: '+64', label: '🇳🇿 New Zealand (+64)' },
  { value: '+65', label: '🇸🇬 Singapore (+65)' },
  { value: '+60', label: '🇲🇾 Malaysia (+60)' },
  { value: '+66', label: '🇹🇭 Thailand (+66)' },
  { value: '+84', label: '🇻🇳 Vietnam (+84)' },
  { value: '+62', label: '🇮🇩 Indonesia (+62)' },
  { value: '+63', label: '🇵🇭 Philippines (+63)' },
  { value: '+971', label: '🇦🇪 UAE (+971)' },
  { value: '+966', label: '🇸🇦 Saudi Arabia (+966)' },
  { value: '+972', label: '🇮🇱 Israel (+972)' },
  { value: '+90', label: '🇹🇷 Turkey (+90)' },
  { value: '+7', label: '🇷🇺 Russia (+7)' },
  { value: '+380', label: '🇺🇦 Ukraine (+380)' },
  { value: '+375', label: '🇧🇾 Belarus (+375)' },
  { value: '+48', label: '🇵🇱 Poland (+48)' },
  { value: '+420', label: '🇨🇿 Czech Republic (+420)' },
  { value: '+36', label: '🇭🇺 Hungary (+36)' },
  { value: '+421', label: '🇸🇰 Slovakia (+421)' },
  { value: '+386', label: '🇸🇮 Slovenia (+386)' },
  { value: '+385', label: '🇭🇷 Croatia (+385)' },
  { value: '+371', label: '🇱🇻 Latvia (+371)' },
  { value: '+372', label: '🇪🇪 Estonia (+372)' },
  { value: '+370', label: '🇱🇹 Lithuania (+370)' },
];

function ProfileSetup() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+45');

  // Remove the useEffect that sets dob from localStorage

  // When setting dob, also update localStorage
  const handleSetDob = (value) => {
    setDob(value);
    localStorage.setItem('dob', value);
  };
  const [country, setCountry] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // 'gender' | 'dob' | null
  const [dobInput, setDobInput] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const dobRef = React.useRef();
  const navigate = useNavigate();
  const { profileComplete } = useProfile();

  // Wait for authentication to be ready
  useEffect(() => {
    const auth = getAuth();
    console.log('🔍 ProfileSetup: Setting up auth listener');
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log('🔍 ProfileSetup: Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      if (user) {
        console.log('✅ User authenticated:', user.uid);
        setAuthReady(true);
      } else {
        console.log('❌ No user authenticated');
        setAuthReady(false);
      }
    });

    // Also check current user immediately
    const currentUser = auth.currentUser;
    console.log('🔍 ProfileSetup: Current user check:', currentUser ? `User: ${currentUser.uid}` : 'No current user');
    if (currentUser) {
      setAuthReady(true);
    }

    return () => unsubscribe();
  }, []);

  // Redirect to /home when profileComplete is true
  useEffect(() => {
    if (profileComplete) {
      navigate('/home', { replace: true });
    }
  }, [profileComplete, navigate]);

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ];

  // Close dropdown on click outside
  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dobRef.current && !dobRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    }
    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Check if authentication is ready
    if (!authReady) {
      setError('Please wait while we verify your account...');
      setLoading(false);
      return;
    }
    
    // Debug log for all field values
    console.log('Submit values:', {
      firstName,
      lastName,
      gender,
      dob,
      country,
      phone,
    });
    
    // Validation
    if (!firstName.trim() || !lastName.trim() || !gender || !dob || !country || !phone.trim()) {
      setError('Please fill out all fields.');
      setLoading(false);
      return;
    }
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        console.log('❌ No user found in auth.currentUser');
        setError('Authentication error. Please try refreshing the page.');
        setLoading(false);
        return;
      }
      
      console.log('✅ User found:', user.uid, user.email);
      
      // Save profile to Firestore
      await setDoc(doc(db, 'profiles', user.uid), {
        firstName,
        lastName,
        gender,
        dob,
        country: country.value || country,
        phone: phoneCountryCode + ' ' + phone,
        email: user.email || '',
        uid: user.uid,
        createdAt: new Date().toISOString(),
      });
      
      console.log('✅ Profile saved successfully');
      // Clear the new signup flag since profile is now complete
      localStorage.removeItem('isNewSignup');
      setLoading(false);
      navigate('/favorites-setup');
    } catch (err) {
      console.error('❌ Error saving profile:', err);
      setError('Failed to save profile: ' + (err.message || err));
      setLoading(false);
    }
  };

  // Debug log for loading state
  console.log('loading state:', loading, 'auth ready:', authReady);

  // Show loading while authentication is being checked
  if (!authReady) {
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
          <div style={{ color: '#fff', fontSize: 18, marginTop: 20 }}>Verifying your account...</div>
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
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: 0, textAlign: 'center' }}>Profile Setup</h2>
        <p style={{ color: '#ccc', fontSize: 16, margin: '8px 0 32px 0', opacity: 0.85, textAlign: 'center' }}>
          Complete your profile
        </p>
        <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 340, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
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
            type="text"
            placeholder="Last name"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
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
          {/* Gender Dropdown Input */}
          <div style={{ width: '100%', position: 'relative', marginBottom: 4 }}>
            <div
              onClick={() => setOpenDropdown('gender')}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                fontSize: 16,
                background: 'rgba(255,255,255,0.12)',
                color: gender ? 'white' : '#ccc',
                outline: 'none',
                boxShadow: '0 2px 8px #a445ff22',
                marginBottom: 0,
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {gender ? genderOptions.find(opt => opt.value === gender)?.label : 'Select gender'}
            </div>
            {openDropdown === 'gender' && (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                width: '100%',
                background: 'rgba(30,30,50,0.98)',
                borderRadius: 12,
                boxShadow: '0 4px 24px #3E29F055',
                padding: 16,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}>
                {genderOptions.map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => {
                      setGender(opt.value);
                      setOpenDropdown(null);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 8,
                      fontSize: 16,
                      color: 'white',
                      background: gender === opt.value ? 'rgba(249,65,249,0.15)' : 'transparent',
                      cursor: 'pointer',
                      marginBottom: 4,
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,65,249,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = gender === opt.value ? 'rgba(249,65,249,0.15)' : 'transparent'}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Date of Birth Dropdown Input */}
          <div style={{ width: '100%', position: 'relative', marginBottom: 0 }} ref={dobRef}>
            <div
              onClick={() => {
                setDobInput(dob);
                setOpenDropdown('dob');
              }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                fontSize: 16,
                background: 'rgba(255,255,255,0.12)',
                color: dob ? 'white' : '#ccc',
                outline: 'none',
                boxShadow: '0 2px 8px #a445ff22',
                marginBottom: 0,
                cursor: 'pointer',
                textAlign: 'left',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {dob ? dob : 'Date of Birth'}
            </div>
            {openDropdown === 'dob' && (
              <div style={{
                position: 'absolute',
                top: '110%',
                left: 0,
                width: '100%',
                background: 'rgba(30,30,50,0.98)',
                borderRadius: 12,
                boxShadow: '0 4px 24px #3E29F055',
                padding: 16,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}>
                <label style={{ color: '#ccc', fontSize: 14, marginBottom: 6 }}>Enter date as dd-mm-yyyy</label>
                <input
                  type="text"
                  value={dobInput}
                  onChange={e => {
                    let v = e.target.value.replace(/[^0-9]/g, '');
                    if (v.length > 8) v = v.slice(0, 8);
                    let formatted = v;
                    if (v.length > 4) formatted = v.slice(0,2) + '-' + v.slice(2,4) + '-' + v.slice(4);
                    else if (v.length > 2) formatted = v.slice(0,2) + '-' + v.slice(2);
                    setDobInput(formatted);
                  }}
                  placeholder="dd-mm-yyyy"
                  autoFocus
                  maxLength={10}
                  pattern="^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-[0-9]{4}$"
                  title="Please enter date as dd-mm-yyyy"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: 16,
                    background: 'rgba(255,255,255,0.18)',
                    color: 'white',
                    outline: 'none',
                    marginBottom: 0,
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      handleSetDob(dobInput);
                      setOpenDropdown(null);
                    }
                  }}
                  onBlur={() => setOpenDropdown(null)}
                />
                <button
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault(); // extra safety
                    handleSetDob(dobInput);
                    setOpenDropdown(null);
                  }}
                  style={{
                    marginTop: 8,
                    padding: '8px 18px',
                    borderRadius: 20,
                    background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: 15,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px #a445ff22',
                  }}
                >OK</button>
              </div>
            )}
          </div>
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
            Finish Profile
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfileSetup; 