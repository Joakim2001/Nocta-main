import React, { useRef, useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { getFirestore, addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
// Firebase Storage imports removed - using base64 instead
import { useNavigate, useLocation } from 'react-router-dom';
// Removed react-datepicker imports to fix module resolution issues

function CreateCompanyEvent() {
  const fileInputRef = useRef();
  const navigate = useNavigate();
  const location = useLocation();
  const ticketOption = location.state?.ticketOption;
  const ticketConfiguration = location.state?.ticketConfiguration;
  const templateData = location.state?.templateData;
  
  console.log('📋 CreateCompanyEvent - location.state:', location.state);
  console.log('📋 CreateCompanyEvent - templateData:', templateData);
  console.log('📋 CreateCompanyEvent - location.pathname:', location.pathname);
  console.log('📋 CreateCompanyEvent - location.search:', location.search);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreview, setImagePreview] = useState(null);
  const [dateMode, setDateMode] = useState('simple'); // 'simple' or 'range'
  const [multiDates, setMultiDates] = useState(['']);
  const [dateRange, setDateRange] = useState([null, null]);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isDatePopupOpen, setIsDatePopupOpen] = useState(false);
  const datePopupRef = useRef(null);
  const [uploading, setUploading] = useState(false);


  const CustomDateInput = ({ value, onChange, placeholder = "dd-mm-yyyy" }) => {
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
        placeholder={placeholder}
        style={{
          ...inputBoxStyle, 
          flex: 1,
          // Mobile-specific improvements
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          appearance: 'none',
          // Ensure calendar icon is visible on mobile
          backgroundImage: isText ? 'none' : 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%204.9A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%204.9%2012.9l128%20127.1c2.2%202.2%205.2%203.2%208.1%203.2s5.9-1%208.1-3.2L287%2095c3.1-3.1%204.9-7.4%204.9-12.9%200-5-1.8-9.3-4.9-12.7z%22/%3E%3C/svg%3E")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '16px 12px',
          paddingRight: '40px',
          // Better mobile touch targets
          minHeight: '48px',
          fontSize: '16px', // Prevents zoom on iOS
        }}
      />
    );
  };

  useEffect(() => {
    if (imageFiles.length > 0) {
      const urls = imageFiles.map(file => {
        if (file instanceof File || file instanceof Blob) {
          return URL.createObjectURL(file);
        }
        return null;
      }).filter(url => url !== null);
      setImagePreview(urls);
      return () => urls.forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    } else {
      setImagePreview([]);
    }
  }, [imageFiles]);

  // Pre-fill form fields if template data is available
  useEffect(() => {
    console.log('📋 useEffect triggered, templateData:', templateData);
    
    let dataToUse = templateData;
    
    // If no template data in location state, try localStorage and sessionStorage
    if (!dataToUse) {
      // Try localStorage first (for deleted event page)
      let storedData = localStorage.getItem('eventTemplateData');
      if (storedData) {
        try {
          dataToUse = JSON.parse(storedData);
          console.log('📋 Found template data in localStorage:', dataToUse);
        } catch (error) {
          console.error('📋 Error parsing localStorage data:', error);
        }
      }
      
      // If still no data, try sessionStorage (for main events list)
      if (!dataToUse) {
        storedData = sessionStorage.getItem('eventTemplate');
        if (storedData) {
          try {
            dataToUse = JSON.parse(storedData);
            console.log('📋 Found template data in sessionStorage:', dataToUse);
          } catch (error) {
            console.error('📋 Error parsing sessionStorage data:', error);
          }
        }
      }
    }
    
    if (dataToUse) {
      console.log('📋 Pre-filling form with template data:', dataToUse);
      
      // Handle different data structures from localStorage vs sessionStorage
      const title = dataToUse.title || dataToUse.name || '';
      const description = dataToUse.description || dataToUse.caption || '';
      const eventLocation = dataToUse.eventLocation || dataToUse.location || '';
      
      console.log('📋 Setting title to:', title);
      console.log('📋 Setting description to:', description);
      console.log('📋 Setting eventLocation to:', eventLocation);
      
      setTitle(title);
      setDescription(description);
      setEventLocation(eventLocation);
      
      // Handle template images if available
      if (dataToUse.imageUrls && dataToUse.imageUrls.length > 0) {
        console.log('📋 Template has images:', dataToUse.imageUrls.length);
        setImagePreview(dataToUse.imageUrls);
        console.log('📋 Set image preview from template');
      } else if (dataToUse.Image1) {
        // Handle single image from sessionStorage
        console.log('📋 Template has single image:', dataToUse.Image1);
        setImagePreview([dataToUse.Image1]);
        console.log('📋 Set single image preview from template');
      }
      
      // Clear template storage after using it
      localStorage.removeItem('eventTemplateData');
      sessionStorage.removeItem('eventTemplate');
      
      // Note: We don't pre-fill dates as the user should set new dates for the new event
    } else {
      // Only restore saved form data if no template data is being used
      const savedFormData = localStorage.getItem('createEventFormData');
      if (savedFormData) {
        try {
          const formData = JSON.parse(savedFormData);
          console.log('📋 Restoring saved form data for navigation persistence:', formData);
          
          // Only restore if we don't already have data (to avoid overwriting template data)
          if (!title && formData.title) setTitle(formData.title);
          if (!description && formData.description) setDescription(formData.description);
          if (!eventLocation && formData.eventLocation) setEventLocation(formData.eventLocation);
          if (!imagePreview && formData.imagePreview) setImagePreview(formData.imagePreview);
          if (!startTime && formData.startTime) setStartTime(formData.startTime);
          if (!endTime && formData.endTime) setEndTime(formData.endTime);
          if (!multiDates[0] && formData.multiDates) setMultiDates(formData.multiDates);
          if (!dateRange[0] && formData.dateRange) setDateRange(formData.dateRange);
          if (formData.dateMode) setDateMode(formData.dateMode);
          
          console.log('📋 Form data restored for navigation persistence');
        } catch (error) {
          console.error('📋 Error restoring form data:', error);
        }
      } else {
        console.log('📋 No template data or saved form data available');
      }
    }
  }, [templateData]);



  // Save form data to localStorage whenever it changes (for navigation persistence)
  useEffect(() => {
    // Only save if we have actual data (not empty form)
    if (title || description || eventLocation || imagePreview) {
      const formData = {
        title: title || '',
        description: description || '',
        eventLocation: eventLocation || '',
        imagePreview: imagePreview || null,
        startTime: startTime || '',
        endTime: endTime || '',
        multiDates: multiDates || [''],
        dateRange: dateRange || [null, null],
        dateMode: dateMode || 'simple'
      };
      
      localStorage.setItem('createEventFormData', JSON.stringify(formData));
      console.log('📋 Form data saved for navigation persistence');
    }
  }, [title, description, eventLocation, imagePreview, startTime, endTime, multiDates, dateRange, dateMode]);

  // Debug: Log state changes
  useEffect(() => {
    console.log('📋 State updated - title:', title, 'description:', description, 'eventLocation:', eventLocation);
  }, [title, description, eventLocation]);

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

  const handleImageSelect = (index) => {
    if (imageFiles.length > 1) {
      const newFiles = [...imageFiles];
      const selectedFile = newFiles[index];
      newFiles.splice(index, 1);
      newFiles.unshift(selectedFile);
      setImageFiles(newFiles);
    }
  };

  const handleRemoveImage = (index) => {
    if (imageFiles.length > 1) {
      const newFiles = imageFiles.filter((_, i) => i !== index);
      setImageFiles(newFiles);
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

    if (!user || !title || !isDateValid() || imageFiles.length === 0) {
      alert("Please fill all required fields and upload an image.");
      return;
    }
    
    // Show user that image will use default due to technical issues
    if (imageFiles.length > 0) {
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
      
      // Convert images to base64 and store directly in Firestore
      const imageUrls = [];
      
      if (imageFiles.length > 0) {
        try {
          console.log(`Converting ${imageFiles.length} images to base64...`);
          
          for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            
            // Convert file to base64
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            
            imageUrls.push(base64);
            console.log(`✅ Image ${i + 1} converted to base64 successfully`);
          }
          
          // Set the first image as the main image
          imageUrl = imageUrls[0];
          console.log(`✅ Set main image: ${imageUrl.substring(0, 50)}...`);
          
        } catch (conversionError) {
          console.error("❌ Image conversion failed:", conversionError);
          imageUrl = '/default-tyrolia.jpg';
          imageUrls.push('/default-tyrolia.jpg');
        }
      } else {
        console.log("No image files provided, using default image");
        imageUrl = '/default-tyrolia.jpg';
        imageUrls.push('/default-tyrolia.jpg');
      }
      
      const eventData = {
        userId: user.uid,
        title,
        description,
        location: eventLocation,
        imageUrl, // Main image (first image)
        imageUrls: imageUrls.length > 0 ? imageUrls : [imageUrl], // All images
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

      // Debug logging to verify image data
      console.log(`📸 Event creation - Total images to save: ${imageUrls.length}`);
      console.log(`📸 Event creation - imageUrls array:`, imageUrls.map((url, i) => `Image ${i + 1}: ${url.substring(0, 50)}...`));
      console.log(`📸 Event creation - imageUrl (main): ${imageUrl.substring(0, 50)}...`);

      if (dateMode === 'simple') {
        eventData.eventDates = multiDates.map(d => new Date(d)).sort((a,b) => a - b);
        // Set the first date as the main eventDate for filtering, combining with startTime
        if (multiDates.filter(Boolean).length > 0) {
          const baseDate = new Date(multiDates.filter(Boolean)[0]);
          
          // Combine the date with the startTime
          if (startTime) {
            const [hours, minutes] = startTime.split(':').map(Number);
            baseDate.setHours(hours, minutes, 0, 0);
          }
          
          eventData.eventDate = baseDate;
          console.log('📅 Created eventDate with startTime:', {
            originalDate: multiDates.filter(Boolean)[0],
            startTime: startTime,
            finalEventDate: baseDate,
            finalEventDateString: baseDate.toISOString()
          });
        }
      } else if (dateMode === 'range') {
        const [rangeStart, rangeEnd] = dateRange;
        
        // Combine start date with startTime
        if (startTime) {
          const [hours, minutes] = startTime.split(':').map(Number);
          rangeStart.setHours(hours, minutes, 0, 0);
        }
        eventData.eventDate = rangeStart;
        
        if (rangeEnd) {
          // Combine end date with endTime
          if (endTime) {
            const [hours, minutes] = endTime.split(':').map(Number);
            rangeEnd.setHours(hours, minutes, 0, 0);
          }
          eventData.eventDateEnd = rangeEnd;
        }
        
        console.log('📅 Created eventDate range with times:', {
          startTime: startTime,
          endTime: endTime,
          finalEventDate: rangeStart,
          finalEventDateEnd: rangeEnd
        });
      }

      await addDoc(collection(db, 'Instagram_posts'), eventData);
      
      // Clear saved form data after successful submission
      localStorage.removeItem('createEventFormData');
      console.log('📋 Form data cleared after successful submission');
      
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
    <div style={{ background: '#3b1a5c', minHeight: '100vh', overflowY: 'auto' }}>

      
      {/* Top Bar */}
      <div style={{ maxWidth: 448, margin: '0 auto', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <span onClick={() => navigate('/ticket-configuration')} style={{ color: '#fff', fontSize: 24, cursor: 'pointer' }}>‹</span>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, textAlign: 'center', flexGrow: 1 }}>Create Post</h2>
      </div>

      <div style={{ background: '#3b1a5c', paddingTop: '24px', paddingBottom: '100px' }}>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
        {/* Template Indicator */}
        {templateData && (
          <div style={{
            background: 'linear-gradient(135deg, #4b1fa2 0%, #a445ff 100%)',
            borderRadius: 12,
            padding: '16px',
            color: '#fff',
            textAlign: 'center',
            boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004'
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: '4px' }}>
              📋 Creating from Template
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>
              Form pre-filled from "{templateData.title || 'Previous Event'}"
            </div>
            {templateData.imageUrls && templateData.imageUrls.length > 0 && (
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: '4px' }}>
                📸 {templateData.imageUrls.length} image{templateData.imageUrls.length !== 1 ? 's' : ''} copied
              </div>
            )}
            {templateData.ticketType && (
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: '2px' }}>
                🎫 Ticket type: {templateData.ticketType}
              </div>
            )}
          </div>
        )}
        
        {/* Image Upload Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Main Upload Button */}
          <button
            onClick={() => fileInputRef.current.click()}
            style={{
              width: '100%',
              height: 200,
              borderRadius: 18,
              background: imagePreview && imagePreview.length > 0 ? `url(${imagePreview[0]}) center/cover` : '#4b1fa2',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
              position: 'relative'
            }}
          >
            {(!imagePreview || imagePreview.length === 0) && (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h7" /><path d="M18 8V2m-3 3h6" /></svg>
                <span style={{ fontWeight: 500, fontSize: 18, marginTop: '8px' }}>Upload pictures</span>
                <span style={{ fontSize: 14, marginTop: '4px', opacity: 0.8 }}>Select multiple images</span>
              </>
            )}
            
            {/* Add More Button Overlay */}
            {imagePreview && imagePreview.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 12,
                right: 12,
                background: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '50%',
                width: 48,
                height: 48,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '2px solid #fff'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
            )}
            
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
              const newFiles = Array.from(e.target.files);
              if (newFiles.length > 0) {
                setImageFiles(prev => [...prev, ...newFiles]);
                // Clear the input value to allow selecting the same file again
                e.target.value = '';
              }
            }} />
          </button>

          {/* Image Preview Gallery */}
          {imagePreview && imagePreview.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#666' }}>
                  {imagePreview.length} image{imagePreview.length !== 1 ? 's' : ''} selected
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 0', maxWidth: '100%' }}>
                {imagePreview.map((preview, index) => (
                  <div key={index} style={{ position: 'relative', flexShrink: 0 }}>
                    <img 
                      src={preview} 
                      alt={`Preview ${index + 1}`}
                      style={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 8, 
                        objectFit: 'cover',
                        border: index === 0 ? '3px solid #4b1fa2' : '1px solid #ddd',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleImageSelect(index)}
                    />
                    <button
                      onClick={() => handleRemoveImage(index)}
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: '#ff4444',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 16,
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    >
                      ×
                    </button>
                    {index === 0 && (
                      <div style={{
                        position: 'absolute',
                        bottom: 4,
                        left: 4,
                        background: '#4b1fa2',
                        color: '#fff',
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 'bold'
                      }}>
                        Main
                      </div>
                    )}
                    <div style={{
                      position: 'absolute',
                      top: 4,
                      left: 4,
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: '#fff',
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 'bold'
                    }}>
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
              
              <div style={{ fontSize: 12, color: '#666', textAlign: 'center' }}>
                💡 Tap an image to make it the main image • Tap × to remove
              </div>
            </div>
          )}
        </div>

          <input type="text" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} style={inputBoxStyle} />

          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setIsDatePopupOpen(v => !v)} 
              style={{
                ...inputBoxStyle, 
                textAlign: 'left', 
                width: '100%', 
                color: multiDates.filter(Boolean).length > 0 ? '#000' : '#757575',
                // Mobile improvements
                minHeight: '48px',
                fontSize: '16px',
                cursor: 'pointer',
                // Add visual indicator for mobile
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23999%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%204.9A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%204.9%2012.9l128%20127.1c2.2%202.2%205.2%203.2%208.1%203.2s5.9-1%208.1-3.2L287%2095c3.1-3.1%204.9-7.4%204.9-12.9%200-5-1.8-9.3-4.9-12.7z%22/%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px 12px',
                paddingRight: '48px',
              }}
            >
              {formatDateForDisplay()}
            </button>
            {isDatePopupOpen && (
              <div ref={datePopupRef} style={{ 
                position: 'absolute', 
                top: '100%', 
                left: 0, 
                right: 0, 
                background: '#fff', 
                padding: '16px', 
                borderRadius: 12, 
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)', 
                zIndex: 10, 
                marginTop: '8px',
                // Mobile improvements
                maxHeight: '80vh',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch'
              }}>
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