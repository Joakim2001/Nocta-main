import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, onSnapshot, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CLUB_FESTIVAL_NAMES } from './club_festival_names';
import BottomNav from './BottomNav';

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

const ChatPage = forwardRef(({ unreadCount, setUnreadCount }, ref) => {
  const [clubs, setClubs] = useState([]);
  const [clubUsers, setClubUsers] = useState([]);
  const [threads, setThreads] = useState([]); // inbox threads
  const [selectedThread, setSelectedThread] = useState(null); // {id, name, ...}
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClub, setIsClub] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [selectedNewClubs, setSelectedNewClubs] = useState([]); // for multi-select
  const [multiMessage, setMultiMessage] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'club', 'bar'
  const auth = getAuth();
  const user = auth.currentUser;
  // REMOVE: const [unreadCount, setUnreadCount] = useState(0);

  // Detect if current user is a club
  useEffect(() => {
    if (!user) return;
    console.log('Checking if user is a club. Fetching Club_Bar_Festival_profiles...');
    getDocs(collection(db, 'Club_Bar_Festival_profiles')).then(snap => {
      const clubIds = snap.docs.map(doc => doc.id);
      setIsClub(clubIds.includes(user.uid));
    }).catch(e => console.error('Error fetching Club_Bar_Festival_profiles:', e));
  }, [user]);

  // Real-time inbox for private users
  useEffect(() => {
    if (!user || isClub) return;
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
            threadMap[clubId] = { id: clubId, name: clubsMap[clubId].name || clubsMap[clubId].email || clubId, lastMsg: lastMsg.text, timestamp: lastMsg.timestamp, unread: false };
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
  }, [user, isClub, setUnreadCount]);

  // Real-time inbox for clubs
  useEffect(() => {
    if (!user || !isClub) return;
    let unsub = null;
    let isMounted = true;
    const q = query(collection(db, `club-chats/${user.uid}/messages`));
    unsub = onSnapshot(q, snap => {
      const threadMap = {};
      let unread = 0;
      snap.docs.forEach(doc => {
        const msg = doc.data();
        const otherId = msg.senderId !== user.uid ? msg.senderId : msg.recipientId;
        if (!otherId) return;
        // Store the full last message object for correct unread logic
        if (!threadMap[otherId] || (msg.timestamp && threadMap[otherId].lastMsg && msg.timestamp.seconds > threadMap[otherId].lastMsg.timestamp?.seconds)) {
          threadMap[otherId] = {
            id: otherId,
            name: msg.senderEmail || msg.recipientEmail || otherId,
            lastMsg: msg, // Store the full message object
            timestamp: msg.timestamp,
            unread: false
          };
        }
      });
      Object.values(threadMap).forEach(thread => {
        const lastSeenKey = `lastSeenMsg_${user.uid}_${thread.id}`;
        const lastSeen = Number(localStorage.getItem(lastSeenKey) || 0);
        // Use thread.lastMsg.senderId for unread logic
        if (thread.timestamp?.seconds && thread.timestamp.seconds > lastSeen && thread.lastMsg && thread.lastMsg.senderId !== user.uid) {
          thread.unread = true;
        } else {
          thread.unread = false;
        }
      });
      if (isMounted) {
        // Show preview text in inbox
        const sorted = Object.values(threadMap).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).map(thread => ({
          ...thread,
          lastMsg: thread.lastMsg.text // For preview in inbox
        }));
        setThreads(sorted);
        setUnreadCount(sorted.filter(t => t.unread).length);
      }
    });
    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [user, isClub, setUnreadCount]);

  // Mark messages as read when opening a thread
  useEffect(() => {
    if (!selectedThread || !user) return;
    if (isClub) {
      localStorage.setItem(`lastSeenMsg_${user.uid}_${selectedThread.id}`, Math.floor(Date.now() / 1000));
    } else {
      localStorage.setItem(`lastSeenMsg_${selectedThread.id}_${user.uid}`, Math.floor(Date.now() / 1000));
    }
  }, [selectedThread, user, isClub]);

  // Expose unreadCount to parent via ref (optional, can be removed)
  useImperativeHandle(ref, () => ({ unreadCount }), [unreadCount]);

  // Fetch all clubs for new chat (private users)
  useEffect(() => {
    if (isClub) return;
    console.log('Fetching all Club_Bar_Festival_profiles for new chat dropdown...');
    async function fetchClubs() {
      try {
        const snap = await getDocs(collection(db, 'Club_Bar_Festival_profiles'));
        setClubs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error('Error fetching clubs for new chat:', e);
      }
    }
    fetchClubs();
  }, [isClub]);

  // Fetch all users for new chat (clubs)
  useEffect(() => {
    if (!isClub) return;
    console.log('Fetching all profiles for club new chat dropdown...');
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, 'profiles'));
        setClubUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error('Error fetching profiles for club new chat:', e);
      }
    }
    fetchUsers();
  }, [isClub]);

  // Listen for messages in selected thread
  useEffect(() => {
    if (!selectedThread) return;
    let q;
    if (isClub) {
      q = query(collection(db, `club-chats/${user.uid}/messages`), orderBy('timestamp'));
      console.log('Listening for messages in club thread:', `club-chats/${user.uid}/messages`);
    } else {
      q = query(collection(db, `club-chats/${selectedThread.id}/messages`), orderBy('timestamp'));
      console.log('Listening for messages in private user thread:', `club-chats/${selectedThread.id}/messages`);
    }
    const unsub = onSnapshot(q, (snap) => {
      let msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (isClub) {
        msgs = msgs.filter(msg => msg.senderId === selectedThread.id || msg.recipientId === selectedThread.id);
      } else {
        msgs = msgs.filter(msg => msg.senderId === user.uid || msg.recipientId === user.uid);
      }
      setMessages(msgs);
    }, (e) => {
      console.error('Error listening for messages in thread:', e);
    });
    return () => unsub();
  }, [selectedThread, isClub, user?.uid]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThread) return;
    setLoading(true);
    if (isClub) {
      await addDoc(collection(db, `club-chats/${user.uid}/messages`), {
        text: newMessage,
        senderId: user.uid,
        senderEmail: user.email || '',
        recipientId: selectedThread.id,
        timestamp: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, `club-chats/${selectedThread.id}/messages`), {
        text: newMessage,
        senderId: user?.uid || 'anon',
        senderEmail: user?.email || '',
        recipientId: selectedThread.id,
        timestamp: serverTimestamp(),
      });
    }
    setNewMessage('');
    setLoading(false);
  };

  // UI
  return (
    <div style={{ minHeight: '100vh', width: '100vw', background: '#3b1a5c', display: 'flex', flexDirection: 'column', padding: 0, margin: 0 }}>
      {/* Full-width Header Bar matching other pages */}
      <div style={{ width: '100vw', background: '#0f172a', padding: '22px 0 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #334155', margin: 0, position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '448px', padding: '0 18px' }}>
          <span style={{ display: 'flex', alignItems: 'center', background: '#2a0845', color: '#fff', fontWeight: 700, fontSize: 18, borderRadius: 24, padding: '8px 22px', boxShadow: '0 2px 12px #0004', letterSpacing: 0.5, border: '2px solid #fff', textShadow: '0 2px 8px #3E29F099' }}>
            <svg style={{ width: 18, height: 18, color: '#b3e0ff', marginRight: 8 }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /></svg>
            {selectedThread ? selectedThread.name : (isClub ? 'Inbox' : 'Chats')}
            {selectedThread && (
              <svg style={{ width: 18, height: 18, color: '#b3e0ff', marginLeft: 6, cursor: 'pointer' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" onClick={() => setSelectedThread(null)}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!selectedThread && (
              <button 
                onClick={() => { setShowNewChat(true); setSelectedNewClubs([]); setMultiMessage(''); setFilterType('all'); }} 
                style={{ background: '#2a0845', border: '2px solid #fff', color: '#ffffff', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 12px #0004' }}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
          </button>
            )}
          </div>
        </div>
      </div>
      {/* Main content container */}
      <div style={{ flex: 1, background: '#3b1a5c', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Inbox View */}
        {!selectedThread && (
          <div style={{ flex: 1, overflowY: 'auto', background: '#3b1a5c', minHeight: 0, padding: '18px 0 100px 0' }}>
            <div style={{ maxWidth: 448, margin: '0 auto', padding: '0 18px' }}>
            {threads.length === 0 && <div style={{ color: '#ccc', textAlign: 'center', padding: '48px 0' }}>No chats yet.</div>}
            {threads.map(thread => (
              <div key={thread.id} onClick={() => setSelectedThread(thread)}
                  style={{ display: 'flex', alignItems: 'center', padding: '18px 20px', borderBottom: '1px solid #a445ff22', cursor: 'pointer', background: selectedThread && selectedThread.id === thread.id ? 'rgba(164,69,255,0.08)' : 'transparent', transition: 'background 0.2s', borderRadius: 12, marginBottom: 8 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #a445ff 0%, #ff0080 100%)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, marginRight: 18, boxShadow: '0 2px 8px #a445ff22' }}>
                  {thread.name ? thread.name[0].toUpperCase() : '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: 17, marginBottom: 2 }}>{thread.name}</div>
                  <div style={{ color: '#b3e0ff', fontSize: 14, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{thread.lastMsg}</div>
                </div>
                <div style={{ fontSize: 13, color: '#b3e0ff', marginLeft: 12, minWidth: 40, textAlign: 'right' }}>{formatTime(thread.timestamp)}</div>
                {thread.unread && <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F941F9', marginLeft: 10, boxShadow: '0 0 8px #F941F9' }} />}
              </div>
            ))}
            </div>
          </div>
        )}
        {/* Chat View */}
        {selectedThread && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', background: '#3b1a5c', padding: '24px 18px 12px 18px', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ maxWidth: 448, margin: '0 auto', width: '100%' }}>
              {messages.length === 0 && <div style={{ color: '#ccc', textAlign: 'center', marginTop: 40 }}>No messages yet.</div>}
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.senderId === user?.uid ? 'flex-end' : 'flex-start', gap: 2 }}>
                  <span style={{ fontSize: 12, color: '#b3e0ff', marginBottom: 2 }}>{msg.senderEmail || 'Unknown'}</span>
                  <span style={{
                    display: 'inline-block',
                    padding: '12px 18px',
                    borderRadius: 22,
                    background: msg.senderId === user?.uid ? 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)' : 'rgba(255,255,255,0.13)',
                    color: msg.senderId === user?.uid ? '#fff' : '#fff',
                    fontSize: 16,
                    fontWeight: 500,
                    boxShadow: msg.senderId === user?.uid ? '0 2px 8px #a445ff22' : '0 2px 8px #fff2',
                    marginBottom: 2,
                    maxWidth: 260,
                    wordBreak: 'break-word',
                  }}>{msg.text}</span>
                  <span style={{ fontSize: 11, color: '#b3e0ff', opacity: 0.7, marginTop: 1 }}>{formatTime(msg.timestamp)}</span>
                </div>
              ))}
              </div>
            </div>
            <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 18px 18px 18px', background: 'rgba(255,255,255,0.06)', borderTop: '1.5px solid #a445ff22', boxShadow: '0 -2px 12px #a445ff11' }}>
              <div style={{ maxWidth: 448, margin: '0 auto', width: '100%', display: 'flex', gap: 10 }}>
              <input
                style={{ flex: 1, padding: '14px 18px', borderRadius: 24, border: 'none', fontSize: 16, background: 'rgba(255,255,255,0.13)', color: '#fff', outline: 'none', boxShadow: '0 2px 8px #a445ff22' }}
                type="text"
                placeholder="Type your message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                style={{ background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 24, padding: '12px 24px', boxShadow: '0 2px 8px #a445ff22', cursor: loading || !newMessage.trim() ? 'not-allowed' : 'pointer', opacity: loading || !newMessage.trim() ? 0.6 : 1, transition: 'opacity 0.2s' }}
                disabled={loading || !newMessage.trim()}
              >Send</button>
              </div>
            </form>
          </>
        )}
        {/* New Chat Modal */}
        {showNewChat && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'rgba(18,0,47,0.98)', borderRadius: 28, boxShadow: '0 8px 32px #a445ff55', padding: 32, width: 600, maxWidth: '95vw', color: '#fff', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                <span style={{ fontWeight: 700, fontSize: 20 }}>New Message</span>
                  <div style={{ fontSize: 12, color: '#b3e0ff', marginTop: 2 }}>
                    {isClub ? 'Select a user to message' : 'Click name to chat • Check box for multi-message'}
                  </div>
                </div>
                <button onClick={() => setShowNewChat(false)} style={{ color: '#b3e0ff', background: 'none', border: 'none', fontSize: 28, cursor: 'pointer', marginLeft: 8 }}>&times;</button>
              </div>
              
              {/* Filter buttons for private users */}
              {!isClub && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button
                    onClick={() => setFilterType('all')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: 'none',
                      background: filterType === 'all' ? 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType('club')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: 'none',
                      background: filterType === 'club' ? 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    Clubs
                  </button>
                  <button
                    onClick={() => setFilterType('bar')}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 20,
                      border: 'none',
                      background: filterType === 'bar' ? 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)' : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    Bars
                  </button>
                </div>
              )}
              
              <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 12 }}>
                {isClub ? (
                  // Club user interface - shows private users who can message them
                  clubUsers.map(u => (
                    <div key={u.id} style={{ padding: '16px 20px', borderRadius: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', marginBottom: 10, color: '#fff', fontWeight: 500, transition: 'background 0.2s' }} onClick={() => { setSelectedThread({ id: u.id, name: u.email || u.id }); setShowNewChat(false); }}>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{u.name || u.fullname || u.email || u.id}</div>
                      <div style={{ fontSize: 12, color: '#b3e0ff', marginTop: 2 }}>👤 Private User • {u.email}</div>
                    </div>
                  ))
                ) : (
                  // Show clubs and bars in organized sections
                  <>
                    {/* Show sections based on filter */}
                    {(filterType === 'all' || filterType === 'club') && (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#a445ff', marginBottom: 8, marginTop: filterType === 'all' ? 0 : 8 }}>
                          🎭 Clubs
                        </div>
                        {clubs
                          .filter(club => {
                            const venueName = club.name || club.companyName || club.fullname || club.email || club.id;
                            return isClubVenue(venueName);
                          })
                          .map(club => (
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
                              🎭 Club
                            </div>
                          </div>
                        </div>
                      ))}
                      </>
                    )}
                    
                    {/* Bars section */}
                    {(filterType === 'all' || filterType === 'bar') && (
                      <>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#a445ff', marginBottom: 8, marginTop: filterType === 'all' ? 16 : 8 }}>
                          🍺 Bars
                        </div>
                        {clubs
                          .filter(club => {
                            const venueName = club.name || club.companyName || club.fullname || club.email || club.id;
                            return !isClubVenue(venueName);
                          })
                          .map(club => (
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
                                  🍺 Bar
                                </div>
                              </div>
                            </div>
                          ))}
                      </>
                    )}
                  </>
                )}
              </div>
              {/* Multi-select message input for private users */}
              {!isClub && selectedNewClubs.length > 0 && (
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
                      
                      // Show success message
                      if (typeof toast !== 'undefined') {
                        toast.success(`Message sent to ${selectedNewClubs.length} venue${selectedNewClubs.length > 1 ? 's' : ''}!`, {
                          position: "top-center",
                          autoClose: 3000,
                          hideProgressBar: false,
                          closeOnClick: true,
                          pauseOnHover: true,
                        });
                      }
                      
                    } catch (error) {
                      console.error('Error sending messages:', error);
                      if (typeof toast !== 'undefined') {
                        toast.error('Failed to send messages. Please try again.', {
                          position: "top-center",
                          autoClose: 3000,
                        });
                      }
                    }
                    
                    setLoading(false);
                    setShowNewChat(false);
                    setSelectedNewClubs([]);
                    setMultiMessage('');
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}
                >
                  <input
                    style={{ padding: '12px', borderRadius: 16, border: 'none', fontSize: 15, background: 'rgba(255,255,255,0.13)', color: '#fff', outline: 'none', marginBottom: 0 }}
                    type="text"
                    placeholder={`Message to ${selectedNewClubs.length} venue${selectedNewClubs.length > 1 ? 's' : ''}...`}
                    value={multiMessage}
                    onChange={e => setMultiMessage(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    style={{ background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)', color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 16, padding: '10px 0', boxShadow: '0 2px 8px #a445ff22', cursor: loading || !multiMessage.trim() ? 'not-allowed' : 'pointer', opacity: loading || !multiMessage.trim() ? 0.6 : 1, transition: 'opacity 0.2s' }}
                    disabled={loading || !multiMessage.trim()}
                  >Send to {selectedNewClubs.length} venue{selectedNewClubs.length > 1 ? 's' : ''}</button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
      <BottomNav />
      <ToastContainer />
    </div>
  );
});

export default ChatPage; 