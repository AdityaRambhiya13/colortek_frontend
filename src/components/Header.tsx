import React, { useState, useEffect, useRef } from 'react';
import { Bell, LogOut, CheckCircle2, AlertTriangle, Info, Home, ShieldAlert } from 'lucide-react';


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
  const [showComplaintNotifications, setShowComplaintNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const notificationsRef = useRef<HTMLDivElement>(null);
  const complaintsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const username = sessionStorage.getItem('username') || 'User';
  const productName = sessionStorage.getItem('product_name') || 'No Workspace Selected';

  // Filter complaints vs regular notifications
  const complaintNotifications = notifications.filter((notif: any) => 
    (notif.target_role || '').toLowerCase().includes('complaint') || 
    (notif.title || '').toLowerCase().includes('complaint') ||
    (notif.message || '').toLowerCase().includes('complaint')
  );
  const complaintUnreadCount = complaintNotifications.filter((notif: any) => !notif.seen).length;

  const regularNotifications = notifications.filter((notif: any) => 
    !((notif.target_role || '').toLowerCase().includes('complaint') || 
      (notif.title || '').toLowerCase().includes('complaint') ||
      (notif.message || '').toLowerCase().includes('complaint'))
  );
  const regularUnreadCount = regularNotifications.filter((notif: any) => !notif.seen).length;

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
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 15 seconds
    const interval = setInterval(fetchNotifications, 15000);

    const handleRefresh = () => {
      fetchNotifications();
    };
    window.addEventListener('refresh-notifications', handleRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('refresh-notifications', handleRefresh);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (complaintsRef.current && !complaintsRef.current.contains(e.target as Node)) {
        setShowComplaintNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const markRegularAsSeen = async () => {
    const unseenIds = regularNotifications
      .filter((n: any) => !n.seen)
      .map((n: any) => n.id);

    if (unseenIds.length > 0) {
      const [success] = await NotificationsAPI.markNotificationsSeen(unseenIds);
      if (success) {
        setNotifications(prev =>
          prev.map((n: any) => unseenIds.includes(n.id) ? { ...n, seen: true } : n)
        );
      }
    }
  };

  const markComplaintsAsSeen = async () => {
    const unseenIds = complaintNotifications
      .filter((n: any) => !n.seen)
      .map((n: any) => n.id);

    if (unseenIds.length > 0) {
      const [success] = await NotificationsAPI.markNotificationsSeen(unseenIds);
      if (success) {
        setNotifications(prev =>
          prev.map((n: any) => unseenIds.includes(n.id) ? { ...n, seen: true } : n)
        );
      }
    }
  };

  return (
    <header className="header-bar">
      {/* Title & View Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          {currentView === 'welcome'
            ? `Welcome, ${username}`
            : getHeaderTitle()}
        </h2>
      </div>

      {/* Control Actions Panel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>

        {/* Complaints-Specific Notifications Bell */}
        <div style={{ position: 'relative' }} ref={complaintsRef}>
          <button 
            onClick={() => {
              setShowComplaintNotifications(!showComplaintNotifications);
              setShowNotifications(false);
              if (!showComplaintNotifications) markComplaintsAsSeen();
            }} 
            className={`header-icon-btn ${showComplaintNotifications ? 'active-bell' : ''} ${complaintUnreadCount > 0 ? 'complaints-bell-blinking' : ''}`}
            title="Complaints Alerts"
            style={{ 
              border: complaintUnreadCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : undefined
            }}
          >
            <ShieldAlert size={18} />
            {complaintUnreadCount > 0 && (
              <span className="notification-badge-pulse" style={{ backgroundColor: '#EF4444' }}>
                {complaintUnreadCount > 99 ? '99+' : complaintUnreadCount}
              </span>
            )}
          </button>

          {/* Complaints Notifications Panel */}
          {showComplaintNotifications && (
            <div className="notification-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: '#EF4444' }}>
                  Complaints Alerts
                </h4>
                <button 
                  onClick={fetchNotifications}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: '#EF4444', 
                    fontSize: '0.75rem', 
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Refresh
                </button>
              </div>
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-color)', margin: '4px 0' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {complaintNotifications.length === 0 ? (
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
                    <ShieldAlert size={24} style={{ opacity: 0.3, color: '#EF4444' }} />
                    <span>No complaint alerts</span>
                  </div>
                ) : (
                  complaintNotifications.map((notif) => (
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
                            backgroundColor: '#EF4444',
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

        {/* Notifications Popover */}
        <div style={{ position: 'relative' }} ref={notificationsRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowComplaintNotifications(false);
              if (!showNotifications) markRegularAsSeen();
            }} 
            className={`header-icon-btn ${showNotifications ? 'active-bell' : ''}`}
            title="General Notifications"
          >
            <Bell size={18} />
            {regularUnreadCount > 0 && (
              <span className="notification-badge-pulse">
                {regularUnreadCount > 99 ? '99+' : regularUnreadCount}
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
                {regularNotifications.length === 0 ? (
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
                  regularNotifications.map((notif) => (
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
                <Home size={16} />

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
