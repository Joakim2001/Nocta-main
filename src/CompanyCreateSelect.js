import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';

const ticketOptions = [
  'No ticket',
  'Free ticket',
  'Buy ticket',
];

function CustomDropdown({ value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [open]);

  const dropdownMenu = open ? ReactDOM.createPortal(
    <ul
      tabIndex={-1}
      style={{
        position: 'absolute',
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        minWidth: 160,
        background: '#2d1457',
        color: '#fff',
        borderRadius: 10,
        marginTop: 4,
        boxShadow: '0 4px 16px #0008',
        zIndex: 99999,
        padding: 0,
        listStyle: 'none',
        fontWeight: 700,
        fontSize: 17,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
      role="listbox"
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
    >
      {options.map((opt) => (
        <li
          key={opt}
          role="option"
          aria-selected={value === opt}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onChange(opt); setOpen(false); }}
          onKeyDown={e => { if (e.key === 'Enter') { onChange(opt); setOpen(false); }}}
          style={{
            padding: '14px 18px',
            background: value === opt ? 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)' : 'transparent',
            color: value === opt ? '#fff' : '#fff',
            cursor: 'pointer',
            transition: 'background 0.2s',
            border: 'none',
            outline: 'none',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(75,31,162,0.5)'}
          onMouseLeave={e => e.currentTarget.style.background = value === opt ? 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)' : 'transparent'}
        >
          {opt}
        </li>
      ))}
    </ul>,
    document.body
  ) : null;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', minWidth: 150, height: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          fontWeight: 700,
          fontSize: 17,
          padding: '0 18px 0 8px',
          height: '100%',
          minWidth: 140,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          position: 'relative',
        }}
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 120 }}>{value}</span>
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" style={{ marginLeft: 8 }}><path d="M6 8l4 4 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {dropdownMenu}
    </div>
  );
}

function CompanyCreateSelect() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null); // null, 'event', or 'offer'
  const [selectedTicket, setSelectedTicket] = useState('No ticket');

  const cardStyle = (active, anySelected) => ({
    width: '100%',
    padding: 0,
    borderRadius: 18,
    background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    border: active ? '4px solid #a445ff' : '2px solid transparent',
    boxShadow: active ? '0 8px 32px #a445ff88, 0 2px 8px #0008' : '0 2px 8px #0008',
    marginBottom: 12,
    cursor: 'pointer',
    letterSpacing: 0.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    minHeight: 48,
    minWidth: 320,
    maxWidth: 400,
    transition: 'border 0.2s, box-shadow 0.2s, transform 0.2s, filter 0.2s',
    transform: active ? 'scale(1.04)' : 'scale(1)',
    filter: !anySelected ? 'grayscale(0.3) brightness(0.85)' : (active ? 'none' : 'grayscale(0.3) brightness(0.85)'),
    opacity: !anySelected ? 0.7 : (active ? 1 : 0.7),
  });

  const buttonTextStyle = {
    flex: 2,
    textAlign: 'left',
    padding: '18px 12px',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    cursor: 'pointer',
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
    outline: 'none',
  };

  const labelTextStyle = {
    flex: '0 0 170px',
    minWidth: 170,
    maxWidth: 170,
    textAlign: 'left',
    padding: '18px 10px',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    cursor: 'pointer',
    letterSpacing: 0.5,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    outline: 'none',
  };

  const continueButtonStyle = {
    width: '50%',
    padding: '16px 0',
    borderRadius: 18,
    background: 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)',
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    border: 'none',
    boxShadow: '0 4px 16px #3E29F055',
    marginTop: 24,
    cursor: 'pointer',
    letterSpacing: 0.5,
    alignSelf: 'center',
  };

  function handleContinue() {
    if (selected === 'event') {
      navigate('/ticket-configuration', { state: { ticketOption: selectedTicket, eventType: selected } });
    } else {
      alert(`Offer creation coming soon!\nTicket type: ${selectedTicket}`);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#22043a' }}>
      {/* Top Bar */}
      <div style={{ maxWidth: 448, margin: '0 auto', background: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', padding: '16px', position: 'relative', justifyContent: 'center' }}>
        <span onClick={() => navigate(-1)} style={{ color: '#fff', fontSize: 24, cursor: 'pointer', position: 'absolute', left: 16, top: 16 }}>‹</span>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
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
          margin: '0 auto',
        }}>Choose type of post</span>
      </div>
      <div style={{ borderRadius: 24, padding: 32, maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', margin: '80px auto 0 auto', background: 'transparent', overflow: 'visible' }}>
        <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 20, marginBottom: 2 }}>Create</h2>
        
        {/* Event and Offer buttons side by side */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', width: '100%' }}>
        {/* Event Card */}
          <div style={{...cardStyle(selected === 'event', selected !== null), width: '120px', minWidth: '120px', maxWidth: '120px'}}
          onClick={() => setSelected('event')}
          tabIndex={0} role="button" aria-pressed={selected === 'event'}>
            <span style={{...labelTextStyle, textAlign: 'center', flex: '1', minWidth: 'auto', maxWidth: 'none'}}>Event</span>
        </div>
        {/* Offer Card */}
          <div style={{...cardStyle(selected === 'offer', selected !== null), width: '120px', minWidth: '120px', maxWidth: '120px'}}
          onClick={() => setSelected('offer')}
          tabIndex={0} role="button" aria-pressed={selected === 'offer'}>
            <span style={{...labelTextStyle, textAlign: 'center', flex: '1', minWidth: 'auto', maxWidth: 'none'}}>Offer</span>
          </div>
        </div>

        {/* Ticket options below */}
        {selected && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 20, marginBottom: 8, textAlign: 'center' }}>Ticket Type</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {ticketOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setSelectedTicket(option)}
                  style={{
                    flex: 1,
                    padding: '16px 20px',
                    borderRadius: 12,
                    background: selectedTicket === option 
                      ? 'linear-gradient(90deg, #F941F9 0%, #3E29F0 100%)' 
                      : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 18,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {selected && <button style={continueButtonStyle} onClick={handleContinue}>Continue</button>}
      </div>
    </div>
  );
}

export default CompanyCreateSelect; 