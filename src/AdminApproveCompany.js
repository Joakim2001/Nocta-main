import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function AdminApproveCompany() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Handle URL-encoded parameters (email clients sometimes encode = as 3D)
  const rawUrl = window.location.href;
  const decodedUrl = decodeURIComponent(rawUrl);
  
  // Extract parameters from the decoded URL
  let queryString = decodedUrl.split('?')[1] || '';
  
  // Fix the query string if it has an extra = at the beginning
  if (queryString.startsWith('=')) {
    queryString = queryString.substring(1);
  }
  
  // Remove any leading spaces
  queryString = queryString.trim();
  
  // Manual parsing to handle malformed URLs
  let uid = null;
  let code = null;
  let action = null;
  
  const params = queryString.split('&');
  for (const param of params) {
    const [key, value] = param.split('=');
    if (key === 'uid') uid = value;
    if (key === 'code') code = value;
    if (key === 'action') action = value;
  }
  
  // Decode the values if they're still encoded
  if (uid && uid.includes('3D')) {
    uid = uid.replace(/3D/g, '=');
  }
  if (code && code.includes('3D')) {
    code = code.replace(/3D/g, '=');
  }
  if (action && action.includes('3D')) {
    action = action.replace(/3D/g, '=');
  }
  
  // Fallback to searchParams if manual parsing failed
  if (!uid || !code || !action) {
    uid = uid || searchParams.get('uid');
    code = code || searchParams.get('code');
    action = action || searchParams.get('action') || (window.location.pathname.includes('reject') ? 'reject' : 'approve');
  }

  useEffect(() => {
    console.log('useEffect triggered with:', { uid, code, action });
    if (!uid || !code || !action) {
      console.log('Missing parameters detected:', { uid, code, action });
      setError('Missing required parameters');
      return;
    }
    console.log('All parameters present, calling handleApproval');
    // Auto-process the approval/rejection
    handleApproval();
  }, [uid, code, action]);

  const handleApproval = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    const url = `https://us-central1-nocta-d1113.cloudfunctions.net/approveCompany?uid=${uid}&code=${code}&action=${action}`;
    console.log('Calling function URL:', url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Company ${action === 'reject' ? 'rejected' : 'approved'} successfully! An email has been sent to the company.`);
      } else {
        setError(data.error || 'Failed to process request');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!uid || !code) {
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
        <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto' }}>
          <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: 1 }}>Nocta</h1>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: '0 0 20px 0' }}>Invalid Request</h2>
          <p style={{ color: '#ffb3ff', fontSize: 16 }}>{error}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '12px 24px',
              borderRadius: 25,
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              cursor: 'pointer',
              marginTop: 20,
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

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
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ color: '#F2F2F2', fontSize: 48, fontFamily: 'Playfair Display, serif', fontWeight: 600, margin: '0 0 8px 0', letterSpacing: 1 }}>Nocta</h1>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 22, margin: '0 0 20px 0' }}>
          {action === 'reject' ? 'Rejecting Company' : 'Approving Company'}
        </h2>
        
        {loading && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ 
              width: 40, 
              height: 40, 
              border: '4px solid rgba(255,255,255,0.3)', 
              borderTop: '4px solid #fff', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite',
              margin: '0 auto 20px auto'
            }}></div>
            <p style={{ color: '#ccc', fontSize: 16 }}>
              Processing {action === 'reject' ? 'rejection' : 'approval'}...
            </p>
          </div>
        )}

        {message && (
          <div style={{ 
            background: action === 'reject' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(76, 175, 80, 0.2)', 
            border: `1px solid ${action === 'reject' ? '#f44336' : '#4CAF50'}`, 
            borderRadius: 12, 
            padding: 20, 
            marginBottom: 20 
          }}>
            <p style={{ color: '#fff', fontSize: 16, margin: 0 }}>{message}</p>
          </div>
        )}

        {error && (
          <div style={{ 
            background: 'rgba(244, 67, 54, 0.2)', 
            border: '1px solid #f44336', 
            borderRadius: 12, 
            padding: 20, 
            marginBottom: 20 
          }}>
            <p style={{ color: '#ffb3ff', fontSize: 16, margin: 0 }}>{error}</p>
          </div>
        )}

        <div style={{ 
          background: 'rgba(255,255,255,0.08)', 
          borderRadius: 12, 
          padding: 20, 
          marginBottom: 20 
        }}>
          <h3 style={{ color: '#fff', fontSize: 18, margin: '0 0 15px 0' }}>Request Details:</h3>
          <div style={{ textAlign: 'left', color: '#ccc', fontSize: 14 }}>
            <p><strong>Action:</strong> {action === 'reject' ? 'Reject' : 'Approve'}</p>
            <p><strong>User ID:</strong> <span style={{ fontFamily: 'monospace' }}>{uid}</span></p>
            <p><strong>Code:</strong> <span style={{ fontFamily: 'monospace' }}>{code}</span></p>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          style={{
            padding: '12px 24px',
            borderRadius: 25,
            background: 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'pointer',
            marginTop: 20,
          }}
        >
          Go Home
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default AdminApproveCompany; 