import React, { useRef, useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate, useLocation } from 'react-router-dom';
// Removed react-datepicker imports to fix module resolution issues

function CreateCompanyEvent() {
  const fileInputRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();
  const ticketOption = location.state?.ticketOption;
  const ticketConfiguration = location.state?.ticketConfiguration;
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [dateMode, setDateMode] = useState('simple'); // 'simple' or 'range'
  const [multiDates, setMultiDates] = useState(['']);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isDatePopupOpen, setIsDatePopupOpen] = useState(false);
  const datePopupRef = useRef(null);
  const [uploading, setUploading] = useState(false);


  const CustomDateInput = ({ value, onChange }) => {
    const [isText, setIsText] = useState(!value);
    const inputRef = useRef(null);

    return (
      <input
        ref={inputRef}
        type={isText ? 'text' : 'date'}
        value={value}
        onChange={onChange}
        onFocus={() => setIsText(false)}
        onBlur={() => {
          if (!inputRef.current.value) {
            setIsText(true);
          }
        }}
        placeholder="dd-mm-yyyy"
        style={{...inputBoxStyle, flex: 1}}
      />
    );
  };

  useEffect(() => {
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      setImagePreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [imageFile]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (datePopupRef.current && !datePopupRef.current.contains(event.target)) {
        setIsDatePopupOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [datePopupRef]);


  const handleTimeChange = (setter) => (e) => {
    const { value } = e.target;
    if (value.length === 2 && !value.includes(':')) {
      setter(value + ':');
    } else if (value.length > 2 && value.charAt(2) !== ':') {
      setter(value.slice(0,2) + ':' + value.slice(2));
    }
     else {
      setter(value);
    }
  };

  const handleSubmit = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    const isDateValid = () => {
      if (dateMode === 'simple') return multiDates.every(d => !!d);
      if (dateMode === 'range') return !!dateRange[0];
      return false;
    }

    if (!user || !title || !isDateValid() || !imageFile) {
      alert("Please fill all required fields and upload an image.");
      return;
    }
    
    // Show user that image will use default due to technical issues
    if (imageFile) {
      console.log("Note: Image will use default due to Firebase Storage configuration");
    }
    setUploading(true);

    try {
      const db = getFirestore();
      const userDocRef = doc(db, 'Club_Bar_Festival_profiles', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let companyName = "Unknown Company";
      if (userDoc.exists()) {
        const profileData = userDoc.data();
        companyName = profileData.name || profileData.profileName || "Unknown Company";
        console.log("Found company profile:", profileData);
      } else {
        console.warn("Company profile not found for user:", user.uid);
      }

      let imageUrl = '/default-tyrolia.jpg';
      
      // Skip image upload for now due to CORS issues
      // TODO: Fix Firebase Storage CORS configuration
      console.log("Skipping image upload due to CORS configuration issues");
      
      // Uncomment this section once Firebase Storage CORS is configured:
      /*
      try {
      const imageRef = storageRef(getStorage(), `company-event-images/${user.uid}/${Date.now()}_${imageFile.name}`);
      await uploadBytes(imageRef, imageFile);
      imageUrl = await getDownloadURL(imageRef);
      } catch (uploadError) {
        console.error("Image upload failed:", uploadError);
        imageUrl = '/default-tyrolia.jpg';
      }
      */
      
      const eventData = {
        userId: user.uid,
        title,
        description,
        location: eventLocation,
        imageUrl,
        companyName: companyName || "Unknown Company",
        startTime,
        endTime,
        createdAt: serverTimestamp(),
        ticketConfiguration: ticketConfiguration || null,
        ticketType: ticketOption || "No ticket",
        viewscount: 0,
        likescount: 0,
        // Source tracking fields
        source: 'company-created',
        createdBy: user.uid,
        // Additional fields to match Instagram posts structure
        fullname: companyName || "Unknown Company",
        username: companyName ? companyName.toLowerCase().replace(/\s+/g, '') : "unknown",
        caption: description,
        timestamp: serverTimestamp()
      };

      if (dateMode === 'simple') {
        eventData.eventDates = multiDates.map(d => new Date(d)).sort((a,b) => a - b);
        // Set the first date as the main eventDate for filtering
        if (multiDates.filter(Boolean).length > 0) {
          eventData.eventDate = new Date(multiDates.filter(Boolean)[0]);
        }
      } else if (dateMode === 'range') {
        const [rangeStart, rangeEnd] = dateRange;
        eventData.eventDate = rangeStart;
        if (rangeEnd) {
          eventData.eventDateEnd = rangeEnd;
        }
      }

      await addDoc(collection(db, 'Instagram_posts'), eventData);
      navigate('/company-events');

    } catch (error) {
      console.error("Error creating event: ", error);
      alert("Failed to create event. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const formatDateForDisplay = () => {
    if (dateMode === 'simple' && multiDates.filter(Boolean).length > 0) {
      const sortedDates = multiDates.filter(Boolean).map(d => new Date(d)).sort((a,b) => a - b);
      return sortedDates.map(d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ');
    }
    if (dateMode === 'range') {
      const [start, end] = dateRange;
      if (start && end) {
        return `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`;
      }
      if (start) {
        return `${start.toLocaleDateString('en-GB')} - ...`;
      }
    }
    return 'Date';
  };

  const activeButtonStyle = {
    flex: 1,
    padding: '8px',
    borderRadius: 8,
    border: 'none',
    background: '#4b1fa2',
          color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const inactiveButtonStyle = {
    flex: 1,
    padding: '8px',
    borderRadius: 8,
          border: 'none',
    background: 'transparent',
    color: '#333',
          fontWeight: 600,
    cursor: 'pointer'
  };

  const inputBoxStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: 'none',
    fontSize: 17,
    outline: 'none',
    background: '#fff',
    fontWeight: 500,
    boxSizing: 'border-box',
    color: '#000',
    boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#3b1a5c' }}>
      {/* Top Bar */}
      <div style={{ maxWidth: 448, margin: '0 auto', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '16px' }}>
        <span onClick={() => navigate(-1)} style={{ color: '#fff', fontSize: 24, cursor: 'pointer' }}>‹</span>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, textAlign: 'center', flexGrow: 1 }}>Create Post</h2>
      </div>

      <div style={{ background: '#3b1a5c', paddingTop: '24px', paddingBottom: '24px' }}>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
        <button
          onClick={() => fileInputRef.current.click()}
          style={{
                width: '100%',
                height: 200,
                borderRadius: 18,
                background: imagePreview ? `url(${imagePreview}) center/cover` : '#4b1fa2',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
                boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004'
          }}
        >
          {!imagePreview && (
            <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7" /><path d="M18 8V2m-3 3h6" /></svg>
                <span style={{ fontWeight: 500, fontSize: 18, marginTop: '8px' }}>Upload picture</span>
            </>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setImageFile(e.target.files[0])} />
        </button>

          <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={inputBoxStyle} />

          <div style={{ position: 'relative' }}>
            <button onClick={() => setIsDatePopupOpen(v => !v)} style={{...inputBoxStyle, textAlign: 'left', width: '100%', color: multiDates.filter(Boolean).length > 0 ? '#000' : '#757575' }}>
              {formatDateForDisplay()}
            </button>
            {isDatePopupOpen && (
              <div ref={datePopupRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', padding: '16px', borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 10, marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', background: '#eee', padding: '4px', borderRadius: 10, marginBottom: '16px' }}>
                  <button onClick={() => setDateMode('simple')} style={dateMode === 'simple' ? activeButtonStyle : inactiveButtonStyle}>Simple</button>
                  <button onClick={() => setDateMode('range')} style={dateMode === 'range' ? activeButtonStyle : inactiveButtonStyle}>Range</button>
                </div>
                {dateMode === 'simple' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto', paddingRight: '5px' }}>
                    {multiDates.map((date, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CustomDateInput
                          value={date}
                          onChange={e => {
                            const newDates = [...multiDates];
                            newDates[idx] = e.target.value;
                            setMultiDates(newDates);
                          }}
                        />
                        {multiDates.length > 1 && (
          <button
            type="button"
                            onClick={() => setMultiDates(multiDates.filter((_, i) => i !== idx))}
                            style={{ marginLeft: 4, background: 'transparent', border: 'none', color: '#a445ff', fontWeight: 700, fontSize: 18, cursor: 'pointer' }}
                            aria-label="Remove day"
          >
                            ×
          </button>
                        )}
                      </div>
                    ))}
                <button
                      type="button"
                      onClick={() => setMultiDates([...multiDates, ''])}
                      style={{ marginTop: 6, background: '#4b1fa2', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 0', fontWeight: 600, cursor: 'pointer' }}
                    >
                      + Add another day
                    </button>
            </div>
          )}
                {dateMode === 'range' && (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <CustomDateInput
                        value={dateRange[0] || ''}
                        onChange={e => setDateRange([e.target.value, dateRange[1]])}
                        placeholder="Start date"
                      />
                      <CustomDateInput
                        value={dateRange[1] || ''}
                        onChange={e => setDateRange([dateRange[0], e.target.value])}
                        placeholder="End date"
              />
            </div>
          )}
                 <button onClick={() => setIsDatePopupOpen(false)} style={{...activeButtonStyle, background: '#6b21a8', color: '#fff', marginTop: '16px', width: '100%'}}>Done</button>
            </div>
          )}
        </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <input type="text" placeholder="Start time" value={startTime} onChange={handleTimeChange(setStartTime)} style={inputBoxStyle} />
            <input type="text" placeholder="End time" value={endTime} onChange={handleTimeChange(setEndTime)} style={inputBoxStyle} />
          </div>
          
          <input type="text" placeholder="Location" value={eventLocation} onChange={e => setEventLocation(e.target.value)} style={inputBoxStyle} />
          <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} style={{...inputBoxStyle, height: 120, resize: 'vertical'}} />

        <button
          style={{
            width: '100%',
              background: uploading ? '#b0b0b0' : 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 18,
            border: 'none',
              borderRadius: 999,
            padding: '14px 0',
              marginTop: 8,
              boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
          disabled={uploading}
            onClick={handleSubmit}
          >
            {uploading ? 'Creating...' : 'Create post'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateCompanyEvent; 