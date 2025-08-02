import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { CLUB_FESTIVAL_NAMES } from './club_festival_names';
import { filterOutDeletedEvents } from './utils/eventFilters';

function CalendarModal({ isOpen, onClose, eventType = 'all' }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [eventsByDate, setEventsByDate] = useState({});
  const [loading, setLoading] = useState(false);

  // Load all events once when modal opens
  useEffect(() => {
    if (isOpen) {
      loadAllEvents();
    }
  }, [isOpen, eventType]);

  // Helper functions to determine event type
  const isBar = (event) => {
    const username = (event.username || '').toLowerCase();
    const fullname = (event.fullname || '').toLowerCase();
    return !CLUB_FESTIVAL_NAMES.some(name => 
      username.includes(name.toLowerCase()) || 
      fullname.includes(name.toLowerCase())
    );
  };

  const isClubOrFestival = (event) => {
    const username = (event.username || '').toLowerCase();
    const fullname = (event.fullname || '').toLowerCase();
    return CLUB_FESTIVAL_NAMES.some(name => 
      username.includes(name.toLowerCase()) || 
      fullname.includes(name.toLowerCase())
    );
  };

  const loadAllEvents = async () => {
    setLoading(true);
    try {
      // Fetch Instagram_posts
      const snap1 = await getDocs(query(collection(db, "Instagram_posts")));
      // Fetch company-events
      const snap2 = await getDocs(query(collection(db, "company-events")));
      
      // Merge events
      let allEvents = [
        ...snap1.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...snap2.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      ];

      // Filter out events that companies have deleted
      allEvents = await filterOutDeletedEvents(allEvents);

      // Filter events based on type
      if (eventType === 'bar') {
        allEvents = allEvents.filter(event => isBar(event));
      } else if (eventType === 'club') {
        allEvents = allEvents.filter(event => isClubOrFestival(event));
      }

      // Filter future events only
      const now = new Date();
      allEvents = allEvents.filter(event => {
        const start = getEventDate(event);
        const end = getEventDateEnd(event);
        if (!start) return false;
        if (end) {
          return now <= end;
        }
        return start >= now;
      });

      // Group events by date
      const eventsByDateMap = {};
      allEvents.forEach(event => {
        const start = getEventDate(event);
        const end = getEventDateEnd(event);
        
        if (start) {
          const startDate = start.toDateString();
          if (!eventsByDateMap[startDate]) {
            eventsByDateMap[startDate] = [];
          }
          eventsByDateMap[startDate].push(event);
        }
        
        // If there's an end date, add events for each day in the range
        if (end && end.getTime() !== start.getTime()) {
          const currentDate = new Date(start);
          while (currentDate <= end) {
            const dateString = currentDate.toDateString();
            if (!eventsByDateMap[dateString]) {
              eventsByDateMap[dateString] = [];
            }
            // Only add the event once per date to avoid duplicates
            if (!eventsByDateMap[dateString].find(e => e.id === event.id)) {
              eventsByDateMap[dateString].push(event);
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      });

      setEventsByDate(eventsByDateMap);
    } catch (error) {
      console.error('Error loading events for calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventDate = (event) => {
    if (event.eventDate) {
      if (typeof event.eventDate.toDate === 'function') {
        return event.eventDate.toDate();
      }
      const d = new Date(event.eventDate);
      if (!isNaN(d.getTime())) return d;
    }
    if (event.timestamp) {
      if (typeof event.timestamp === 'string') {
        const d = new Date(event.timestamp);
        if (!isNaN(d.getTime())) return d;
      }
      if (event.timestamp.seconds) {
        const d = new Date(event.timestamp.seconds * 1000);
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  };

  const getEventDateEnd = (event) => {
    if (event.eventDateEnd) {
      if (typeof event.eventDateEnd.toDate === 'function') {
        return event.eventDateEnd.toDate();
      }
      const d = new Date(event.eventDateEnd);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const days = getDaysInMonth(currentDate);
  const today = new Date();
  const isToday = (date) => {
    return date && date.toDateString() === today.toDateString();
  };

  const hasEvents = (date) => {
    if (!date) return false;
    const dateString = date.toDateString();
    return eventsByDate[dateString] && eventsByDate[dateString].length > 0;
  };

  const getEventCount = (date) => {
    if (!date) return 0;
    const dateString = date.toDateString();
    return eventsByDate[dateString] ? eventsByDate[dateString].length : 0;
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: '#3b1a5c',
        borderRadius: '16px',
        width: '90%',
        maxWidth: '400px',
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
        border: '2px solid #F941F9'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #4a1f6b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <button
              onClick={goToPreviousMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#F941F9',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              ‹
            </button>
            <h2 style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: '600',
              margin: 0
            }}>
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={goToNextMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#F941F9',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              ›
            </button>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <button
              onClick={goToToday}
              style={{
                background: '#F941F9',
                border: 'none',
                color: 'white',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Today
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#F941F9',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Calendar */}
        <div style={{
          padding: '20px',
          maxHeight: '60vh',
          overflowY: 'auto'
        }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#94a3b8'
            }}>
              Loading events...
            </div>
          ) : (
            <div>
              {/* Day headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px',
                marginBottom: '8px'
              }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} style={{
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '8px 4px'
                  }}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px'
              }}>
                {days.map((day, index) => (
                  <div
                    key={index}
                    style={{
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      background: day ? (isToday(day) ? '#F941F9' : 'transparent') : 'transparent',
                      color: day ? (isToday(day) ? 'white' : 'white') : 'transparent',
                      fontSize: '14px',
                      fontWeight: isToday(day) ? '700' : '500',
                      cursor: day ? 'pointer' : 'default',
                      position: 'relative',
                      minHeight: '40px'
                    }}
                  >
                    {day && (
                      <>
                        <span>{day.getDate()}</span>
                        {hasEvents(day) && (
                          <div style={{
                            position: 'absolute',
                            bottom: '2px',
                            display: 'flex',
                            gap: '2px',
                            justifyContent: 'center'
                          }}>
                            {getEventCount(day) <= 3 ? (
                              // Show individual dots for 1-3 events
                              Array.from({ length: Math.min(getEventCount(day), 3) }).map((_, i) => (
                                <div
                                  key={i}
                                  style={{
                                    width: '4px',
                                    height: '4px',
                                    borderRadius: '50%',
                                    background: '#F941F9',
                                    boxShadow: '0 0 4px #F941F9'
                                  }}
                                />
                              ))
                            ) : (
                              // Show a single dot with count for 4+ events
                              <div style={{
                                position: 'relative',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#F941F9',
                                boxShadow: '0 0 4px #F941F9'
                              }}>
                                <span style={{
                                  position: 'absolute',
                                  top: '-8px',
                                  right: '-8px',
                                  background: '#F941F9',
                                  color: 'white',
                                  fontSize: '8px',
                                  borderRadius: '50%',
                                  width: '12px',
                                  height: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: '600'
                                }}>
                                  {getEventCount(day)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#2a0845',
                borderRadius: '8px',
                border: '1px solid #4a1f6b'
              }}>
                <div style={{
                  color: '#F941F9',
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  Legend
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#94a3b8'
                }}>
                  <div style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: '#F941F9',
                    boxShadow: '0 0 4px #F941F9'
                  }} />
                  <span>Events on this day</span>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginTop: '4px'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: '#F941F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    3+
                  </div>
                  <span>Multiple events (shows count)</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarModal; 