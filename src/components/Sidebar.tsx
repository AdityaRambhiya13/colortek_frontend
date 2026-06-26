import React, { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Menu, 
  LogOut, 
  Lightbulb, 
  FileText, 
  ShieldAlert, 
  Factory, 
  Beaker,
  Layers,
  Settings,
  Database
} from 'lucide-react';
// Note: We'll map appropriate Lucide icons for high visual fidelity

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  miniMode: boolean;
  onToggleMiniMode: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onChangeView,
  miniMode,
  onToggleMiniMode,
  onLogout,
}) => {
  // Read user roles from session
  const roleString = sessionStorage.getItem('user_roles') || '';
  const roles = roleString.split(',');

  // Keep track of folder expansion states
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    lab: false,
    rd: false,
    complaints: false,
    qc: false,
    production: false,
    admin: false,
  });

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folder]: !prev[folder]
    }));
  };

  // Helper to determine if a view is active
  const isActive = (viewName: string) => currentView === viewName;

  // Render a single navigation link item
  const renderLink = (viewName: string, label: string, icon: React.ReactNode, indent = false) => {
    const active = isActive(viewName);
    return (
      <div
        key={viewName}
        onClick={() => onChangeView(viewName)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: miniMode ? '14px' : '10px 16px',
          margin: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          backgroundColor: active ? 'var(--bg-sidebar-active)' : 'transparent',
          color: active ? '#818cf8' : '#cbd5e1',
          borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
          paddingLeft: indent && !miniMode ? '32px' : undefined,
          transition: 'all var(--transition-fast)',
        }}
        className="sidebar-item"
        title={miniMode ? label : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        {!miniMode && (
          <span style={{ fontSize: '0.875rem', fontWeight: active ? 600 : 400 }}>
            {label}
          </span>
        )}
      </div>
    );
  };

  // Render a collapsible folder item
  const renderFolder = (folderKey: string, label: string, icon: React.ReactNode, children: React.ReactNode) => {
    const isExpanded = expandedFolders[folderKey];
    
    if (miniMode) {
      return (
        <div key={folderKey} style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            onClick={onToggleMiniMode}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '14px',
              margin: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              color: '#cbd5e1',
            }}
            title={label}
          >
            {icon}
          </div>
        </div>
      );
    }

    return (
      <div key={folderKey} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => toggleFolder(folderKey)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            margin: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: '#cbd5e1',
            transition: 'background-color var(--transition-fast)',
          }}
          className="sidebar-item"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon}
            <span style={{ fontSize: '0.875rem' }}>{label}</span>
          </div>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        {isExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={`sidebar-panel ${miniMode ? 'mini' : ''}`}>
      {/* Sidebar Header Logo */}
      <div style={{
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyItems: 'center',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        gap: '12px'
      }}>
        <button 
          onClick={onToggleMiniMode}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Menu size={20} />
        </button>
        {!miniMode && (
          <span style={{
            fontWeight: 700,
            fontSize: '1.15rem',
            background: 'linear-gradient(to right, #818cf8, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.05em'
          }}>
            COLORTEK CMS
          </span>
        )}
      </div>

      {/* Navigation Groups Container */}
      <div style={{ flexGrow: 1, padding: '16px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Welcome Dashboard Link */}
        {renderLink('welcome', 'Dashboard', <Layers size={18} />)}

        {/* CMS / LAB Role */}
        {(roles.includes('cms') || roles.includes('all')) && renderFolder(
          'lab',
          'Laboratory (CMS)',
          <Beaker size={18} />,
          <>
            {renderLink('lab_formulations', 'Lab Formulations', <Beaker size={14} />, true)}
            {renderLink('past_lab_formulations', 'Past Lab Formulations', <FileText size={14} />, true)}
            {renderLink('rm_testing', 'RM Testing', <Beaker size={14} />, true)}
            {renderLink('past_rm_testing', 'Past RM Testing', <FileText size={14} />, true)}
          </>
        )}

        {/* Master Formulations (MF Role) */}
        {(roles.includes('mf') || roles.includes('all')) && 
          renderLink('master_formulation', 'Master Formulation', <FileText size={18} />)
        }

        {/* R&D Section (RD Role) */}
        {(roles.includes('rd') || roles.includes('all')) && renderFolder(
          'rd',
          'Research & Dev',
          <Lightbulb size={18} />,
          <>
            {renderLink('rd', 'R&D Entry', <Lightbulb size={14} />, true)}
            {renderLink('past_rd_entries', 'Past R&D Entries', <FileText size={14} />, true)}
          </>
        )}

        {/* Complaints Role */}
        {(roles.includes('complaints') || roles.includes('lab') || roles.includes('all')) && renderFolder(
          'complaints',
          'Complaints Dept',
          <ShieldAlert size={18} />,
          <>
            {roles.includes('complaints') && renderLink('complaints', 'Registration', <ShieldAlert size={14} />, true)}
            {roles.includes('lab') && (
              <>
                {renderLink('complaints_lab', 'Lab Complaints', <Beaker size={14} />, true)}
                {renderLink('repaired_formulations', 'Repaired Formulas', <FileText size={14} />, true)}
              </>
            )}
          </>
        )}

        {/* Quality Control (QC Role) */}
        {(roles.includes('qc') || roles.includes('all')) && renderFolder(
          'qc',
          'Quality Control (QC)',
          <Beaker size={18} />,
          <>
            {renderLink('lab_report', 'QC Lab Report', <Beaker size={14} />, true)}
            {renderLink('live_qc_approval', 'Live QC Approval', <Layers size={14} />, true)}
            {renderLink('production_batches_entry', 'Production Batches', <Factory size={14} />, true)}
            {renderLink('past_production_batches', 'Past Production Batches', <FileText size={14} />, true)}
            {renderLink('raw_material_entry', 'Raw Material Entry', <Beaker size={14} />, true)}
            {renderLink('past_rm_entries', 'Past RM Entries', <FileText size={14} />, true)}
            {renderLink('w-56_rnd_batches_entry', 'W-56 RND Batches', <Beaker size={14} />, true)}
            {renderLink('past_w-56_rnd_batches', 'Past W-56 RND', <FileText size={14} />, true)}
            {renderLink('production_batches_filter', 'Production Filter', <Factory size={14} />, true)}
            {renderLink('past_batches_filter', 'Past Filter Logs', <FileText size={14} />, true)}
            {renderLink('lab_return_batches_entry', 'Lab Return Batches', <Beaker size={14} />, true)}
            {renderLink('past_lab_return_batches', 'Past Lab Returns', <FileText size={14} />, true)}
          </>
        )}

        {/* Production Role */}
        {(roles.includes('production') || roles.includes('all')) && renderFolder(
          'production',
          'Production Dept',
          <Factory size={18} />,
          <>
            {renderLink('mf_production', 'Production Formulations', <FileText size={14} />, true)}
            {renderLink('formulation_sheet', 'Perfect Batch Sheet', <FileText size={14} />, true)}
            {renderLink('dispatch_register', 'Dispatch Register', <Factory size={14} />, true)}
            {renderLink('dispatch_history', 'Dispatch History', <FileText size={14} />, true)}
            {renderLink('inward_register', 'Inward Register', <Factory size={14} />, true)}
            {renderLink('warehouse_dept', 'FG Storage', <Layers size={14} />, true)}
            {renderLink('daily_production', 'Daily Production', <Factory size={14} />, true)}
            {renderLink('daily_production_history', 'DP History logs', <FileText size={14} />, true)}
            {renderLink('rejected_material_record', 'Rejected Material', <ShieldAlert size={14} />, true)}
            {renderLink('material_requistion_form', 'Material Requisition', <FileText size={14} />, true)}
            {renderLink('live_production', 'Live Production', <Layers size={14} />, true)}
            {renderLink('live_prod_view', 'Live Monitor View', <Layers size={14} />, true)}
            {renderLink('rm_stock', 'Raw Material Stock', <Layers size={14} />, true)}
          </>
        )}

        {/* System Administration Role */}
        {(roles.includes('admin') || roles.includes('all')) && renderFolder(
          'admin',
          'System Administration',
          <Settings size={18} />,
          <>
            {renderLink('user_management', 'User Management', <ChevronRight size={14} />, true)}
            {renderLink('database_management', 'Database Manager', <Database size={14} />, true)}
            {renderLink('products_master', 'Products Master', <Layers size={14} />, true)}
          </>
        )}
      </div>

      {/* Footer Sign Out Action */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <div
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: miniMode ? '14px' : '10px 16px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            transition: 'background-color var(--transition-fast)',
            justifyContent: miniMode ? 'center' : 'flex-start'
          }}
          className="sidebar-logout"
          title={miniMode ? 'Sign Out' : undefined}
        >
          <LogOut size={18} />
          {!miniMode && <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Sign Out</span>}
        </div>
      </div>
    </aside>
  );
};
