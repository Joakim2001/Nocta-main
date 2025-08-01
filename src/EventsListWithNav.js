import React, { useState, useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import EventsList from './EventsList';
import BarsList from './BarsList';
import CalendarModal from './CalendarModal';

function EventsListWithNav() {
  const [activeTab, setActiveTab] = useState(() => {
    // Try to restore active tab from sessionStorage, default to 'explore'
    const savedTab = sessionStorage.getItem('activeTab');
    console.log('🔍 EventsListWithNav - Initializing with savedTab:', savedTab);
    return savedTab || 'explore';
  });
  const [userFavorites, setUserFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    const loadUserFavorites = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, 'profiles', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserFavorites(userData.favorites || []);
          }
        }
      } catch (error) {
        console.error('Error loading user favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserFavorites();
  }, []);

  // Debug: Log component mount and current state
  useEffect(() => {
    console.log('🔍 EventsListWithNav - Component mounted');
    console.log('🔍 EventsListWithNav - Current activeTab:', activeTab);
    console.log('🔍 EventsListWithNav - sessionStorage activeTab:', sessionStorage.getItem('activeTab'));
  }, []);

  // Save active tab to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
    console.log('🔍 EventsListWithNav - Saved activeTab to sessionStorage:', activeTab);
  }, [activeTab]);

  const renderContent = () => {
    console.log('🔍 EventsListWithNav - activeTab:', activeTab);
    console.log('🔍 EventsListWithNav - userFavorites:', userFavorites);
    
    switch (activeTab) {
      case 'favourites':
        return <EventsList filterFavorites={userFavorites} />;
      case 'trending':
        return <EventsList showOnlyTrending={true} />;
      case 'explore':
      default:
        return <EventsList excludeFavorites={userFavorites} />;
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#3b1a5c', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'white'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#3b1a5c' }}>
      {/* Top Bar with København and search elements */}
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
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          width: '100%', 
          maxWidth: '448px', 
          padding: '0 18px' 
        }}>
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: '#2a0845', 
            color: '#fff', 
            fontWeight: 700, 
            fontSize: 18, 
            borderRadius: 24, 
            padding: '8px 22px', 
            boxShadow: '0 2px 12px #0004', 
            letterSpacing: 0.5, 
            border: '2px solid #fff', 
            textShadow: '0 2px 8px #3E29F099' 
          }}>
            <svg style={{ width: 18, height: 18, color: '#b3e0ff', marginRight: 8 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            København
            <svg style={{ width: 18, height: 18, color: '#b3e0ff', marginLeft: 6 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={{ 
              background: '#2a0845', 
              border: '2px solid #fff', 
              color: '#ffffff', 
              borderRadius: '50%', 
              width: 40, 
              height: 40, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer', 
              boxShadow: '0 2px 12px #0004' 
            }}>
              <svg style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <button 
              onClick={() => setIsCalendarOpen(true)}
              style={{ 
                background: '#2a0845', 
                border: '2px solid #fff', 
                color: '#ffffff', 
                borderRadius: '50%', 
                width: 40, 
                height: 40, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer', 
                boxShadow: '0 2px 12px #0004' 
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Bar */}
      <div style={{ 
        width: '100vw', 
        background: '#3b1a5c', 
        padding: '16px 0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        margin: 0, 
        position: 'relative', 
        zIndex: 1 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: '100%', 
          maxWidth: '448px', 
          padding: '0 18px' 
        }}>
          {/* Circular container around the three buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#3b1a5c',
            borderRadius: 30,
            padding: '8px',
            width: '100%',
            maxWidth: '320px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
          }}>
            <button
              onClick={() => setActiveTab('favourites')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 22,
                background: activeTab === 'favourites' ? '#F941F9' : 'transparent',
                color: activeTab === 'favourites' ? 'white' : '#94a3b8',
                fontWeight: activeTab === 'favourites' ? 700 : 500,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                margin: '0 2px'
              }}
            >
              Favourites
            </button>
            <button
              onClick={() => setActiveTab('trending')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 22,
                background: activeTab === 'trending' ? '#F941F9' : 'transparent',
                color: activeTab === 'trending' ? 'white' : '#94a3b8',
                fontWeight: activeTab === 'trending' ? 700 : 500,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                margin: '0 2px'
              }}
            >
              Trending
            </button>
            <button
              onClick={() => setActiveTab('explore')}
              style={{
                flex: 1,
                padding: '8px 16px',
                borderRadius: 22,
                background: activeTab === 'explore' ? '#F941F9' : 'transparent',
                color: activeTab === 'explore' ? 'white' : '#94a3b8',
                fontWeight: activeTab === 'explore' ? 700 : 500,
                fontSize: 16,
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s',
                margin: '0 2px'
              }}
            >
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {renderContent()}
      
      {/* Calendar Modal */}
      <CalendarModal 
        isOpen={isCalendarOpen} 
        onClose={() => setIsCalendarOpen(false)}
        eventType="club"
      />
    </div>
  );
}

export default EventsListWithNav; 