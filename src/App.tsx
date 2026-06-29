import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './components/Login';
import { CmsMain } from './pages/CmsMain';
import { MasterFormulation } from './pages/MasterFormulation';
import { QcMain } from './pages/QcMain';
import { ProductionMain } from './pages/ProductionMain';
import { RdMain } from './pages/RdMain';
import { ComplaintsMain } from './pages/ComplaintsMain';
import { UserManagement } from './pages/UserManagement';
import { DatabaseManagement } from './pages/DatabaseManagement';
import { ProductsMaster } from './pages/ProductsMaster';
import { AuthAPI } from './services/api';
import { Sparkles, Layers, ShieldCheck, Factory, Beaker, FileSpreadsheet, Moon, Sun, LogOut } from 'lucide-react';

export const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'welcome';
  });
  const [sidebarMini, setSidebarMini] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Toast Notification System State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Initialize theme and verify active cached session
  useEffect(() => {
    // 1. Theme Configuration
    const cachedTheme = localStorage.getItem('theme_mode') as 'light' | 'dark';
    const activeTheme = cachedTheme || 'light';
    setTheme(activeTheme);
    document.documentElement.setAttribute('data-theme', activeTheme);
    document.documentElement.className = activeTheme;

    // 2. Auth Session Check
    const verifyUserSession = async () => {
      const storedUser = sessionStorage.getItem('username');
      if (storedUser) {
        const [success] = await AuthAPI.verifySession();
        if (success) {
          setIsAuthenticated(true);
          const cachedView = sessionStorage.getItem('active_view');
          if (cachedView) {
            setCurrentView(cachedView);
          }
        } else {
          AuthAPI.logout();
          setIsAuthenticated(false);
        }
      }
      setSessionLoading(false);
    };

    verifyUserSession();
  }, []);

  // 3. Inactivity Auto-Logout System (30 minutes) + Background Session Verify
  useEffect(() => {
    if (!isAuthenticated) return;

    let lastActivityTime = Date.now();

    const updateActivity = () => {
      lastActivityTime = Date.now();
    };

    // Attach listeners for user interactions to reset the inactivity timer
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    // Periodically check for inactivity (every 30 seconds)
    const interval = setInterval(async () => {
      const inactiveDuration = Date.now() - lastActivityTime;
      const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

      if (inactiveDuration >= thirtyMinutes) {
        showToast('Logged out due to 30 minutes of inactivity.', 'warning');
        AuthAPI.logout();
        setIsAuthenticated(false);
        setCurrentView('welcome');
      } else {
        // Every 5 minutes: silently refresh the access token using the refresh_token cookie
        const timeSinceLastVerify = Date.now() - ((window as any).lastSessionVerifyTime || 0);
        if (timeSinceLastVerify > 300000) {
          const storedUser = sessionStorage.getItem('username');
          if (storedUser) {
            // Try silent refresh first (renews the 30-min access token from 7-day refresh token)
            const refreshed = await AuthAPI.refreshSession();
            if (!refreshed) {
              // Refresh token also expired — fall back to verifySession check
              const [valid] = await AuthAPI.verifySession();
              if (!valid) {
                showToast('Session expired. Please log in again.', 'warning');
                setTimeout(() => {
                  AuthAPI.logout();
                  setIsAuthenticated(false);
                  setCurrentView('welcome');
                }, 3000);
                return;
              }
            }
            (window as any).lastSessionVerifyTime = Date.now();
          }
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Theme Toggler
  const handleThemeToggle = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme_mode', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.className = nextTheme;
    showToast(`Switched to ${nextTheme} mode`, 'info');
  };

  // View Router
  const handleViewChange = (viewName: string) => {
    if (viewName === 'product_select') {
      setIsAuthenticated(false);
      sessionStorage.removeItem('product_name');
      sessionStorage.removeItem('user_roles');
      setCurrentView('welcome');
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      window.history.pushState({}, '', url.toString());
      return;
    }
    setCurrentView(viewName);
    sessionStorage.setItem('active_view', viewName);

    const url = new URL(window.location.href);
    url.searchParams.set('view', viewName);
    window.history.pushState({}, '', url.toString());
  };

  // Toast trigger helper
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleLogout = () => {
    AuthAPI.logout();
    setIsAuthenticated(false);
    setCurrentView('welcome');
    showToast('Logged out successfully', 'success');
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    const cachedView = sessionStorage.getItem('active_view');
    const params = new URLSearchParams(window.location.search);
    const urlView = params.get('view');
    
    const isMasterAdmin = sessionStorage.getItem('product_name') === 'System Admin';
    let targetView = urlView || cachedView || 'welcome';
    
    if (isMasterAdmin && !['user_management', 'database_management', 'products_master'].includes(targetView)) {
      targetView = 'user_management';
    }
    
    setCurrentView(targetView);
    sessionStorage.setItem('active_view', targetView);
  };

  // Router switch rendering individual screen pages
  const renderActivePage = () => {
    switch (currentView) {
      // Lab (CMS) Screens
      case 'lab_formulations':
      case 'past_lab_formulations':
      case 'rm_testing':
      case 'past_rm_testing':
        return <CmsMain activeSubView={currentView} onShowToast={showToast} onChangeView={handleViewChange} />;

      // Master Formulation Page
      case 'master_formulation':
      case 'mf_production':
        return <MasterFormulation viewMode={currentView} onShowToast={showToast} onChangeView={handleViewChange} />;

      // QC Lab Screen Routes
      case 'lab_report':
      case 'live_qc_approval':
      case 'production_batches_entry':
      case 'past_production_batches':
      case 'raw_material_entry':
      case 'past_rm_entries':
      case 'w-56_rnd_batches_entry':
      case 'past_w-56_rnd_batches':
      case 'production_batches_filter':
      case 'past_batches_filter':
      case 'lab_return_batches_entry':
      case 'past_lab_return_batches':
        return <QcMain activeSubView={currentView} onShowToast={showToast} />;

      // Production & BPBS Screens
      case 'formulation_sheet':
      case 'dispatch_register':
      case 'dispatch_history':
      case 'inward_register':
      case 'warehouse_dept':
      case 'daily_production':
      case 'daily_production_history':
      case 'rejected_material_record':
      case 'material_requistion_form':
      case 'live_production':
      case 'live_prod_view':
      case 'rm_stock':
        return <ProductionMain activeSubView={currentView} onShowToast={showToast} />;

      // R&D Pages
      case 'rd':
      case 'past_rd_entries':
        return <RdMain activeSubView={currentView} onShowToast={showToast} />;

      // Complaints Screens
      case 'complaints':
      case 'complaints_lab':
      case 'repaired_formulations':
        return <ComplaintsMain activeSubView={currentView} onShowToast={showToast} onChangeView={handleViewChange} />;

      // System Administration Routes
      case 'user_management':
        return <UserManagement onShowToast={showToast} />;
      case 'database_management':
        return <DatabaseManagement onShowToast={showToast} />;
      case 'products_master':
        return <ProductsMaster onShowToast={showToast} />;

      // Fallback Welcome Dashboard
      case 'welcome':
      default:
        return (
          <div className="animated-fade" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            textAlign: 'center',
            minHeight: '60vh',
            gap: '24px'
          }}>
            <div style={{
              backgroundColor: 'var(--primary-light)',
              padding: '24px',
              borderRadius: '50%',
              color: 'var(--primary-color)',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <ShieldCheck size={48} />
            </div>
            
            <div>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '8px' }}>
                Welcome, {sessionStorage.getItem('username')}!
              </h1>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '480px' }}>
                Active product workspace: <strong style={{ color: 'var(--primary-color)' }}>{sessionStorage.getItem('product_name')}</strong>. Use the sidebar folders to compile, test, or approve batch systems.
              </p>
            </div>

            {/* Quick Cards Navigation Dashboard */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              justifyContent: 'center',
              marginTop: '16px',
              maxWidth: '800px'
            }}>
              {/* Card 1 */}
              <div 
                onClick={() => handleViewChange('lab_formulations')}
                className="glass-card interactive" 
                style={{ width: '220px', padding: '20px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                <Beaker size={24} color="var(--primary-color)" />
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>CMS Laboratory</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Compare and compile dual formulation grids.</p>
              </div>

              {/* Card 2 */}
              <div 
                onClick={() => handleViewChange('formulation_sheet')}
                className="glass-card interactive" 
                style={{ width: '220px', padding: '20px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                <FileSpreadsheet size={24} color="var(--color-success)" />
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>Perfect Batch Sheet</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Calculate raw material weights for batch lines.</p>
              </div>

              {/* Card 3 */}
              <div 
                onClick={() => handleViewChange('live_qc_approval')}
                className="glass-card interactive" 
                style={{ width: '220px', padding: '20px', textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                <ShieldCheck size={24} color="var(--color-warning)" />
                <h4 style={{ fontWeight: 600, fontSize: '0.95rem' }}>QC Approvals</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Review active production batches and sign off.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  // Render full screen session verification loader on initial load
  if (sessionLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #18181b, #27272a, #000000)',
        color: 'white',
        gap: '16px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTopColor: 'var(--primary-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <span style={{ fontSize: '0.85rem', color: '#cbd5e1', letterSpacing: '0.05em' }}>VERIFYING CLOUD SESSION...</span>
      </div>
    );
  }

  // Render Login portal if unauthenticated
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isMasterAdmin = sessionStorage.getItem('product_name') === 'System Admin';

  if (isMasterAdmin) {
    return (
      <div className="dark-theme" data-theme="dark" style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#090c15',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        {/* App Header (No Sidebar) */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: '#0b0f19',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          height: '60px',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontWeight: 700,
              fontSize: '1.2rem',
              letterSpacing: '0.03em',
              background: 'linear-gradient(135deg, #c084fc, #818cf8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Colortek Admin Panel
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Logged in as <strong style={{ color: '#ffffff' }}>{sessionStorage.getItem('username')}</strong>
            </span>
            <button
              onClick={handleThemeToggle}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#cbd5e1',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.02)'
              }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              onClick={handleLogout}
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </header>

        {/* Tab Selector Bar */}
        <div style={{
          display: 'flex',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '0 24px',
          boxSizing: 'border-box'
        }}>
          <button
            onClick={() => handleViewChange('user_management')}
            style={{
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: currentView === 'user_management' ? '3px solid #c084fc' : '3px solid transparent',
              color: currentView === 'user_management' ? '#ffffff' : '#94a3b8',
              fontWeight: currentView === 'user_management' ? 700 : 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            User Management
          </button>
          <button
            onClick={() => handleViewChange('database_management')}
            style={{
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: currentView === 'database_management' ? '3px solid #c084fc' : '3px solid transparent',
              color: currentView === 'database_management' ? '#ffffff' : '#94a3b8',
              fontWeight: currentView === 'database_management' ? 700 : 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            Database Management
          </button>
          <button
            onClick={() => handleViewChange('products_master')}
            style={{
              padding: '16px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: currentView === 'products_master' ? '3px solid #c084fc' : '3px solid transparent',
              color: currentView === 'products_master' ? '#ffffff' : '#94a3b8',
              fontWeight: currentView === 'products_master' ? 700 : 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            Products Master
          </button>
        </div>

        {/* Admin Content Area */}
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          boxSizing: 'border-box',
          backgroundColor: '#090c15'
        }}>
          {renderActivePage()}
        </main>

        {/* Toast Alert Dialog */}
        {toast && (
          <div className="toast-notification" style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: toast.type === 'error' ? '#ef4444' : toast.type === 'warning' ? '#f59e0b' : toast.type === 'info' ? '#3b82f6' : '#10b981',
            color: 'white',
            padding: '12px 20px',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)',
            zIndex: 1000,
            fontWeight: 600,
            fontSize: '0.85rem'
          }}>
            {toast.message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Dynamic Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onChangeView={handleViewChange}
        miniMode={sidebarMini}
        onToggleMiniMode={() => setSidebarMini(!sidebarMini)}
        onLogout={handleLogout}
      />

      {/* Main App Page Viewport */}
      <main className="main-viewport">
        {!['lab_formulations', 'past_lab_formulations', 'rm_testing', 'past_rm_testing'].includes(currentView) && (
          <Header
            currentView={currentView}
            onChangeView={handleViewChange}
            onThemeToggle={handleThemeToggle}
            theme={theme}
            onLogout={handleLogout}
          />
        )}

        {/* Global Page Content Container */}
        <div className="content-wrapper">
          {renderActivePage()}
        </div>
      </main>

      {/* Toast Alert Dialog */}
      {toast && (
        <div className={`toast-alert success ${toast.type}`}>
          <Sparkles size={16} color="var(--primary-color)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
};
export default App;
