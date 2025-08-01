import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App, { ProfileContext } from './App';
import reportWebVitals from './reportWebVitals';
import { BrowserRouter } from 'react-router-dom';
import { UserTypeProvider } from './UserTypeContext';

const root = ReactDOM.createRoot(document.getElementById('root'));

function Root() {
  const [profileLoaded, setProfileLoaded] = React.useState(false);
  const [profileComplete, setProfileComplete] = React.useState(false);

  return (
  <React.StrictMode>
    <BrowserRouter>
      <UserTypeProvider>
          <ProfileContext.Provider value={{ profileLoaded, setProfileLoaded, profileComplete, setProfileComplete }}>
        <App />
          </ProfileContext.Provider>
      </UserTypeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
}

root.render(<Root />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
