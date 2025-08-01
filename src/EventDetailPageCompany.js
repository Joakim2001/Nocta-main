import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { doc, getDoc, deleteDoc, collection, setDoc, getDocs } from "firebase/firestore";
import { storage } from './firebase';
import { ref, getDownloadURL } from "firebase/storage";
import { getAuth } from 'firebase/auth';
import BottomNavCompany from './BottomNavCompany';

export default function EventDetailPageCompany() {
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  useEffect(() => {
    async function fetchEvent() {
      try {
        console.log('🔍 [FETCH] Starting event fetch for ID:', id);
        
        // Try Instagram_posts first
        let docRef = doc(db, "Instagram_posts", id);
        let docSnap = await getDoc(docRef);
        console.log('🔍 [FETCH] Instagram_posts direct lookup exists:', docSnap.exists());
        
        if (!docSnap.exists()) {
          // Try company-events if not found
          console.log('🔍 [FETCH] Trying company-events...');
          docRef = doc(db, "company-events", id);
          docSnap = await getDoc(docRef);
          console.log('🔍 [FETCH] company-events direct lookup exists:', docSnap.exists());
        }
        
        // If still not found, search all documents for ID mismatch
        if (!docSnap.exists()) {
          console.log('🔍 [FETCH] Not found by direct lookup - searching all collections...');
          
          // Search Instagram_posts by content
          const instaSnapshot = await getDocs(collection(db, 'Instagram_posts'));
          console.log('🔍 [FETCH] Searching', instaSnapshot.docs.length, 'Instagram_posts documents');
          
          let foundEvent = null;
          instaSnapshot.docs.forEach(doc => {
            const data = doc.data();
            console.log('🔍 [FETCH] Checking doc ID:', doc.id, 'title:', data.title);
            
            // Try to match by various possible IDs or content
            if (doc.id === id || data.originalId === id || data.id === id) {
              console.log('✅ [FETCH] Found match in Instagram_posts by ID');
              foundEvent = { id: doc.id, ...data };
            }
          });
          
          if (foundEvent) {
            console.log('✅ [FETCH] Using found event from Instagram_posts:', foundEvent.id);
            docSnap = { exists: () => true, id: foundEvent.id, data: () => foundEvent };
          } else {
            // Search company-events by content
            console.log('🔍 [FETCH] Searching company-events collection...');
            const companySnapshot = await getDocs(collection(db, 'company-events'));
            console.log('🔍 [FETCH] Searching', companySnapshot.docs.length, 'company-events documents');
            
            companySnapshot.docs.forEach(doc => {
              const data = doc.data();
              console.log('🔍 [FETCH] Checking doc ID:', doc.id, 'title:', data.title);
              
              if (doc.id === id || data.originalId === id || data.id === id) {
                console.log('✅ [FETCH] Found match in company-events by ID');
                foundEvent = { id: doc.id, ...data };
              }
            });
            
            if (foundEvent) {
              console.log('✅ [FETCH] Using found event from company-events:', foundEvent.id);
              docSnap = { exists: () => true, id: foundEvent.id, data: () => foundEvent };
            }
          }
        }
        
        if (docSnap.exists()) {
          const eventData = { id: docSnap.id, ...docSnap.data() };
          console.log('✅ [FETCH] Final event loaded:', eventData.id, eventData.title);
          setEvent(eventData);

          // Load all available images (Image0 to Image9) - filter and sort
          const imageFields = [
            eventData.Image0, eventData.Image1, eventData.Image2, eventData.Image3, eventData.Image4,
            eventData.Image5, eventData.Image6, eventData.Image7, eventData.Image8, eventData.Image9
          ];
          
          // Filter images: match event ID (without "A") with file ID (without "_imageX")
          const eventIdWithoutA = eventData.id.replace(/^A/, '');
          const validImageFields = imageFields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => field && 
              (field.startsWith('http') || field))
            .filter(({ field }) => {
              // For Firebase Storage paths, check if they match the event ID
              if (field && !field.startsWith('http')) {
                // Remove "events/" prefix and "_ImageX" suffix to get the file ID
                const fileId = field
                  .replace(/^events\//, '') // Remove "events/" prefix
                  .replace(/_Image\d+\.jpg$/, ''); // Remove "_ImageX.jpg" suffix (uppercase I)
                
                const matchesEventId = fileId === eventIdWithoutA;
                return matchesEventId;
              }
              return true; // Keep HTTP URLs
            })
            .map(({ field, index }) => {
              // Convert paths to match actual file structure
              if (field && !field.startsWith('http')) {
                // Remove "events/" prefix and convert Image to image (lowercase)
                const correctedPath = field
                  .replace(/^events\//, '') // Remove "events/" prefix
                  .replace(/_Image(\d+)\.jpg$/, '_image$1.jpg'); // Convert Image to image
                return { field: correctedPath, index };
              }
              return { field, index };
            })
            .sort((a, b) => a.index - b.index); // Sort by index (lowest number first)
          
          if (validImageFields.length > 0) {
            const urls = [];
            for (const { field: imagePath } of validImageFields) {
              if (imagePath.startsWith('http')) {
                urls.push(imagePath);
              } else {
                try {
                  const url = await getDownloadURL(ref(storage, imagePath));
                  urls.push(url);
                } catch (e) {
                  console.error("Error getting download URL:", e);
                  // Skip this image if it fails to load
                }
              }
            }
            
            if (urls.length > 0) {
              setImageUrls(urls);
            } else {
              setImageUrls(['/default-tyrolia.jpg']);
            }
          } else {
            setImageUrls(['/default-tyrolia.jpg']);
          }
        } else {
          console.log('❌ [FETCH] Event not found anywhere');
          setEvent(null);
        }
      } catch (err) {
        console.error("Error fetching event:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [id]);

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen text-white bg-slate-900">Loading...</div>;
  }
  if (!event) {
    return <div className="flex justify-center items-center min-h-screen text-white bg-slate-900">Event not found.</div>;
  }

  const { title, caption, location, url, username, fullname, description, eventDate, eventDateEnd, venue, club } = event;
  const eventTitle = title || caption?.substring(0, 50) + (caption?.length > 50 ? '...' : '') || 'Event';
  const instagramHandle = username || fullname || 'Unknown';
  const locationText = location || venue || club || fullname;
  
  const getEventDate = (dateField) => {
    if (!dateField) return null;
    return typeof dateField.toDate === 'function' ? dateField.toDate() : new Date(dateField);
  };

  const startDate = getEventDate(eventDate);
  const endDate = getEventDate(eventDateEnd);
  
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Swipe functions
  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && imageUrls.length > 1) {
      setCurrentImageIndex(prev => prev === imageUrls.length - 1 ? 0 : prev + 1);
    }
    if (isRightSwipe && imageUrls.length > 1) {
      setCurrentImageIndex(prev => prev === 0 ? imageUrls.length - 1 : prev - 1);
    }
  };

  const dateText = startDate && endDate && startDate.getTime() !== endDate.getTime()
    ? `${formatDate(startDate)} to ${formatDate(endDate)}`
    : startDate ? formatDate(startDate) : '';

  const handleDelete = async () => {
    setDeleting(true);
    console.log('🗑️ Starting delete with event data:', event);
    console.log('🗑️ URL ID:', id, 'vs Event ID:', event.id);
    
    try {
      let deletedData = null;
      let deleteSuccess = false;
      
      // Use the ACTUAL event ID from the loaded event, not the URL ID
      const actualEventId = event.id; // This is the real database ID
      console.log('🗑️ Using actual event ID for delete:', actualEventId);
      
      // Try to get from instagram_posts first
      console.log('🗑️ Checking Instagram_posts for ID:', actualEventId);
      const instaDocRef = doc(db, 'Instagram_posts', actualEventId);
      const instaSnap = await getDoc(instaDocRef);
      
              if (instaSnap.exists()) {
          console.log('✅ Found in Instagram_posts - proceeding with delete');
          deletedData = {
            ...instaSnap.data(),
            deletedAt: new Date(),
            deletedBy: 'manual-company',
            originalId: actualEventId
          };
          // Use the ACTUAL event ID for both operations
          await setDoc(doc(db, 'deleted_posts', actualEventId), deletedData);
          await deleteDoc(instaDocRef);
          deleteSuccess = true;
          console.log('✅ Successfully moved from Instagram_posts to deleted_posts');
        } else {
          console.log('❌ Not found in Instagram_posts, checking company-events');
          // Try company-events
          const companyDocRef = doc(db, 'company-events', actualEventId);
          const companySnap = await getDoc(companyDocRef);
          
          if (companySnap.exists()) {
            console.log('✅ Found in company-events - proceeding with delete');
            deletedData = {
              ...companySnap.data(),
              deletedAt: new Date(),
              deletedBy: 'manual-company',
              originalId: actualEventId
            };
            // Use the ACTUAL event ID for both operations
            await setDoc(doc(db, 'deleted_posts', actualEventId), deletedData);
            await deleteDoc(companyDocRef);
            deleteSuccess = true;
            console.log('✅ Successfully moved from company-events to deleted_posts');
          } else {
            console.log('❌ Not found in either collection with ID:', actualEventId);
            console.log('❌ This suggests the event data is inconsistent');
            throw new Error('Event not found in any collection with the provided ID');
          }
        }
      
      if (deleteSuccess) {
        console.log('✅ Delete operation completed successfully');
      }
      
      navigate('/company-events');
    } catch (err) {
      console.error('❌ Delete failed:', err);
      alert('Failed to delete event: ' + err.message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#3b1a5c', color: '#fff', paddingBottom: 100 }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: '#3b1a5c',
        borderBottom: '1px solid #1e293b',
        maxWidth: 448,
        margin: '0 auto'
      }}>
        <span
          onClick={() => {
            // Check if we came from the main events page (with tabs)
            const activeTab = sessionStorage.getItem('activeTab');
            if (activeTab) {
              console.log('🔍 EventDetailCompany - Returning to tab:', activeTab);
              // Navigate back to the main page, the tab will be restored automatically
              navigate('/');
            } else {
              // Fallback to normal back navigation
              navigate(-1);
            }
          }}
          style={{ position: 'absolute', left: 28, top: 20, color: '#2046A6', fontSize: 32, fontWeight: 700, cursor: 'pointer', userSelect: 'none', lineHeight: 1 }}
        >
          {'‹'}
        </span>
        <a
          href={`https://instagram.com/${instagramHandle}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'transparent',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: 999,
            border: '1px solid #fff',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: instagramHandle.length > 15 ? '12px' : '14px',
            whiteSpace: 'nowrap',
            display: 'inline-block',
            textAlign: 'center',
            minWidth: 'fit-content',
            maxWidth: '250px'
          }}
        >
          @{instagramHandle}
        </a>
      </div>

      <div style={{ maxWidth: 448, margin: '0 auto', padding: '0 16px' }}>
        {/* Image Carousel */}
        <div 
          style={{ position: 'relative', height: '12rem', margin: '16px 0', borderRadius: 18, overflow: 'hidden', boxShadow: '0 6px 18px 2px #0008' }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {imageUrls && imageUrls.length > 0 && (
            <>
              <img 
                src={imageUrls[currentImageIndex]} 
                alt={eventTitle} 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  display: 'block',
                  transition: 'opacity 0.3s ease-in-out'
                }} 
              />
              
              {/* Navigation arrows - only show if multiple images */}
              {imageUrls.length > 1 && (
                <>
                  {/* Left arrow */}
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === 0 ? imageUrls.length - 1 : prev - 1)}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      fontSize: '20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}
                  >
                    ‹
                  </button>
                  
                  {/* Right arrow */}
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === imageUrls.length - 1 ? 0 : prev + 1)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      fontSize: '20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 10
                    }}
                  >
                    ›
                  </button>
                </>
              )}
              
              {/* Image indicators - always show if multiple images */}
              {imageUrls.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '8px',
                  zIndex: 10
                }}>
                  {imageUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        border: 'none',
                        background: index === currentImageIndex ? 'white' : 'rgba(255, 255, 255, 0.5)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Title */}
        <h1 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 600, margin: '24px 0' }}>
          {eventTitle}
        </h1>

        
        {/* Description Card */}
        {(description || (caption && caption.length > 50)) && (
                  <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>DESCRIPTION</h2>
          <p style={{ fontWeight: 600, color: '#1f2937', whiteSpace: 'pre-wrap' }}>{description || caption}</p>
          </div>
        )}
        
        {/* Date Card */}
        {dateText && (
                  <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>DATE</h2>
          <p style={{ fontWeight: 600, color: '#1f2937' }}>{dateText}</p>
          </div>
        )}
        
        {/* Location Card */}
        {locationText && (
                  <div style={{ background: '#fff', color: '#1f2937', borderRadius: 12, padding: '16px', margin: '16px 0', boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#6b21a8', marginBottom: '8px' }}>LOCATION</h2>
          {location ? (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, textDecoration: 'underline', color: '#1d4ed8' }}>
              {locationText}
            </a>
          ) : (
            <p style={{ fontWeight: 600, color: '#1f2937' }}>{locationText}</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '32px' }}>
            <button 
                onClick={() => setShowDeleteModal(true)}
                disabled={deleting}
                style={{
                    flex: 1,
                    background: '#dc2626',
                    color: '#fff',
                    padding: '14px',
                    borderRadius: 999,
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '1rem',
                    boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    opacity: deleting ? 0.7 : 1
                }}
            >
                {deleting ? 'Deleting...' : 'Delete'}
            </button>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" style={{
                flex: 1,
                background: 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
                color: 'white',
                padding: '14px',
                borderRadius: 999,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                boxShadow: '0 4px 16px 1px #0008, 0 2px 8px 1px #0004',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                See post
              </a>
            )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            color: '#fff'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Delete Event</h3>
              <button 
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: '#cbd5e1', fontSize: '16px' }}>Are you sure you want to delete this event?</p>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '8px' }}>This action cannot be undone.</p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  flex: 1,
                  background: '#64748b',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '16px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  background: '#dc2626',
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '16px',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.7 : 1
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNavCompany />
    </div>
  );
}