import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

function CompanyProfilePage() {
  const [user, setUser] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setEmail(currentUser.email || '');

        // Fetch company data from Firestore
        try {
          const companyDoc = await getDoc(doc(db, 'Club_Bar_Festival_profiles', currentUser.uid));
          if (companyDoc.exists()) {
            const data = companyDoc.data();
            setCompanyData(data);
            setCompanyName(data.companyName || data.fullname || '');
            setPhone(data.phone || '');
            setDescription(data.description || '');
          }
        } catch (error) {
          console.error('Error fetching company data:', error);
        }
        setLoading(false);
      } else {
        // User is not authenticated
        setUser(null);
        setCompanyData(null);
        setLoading(false);
        navigate('/company-login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'Club_Bar_Festival_profiles', user.uid), {
        companyName: companyName,
        phone: phone,
        description: description,
        updatedAt: new Date()
      });
      setCompanyData(prev => ({ ...prev, companyName, phone, description }));
      setEditing(false);
    } catch (error) {
      console.error('Error updating company profile:', error);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/company-login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    if (date.seconds) {
      return new Date(date.seconds * 1000).toLocaleDateString();
    }
    return new Date(date).toLocaleDateString();
  };

  const getVerificationStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return '#10b981'; // Green
      case 'verified':
        return '#10b981'; // Green
      case 'pending':
        return '#f59e0b'; // Yellow
      case 'rejected':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  const getVerificationStatusText = (status) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending Review';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Unknown';
    }
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
                <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 0.5, textShadow: '0 2px 8px #3E29F099' }}>Company Profile</div>
              <div style={{ fontSize: 12, color: '#b3e0ff' }}>Business account settings</div>
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
            {companyName ? companyName.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
            {companyName || 'Company'}
          </div>
          <div style={{ fontSize: 14, color: '#94a3b8' }}>
            {user?.email}
          </div>

          {/* Verification Status */}
          {companyData && (
            <div style={{
              marginTop: 16,
              padding: '8px 16px',
              borderRadius: 20,
              background: getVerificationStatusColor(companyData.verificationStatus),
              display: 'inline-block'
            }}>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>
                {getVerificationStatusText(companyData.verificationStatus)}
              </span>
            </div>
          )}
        </div>

        {/* Company Information */}
        {companyData && (
          <div style={{
            background: '#1e293b',
            borderRadius: 16,
            padding: 24,
            marginBottom: 20
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
              Company Information
            </div>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8, display: 'block' }}>
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '1px solid #334155',
                      background: '#334155',
                      color: '#fff',
                      fontSize: 14
                    }}
                    placeholder="Enter company name"
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
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label style={{ fontSize: 14, color: '#94a3b8', marginBottom: 8, display: 'block' }}>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 8,
                      border: '1px solid #334155',
                      background: '#334155',
                      color: '#fff',
                      fontSize: 14,
                      minHeight: 80,
                      resize: 'vertical'
                    }}
                    placeholder="Enter company description"
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setCompanyName(companyData?.companyName || companyData?.fullname || '');
                      setPhone(companyData?.phone || '');
                      setDescription(companyData?.description || '');
                    }}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: '#334155',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 500
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
                      fontSize: 14,
                      fontWeight: 500,
                      opacity: saving ? 0.6 : 1
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Company Name</div>
                  <div style={{ fontSize: 16, color: '#fff' }}>{companyName || 'Not set'}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Email</div>
                  <div style={{ fontSize: 16, color: '#fff' }}>{email}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Phone Number</div>
                  <div style={{ fontSize: 16, color: '#fff' }}>{phone || 'Not set'}</div>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 16, color: '#fff' }}>{description || 'No description provided'}</div>
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
                    fontSize: 14,
                    fontWeight: 500
                  }}
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        )}

        {/* Account Details */}
        {companyData && (
          <div style={{
            background: '#1e293b',
            borderRadius: 16,
            padding: 24,
            marginBottom: 20
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 20 }}>
              Account Details
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Account Created</div>
                <div style={{ fontSize: 16, color: '#fff' }}>
                  {formatDate(companyData.createdAt)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Last Updated</div>
                <div style={{ fontSize: 16, color: '#fff' }}>
                  {formatDate(companyData.updatedAt)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Verification Status</div>
                <div style={{
                  fontSize: 16,
                  color: getVerificationStatusColor(companyData.verificationStatus),
                  fontWeight: 600
                }}>
                  {getVerificationStatusText(companyData.verificationStatus)}
                </div>
              </div>

              {companyData.verifiedAt && (
                <div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Verified On</div>
                  <div style={{ fontSize: 16, color: '#fff' }}>
                    {formatDate(companyData.verifiedAt)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sign Out Button */}
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

export default CompanyProfilePage;
