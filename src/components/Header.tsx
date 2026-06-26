import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Bell, LogOut, Briefcase, HelpCircle, Layers, CheckCircle2 } from 'lucide-react';
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
          className="theme-switch-btn"
          title="Switch Product Workspace"
        >
          <Layers size={20} />
        </button>

        {/* Theme Switcher */}
        <button 
          onClick={onThemeToggle} 
          className="theme-switch-btn"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* Notifications Popover */}
        <div style={{ position: 'relative' }} ref={notificationsRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) markAllAsSeen();
            }} 
            className="theme-switch-btn"
            title="Notifications"
            style={{ position: 'relative' }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '16px',
                height: '16px',
                backgroundColor: 'var(--color-error)',
                color: 'white',
                borderRadius: '50%',
                fontSize: '0.65rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Panel */}
          {showNotifications && (
            <div className="glass-card animated-fade" style={{
              position: 'absolute',
              top: '50px',
              right: '0',
              width: '320px',
              maxHeight: '400px',
              padding: '16px',
              overflowY: 'auto',
              zIndex: 200,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontWeight: 600 }}>Notifications</h4>
                <button 
                  onClick={fetchNotifications}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Refresh
                </button>
              </div>
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem', padding: '16px 0' }}>
                    No alerts at this time
                  </p>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      style={{
                        padding: '10px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: notif.seen ? 'transparent' : 'var(--primary-light)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {notif.title}
                        </span>
                        {!notif.seen && <CheckCircle2 size={12} color="var(--primary-color)" />}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {notif.message}
                      </p>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-light)', textAlign: 'right' }}>
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
