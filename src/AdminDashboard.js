import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import BottomNavCompany from './BottomNavCompany';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [validationMode, setValidationMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;

  // Fetch user's events
  useEffect(() => {
    if (!user) {
      navigate('/company-login');
      return;
    }

    fetchUserEvents();
  }, [user, navigate]);

  const fetchUserEvents = async () => {
    try {
      // Get ALL events from Instagram_posts collection first to debug
      const eventsSnapshot = await getDocs(collection(db, 'Instagram_posts'));
      
      const allEvents = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const userEvents = allEvents.filter(event => event.userId === user.uid);

      console.log('=== EVENT DEBUGGING ===');
      console.log('Current user UID:', user.uid);
      console.log('Current user email:', user.email);
      console.log('Total events in database:', allEvents.length);
      console.log('Events matching current user:', userEvents.length);
      
      console.log('=== ALL EVENTS DETAILS ===');
      allEvents.forEach((event, index) => {
        console.log(`Event ${index + 1}:`, {
          id: event.id,
          title: event.title,
          username: event.username,
          userId: event.userId,
          hasUserId: !!event.userId,
          matches: event.userId === user.uid,
          allFields: Object.keys(event)
        });
      });
      
      console.log('=== EVENTS WITH "aveant" IN NAME ===');
      const aveantEvents = allEvents.filter(e => 
        (e.title && e.title.toLowerCase().includes('aveant')) ||
        (e.username && e.username.toLowerCase().includes('aveant')) ||
        (e.venue && e.venue.toLowerCase().includes('aveant'))
      );
      console.log('Aveant events found:', aveantEvents.length);
      aveantEvents.forEach(event => {
        console.log('Aveant event:', {
          id: event.id,
          title: event.title,
          username: event.username,
          userId: event.userId,
          venue: event.venue
        });
      });
      
      setEvents(userEvents);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching events:', error);
      setLoading(false);
    }
  };

  const fetchEventTickets = async (eventName) => {
    try {
      setLoading(true);
      console.log('Fetching tickets for event:', eventName);
      console.log('Event name type:', typeof eventName);
      console.log('Event name value:', JSON.stringify(eventName));

      if (!eventName) {
        console.error('Event name is missing or undefined');
        setTickets([]);
        setSummary(null);
        setLoading(false);
        return;
      }

      const response = await fetch('https://europe-west1-nocta-d1113.cloudfunctions.net/getEventTickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eventName: eventName,
          managerId: user.uid
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setTickets(data.tickets);
        setSummary(data.summary);
        console.log('Event tickets loaded:', data.tickets.length);
      } else {
        console.error('Error from function:', data.error);
        setTickets([]);
        setSummary(null);
      }
    } catch (error) {
      console.error('Error fetching event tickets:', error);
      setTickets([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const validateTicket = async (ticketId) => {
    if (!selectedEvent || !ticketId.trim()) return;

    try {
      setValidationResult({ loading: true });

      const response = await fetch('https://europe-west1-nocta-d1113.cloudfunctions.net/validateTicket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticketId: ticketId.trim(),
          eventName: selectedEvent.event_name || selectedEvent.title,
          managerId: user.uid
        })
      });

      const data = await response.json();
      setValidationResult(data);

      // Clear input after validation
      setScanInput('');

      // Refresh ticket list if validation was successful
      if (data.valid) {
        fetchEventTickets(selectedEvent.event_name);
      }

    } catch (error) {
      console.error('Error validating ticket:', error);
      setValidationResult({
        success: false,
        valid: false,
        message: 'Error validating ticket'
      });
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.seconds) return 'Unknown';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const assignUserIdToAveantEvents = async () => {
    try {
      console.log('=== FIXING AVEANT EVENTS ===');
      
      // Get all events
      const eventsSnapshot = await getDocs(collection(db, 'Instagram_posts'));
      const allEvents = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        docRef: doc.ref,
        ...doc.data()
      }));

      // Find Aveant events without userId
      const aveantEventsToFix = allEvents.filter(event => {
        const isAveant = (event.title && event.title.toLowerCase().includes('aveant')) ||
                        (event.username && event.username.toLowerCase().includes('aveant')) ||
                        (event.venue && event.venue.toLowerCase().includes('aveant'));
        const needsUserId = !event.userId || event.userId === undefined;
        return isAveant && needsUserId;
      });

      console.log('Aveant events to fix:', aveantEventsToFix.length);

      // Update each event with the current user ID
      for (const event of aveantEventsToFix) {
        await updateDoc(doc(db, 'Instagram_posts', event.id), {
          userId: user.uid
        });
        console.log('Fixed event:', event.title, 'ID:', event.id);
      }

      console.log('=== FIXED', aveantEventsToFix.length, 'AVEANT EVENTS ===');
      
      // Refresh the events list
      fetchUserEvents();
      
    } catch (error) {
      console.error('Error fixing Aveant events:', error);
    }
  };

  if (loading && !selectedEvent) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#3b1a5c',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white'
      }}>
        Loading your events...
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#3b1a5c',
        color: 'white',
        padding: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => navigate('/company')}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '24px',
              cursor: 'pointer',
              marginRight: '15px'
            }}
          >
            ‹
          </button>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Admin Dashboard</h1>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '15px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '15px' }}>Select Event to Manage</h2>
          
          {events.length === 0 ? (
            <p style={{ opacity: 0.8 }}>No events found. Create an event first to see ticket sales.</p>
          ) : (
            <div>
              <div style={{ marginBottom: '10px' }}>
                <button 
                  onClick={() => {
                    console.log('=== MANUAL DEBUG TRIGGER ===');
                    fetchUserEvents();
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '5px',
                    padding: '10px',
                    marginRight: '10px',
                    cursor: 'pointer'
                  }}
                >
                  🔍 Debug Events
                </button>
                <button 
                  onClick={assignUserIdToAveantEvents}
                  style={{
                    background: 'rgba(0,255,0,0.2)',
                    color: 'white',
                    border: '1px solid rgba(0,255,0,0.3)',
                    borderRadius: '5px',
                    padding: '10px',
                    cursor: 'pointer'
                  }}
                >
                  🔧 Fix Aveant Events
                </button>
              </div>
              {events.map(event => (
                <div
                  key={event.id}
                  onClick={() => {
                    console.log('Selected event object:', event);
                    console.log('Event keys:', Object.keys(event));
                    console.log('Event event_name field:', event.event_name);
                    console.log('Event title field:', event.title);
                    setSelectedEvent(event);
                    fetchEventTickets(event.event_name || event.title);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '15px',
                    marginBottom: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    border: '1px solid transparent'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.2)';
                    e.target.style.borderColor = 'rgba(255,255,255,0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.background = 'rgba(255,255,255,0.1)';
                    e.target.style.borderColor = 'transparent';
                  }}
                >
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px' }}>
                    {event.event_name}
                  </h3>
                  <p style={{ margin: '0', opacity: 0.8, fontSize: '14px' }}>
                    {event.club_name} • {formatDate(event.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <BottomNavCompany />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '20px',
      paddingBottom: '100px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => setSelectedEvent(null)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '24px',
            cursor: 'pointer',
            marginRight: '15px'
          }}
        >
          ‹
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px' }}>{selectedEvent.event_name}</h1>
          <p style={{ margin: '5px 0 0 0', opacity: 0.8, fontSize: '14px' }}>
            {selectedEvent.club_name}
          </p>
        </div>
      </div>

      {/* Mode Toggle */}
      <div style={{
        display: 'flex',
        marginBottom: '20px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '10px',
        padding: '5px'
      }}>
        <button
          onClick={() => setValidationMode(false)}
          style={{
            flex: 1,
            padding: '10px',
            background: !validationMode ? 'rgba(255,255,255,0.2)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          📊 Sales Overview
        </button>
        <button
          onClick={() => setValidationMode(true)}
          style={{
            flex: 1,
            padding: '10px',
            background: validationMode ? 'rgba(255,255,255,0.2)' : 'transparent',
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          📱 Scan Tickets
        </button>
      </div>

      {!validationMode ? (
        /* Sales Overview */
        <div>
          {/* Summary Stats */}
          {summary && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '15px',
              marginBottom: '20px'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {summary.totalTickets}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>Total Tickets</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {summary.totalRevenue} {summary.currency}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>Total Revenue</div>
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '10px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {summary.uniqueCustomers}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>Customers</div>
              </div>
            </div>
          )}

          {/* Tickets List */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '15px',
            padding: '20px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Ticket Sales</h3>
            
            {loading ? (
              <p>Loading tickets...</p>
            ) : tickets.length === 0 ? (
              <p style={{ opacity: 0.8 }}>No tickets sold yet for this event.</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {tickets.map(ticket => (
                  <div
                    key={ticket.id}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '15px',
                      marginBottom: '10px',
                      borderLeft: ticket.used ? '4px solid #ff6b6b' : '4px solid #4ecdc4'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '8px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                          {ticket.ticketId}
                        </div>
                        <div style={{ fontSize: '12px', opacity: 0.8 }}>
                          {ticket.customerEmail}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold' }}>
                          {ticket.price} {ticket.currency}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: ticket.used ? '#ff6b6b' : '#4ecdc4',
                          color: 'white',
                          marginTop: '4px'
                        }}>
                          {ticket.used ? 'USED' : 'VALID'}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      Purchased: {formatDate(ticket.purchaseDate)}
                      {ticket.used && (
                        <span> • Used: {formatDate(ticket.usedAt)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Ticket Validation */
        <div>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '15px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Validate Ticket</h3>
            
            <div style={{ marginBottom: '15px' }}>
              <input
                type="text"
                placeholder="Enter ticket ID (e.g., TKT-ABCD1234)"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    validateTicket(scanInput);
                  }
                }}
              />
            </div>
            
            <button
              onClick={() => validateTicket(scanInput)}
              disabled={!scanInput.trim()}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: scanInput.trim() ? '#4ecdc4' : 'rgba(255,255,255,0.3)',
                color: 'white',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: scanInput.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Validate Ticket
            </button>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div style={{
              background: validationResult.valid ? 
                'rgba(78, 205, 196, 0.2)' : 'rgba(255, 107, 107, 0.2)',
              border: `2px solid ${validationResult.valid ? '#4ecdc4' : '#ff6b6b'}`,
              borderRadius: '15px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '10px',
                color: validationResult.valid ? '#4ecdc4' : '#ff6b6b'
              }}>
                {validationResult.valid ? '✅ Valid Ticket' : '❌ Invalid Ticket'}
              </div>
              
              <p style={{ margin: '0 0 10px 0' }}>
                {validationResult.message}
              </p>

              {validationResult.ticket && (
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '14px'
                }}>
                  <div><strong>Customer:</strong> {validationResult.ticket.customerEmail}</div>
                  <div><strong>Price:</strong> {validationResult.ticket.price} {validationResult.ticket.currency}</div>
                  <div><strong>Purchased:</strong> {formatDate(validationResult.ticket.purchaseDate)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <BottomNavCompany />
    </div>
  );
} 