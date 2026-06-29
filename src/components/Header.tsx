import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Bell, LogOut, Briefcase, HelpCircle, Layers, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { NotificationsAPI } from '../services/api';

interface HeaderProps {
  currentView: string;
  onChangeView: (view: string) => void;
  onThemeToggle: () => void;
  theme: 'light' | 'dark';
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onChangeView,
  onThemeToggle,
  theme,
  onLogout,
}) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const username = sessionStorage.getItem('username') || 'User';
  const productName = sessionStorage.getItem('product_name') || 'No Workspace Selected';

  const getTypeClass = (type: string) => {
    const t = (type || '').toLowerCase().trim();
    if (t === 'success' || t === 'ok') return 'success';
    if (t === 'warning' || t === 'not_ok') return 'warning';
    if (t === 'info') return 'info';
    if (t === 'error' || t === 'danger') return 'error';
    return 'info';
  };

  const renderNotificationIcon = (type: string) => {
    const t = getTypeClass(type);
    if (t === 'success') return <CheckCircle2 size={14} style={{ color: '#10B981' }} />;
    if (t === 'warning') return <AlertTriangle size={14} style={{ color: '#F59E0B' }} />;
    if (t === 'info') return <Info size={14} style={{ color: '#3B82F6' }} />;
    return <AlertTriangle size={14} style={{ color: '#EF4444' }} />;
  };

  // Format header title text based on current view name
  const getHeaderTitle = () => {
    if (currentView === 'welcome') return 'Dashboard Overview';
    return currentView.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    const [success, data] = await NotificationsAPI.getNotifications();
    if (success && Array.isArray(data)) {
      setNotifications(data);
      // Count unseen notifications
      const unseen = data.filter((notif: any) => !notif.seen).length;
      setUnreadCount(unseen);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 45 seconds
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const markAllAsSeen = async () => {
    const unseenIds = notifications
      .filter((n: any) => !n.seen)
      .map((n: any) => n.id);

    if (unseenIds.length > 0) {
      const [success] = await NotificationsAPI.markNotificationsSeen(unseenIds);
      if (success) {
        setNotifications(prev =>
          prev.map((n: any) => ({ ...n, seen: true }))
        );
        setUnreadCount(0);
      }
    }
  };

  return (
    <header className="header-bar">
      {/* Title & View Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{getHeaderTitle()}</h2>
      </div>

      {/* Control Actions Panel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Workspace Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'var(--primary-light)',
          color: 'var(--primary-color)',
          padding: '6px 14px',
          borderRadius: '50px',
          fontSize: '0.8rem',
          fontWeight: 600,
          border: '1px solid rgba(99, 102, 241, 0.2)'
        }}>
          <Briefcase size={14} />
          <span>{productName}</span>
        </div>

        {/* Quick Product Switcher */}
        <button 
          onClick={() => onChangeView('product_select')}
          className="header-icon-btn"
          title="Switch Product Workspace"
        >
          <Layers size={18} />
        </button>

        {/* Theme Switcher */}
        <button 
          onClick={onThemeToggle} 
          className="header-icon-btn"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications Popover */}
        <div style={{ position: 'relative' }} ref={notificationsRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) markAllAsSeen();
            }} 
            className={`header-icon-btn ${showNotifications ? 'active-bell' : ''}`}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="notification-badge-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Panel */}
          {showNotifications && (
            <div className="notification-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>
                  Notifications
                </h4>
                <button 
                  onClick={fetchNotifications}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--primary-color)', 
                    fontSize: '0.75rem', 
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Refresh
                </button>
              </div>
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '4px 0' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: 'var(--text-light)', 
                    fontSize: '0.85rem', 
                    padding: '24px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Bell size={24} style={{ opacity: 0.3 }} />
                    <span>No alerts at this time</span>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className={`notification-card ${getTypeClass(notif.notification_type)} ${notif.seen ? 'seen' : 'unread'}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {renderNotificationIcon(notif.notification_type)}
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme === 'light' ? '#1e293b' : '#f8fafc' }}>
                            {notif.title}
                          </span>
                        </div>
                        {!notif.seen && (
                          <span style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: 'var(--primary-color)',
                            borderRadius: '50%'
                          }} />
                        )}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                        {notif.message}
                      </p>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', alignSelf: 'flex-end', marginTop: '2px' }}>
                        {new Date(notif.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Card Menu */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <div 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'var(--primary-gradient)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {username.charAt(0).toUpperCase()}
          </div>

          {showProfileMenu && (
            <div className="glass-card animated-fade" style={{
              position: 'absolute',
              top: '50px',
              right: '0',
              width: '180px',
              padding: '8px',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <div style={{ padding: '8px', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{username}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>Online</span>
              </div>
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '4px 0' }} />
              
              <button 
                onClick={() => {
                  setShowProfileMenu(false);
                  onChangeView('welcome');
                }}
                className="theme-switch-btn"
                style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.85rem', gap: '8px' }}
              >
                <HelpCircle size={16} />
                <span>Dashboard</span>
              </button>
              
              <button 
                onClick={() => {
                  setShowProfileMenu(false);
                  onLogout();
                }}
                className="theme-switch-btn"
                style={{ 
                  justifyContent: 'flex-start', 
                  width: '100%', 
                  fontSize: '0.85rem', 
                  gap: '8px',
                  color: 'var(--color-error)'
                }}
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
