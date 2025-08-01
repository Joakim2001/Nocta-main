import React from 'react';
import { getAuth } from 'firebase/auth';

export default function UserIdDebug() {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    return (
      <div style={{
        position: 'fixed',
        top: 20,
        left: 20,
        background: '#1e293b',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #334155',
        zIndex: 1000,
        color: '#fff',
        fontSize: '12px'
      }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#f59e0b' }}>User Debug</h4>
        <div>Not logged in</div>
      </div>
    );
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(user.uid);
    alert('User ID copied to clipboard!');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      left: 20,
      background: '#1e293b',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid #334155',
      zIndex: 1000,
      color: '#fff',
      fontSize: '12px',
      maxWidth: '300px'
    }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#f59e0b' }}>User Debug Info</h4>
      <div style={{ marginBottom: '8px' }}>
        <strong>Email:</strong> {user.email}
      </div>
      <div style={{ marginBottom: '8px' }}>
        <strong>Full UID:</strong> 
        <div style={{ 
          background: '#374151', 
          padding: '4px 8px', 
          borderRadius: '4px', 
          fontFamily: 'monospace',
          fontSize: '10px',
          marginTop: '4px',
          wordBreak: 'break-all'
        }}>
          {user.uid}
        </div>
      </div>
      <button
        onClick={copyToClipboard}
        style={{
          background: '#3b82f6',
          color: '#fff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '11px',
          cursor: 'pointer'
        }}
      >
        Copy UID
      </button>
    </div>
  );
} 