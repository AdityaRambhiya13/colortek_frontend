import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, Building, Compass, Sparkles } from 'lucide-react';
import { AuthAPI } from '../services/api';

interface LoginProps {
  onLoginSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAdminLogin] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    return view === 'user_management' || view === 'database_management' || view === 'products_master';
  });
  
  // Workspace Selection State
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [showProductSelect, setShowProductSelect] = useState(false);
  const [preAuthToken, setPreAuthToken] = useState('');

  // Focus & Hover States
  const [focusedField, setFocusedField] = useState<'username' | 'password' | null>(null);
  const [isLoginHovered, setIsLoginHovered] = useState(false);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  useEffect(() => {
    // Autofill username from cache if available
    const cachedUser = sessionStorage.getItem('username_cache');
    if (cachedUser) {
      setUsername(cachedUser);
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please input your username and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Fetch authorized product workspaces first
      const [success, data] = await AuthAPI.getUserProducts(username, password);
      
      if (success && typeof data !== 'string') {
        const products = data.products || [];
        
        if (products.length === 0) {
          setErrorMsg('You do not have permission for any product workspace.');
          setLoading(false);
          return;
        }

        // Store pre-auth token in React state
        setPreAuthToken(data.pre_auth_token);
        
        setAvailableProducts(products);

        if (products.length === 1) {
          // If only 1 product, login instantly
          completeWorkspaceLogin(products[0], data.pre_auth_token);
        } else {
          // If multiple products, show workspace cards selection screen
          setShowProductSelect(true);
          setLoading(false);
        }
      } else {
        setErrorMsg(typeof data === 'string' ? data : 'Invalid username or password.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg('A connection error occurred. Verify that the server is online.');
      setLoading(false);
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorMsg('Please input your admin username and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const [success, data] = await AuthAPI.adminLogin(username, password);
      
      if (success) {
        // Set direct view to user_management
        sessionStorage.setItem('active_view', 'user_management');
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'user_management');
        window.history.pushState({}, '', url.toString());

        onLoginSuccess();
      } else {
        setErrorMsg(typeof data === 'string' ? data : 'Invalid admin username or password.');
        setLoading(false);
      }
    } catch (err: any) {
      setErrorMsg('A connection error occurred. Verify that the server is online.');
      setLoading(false);
    }
  };

  const completeWorkspaceLogin = async (productName: string, tokenParam?: string) => {
    setLoading(true);
    setErrorMsg('');

    const tokenToUse = tokenParam || preAuthToken;

    try {
      const [success, data] = await AuthAPI.login(username, tokenToUse, productName);
      
      if (success) {
        // Clear temporary pre-auth token state
        setPreAuthToken('');
        
        onLoginSuccess();
      } else {
        setErrorMsg(typeof data === 'string' ? data : 'Workspace access denied.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg('Failed to open selected workspace.');
      setLoading(false);
    }
  };

  if (showProductSelect) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #18181b 0%, #09090b 100%)',
        padding: '24px',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div className="glass-card animated-scale" style={{
          width: '100%',
          maxWidth: '850px',
          background: 'rgba(18, 18, 18, 0.75)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            padding: '16px',
            borderRadius: '50%',
            color: '#818cf8',
            boxShadow: '0 0 30px rgba(99, 102, 241, 0.15)'
          }}>
            <Compass size={36} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Select Product Workspace</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
              Your account has access to multiple product scopes. Select one to proceed.
            </p>
          </div>

          <hr style={{ width: '100%', border: 'none', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }} />

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '32px' }}>
              <div className="loader-ring" style={{
                width: '40px',
                height: '40px',
                border: '4px solid rgba(255,255,255,0.1)',
                borderTopColor: 'var(--primary-color)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Loading selected environment...</span>
            </div>
          ) : (
            <div className="workspace-cards" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              width: '100%',
              marginTop: '8px',
              maxHeight: '380px',
              overflowY: 'auto',
              padding: '8px',
              boxSizing: 'border-box'
            }}>
              {availableProducts.map((product) => {
                const isHovered = hoveredProduct === product;
                return (
                  <div 
                    key={product}
                    onClick={() => completeWorkspaceLogin(product)}
                    onMouseEnter={() => setHoveredProduct(product)}
                    onMouseLeave={() => setHoveredProduct(null)}
                    className="workspace-card"
                    style={{
                      background: isHovered ? 'rgba(255, 255, 255, 0.07)' : 'rgba(255, 255, 255, 0.03)',
                      border: isHovered ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px',
                      borderRadius: '12px',
                      padding: '20px 12px',
                      cursor: 'pointer',
                      transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                      boxShadow: isHovered ? '0 10px 20px rgba(0,0,0,0.3)' : 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div style={{
                      backgroundColor: isHovered ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)',
                      padding: '12px',
                      borderRadius: '50%',
                      color: '#818cf8',
                      transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 0.2s ease'
                    }}>
                      <Building size={24} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', textAlign: 'center', wordBreak: 'break-word' }}>{product}</span>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Authorized Profile</span>
                    <div style={{
                      marginTop: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: isHovered ? '#818cf8' : '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: isHovered ? 1 : 0.8,
                      transition: 'all 0.2s ease'
                    }}>
                      <span>Open Scope</span>
                      <Sparkles size={10} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && (
            <button 
              onClick={() => setShowProductSelect(false)}
              className="btn-secondary"
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '8px 16px',
                color: '#cbd5e1',
                fontSize: '0.85rem',
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: '16px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              Back to Login
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: '100vh',
      overflowY: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #18181b 0%, #09090b 100%)',
      padding: '40px 24px',
      boxSizing: 'border-box',
      color: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div className="glass-card animated-scale" style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(18, 18, 18, 0.75)',
        backdropFilter: 'blur(20px)',
        border: isAdminLogin ? '1px solid rgba(168, 85, 247, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        boxShadow: isAdminLogin ? '0 20px 50px rgba(168, 85, 247, 0.15)' : '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        transition: 'all 0.3s ease',
        margin: 'auto' // Center horizontally and vertically within the scrollable container
      }}>
        {/* Logo and Titles */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isAdminLogin ? 'rgba(168, 85, 247, 0.1)' : 'rgba(99, 102, 241, 0.1)',
            border: isAdminLogin ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid rgba(99, 102, 241, 0.2)',
            padding: '16px',
            borderRadius: '50%',
            color: isAdminLogin ? '#c084fc' : '#818cf8',
            boxShadow: isAdminLogin ? '0 0 30px rgba(168, 85, 247, 0.15)' : '0 0 30px rgba(99, 102, 241, 0.15)',
            transition: 'all 0.3s ease'
          }}>
            {isAdminLogin ? <Shield size={36} /> : <Building size={36} />}
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.01em', marginTop: '12px', textAlign: 'center' }}>
            {isAdminLogin ? 'Colortek Admin Panel' : 'Colortek Secure Portal'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
            {isAdminLogin ? 'Sign in to manage system administration' : 'Sign in to manage batch systems'}
          </p>
        </div>

        <form onSubmit={isAdminLogin ? handleAdminLoginSubmit : handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {errorMsg && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '0.8rem',
              textAlign: 'center'
            }}>
              {errorMsg}
            </div>
          )}

          {/* Username Box */}
          <div className="form-input-container">
            <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField('username')}
                onBlur={() => setFocusedField(null)}
                className="field-input"
                placeholder={isAdminLogin ? "Enter admin username" : "Enter your username"}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: focusedField === 'username' ? (isAdminLogin ? '1px solid #a855f7' : '1px solid #6366f1') : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: 'white',
                  paddingLeft: '40px',
                  height: '40px',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxShadow: focusedField === 'username' ? (isAdminLogin ? '0 0 10px rgba(168, 85, 247, 0.15)' : '0 0 10px rgba(99, 102, 241, 0.15)') : 'none',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
                disabled={loading}
              />
              <Shield size={16} color={focusedField === 'username' ? (isAdminLogin ? '#c084fc' : '#818cf8') : '#64748b'} style={{ position: 'absolute', left: '14px', top: '12px', transition: 'color 0.2s ease' }} />
            </div>
          </div>

          {/* Password Box */}
          <div className="form-input-container">
            <label className="form-label" style={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                className="field-input"
                placeholder="Enter your password"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: focusedField === 'password' ? (isAdminLogin ? '1px solid #a855f7' : '1px solid #6366f1') : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  color: 'white',
                  paddingLeft: '40px',
                  paddingRight: '40px',
                  height: '40px',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxShadow: focusedField === 'password' ? (isAdminLogin ? '0 0 10px rgba(168, 85, 247, 0.15)' : '0 0 10px rgba(99, 102, 241, 0.15)') : 'none',
                  transition: 'all 0.2s ease',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
                disabled={loading}
              />
              <Key size={16} color={focusedField === 'password' ? (isAdminLogin ? '#c084fc' : '#818cf8') : '#64748b'} style={{ position: 'absolute', left: '14px', top: '12px', transition: 'color 0.2s ease' }} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '12px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            onMouseEnter={() => setIsLoginHovered(true)}
            onMouseLeave={() => setIsLoginHovered(false)}
            className="btn-primary"
            style={{
              width: '100%',
              height: '42px',
              marginTop: '12px',
              background: isAdminLogin
                ? (isLoginHovered ? 'linear-gradient(135deg, #7e22ce, #581c87)' : 'linear-gradient(135deg, #a855f7, #7e22ce)')
                : (isLoginHovered ? 'linear-gradient(135deg, #4f46e5, #1d4ed8)' : 'linear-gradient(135deg, #6366f1, #2563eb)'),
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transform: isLoginHovered ? 'translateY(-1px)' : 'translateY(0)',
              boxShadow: isLoginHovered 
                ? (isAdminLogin ? '0 4px 12px rgba(168, 85, 247, 0.25)' : '0 4px 12px rgba(99, 102, 241, 0.25)')
                : 'none',
              transition: 'all 0.2s ease'
            }}
            disabled={loading}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="loader-ring" style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span>Securing session...</span>
              </div>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
