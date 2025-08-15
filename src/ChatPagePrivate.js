import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, onSnapshot, getDocs, updateDoc, doc, limit } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CLUB_FESTIVAL_NAMES } from './club_festival_names';
import BottomNav from './BottomNav';
import { useUserType } from './UserTypeContext';

function formatTime(ts) {
  if (!ts) return '';
  const date = new Date(ts.seconds * 1000);
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return Math.floor(diff) + 's';
  if (diff < 3600) return Math.floor(diff / 60) + 'm';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h';
  return date.toLocaleDateString();
}

// Helper function to determine if a venue is a club or bar
function isClubVenue(venueName) {
  const name = (venueName || '').toLowerCase();
  return CLUB_FESTIVAL_NAMES.map(n => n.toLowerCase()).includes(name);
}

const ChatPagePrivate = forwardRef(({ unreadCount, setUnreadCount }, ref) => {
  const [clubs, setClubs] = useState([]);
  const [threads, setThreads] = useState([]); // inbox threads
  const [selectedThread, setSelectedThread] = useState(null); // {id, name, ...}
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [selectedNewClubs, setSelectedNewClubs] = useState([]); // for multi-select
  const [multiMessage, setMultiMessage] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'club', 'bar'
  const [longPressMessageId, setLongPressMessageId] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;
  const { userType } = useUserType();

  // Debug authentication state
  useEffect(() => {
    console.log('🔍 ChatPagePrivate: Component mounted');
    console.log('🔍 ChatPagePrivate: Auth state:', auth);
    console.log('🔍 ChatPagePrivate: Current user:', user);
    console.log('🔍 ChatPagePrivate: User UID:', user?.uid);
    console.log('🔍 ChatPagePrivate: User email:', user?.email);
    console.log('🔍 ChatPagePrivate: User Type:', userType);
  }, [auth, user, userType]);

  // Monitor auth state changes
  useEffect(() => {
    console.log('🔍 ChatPagePrivate: Setting up auth state listener...');
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('🔍 ChatPagePrivate: Auth state changed:', user ? 'User logged in' : 'No user');
      if (user) {
        console.log('🔍 ChatPagePrivate: User details - UID:', user.uid, 'Email:', user.email);
      }
    });
    
    return () => {
      console.log('🔍 ChatPagePrivate: Cleaning up auth state listener');
      unsubscribe();
    };
  }, [auth]);

  // Debug clubs state changes
  useEffect(() => {
    console.log('🔍 ChatPagePrivate: Clubs state changed:', clubs.length, 'clubs');
    console.log('🔍 ChatPagePrivate: Clubs data:', clubs);
  }, [clubs]);
  


  // Real-time inbox for private users
  useEffect(() => {
    if (!user) return;
    let unsubscribes = [];
    let isMounted = true;
    getDocs(collection(db, 'Club_Bar_Festival_profiles')).then(clubSnap => {
      const clubsMap = {};
      clubSnap.docs.forEach(doc => { clubsMap[doc.id] = doc.data(); });
      const threadMap = {};
      let unread = 0;
      Object.keys(clubsMap).forEach(clubId => {
        const q = query(collection(db, `club-chats/${clubId}/messages`));
        const unsub = onSnapshot(q, snap => {
          let lastMsg = null;
          snap.docs.forEach(doc => {
            const msg = doc.data();
            if ((msg.senderId === user.uid || msg.recipientId === user.uid)) {
              if (!lastMsg || (msg.timestamp && lastMsg.timestamp && msg.timestamp.seconds > lastMsg.timestamp.seconds)) {
                lastMsg = msg;
              }
            }
          });
          if (lastMsg) {
            threadMap[clubId] = { 
              id: clubId, 
              name: clubsMap[clubId].name || clubsMap[clubId].companyName || clubsMap[clubId].fullname || clubsMap[clubId].email || clubId, 
              lastMsg: lastMsg.text, 
              timestamp: lastMsg.timestamp, 
              unread: false 
            };
            // Unread logic
            const lastSeenKey = `lastSeenMsg_${clubId}_${user.uid}`;
            const lastSeen = Number(localStorage.getItem(lastSeenKey) || 0);
            if (lastMsg.timestamp?.seconds && lastMsg.timestamp.seconds > lastSeen && lastMsg.senderId !== user.uid) {
              threadMap[clubId].unread = true;
            } else {
              threadMap[clubId].unread = false;
            }
          } else {
            delete threadMap[clubId];
          }
          if (isMounted) {
            const sorted = Object.values(threadMap).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
            setThreads(sorted);
            setUnreadCount(sorted.filter(t => t.unread).length);
          }
        });
        unsubscribes.push(unsub);
      });
    });
    return () => {
      isMounted = false;
      unsubscribes.forEach(unsub => unsub());
    };
  }, [user, setUnreadCount]);

  // Mark messages as read when opening a thread
  useEffect(() => {
    if (!selectedThread || !user) return;
    localStorage.setItem(`lastSeenMsg_${selectedThread.id}_${user.uid}`, Math.floor(Date.now() / 1000));
  }, [selectedThread, user]);

  // Expose unreadCount to parent via ref
  useImperativeHandle(ref, () => ({ unreadCount }), [unreadCount]);

  // Fetch all clubs for new chat
  useEffect(() => {
    console.log('🔍 ChatPagePrivate: fetchClubs useEffect triggered');
    console.log('🔍 ChatPagePrivate: Current user in fetchClubs:', user);
    console.log('🔍 ChatPagePrivate: User authenticated:', !!user);
    console.log('🔍 ChatPagePrivate: User UID available:', !!user?.uid);
    console.log('🔍 ChatPagePrivate: User email verified:', user?.emailVerified);
    console.log('🔍 ChatPagePrivate: User provider data:', user?.providerData);
    
    if (!user || !user.uid) {
      console.log('🔍 ChatPagePrivate: No user or no UID, skipping fetchClubs');
      return;
    }
    
    // Wait a bit to ensure user is fully authenticated
    const timer = setTimeout(() => {
      console.log('🔍 ChatPagePrivate: Timer fired, proceeding with fetchClubs');
      fetchClubs();
    }, 1000);
    
    return () => {
      console.log('🔍 ChatPagePrivate: Cleaning up timer');
      clearTimeout(timer);
    };
  }, [user]);

  async function fetchClubs() {
    try {
      console.log('🔍 ChatPagePrivate: Starting Firestore query...');
      console.log('🔍 ChatPagePrivate: Querying collection: Club_Bar_Festival_profiles');
      const snap = await getDocs(collection(db, 'Club_Bar_Festival_profiles'));
      console.log('🔍 ChatPagePrivate: Firestore query completed successfully');
      console.log('Club_Bar_Festival_profiles snapshot:', snap.docs.length, 'documents found');
      const clubsData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Clubs data:', clubsData);
      setClubs(clubsData);
      console.log('🔍 ChatPagePrivate: Clubs state updated with', clubsData.length, 'clubs');
    } catch (e) {
      console.error('🔍 ChatPagePrivate: Error fetching clubs for new chat:', e);
      console.error('🔍 ChatPagePrivate: Error details:', e.code, e.message);
      console.error('🔍 ChatPagePrivate: Error stack:', e.stack);
    }
  }

  // Listen for messages in selected thread
  useEffect(() => {
    if (!selectedThread || !user) return;
    const q = query(collection(db, `club-chats/${selectedThread.id}/messages`), orderBy('timestamp'));
    console.log('Listening for messages in private user thread:', `club-chats/${selectedThread.id}/messages`);
    const unsub = onSnapshot(q, (snap) => {
      let msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgs = msgs.filter(msg => msg.senderId === user.uid || msg.recipientId === user.uid);
      setMessages(msgs);
    }, (e) => {
      console.error('Error listening for messages in thread:', e);
    });
    return () => unsub();
  }, [selectedThread, user?.uid]);

  // Test Firestore connection
  useEffect(() => {
    if (!user || !user.uid) return;
    
    console.log('🔍 ChatPagePrivate: Testing Firestore connection...');
    async function testConnection() {
      try {
        // Try to get a single document to test connection
        const testQuery = query(collection(db, 'Club_Bar_Festival_profiles'), limit(1));
        console.log('🔍 ChatPagePrivate: Testing with limit(1) query...');
        const testSnap = await getDocs(testQuery);
        console.log('🔍 ChatPagePrivate: Test query successful, got', testSnap.docs.length, 'docs');
      } catch (e) {
        console.error('🔍 ChatPagePrivate: Test query failed:', e);
        console.error('🔍 ChatPagePrivate: Test error details:', e.code, e.message);
      }
    }
    testConnection();
  }, [user]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThread) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `club-chats/${selectedThread.id}/messages`), {
        text: newMessage,
        senderId: user?.uid || 'anon',
        senderEmail: user?.email || '',
        recipientId: selectedThread.id,
        timestamp: serverTimestamp(),
      });
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setLoading(false);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!selectedThread || !user) return;
    try {
      await updateDoc(doc(db, `club-chats/${selectedThread.id}/messages`, messageId), {
        text: '[Message deleted]',
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user.uid
      });
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const handleMessageLongPress = (messageId) => {
    if (longPressTimer) clearTimeout(longPressTimer);
    const timer = setTimeout(() => {
      setLongPressMessageId(messageId);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  };

  const handleMessagePressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleMessagePressStart = (messageId) => {
    handleMessageLongPress(messageId);
  };

  // UI
  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#3b1a5c', display: 'flex', flexDirection: 'column', padding: 0, margin: 0 }}>
      
      {/* Header - Matching bar page style */}
      <div style={{ width: '100vw', background: '#0f172a', padding: '22px 0 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #334155', margin: 0, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '448px', padding: '0 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#a445ff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 0.5, textShadow: '0 2px 8px #3E29F099' }}>Chats</div>
              <div style={{ fontSize: 12, color: '#b3e0ff' }}>Message venues</div>
            </div>
          </div>
          <button 
            onClick={() => setShowNewChat(true)}
            style={{ background: '#2a0845', border: '2px solid #fff', color: '#ffffff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px #0004' }}
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#3b1a5c' }}>
        {!selectedThread ? (
          // Inbox view
          <div style={{ flex: 1, padding: '20px', background: '#3b1a5c' }}>
            {threads.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 60 }}>
                <div style={{ fontSize: 16, marginBottom: 8 }}>No chats yet.</div>
                <div style={{ fontSize: 14 }}>Start a conversation with a venue</div>
              </div>
            ) : (
              <div>
                {threads.map(thread => (
                  <div 
                    key={thread.id} 
                    style={{ 
                      padding: '16px 20px', 
                      borderRadius: 12, 
                      cursor: 'pointer', 
                      background: thread.unread ? 'rgba(164, 69, 255, 0.1)' : 'rgba(255,255,255,0.06)', 
                      marginBottom: 10, 
                      color: '#fff', 
                      fontWeight: 500, 
                      transition: 'background 0.2s',
                      border: thread.unread ? '1px solid rgba(164, 69, 255, 0.3)' : '1px solid transparent'
                    }} 
                    onClick={() => setSelectedThread(thread)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>
                        {thread.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {formatTime(thread.timestamp)}
                      </div>
                    </div>
                    <div style={{ fontSize: 14, color: thread.unread ? '#a445ff' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {thread.unread && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#a445ff' }} />}
                      {thread.lastMsg}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Chat view
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#3b1a5c' }}>
            {/* Chat header */}
            <div style={{ background: '#0f172a', padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                onClick={() => setSelectedThread(null)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{selectedThread.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {isClubVenue(selectedThread.name) ? 'Club' : 'Bar'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, padding: '20px', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 60 }}>
                  <div style={{ fontSize: 16, marginBottom: 8 }}>No messages yet.</div>
                  <div style={{ fontSize: 14 }}>Start the conversation!</div>
                </div>
              ) : (
                <div>
                  {messages.map(msg => (
                    <div 
                      key={msg.id} 
                      style={{ 
                        marginBottom: 12, 
                        display: 'flex', 
                        justifyContent: msg.senderId === user?.uid ? 'flex-end' : 'flex-start',
                        position: 'relative'
                      }}
                    >
                      <div 
                        style={{ 
                          maxWidth: '70%', 
                          padding: '12px 16px', 
                          borderRadius: 16, 
                          background: msg.senderId === user?.uid ? '#a445ff' : '#334155',
                          color: msg.deleted ? '#94a3b8' : '#fff',
                          fontSize: 14,
                          fontStyle: msg.deleted ? 'italic' : 'normal',
                          position: 'relative',
                          cursor: msg.senderId === user?.uid && !msg.deleted ? 'pointer' : 'default'
                        }}
                        onMouseDown={() => msg.senderId === user?.uid && !msg.deleted && handleMessagePressStart(msg.id)}
                        onMouseUp={handleMessagePressEnd}
                        onMouseLeave={handleMessagePressEnd}
                        onTouchStart={() => msg.senderId === user?.uid && !msg.deleted && handleMessagePressStart(msg.id)}
                        onTouchEnd={handleMessagePressEnd}
                      >
                        {msg.deleted ? '[Message deleted]' : msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message input */}
            <form onSubmit={handleSend} style={{ 
              padding: '20px', 
              borderTop: '1px solid #334155', 
              background: '#1e293b', 
              position: 'relative', 
              zIndex: 10,
              marginBottom: '80px', // Add space for bottom navigation
              minHeight: '80px'
            }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  style={{ 
                    flex: 1, 
                    padding: '12px 16px', 
                    borderRadius: 24, 
                    border: '1px solid #334155', 
                    background: '#334155', 
                    color: '#fff',
                    fontSize: 14
                  }}
                />
                <button 
                  type="submit" 
                  disabled={loading || !newMessage.trim()}
                  style={{ 
                    background: newMessage.trim() ? '#a445ff' : '#334155', 
                    border: 'none', 
                    borderRadius: '50%', 
                    width: 44, 
                    height: 44, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                    color: '#fff'
                  }}
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Delete Message Modal */}
      {longPressMessageId && (
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
          zIndex: 1000
        }}>
          <div style={{ 
            background: '#1e293b', 
            borderRadius: 16, 
            padding: 24, 
            width: '90%', 
            maxWidth: 300,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 16 }}>
              Delete Message?
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setLongPressMessageId(null)}
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
                onClick={() => {
                  handleDeleteMessage(longPressMessageId);
                  setLongPressMessageId(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChat && (
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
          zIndex: 1000
        }}>
          <div style={{ 
            background: '#1e293b', 
            borderRadius: 16, 
            padding: 24, 
            width: '90%', 
            maxWidth: 400, 
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 20, color: '#fff', textShadow: '0 2px 8px #3E29F099' }}>New Message</span>
              </div>
              <button 
                onClick={() => setShowNewChat(false)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['all', 'club', 'bar'].map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 20,
                    border: 'none',
                    background: filterType === type ? '#a445ff' : '#334155',
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  {type === 'all' ? 'All' : type === 'club' ? 'Clubs' : 'Bars'}
                </button>
              ))}
            </div>

            {/* Venues list */}
            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 12 }}>
              {/* Show clubs and bars in organized sections */}
              <>
                {/* Show sections based on filter */}
                {(filterType === 'all' || filterType === 'club') && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#a445ff', marginBottom: 8, marginTop: filterType === 'all' ? 0 : 8 }}>
                      Clubs
                    </div>
                    {(() => {
                      const clubVenues = clubs.filter(club => {
                        const venueName = club.name || club.companyName || club.fullname || club.email || club.id;
                        const isClub = isClubVenue(venueName);
                        return isClub;
                      });
                      
                      if (clubVenues.length === 0) {
                        return (
                          <div style={{ padding: '16px 20px', color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
                            No clubs found
                          </div>
                        );
                      }
                      
                      return clubVenues.map(club => (
                        <div key={club.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', marginBottom: 10, color: '#fff', fontWeight: 500, transition: 'background 0.2s' }}>
                          <input
                            type="checkbox"
                            style={{ marginRight: 16, width: 26, height: 26 }}
                            checked={selectedNewClubs.includes(club.id)}
                            onChange={e => {
                              if (e.target.checked) setSelectedNewClubs([...selectedNewClubs, club.id]);
                              else setSelectedNewClubs(selectedNewClubs.filter(id => id !== club.id));
                            }}
                          />
                          <div 
                            style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => {
                              // Start individual chat with this club/bar
                              setSelectedThread({ 
                                id: club.id, 
                                name: club.name || club.companyName || club.fullname || club.email || club.id 
                              });
                              setShowNewChat(false);
                            }}
                          >
                            <div style={{ fontSize: 16, fontWeight: 600 }}>
                              {club.name || club.companyName || club.fullname || club.email || club.id}
                            </div>
                            <div style={{ fontSize: 12, color: '#b3e0ff', marginTop: 2 }}>
                              Club
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </>
                )}
                
                {/* Bars section */}
                {(filterType === 'all' || filterType === 'bar') && (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#a445ff', marginBottom: 8, marginTop: filterType === 'all' ? 16 : 8 }}>
                      Bars
                    </div>
                    {(() => {
                      const barVenues = clubs.filter(club => {
                        const venueName = club.name || club.companyName || club.fullname || club.email || club.id;
                        const isClub = isClubVenue(venueName);
                        return !isClub;
                      });
                      
                      if (barVenues.length === 0) {
                        return (
                          <div style={{ padding: '16px 20px', color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
                            No bars found
                          </div>
                        );
                      }
                      
                      return barVenues.map(club => (
                        <div key={club.id} style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', marginBottom: 10, color: '#fff', fontWeight: 500, transition: 'background 0.2s' }}>
                          <input
                            type="checkbox"
                            style={{ marginRight: 16, width: 26, height: 26 }}
                            checked={selectedNewClubs.includes(club.id)}
                            onChange={e => {
                              if (e.target.checked) setSelectedNewClubs([...selectedNewClubs, club.id]);
                              else setSelectedNewClubs(selectedNewClubs.filter(id => id !== club.id));
                            }}
                          />
                          <div 
                            style={{ flex: 1, cursor: 'pointer' }}
                            onClick={() => {
                              // Start individual chat with this club/bar
                              setSelectedThread({ 
                                id: club.id, 
                                name: club.name || club.companyName || club.fullname || club.email || club.id 
                              });
                              setShowNewChat(false);
                            }}
                          >
                            <div style={{ fontSize: 16, fontWeight: 600 }}>
                              {club.name || club.companyName || club.fullname || club.email || club.id}
                            </div>
                            <div style={{ fontSize: 12, color: '#b3e0ff', marginTop: 2 }}>
                              Bar
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </>
                )}
              </>
            </div>

            {/* Multi-select message input */}
            {selectedNewClubs.length > 0 && (
              <form
                onSubmit={async e => {
                  e.preventDefault();
                  setLoading(true);
                  // Send message to all selected clubs
                  try {
                    await Promise.all(selectedNewClubs.map(async clubId => {
                      await addDoc(collection(db, `club-chats/${clubId}/messages`), {
                        text: multiMessage,
                        senderId: user?.uid || 'anon',
                        senderEmail: user?.email || '',
                        recipientId: clubId,
                        timestamp: serverTimestamp(),
                      });
                    }));
                    setMultiMessage('');
                    setSelectedNewClubs([]);
                    setShowNewChat(false);
                    toast.success(`Message sent to ${selectedNewClubs.length} venue${selectedNewClubs.length > 1 ? 's' : ''}`);
                  } catch (error) {
                    console.error('Error sending multi-message:', error);
                    toast.error('Failed to send message');
                  }
                  setLoading(false);
                }}
                style={{ marginTop: 'auto' }}
              >
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <input
                    type="text"
                    value={multiMessage}
                    onChange={(e) => setMultiMessage(e.target.value)}
                    placeholder={`Message ${selectedNewClubs.length} venue${selectedNewClubs.length > 1 ? 's' : ''}...`}
                    style={{ 
                      flex: 1, 
                      padding: '12px 16px', 
                      borderRadius: 24, 
                      border: '1px solid #334155', 
                      background: '#1e293b', 
                      color: '#fff',
                      fontSize: 14
                    }}
                  />
                  <button 
                    type="submit" 
                    disabled={loading || !multiMessage.trim()}
                    style={{ 
                      background: multiMessage.trim() ? '#a445ff' : '#334155', 
                      border: 'none', 
                      borderRadius: '50%', 
                      width: 44, 
                      height: 44, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: multiMessage.trim() ? 'pointer' : 'not-allowed',
                      color: '#fff'
                    }}
                  >
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatPagePrivate; 