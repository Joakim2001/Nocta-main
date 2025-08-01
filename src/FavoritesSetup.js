import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { CLUB_FESTIVAL_NAMES, BAR_NAMES } from './club_festival_names';

function FavoritesSetup() {
  const [selectedFavorites, setSelectedFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const navigate = useNavigate();

  // Get all available clubs and bars (no duplication)
  const allVenues = [
    ...CLUB_FESTIVAL_NAMES.map(name => ({ name, type: 'club' })),
    ...BAR_NAMES.map(name => ({ name, type: 'bar' }))
  ];

  // Filter venues based on search term and category
  const filteredVenues = allVenues.filter(venue => {
    const matchesSearch = venue.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || venue.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleToggleFavorite = (venue) => {
    setSelectedFavorites(prev => {
      const isSelected = prev.some(fav => fav.name === venue.name);
      if (isSelected) {
        return prev.filter(fav => fav.name !== venue.name);
      } else {
        return [...prev, venue];
      }
    });
  };

  const handleContinue = async () => {
    setLoading(true);
    setError('');
    
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Save favorites to user profile
      await setDoc(doc(db, 'profiles', user.uid), {
        favorites: selectedFavorites,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Clear signup flow flags since user has completed the entire flow
      localStorage.removeItem('isNewSignup');
      localStorage.removeItem('wasInSignupFlow');
      setLoading(false);
      console.log('🔍 FavoritesSetup: Navigating to /home after saving favorites');
      navigate('/home'); // Navigate to main events page
    } catch (err) {
      setError('Failed to save favorites: ' + (err.message || err));
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Clear signup flow flags since user has completed the entire flow
    localStorage.removeItem('isNewSignup');
    localStorage.removeItem('wasInSignupFlow');
    console.log('🔍 FavoritesSetup: Navigating to /home after skipping');
    navigate('/home'); // Navigate to main events page
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
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: 0, textAlign: 'center' }}>Choose Your Favorites</h2>
        <p style={{ color: '#ccc', fontSize: 16, margin: '8px 0 32px 0', opacity: 0.85, textAlign: 'center' }}>
          Select your favorite clubs and bars to see their events first
        </p>
        
        <div style={{ width: '100%', maxWidth: 340, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Search Bar */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search clubs and bars..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.2)',
                fontSize: 16,
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                outline: 'none',
                transition: 'all 0.2s',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#ccc',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: 4,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            {[
              { key: 'all', label: 'All', count: allVenues.length },
              { key: 'club', label: 'Club', count: allVenues.filter(v => v.type === 'club').length },
              { key: 'bar', label: 'Bar', count: allVenues.filter(v => v.type === 'bar').length }
            ].map(category => (
              <button
                key={category.key}
                onClick={() => setActiveCategory(category.key)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: activeCategory === category.key ? '1px solid #F941F9' : '1px solid rgba(255,255,255,0.2)',
                  background: activeCategory === category.key ? 'rgba(249, 65, 249, 0.15)' : 'rgba(255,255,255,0.08)',
                  color: activeCategory === category.key ? '#F941F9' : 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {category.label}
                <span style={{ 
                  fontSize: 12, 
                  opacity: 0.7,
                  background: activeCategory === category.key ? 'rgba(249, 65, 249, 0.2)' : 'rgba(255,255,255,0.1)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}>
                  {category.count}
                </span>
              </button>
            ))}
          </div>

          {/* Favorites Selection */}
          <div style={{ 
            maxHeight: '400px', 
            overflowY: 'auto', 
            background: 'rgba(255,255,255,0.08)', 
            borderRadius: 16, 
            padding: 16,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: '0 0 16px 0', textAlign: 'left' }}>
              Select Your Favorites ({selectedFavorites.length} selected)
            </h3>
            
            {filteredVenues.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                color: '#ccc', 
                padding: '32px 16px',
                fontSize: 16 
              }}>
                {searchTerm ? `No venues found matching "${searchTerm}"` : 'No venues available'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filteredVenues.map((venue, index) => {
                  const isSelected = selectedFavorites.some(fav => fav.name === venue.name);
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleToggleFavorite(venue)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        borderRadius: 12,
                        border: isSelected ? '2px solid #F941F9' : '1px solid rgba(255,255,255,0.2)',
                        background: isSelected ? 'rgba(249, 65, 249, 0.15)' : 'rgba(255,255,255,0.08)',
                        color: 'white',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left',
                        width: '100%'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: venue.type === 'club' ? '#F941F9' : '#3E29F0'
                        }} />
                        <span style={{ fontWeight: 500 }}>{venue.name}</span>
                        <span style={{ 
                          fontSize: 12, 
                          opacity: 0.7, 
                          textTransform: 'uppercase',
                          background: venue.type === 'club' ? 'rgba(249, 65, 249, 0.2)' : 'rgba(62, 41, 240, 0.2)',
                          padding: '2px 8px',
                          borderRadius: 8
                        }}>
                          {venue.type}
                        </span>
                      </div>
                      {isSelected && (
                        <span style={{ color: '#F941F9', fontSize: 18 }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ color: '#ffb3ff', fontSize: 14, marginBottom: 8, minHeight: 18 }}>{error}</div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={handleSkip}
              style={{
                flex: 1,
                padding: '16px 0',
                borderRadius: 32,
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                fontWeight: 600,
                fontSize: 16,
                border: '1px solid rgba(255,255,255,0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              disabled={loading}
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleContinue}
              style={{
                flex: 1,
                padding: '16px 0',
                borderRadius: 32,
                background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 24px #3E29F055',
                transition: 'background 0.2s, box-shadow 0.2s',
                letterSpacing: 0.5,
              }}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FavoritesSetup; 