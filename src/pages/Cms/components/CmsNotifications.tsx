import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { NotificationsAPI } from '../../../services/api';

export const CmsNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef<HTMLDivElement>(null);

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

  const fetchNotifications = async () => {
    const [success, data] = await NotificationsAPI.getNotifications();
    if (success && Array.isArray(data)) {
      setNotifications(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unseen = data.filter((notif: any) => !notif.seen).length;
      setUnreadCount(unseen);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const markAllAsSeen = async () => {
    const unseenIds = notifications
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((n: any) => !n.seen)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((n: any) => n.id);

    if (unseenIds.length > 0) {
      const [success] = await NotificationsAPI.markNotificationsSeen(unseenIds);
      if (success) {
        setNotifications(prev =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          prev.map((n: any) => ({ ...n, seen: true }))
        );
        setUnreadCount(0);
      }
    }
  };

  return (
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
        <div className="notification-panel" style={{ top: '45px', right: '0', zIndex: 99999 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', margin: 0, color: '#1e293b' }}>
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
                <Bell size={24} style={{ opacity: 0.3, color: '#64748b' }} />
                <span style={{ color: '#64748b' }}>No alerts at this time</span>
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
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
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
                  <p style={{ fontSize: '0.75rem', color: '#475569', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                    {notif.message}
                  </p>
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8', alignSelf: 'flex-end', marginTop: '2px' }}>
                    {new Date(notif.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
