import React, { useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, onSnapshot, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';



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

const ChatPageCompany = forwardRef(({ unreadCount, setUnreadCount }, ref) => {
  const [clubUsers, setClubUsers] = useState([]);
  const [threads, setThreads] = useState([]); // inbox threads
  const [selectedThread, setSelectedThread] = useState(null); // {id, name, ...}
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [longPressMessageId, setLongPressMessageId] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const auth = getAuth();
  const user = auth.currentUser;

  // Real-time inbox for clubs
  useEffect(() => {
    if (!user) return;
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
            name: msg.senderId !== user.uid ? msg.senderEmail : msg.recipientEmail || otherId,
            lastMsg: msg,
            timestamp: msg.timestamp,
            unread: false
          };
        }
      });
      // Process unread logic
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
  }, [user, setUnreadCount]);

  // Mark messages as read when opening a thread
  useEffect(() => {
    if (!selectedThread || !user) return;
    localStorage.setItem(`lastSeenMsg_${user.uid}_${selectedThread.id}`, Math.floor(Date.now() / 1000));
  }, [selectedThread, user]);

  // Expose unreadCount to parent via ref
  useImperativeHandle(ref, () => ({ unreadCount }), [unreadCount]);

  // Fetch users who can message this club
  useEffect(() => {
    if (!user) return;
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, 'profiles'));
        setClubUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error('Error fetching users for club chat:', e);
      }
    }
    fetchUsers();
  }, [user]);

  // Listen for messages in selected thread
  useEffect(() => {
    if (!selectedThread || !user) return;
    const q = query(collection(db, `club-chats/${user.uid}/messages`), orderBy('timestamp'));
    console.log('Listening for messages in club thread:', `club-chats/${user.uid}/messages`);
    const unsub = onSnapshot(q, (snap) => {
      let msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      msgs = msgs.filter(msg => msg.senderId === selectedThread.id || msg.recipientId === selectedThread.id);
      setMessages(msgs);
    }, (e) => {
      console.error('Error listening for messages in thread:', e);
    });
    return () => unsub();
  }, [selectedThread, user?.uid]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedThread) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `club-chats/${user.uid}/messages`), {
        text: newMessage,
        senderId: user.uid,
        senderEmail: user.email || '',
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
      await updateDoc(doc(db, `club-chats/${user.uid}/messages`, messageId), {
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
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 0.5, textShadow: '0 2px 8px #3E29F099' }}>Inbox</div>
              <div style={{ fontSize: 12, color: '#b3e0ff' }}>Customer messages</div>
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
                <div style={{ fontSize: 16, marginBottom: 8 }}>No messages yet.</div>
                <div style={{ fontSize: 14 }}>Customers will appear here when they message you</div>
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
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Private User</div>
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

            {/* Users list */}
            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 12 }}>
              {clubUsers.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 20 }}>
                  No users available to message
                </div>
              ) : (
                clubUsers.map(u => (
                  <div 
                    key={u.id} 
                    style={{ 
                      padding: '16px 20px', 
                      borderRadius: 12, 
                      cursor: 'pointer', 
                      background: 'rgba(255,255,255,0.06)', 
                      marginBottom: 10, 
                      color: '#fff', 
                      fontWeight: 500, 
                      transition: 'background 0.2s' 
                    }} 
                    onClick={() => { 
                      setSelectedThread({ id: u.id, name: u.name || u.fullname || u.email || u.id }); 
                      setShowNewChat(false); 
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 600 }}>
                      {u.name || u.fullname || u.email || u.id}
                    </div>
                                          <div style={{ fontSize: 12, color: '#b3e0ff', marginTop: 2 }}>
                        Private User • {u.email}
                      </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatPageCompany; 