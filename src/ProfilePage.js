import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CLUB_FESTIVAL_NAMES, BAR_NAMES } from './club_festival_names';

function ProfilePage() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [userFavorites, setUserFavorites] = useState([]);
  const [showAddFavorites, setShowAddFavorites] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setEmail(currentUser.email || '');
        
        // Fetch user data from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'profiles', currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setFullName(data.fullname || '');
            setPhone(data.phone || '');
            setUserFavorites(data.favorites || []);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
        setLoading(false);
      } else {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        fullname: fullName,
        phone: phone,
        updatedAt: new Date()
      });
      setUserData(prev => ({ ...prev, fullname: fullName, phone }));
      setEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const addToFavorites = async (venue) => {
    if (!user) return;
    
    const newFavorites = [...userFavorites, venue];
    setUserFavorites(newFavorites);
    
    try {
      await updateDoc(doc(db, 'profiles', user.uid), {
        favorites: newFavorites,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating favorites:', error);
      // Revert on error
      setUserFavorites(userFavorites);
    }
  };

  const removeFromFavorites = async (venueName) => {
    if (!user) return;
    
    const newFavorites = userFavorites.filter(fav => fav.name !== venueName);
    setUserFavorites(newFavorites);
    
    try {
      await updateDoc(doc(db, 'profiles', user.uid), {
        favorites: newFavorites,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating favorites:', error);
      // Revert on error
      setUserFavorites(userFavorites);
    }
  };

  // Get all available venues
  const allVenues = [...CLUB_FESTIVAL_NAMES.map(name => ({ name, type: 'club' })), ...BAR_NAMES.map(name => ({ name, type: 'bar' }))];
  
  // Filter venues based on search and category
  const filteredVenues = allVenues.filter(venue => {
    const matchesSearch = venue.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || venue.type === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date.seconds * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#3b1a5c', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div style={{ color: '#fff', fontSize: 16 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#3b1a5c', paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ 
        width: '100vw', 
        background: '#0f172a', 
        padding: '22px 0 18px 0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        borderBottom: '1px solid #334155', 
        margin: 0, 
        position: 'relative', 
        zIndex: 2 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '448px', padding: '0 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#a445ff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 0.5, textShadow: '0 2px 8px #3E29F099' }}>Profile</div>
              <div style={{ fontSize: 12, color: '#b3e0ff' }}>Account settings</div>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div style={{ padding: '20px', maxWidth: '448px', margin: '0 auto' }}>
        {/* Profile Picture Section */}
        <div style={{ 
          background: '#1e293b', 
          borderRadius: 16, 
          padding: 24, 
          marginBottom: 20,
          textAlign: 'center'
        }}>
          <div style={{ 
            width: 80, 
            height: 80, 
            borderRadius: '50%', 
            background: '#a445ff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px auto',
            fontSize: 32,
            fontWeight: 600,
            color: '#fff'
          }}>
            {userData?.fullname ? userData.fullname.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
            {userData?.fullname || 'User'}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {user?.email}
          </div>
        </div>

        {/* Account Information */}
        <div style={{ 
          background: '#1e293b', 
          borderRadius: 16, 
          padding: 24, 
          marginBottom: 20
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
            Account Information
          </div>
          
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8, display: 'block' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#334155',
                    color: '#fff',
                    fontSize: 14
                  }}
                  placeholder="Enter your full name"
                />
              </div>
              
              <div>
                <label style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8, display: 'block' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#94a3b8',
                    fontSize: 14
                  }}
                />
              </div>
              
              <div>
                <label style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8, display: 'block' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #334155',
                    background: '#334155',
                    color: '#fff',
                    fontSize: 14
                  }}
                  placeholder="Enter your phone number"
                />
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  onClick={() => {
                    setEditing(false);
                    setFullName(userData?.fullname || '');
                    setPhone(userData?.phone || '');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#334155',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#a445ff',
                    border: 'none',
                    borderRadius: 8,
                    color: '#fff',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.6 : 1
                  }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>Full Name</div>
                <div style={{ fontSize: 16, color: '#fff' }}>
                  {userData?.fullname || 'Not set'}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 16, color: '#fff' }}>
                  {user?.email}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>Phone Number</div>
                <div style={{ fontSize: 16, color: '#fff' }}>
                  {userData?.phone || 'Not set'}
                </div>
              </div>
              
              <div>
                <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 4 }}>Member Since</div>
                <div style={{ fontSize: 16, color: '#fff' }}>
                  {formatDate(userData?.createdAt)}
                </div>
              </div>
              
              <button
                onClick={() => setEditing(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#a445ff',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer',
                  marginTop: 8
                }}
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        {/* Account Actions */}
        <div style={{ 
          background: '#1e293b', 
          borderRadius: 16, 
          padding: 24, 
          marginBottom: 20
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
            Account Actions
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={() => navigate('/my-tickets')}
              style={{
                width: '100%',
                padding: '16px',
                background: '#334155',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>My Tickets</span>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            <button
              onClick={() => navigate('/chats')}
              style={{
                width: '100%',
                padding: '16px',
                background: '#334155',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>My Chats</span>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Favorites Management */}
        <div style={{ 
          background: '#1e293b', 
          borderRadius: 16, 
          padding: 24, 
          marginBottom: 20
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
            My Favorites
          </div>
          
          {/* Current Favorites */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>
              Current Favorites ({userFavorites.length})
            </div>
            {userFavorites.length === 0 ? (
              <div style={{ fontSize: 14, color: '#64748b', fontStyle: 'italic' }}>
                No favorites added yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {userFavorites.map((favorite, index) => (
                  <div
                    key={index}
                    style={{
                      background: '#334155',
                      borderRadius: 20,
                      padding: '8px 12px',
                      fontSize: 14,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}
                  >
                    <span>{favorite.name}</span>
                    <button
                      onClick={() => removeFromFavorites(favorite.name)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: 16,
                        display: 'flex',
                        alignItems: 'center'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Favorites Button */}
          <button
            onClick={() => setShowAddFavorites(!showAddFavorites)}
            style={{
              width: '100%',
              padding: '12px',
              background: '#a445ff',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500
            }}
          >
            {showAddFavorites ? 'Hide Add Favorites' : 'Add More Favorites'}
          </button>

          {/* Add Favorites Section */}
          {showAddFavorites && (
            <div style={{ marginTop: 20 }}>
              {/* Search Bar */}
              <input
                type="text"
                placeholder="Search venues..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: '1px solid #334155',
                  background: '#334155',
                  color: '#fff',
                  fontSize: 14,
                  marginBottom: 16
                }}
              />

              {/* Category Tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['all', 'club', 'bar'].map(category => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      background: activeCategory === category ? '#a445ff' : '#334155',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      textTransform: 'capitalize'
                    }}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {/* Venues List */}
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {filteredVenues.length === 0 ? (
                  <div style={{ fontSize: 14, color: '#64748b', textAlign: 'center', padding: '20px' }}>
                    No venues found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredVenues.map((venue, index) => {
                      const isFavorite = userFavorites.some(fav => fav.name === venue.name);
                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: '#334155',
                            borderRadius: 8,
                            border: isFavorite ? '2px solid #a445ff' : '2px solid transparent'
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
                              {venue.name}
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' }}>
                              {venue.type}
                            </div>
                          </div>
                          <button
                            onClick={() => isFavorite ? removeFromFavorites(venue.name) : addToFavorites(venue)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 6,
                              background: isFavorite ? '#ef4444' : '#10b981',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 500
                            }}
                          >
                            {isFavorite ? 'Remove' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          style={{
            width: '100%',
            padding: '16px',
            background: '#ef4444',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default ProfilePage; 