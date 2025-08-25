import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast } from 'react-toastify';
// Removed direct Firestore imports - using Cloud Function instead
import BottomNav from './BottomNav';
import QRCodeComponent from './QRCodeComponent';


export default function MyTickets({ showSignUpOverlay = false }) {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'previous'
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const auth = getAuth();

  // Define fetchTickets outside useEffect so it can be reused
  const fetchTickets = async () => {
    try {
      console.log('Fetching tickets for user:', user.uid);
      
      const response = await fetch('https://europe-west1-nocta-d1113.cloudfunctions.net/getUserTickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log('Tickets fetched successfully:', data.tickets);
        console.log('Total tickets in database:', data.totalTickets);
        console.log('Ticket details:', data.tickets.map(ticket => ({
          id: ticket.id,
          eventName: ticket.eventName,
          companyName: ticket.companyName,
          eventDate: ticket.eventDate,
          price: ticket.price,
          tierName: ticket.tierName
        })));
        
        // Debug information
        if (data.debug) {
          console.log('🔍 DEBUG - Looking for user ID:', data.debug.lookingForUserId);
          console.log('🔍 DEBUG - All user IDs in tickets:', data.debug.allUserIds);
          console.log('🔍 DEBUG - Sample tickets:', data.debug.sampleTickets);
        }
        
        setTickets(data.tickets);
      } else {
        console.error('Error from function:', data.error);
        setTickets([]);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  // Authentication state listener
  useEffect(() => {
    console.log('MyTickets: Setting up auth listener');
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('MyTickets: Auth state changed:', currentUser ? `User: ${currentUser.uid}` : 'No user');
      setUser(currentUser);
      setAuthLoading(false);
      
      // Only redirect if showSignUpOverlay is false
      if (!currentUser && !showSignUpOverlay) {
        console.log('MyTickets: No user, redirecting to signup');
        navigate('/signup');
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, showSignUpOverlay]);

  // Fetch tickets when user is available
  useEffect(() => {
    if (!authLoading && user) {
      console.log('MyTickets: User available, fetching tickets');
      fetchTickets();
    }
  }, [user, authLoading]);

  // Capture the beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Auto-refresh when returning from payment
  useEffect(() => {
    const handleFocus = () => {
      // Refresh tickets when user returns to the page (e.g., from Stripe)
      if (user && !loading) {
        console.log('Page focused - refreshing tickets');
        setLoading(true);
        fetchTickets();
      }
    };
    
    const handleVisibilityChange = () => {
      // Refresh tickets when page becomes visible
      if (user && !loading && !document.hidden) {
        console.log('Page visible - refreshing tickets');
        setLoading(true);
        fetchTickets();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, loading, fetchTickets]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-GB', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // Helper function to determine if a ticket is current or previous
  const isCurrentTicket = (ticket) => {
    if (!ticket.eventDate) return true; // If no event date, consider it current
    const eventDate = ticket.eventDate.toDate ? ticket.eventDate.toDate() : new Date(ticket.eventDate);
    const now = new Date();
    return eventDate >= now;
  };

  // Group tickets by event
  const groupTicketsByEvent = (ticketList) => {
    const grouped = {};
    
    ticketList.forEach(ticket => {
      const eventKey = ticket.eventName || 'Unknown Event';
      
      if (!grouped[eventKey]) {
        grouped[eventKey] = {
          eventName: eventKey,
          tickets: [],
          totalQuantity: 0,
          totalPrice: 0,
          purchaseDate: ticket.purchaseDate || ticket.downloadDate,
          eventDate: ticket.eventDate
        };
      }
      
      grouped[eventKey].tickets.push(ticket);
      grouped[eventKey].totalQuantity += 1;
      grouped[eventKey].totalPrice += ticket.price || 0;
    });
    
    return Object.values(grouped);
  };

  // Filter tickets based on active tab and group them
  const currentTickets = tickets.filter(ticket => isCurrentTicket(ticket));
  const previousTickets = tickets.filter(ticket => !isCurrentTicket(ticket));
  
  const groupedCurrentTickets = groupTicketsByEvent(currentTickets);
  const groupedPreviousTickets = groupTicketsByEvent(previousTickets);

  // Add to wallet function
  const addToWallet = async (ticket) => {
    try {
      // Check if user is on iOS (Apple Wallet)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      // Check if user is on Android (Google Pay)
      const isAndroid = /Android/.test(navigator.userAgent);
      
      // Check if PWA is already installed
      const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

      if (isStandalone) {
        toast.info('App is already installed on your home screen!');
        return;
      }

      if (deferredPrompt) {
        // PWA installation available
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
          toast.success('Ticket app added to your home screen!');
          setDeferredPrompt(null);
        }
      } else if (isIOS) {
        // iOS - Show instructions for adding to home screen
        toast.info(
          'To add this ticket to your home screen:\n1. Tap the Share button\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add"',
          { autoClose: 8000 }
        );
      } else if (isAndroid) {
        // Android - Show instructions for adding to home screen
        toast.info(
          'To add this ticket to your home screen:\n1. Tap the menu (⋮)\n2. Tap "Add to Home screen"\n3. Tap "Add"',
          { autoClose: 8000 }
        );
      } else {
        // Fallback: Download ticket as file
        const ticketData = {
          eventName: ticket.eventName,
          ticketId: ticket.id,
          price: ticket.price,
          purchaseDate: formatDate(ticket.purchaseDate || ticket.downloadDate),
          type: ticket.price === 0 ? 'Free Ticket' : (ticket.price >= 200 ? 'VIP Access' : 'General Admission'),
          qrCode: `ticket-${ticket.id}` // Reference to QR code
        };

        // Create a downloadable ticket file
        const blob = new Blob([JSON.stringify(ticketData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ticket-${ticket.eventName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Ticket downloaded! You can save it to your device for offline access.');
      }
    } catch (error) {
      console.error('Error adding to wallet:', error);
      toast.error('Failed to add ticket to wallet. Please try again.');
    }
  };

  // TicketCard component with QR code toggle - now handles grouped tickets
  const TicketCard = ({ ticketGroup }) => {
    const [showQR, setShowQR] = useState(false);
    const firstTicket = ticketGroup.tickets[0];

    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid #334155',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
        }}
      >
        {/* Event Name */}
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          marginBottom: '12px',
          color: '#fff'
        }}>
          {ticketGroup.eventName}
        </h3>

        {/* Ticket Quantity & Total Price */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{
              background: 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 600,
              alignSelf: 'flex-start'
            }}>
              {ticketGroup.totalQuantity} {ticketGroup.totalQuantity === 1 ? 'Ticket' : 'Tickets'}
            </span>
            {ticketGroup.tickets.length > 1 && (
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                {ticketGroup.tickets.map(t => t.price >= 200 ? 'VIP' : 'General').join(', ')}
              </span>
            )}
          </div>
          <span style={{
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color: '#10b981'
          }}>
            {ticketGroup.totalPrice === 0 ? 'Free' : `${ticketGroup.totalPrice} DKK`}
          </span>
        </div>

        {/* Purchase/Download Date */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>
            {firstTicket.price === 0 ? 'Downloaded' : 'Purchased'}: {formatDate(firstTicket.purchaseDate || firstTicket.downloadDate)} at {formatTime(firstTicket.purchaseDate || firstTicket.downloadDate)}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {/* QR Code Toggle Button */}
          <button
            onClick={() => setShowQR(!showQR)}
            style={{
              background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1
            }}
          >
            {showQR ? (
              <>
                <span>Hide QR Code</span>
                <span>👁️</span>
              </>
            ) : (
              <>
                <span>View QR Code</span>
                <span>📱</span>
              </>
            )}
          </button>

          {/* Add to Wallet Button */}
          <button
            onClick={() => addToWallet(firstTicket)}
            style={{
              background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1
            }}
          >
            <span>Add to Wallet</span>
            <span>💳</span>
          </button>
        </div>

        {/* QR Code (Conditional) */}
        {showQR && (
          <div style={{ marginBottom: '16px' }}>
            {ticketGroup.tickets.length === 1 ? (
              <QRCodeComponent ticketData={firstTicket} size={200} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {ticketGroup.tickets.map((ticket, index) => (
                  <div key={ticket.id} style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '8px', color: '#9ca3af', fontSize: '14px' }}>
                      Ticket {index + 1} of {ticketGroup.tickets.length}
                    </div>
                    <QRCodeComponent ticketData={ticket} size={180} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Ticket IDs */}
        <div style={{
          background: '#374151',
          borderRadius: '8px',
          padding: '12px',
          textAlign: 'center'
        }}>
          {ticketGroup.tickets.length === 1 ? (
            <>
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>Ticket ID: </span>
              <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
                {firstTicket.id.toUpperCase()}
              </span>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>Ticket IDs:</span>
              {ticketGroup.tickets.map((ticket, index) => (
                <span key={ticket.id} style={{ color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}>
                  {index + 1}. {ticket.id.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // If showSignUpOverlay is true, skip loading check and show overlay immediately
  if (!showSignUpOverlay && (authLoading || loading)) {
    return (
      <div style={{ minHeight: '100vh', background: '#3b1a5c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#fff', fontSize: '18px' }}>
          {authLoading ? 'Checking authentication...' : 'Loading your tickets...'}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#3b1a5c', color: '#fff', paddingBottom: 100 }}>
      {/* Sign-up overlay for non-authenticated users */}
      {showSignUpOverlay && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: '80px', // Leave space for bottom navigation
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#1f2937',
            borderRadius: 24,
            padding: '40px 20px',
            textAlign: 'center',
            border: '2px solid #E9D5FF',
            maxWidth: '90%',
            width: '400px'
          }}>
            <div style={{
              fontSize: 24,
              fontWeight: 600,
              color: '#FFFFFF',
              marginBottom: 16
            }}>
              Get Your Event Tickets
            </div>
            <div style={{
              fontSize: 16,
              color: '#9CA3AF',
              lineHeight: 1.5,
              marginBottom: 24
            }}>
              Sign up for free to purchase tickets for events, track your bookings, and get exclusive access to the best venues and experiences.
            </div>
            <button
              onClick={() => navigate('/signup')}
              style={{
                background: '#F941F9',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 12,
                padding: '16px 32px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#E91E63';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#F941F9';
              }}
            >
              Sign Up for Free
            </button>
          </div>
        </div>
      )}
      
      {/* Top Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        maxWidth: 448,
        margin: '0 auto',
        position: 'relative'
      }}>
        <span
          onClick={() => navigate(-1)}
          style={{ 
            position: 'absolute', 
            left: 28, 
            top: 20, 
            color: '#2046A6', 
            fontSize: 32, 
            fontWeight: 700, 
            cursor: 'pointer', 
            userSelect: 'none', 
            lineHeight: 1 
          }}
        >
          {'‹'}
        </span>
        <h1 style={{
          background: 'rgba(34,4,58,0.95)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 18,
          borderRadius: 24,
          padding: '8px 22px',
          boxShadow: '0 2px 12px #0004',
          letterSpacing: 0.5,
          border: '2px solid #fff',
          textShadow: '0 2px 8px #3E29F099',
          margin: 0
        }}>
          Tickets
        </h1>

      </div>

      <div style={{ maxWidth: 448, margin: '0 auto', padding: '20px' }}>
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(90deg, #6b7280 0%, #9ca3af 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '40px'
            }}>
              🎫
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '16px', color: '#cbd5e1' }}>
              No Tickets Yet
            </h2>
            <p style={{ color: '#9ca3af', marginBottom: '32px', lineHeight: 1.6 }}>
              You haven't purchased any tickets yet. Browse events and get your tickets!
            </p>
            <button
              onClick={() => navigate('/home')}
              style={{
                background: 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)',
                color: '#fff',
                padding: '12px 32px',
                borderRadius: '999px',
                border: 'none',
                fontWeight: 600,
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Browse Events
            </button>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div style={{ 
              display: 'flex', 
              background: '#1e293b', 
              borderRadius: '12px', 
              padding: '4px', 
              marginBottom: '20px',
              border: '1px solid #334155'
            }}>
              <button
                onClick={() => setActiveTab('current')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'current' ? 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)' : 'transparent',
                  color: activeTab === 'current' ? '#fff' : '#9ca3af',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Current Tickets ({groupedCurrentTickets.length})
              </button>
              <button
                onClick={() => setActiveTab('previous')}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'previous' ? 'linear-gradient(90deg, #3E29F0 0%, #a445ff 100%)' : 'transparent',
                  color: activeTab === 'previous' ? '#fff' : '#9ca3af',
                  fontWeight: 600,
                    fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Previous Tickets ({groupedPreviousTickets.length})
              </button>
                </div>

            {/* Tickets Display */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {activeTab === 'current' && groupedCurrentTickets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎫</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px', color: '#cbd5e1' }}>
                    No Current Tickets
                  </h3>
                  <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                    You don't have any upcoming events.
                  </p>
                </div>
              )}

              {activeTab === 'previous' && groupedPreviousTickets.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📅</div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '8px', color: '#cbd5e1' }}>
                    No Previous Tickets
                  </h3>
                  <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                    You haven't attended any events yet.
                  </p>
                </div>
              )}

              {(activeTab === 'current' ? groupedCurrentTickets : groupedPreviousTickets).map((ticketGroup) => (
                <TicketCard key={ticketGroup.eventName} ticketGroup={ticketGroup} />
            ))}
          </div>
            </>
        )}
              </div>
        
        <BottomNav />
      </div>
    );
  } 