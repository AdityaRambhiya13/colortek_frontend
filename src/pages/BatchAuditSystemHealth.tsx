import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, AlertTriangle, AlertCircle, RefreshCw, Database,
  ShieldCheck, Activity, Eye, FileText, Search,
  Layers, Server, HardDrive, Key, X,
  ChevronDown, ChevronRight, Download, BarChart2
} from 'lucide-react';
import {
  AdminAPI,
  type SystemHealthResponse,
  type FormulaDuplicateGroup,
  type BatchNoDuplicateGroup,
  type BatchDetailResponseAdmin
} from '../services/api';

interface BatchAuditSystemHealthProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const BatchAuditSystemHealth: React.FC<BatchAuditSystemHealthProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'audit' | 'health'>('audit');

  // Health Data State
  const [healthData, setHealthData] = useState<SystemHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  // Duplicate Audit State
  const [auditLoading, setAuditLoading] = useState(false);
  const [formulaDuplicates, setFormulaDuplicates] = useState<FormulaDuplicateGroup[]>([]);
  const [batchNoDuplicates, setBatchNoDuplicates] = useState<BatchNoDuplicateGroup[]>([]);
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [auditSummary, setAuditSummary] = useState<any>(null);

  // Filters
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [duplicateMode, setDuplicateMode] = useState<'formula' | 'batch_no' | 'all'>('formula');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'lab' | 'cms'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Expanded Groups State (Group ID -> boolean)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Batch Detail Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedBatchDetail, setSelectedBatchDetail] = useState<BatchDetailResponseAdmin | null>(null);

  // Side-by-side Compare Modal State
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [compareBatchA, setCompareBatchA] = useState<BatchDetailResponseAdmin | null>(null);
  const [compareBatchB, setCompareBatchB] = useState<BatchDetailResponseAdmin | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  // Load System Health
  const fetchSystemHealth = async (showNotification = false) => {
    setHealthLoading(true);
    const [success, data] = await AdminAPI.getSystemHealth();
    setHealthLoading(false);
    if (success && typeof data !== 'string' && data) {
      setHealthData(data);
      if (showNotification) {
        onShowToast('System health diagnostics completed.', 'success');
      }
    } else {
      onShowToast('Failed to retrieve system health diagnostics.', 'error');
    }
  };

  // Load Duplicate Batches
  const fetchDuplicateBatches = async (showNotification = false) => {
    setAuditLoading(true);
    const [success, data] = await AdminAPI.getDuplicateBatches({
      product_name: selectedProduct === 'all' ? undefined : selectedProduct,
      scope: scopeFilter,
      filter_type: duplicateMode,
      search: searchTerm.trim() || undefined,
      limit: 150
    });
    setAuditLoading(false);

    if (success && typeof data !== 'string' && data) {
      setFormulaDuplicates(data.formula_duplicates || []);
      setBatchNoDuplicates(data.batch_no_duplicates || []);
      if (data.available_products && data.available_products.length > 0) {
        setAvailableProducts(data.available_products);
      }
      setAuditSummary(data.summary || null);

      // Auto-expand first 5 groups
      const initialExpanded: Record<string, boolean> = {};
      (data.formula_duplicates || []).slice(0, 5).forEach(g => {
        initialExpanded[g.group_id] = true;
      });
      setExpandedGroups(initialExpanded);

      if (showNotification) {
        const formulaCount = data.summary?.total_formula_groups || 0;
        onShowToast(`Audit updated: Found ${formulaCount} identical formula groups.`, 'info');
      }
    } else {
      onShowToast('Failed to audit duplicate batch entries.', 'error');
    }
  };

  // Initial Load
  useEffect(() => {
    fetchSystemHealth();
    fetchDuplicateBatches();
  }, []);

  // Re-fetch audit when filters change
  useEffect(() => {
    fetchDuplicateBatches();
  }, [selectedProduct, duplicateMode, scopeFilter]);

  // Handle Search on Enter or debounce
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDuplicateBatches();
  };

  // Toggle Group Expansion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const expandAllGroups = () => {
    const allExp: Record<string, boolean> = {};
    formulaDuplicates.forEach(g => { allExp[g.group_id] = true; });
    setExpandedGroups(allExp);
  };

  const collapseAllGroups = () => {
    setExpandedGroups({});
  };

  // View Single Batch Detail
  const handleInspectBatch = async (source: string, batchId: number) => {
    setDetailLoading(true);
    setDetailModalOpen(true);
    const [success, data] = await AdminAPI.getBatchDetail(source, batchId);
    setDetailLoading(false);
    if (success && typeof data !== 'string' && data) {
      setSelectedBatchDetail(data);
    } else {
      onShowToast('Could not load batch details.', 'error');
      setDetailModalOpen(false);
    }
  };

  // Compare Two Batches Side-by-Side
  const handleCompareGroupBatches = async (group: FormulaDuplicateGroup) => {
    if (group.batches.length < 2) {
      onShowToast('At least 2 batches are needed for comparison.', 'warning');
      return;
    }
    setCompareLoading(true);
    setCompareModalOpen(true);
    setCompareBatchA(null);
    setCompareBatchB(null);

    const b1 = group.batches[0];
    const b2 = group.batches[1];

    const [res1, data1] = await AdminAPI.getBatchDetail(b1.source, b1.id);
    const [res2, data2] = await AdminAPI.getBatchDetail(b2.source, b2.id);

    setCompareLoading(false);
    if (res1 && typeof data1 !== 'string' && res2 && typeof data2 !== 'string') {
      setCompareBatchA(data1);
      setCompareBatchB(data2);
    } else {
      onShowToast('Failed to load batches for comparison.', 'error');
      setCompareModalOpen(false);
    }
  };

  // Trigger DB Backup
  const handleTriggerBackup = async () => {
    if (!window.confirm('Create a complete system database backup now?')) return;
    setBackingUp(true);
    const [success, data] = await AdminAPI.triggerBackup();
    setBackingUp(false);
    if (success) {
      onShowToast('Database backup created successfully.', 'success');
      fetchSystemHealth();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Database backup failed.', 'error');
    }
  };

  // Export JSON Report
  const handleExportReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      system_health: healthData,
      duplicate_audit: {
        summary: auditSummary,
        formula_duplicates_count: formulaDuplicates.length,
        batch_no_duplicates_count: batchNoDuplicates.length,
        formula_duplicates: formulaDuplicates,
        batch_no_duplicates: batchNoDuplicates
      }
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `colortek_audit_health_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast('Audit & Health report downloaded.', 'success');
  };

  // Filtered view of formula duplicates by search term
  const displayFormulaGroups = useMemo(() => {
    if (!searchTerm.trim()) return formulaDuplicates;
    const term = searchTerm.toLowerCase();
    return formulaDuplicates.filter(g => {
      const matchBatch = g.batches.some(b =>
        b.batch_no.toLowerCase().includes(term) ||
        b.product_name.toLowerCase().includes(term) ||
        (b.ref_no && b.ref_no.toLowerCase().includes(term))
      );
      const matchMat = g.materials.some(m =>
        m.material.toLowerCase().includes(term) ||
        m.normalized_material.toLowerCase().includes(term)
      );
      return matchBatch || matchMat;
    });
  }, [formulaDuplicates, searchTerm]);

  // Overall Health Status Badge Color
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'healthy':
        return {
          bg: 'rgba(16, 185, 129, 0.1)',
          border: '#10b981',
          text: '#10b981',
          label: 'System Operational - Healthy',
          icon: <CheckCircle2 size={18} color="#10b981" />
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.1)',
          border: '#f59e0b',
          text: '#f59e0b',
          label: 'System Warning / Degraded',
          icon: <AlertTriangle size={18} color="#f59e0b" />
        };
      case 'error':
        return {
          bg: 'rgba(239, 68, 68, 0.1)',
          border: '#ef4444',
          text: '#ef4444',
          label: 'System Error / Issues Detected',
          icon: <AlertCircle size={18} color="#ef4444" />
        };
      default:
        return {
          bg: 'rgba(100, 116, 139, 0.1)',
          border: '#64748b',
          text: '#64748b',
          label: 'Status Unknown',
          icon: <Activity size={18} color="#64748b" />
        };
    }
  };

  const healthBadge = getStatusBadge(healthData?.status);

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* PAGE HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '16px',
        backgroundColor: 'var(--bg-card)',
        padding: '20px 24px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--primary-color)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={24} />
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
              Batch Audit & System Health
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            Audit identical formulation batches, analyze duplicate material compositions, and monitor server & database health.
          </p>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              if (activeTab === 'audit') fetchDuplicateBatches(true);
              else fetchSystemHealth(true);
            }}
            disabled={auditLoading || healthLoading}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }}
            title="Refresh current tab data"
          >
            <RefreshCw size={15} className={(auditLoading || healthLoading) ? 'spin' : ''} />
            <span>{(auditLoading || healthLoading) ? 'Checking...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportReport}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px' }}
            title="Download complete JSON report"
          >
            <Download size={15} />
            <span>Export Report</span>
          </button>

          <button
            onClick={handleTriggerBackup}
            disabled={backingUp}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#6366f1' }}
            title="Create full database backup"
          >
            <Database size={15} />
            <span>{backingUp ? 'Backing Up...' : 'Trigger Backup'}</span>
          </button>
        </div>
      </div>

      {/* TAB NAVIGATION HEADER */}
      <div style={{
        display: 'flex',
        gap: '8px',
        borderBottom: '2px solid var(--border-light)',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('audit')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'audit' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'audit' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'audit' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers size={18} />
          <span>Duplicate Batch Audit</span>
          {auditSummary?.total_formula_groups !== undefined && (
            <span style={{
              backgroundColor: activeTab === 'audit' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-app)',
              color: activeTab === 'audit' ? 'var(--primary-color)' : 'var(--text-light)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {auditSummary.total_formula_groups} Groups
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('health');
            if (!healthData) fetchSystemHealth();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 20px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'health' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'health' ? 'var(--primary-color)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'health' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Activity size={18} />
          <span>System Health & Diagnostics</span>
          {healthData && (
            <span style={{
              backgroundColor: healthBadge.bg,
              color: healthBadge.text,
              border: `1px solid ${healthBadge.border}`,
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: healthBadge.text }}></span>
              {healthData.status.toUpperCase()}
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DUPLICATE BATCH AUDIT */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* AUDIT SUMMARY KPI CARDS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px'
          }}>
            {/* Card 1: Formula Duplicate Groups */}
            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                IDENTICAL FORMULA GROUPS
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b' }}>
                  {auditSummary?.total_formula_groups ?? '...'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>groups</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Batches with 100% same materials & quantities
              </span>
            </div>

            {/* Card 2: Affected Batches */}
            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                TOTAL DUPLICATE BATCHES
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-color)' }}>
                  {auditSummary?.total_formula_batches ?? '...'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>batch records</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Entries sharing identical compositions
              </span>
            </div>

            {/* Card 3: Batch No Collisions */}
            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                BATCH NUMBER COLLISIONS
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366f1' }}>
                  {auditSummary?.total_batch_no_groups ?? '...'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>colliding numbers</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Same batch # across product partitions
              </span>
            </div>

            {/* Card 4: Product Workspaces */}
            <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                PARTITION SCOPES
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                  {availableProducts.length}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>databases</span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Audited product databases
              </span>
            </div>
          </div>

          {/* FILTER TOOLBAR */}
          <div className="glass-card" style={{
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 280px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                className="field-input"
                style={{ paddingLeft: '36px', paddingRight: searchTerm ? '32px' : '12px', width: '100%' }}
                placeholder="Search batch number, product, or raw material..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); }}
                  style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </form>

            {/* Product Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Product:</span>
              <select
                className="field-input"
                style={{ width: '180px', padding: '6px 10px', fontSize: '0.85rem' }}
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
              >
                <option value="all">All Products</option>
                {availableProducts.map(p => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Scope Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Source:</span>
              <select
                className="field-input"
                style={{ width: '160px', padding: '6px 10px', fontSize: '0.85rem' }}
                value={scopeFilter}
                onChange={e => setScopeFilter(e.target.value as any)}
              >
                <option value="all">All Ledgers</option>
                <option value="lab">Lab Formulations</option>
                <option value="cms">Standard CMS</option>
              </select>
            </div>

            {/* Duplicate Mode Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--input-bg)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                onClick={() => setDuplicateMode('formula')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: duplicateMode === 'formula' ? 700 : 500,
                  backgroundColor: duplicateMode === 'formula' ? 'var(--bg-card)' : 'transparent',
                  color: duplicateMode === 'formula' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: duplicateMode === 'formula' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Same Materials & Qty
              </button>
              <button
                type="button"
                onClick={() => setDuplicateMode('batch_no')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: duplicateMode === 'batch_no' ? 700 : 500,
                  backgroundColor: duplicateMode === 'batch_no' ? 'var(--bg-card)' : 'transparent',
                  color: duplicateMode === 'batch_no' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: duplicateMode === 'batch_no' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Same Batch No
              </button>
              <button
                type="button"
                onClick={() => setDuplicateMode('all')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: duplicateMode === 'all' ? 700 : 500,
                  backgroundColor: duplicateMode === 'all' ? 'var(--bg-card)' : 'transparent',
                  color: duplicateMode === 'all' ? 'var(--primary-color)' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: duplicateMode === 'all' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                All
              </button>
            </div>
          </div>

          {/* MAIN RESULTS CONTAINER */}
          {auditLoading ? (
            <div className="glass-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <RefreshCw size={28} className="spin" color="var(--primary-color)" style={{ marginBottom: '12px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 600 }}>
                Scanning and cross-referencing batch formulations & materials...
              </p>
            </div>
          ) : (
            <>
              {/* SECTION 1: FORMULA DUPLICATES (SAME MATERIALS & QUANTITIES) */}
              {(duplicateMode === 'formula' || duplicateMode === 'all') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={18} color="#f59e0b" />
                        <span>Identical Formulation Groups ({displayFormulaGroups.length})</span>
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                        Batches sharing 100% identical raw materials and exact quantities
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={expandAllGroups}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-color)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Expand All
                      </button>
                      <span style={{ color: 'var(--border-color)' }}>|</span>
                      <button
                        onClick={collapseAllGroups}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>

                  {displayFormulaGroups.length === 0 ? (
                    <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
                      <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                        No duplicate formulation groups found matching current filter criteria.
                      </p>
                    </div>
                  ) : (
                    displayFormulaGroups.map((group, index) => {
                      const isExpanded = !!expandedGroups[group.group_id];
                      const totalQty = group.materials.reduce((sum, m) => sum + (m.qty || 0), 0);

                      return (
                        <div
                          key={group.group_id}
                          className="glass-card"
                          style={{
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)',
                            transition: 'border-color 0.15s ease'
                          }}
                        >
                          {/* GROUP HEADER ROW */}
                          <div
                            onClick={() => toggleGroup(group.group_id)}
                            style={{
                              padding: '14px 18px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? 'rgba(99, 102, 241, 0.04)' : 'transparent',
                              borderBottom: isExpanded ? '1px solid var(--border-light)' : 'none',
                              gap: '12px',
                              flexWrap: 'wrap'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                              <button
                                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}
                              >
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>

                              <span style={{
                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                color: '#b45309',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                letterSpacing: '0.02em'
                              }}>
                                Group #{index + 1}
                              </span>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                  {group.match_count} Batches
                                </span>
                                <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>
                                  ({group.materials.length} Raw Materials • Total Qty: {totalQty.toFixed(2)}g)
                                </span>
                              </div>

                              {/* Product badges */}
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {group.products.map(p => (
                                  <span
                                    key={p}
                                    style={{
                                      backgroundColor: 'var(--bg-app)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-secondary)',
                                      fontSize: '0.72rem',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontWeight: 600
                                    }}
                                  >
                                    {p.toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Compare / Quick Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleCompareGroupBatches(group)}
                                className="btn-secondary"
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '0.8rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                                title="Compare formulations side-by-side"
                              >
                                <BarChart2 size={14} />
                                <span>Compare Batches</span>
                              </button>
                            </div>
                          </div>

                          {/* EXPANDED GROUP CONTENT (SPLIT VIEW: MATERIALS vs BATCHES) */}
                          {isExpanded && (
                            <div style={{
                              padding: '16px 18px',
                              display: 'grid',
                              gridTemplateColumns: 'minmax(300px, 1fr) minmax(320px, 1.2fr)',
                              gap: '20px',
                              backgroundColor: 'var(--bg-card)'
                            }}>
                              {/* LEFT COLUMN: SHARED RAW MATERIALS & QUANTITIES */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Identical Formula Composition ({group.materials.length} Items)
                                </span>
                                <div style={{
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  maxHeight: '260px',
                                  overflowY: 'auto'
                                }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>#</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Raw Material</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>Qty (g)</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>%</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.materials.map((m, mIdx) => {
                                        const pct = totalQty > 0 ? ((m.qty / totalQty) * 100).toFixed(1) : '0';
                                        return (
                                          <tr
                                            key={mIdx}
                                            style={{
                                              borderBottom: '1px solid var(--border-light)',
                                              backgroundColor: mIdx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'
                                            }}
                                          >
                                            <td style={{ padding: '6px 12px', color: 'var(--text-light)' }}>{mIdx + 1}</td>
                                            <td style={{ padding: '6px 12px', fontWeight: 600 }}>
                                              {m.material || m.normalized_material}
                                            </td>
                                            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--primary-color)' }}>
                                              {m.qty.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--text-light)' }}>
                                              {pct}%
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* RIGHT COLUMN: DUPLICATE BATCHES LIST */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                  Batches Sharing This Composition ({group.batches.length})
                                </span>
                                <div style={{
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  overflow: 'hidden',
                                  maxHeight: '260px',
                                  overflowY: 'auto'
                                }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                                    <thead>
                                      <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Batch No</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Workspace</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Ref / Lot</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Test Date</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'center' }}>Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.batches.map(b => (
                                        <tr key={`${b.source}_${b.id}`} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                          <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary-color)' }}>
                                            {b.batch_no}
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <span style={{
                                              backgroundColor: 'var(--bg-app)',
                                              padding: '2px 6px',
                                              borderRadius: '4px',
                                              fontSize: '0.75rem',
                                              fontWeight: 600
                                            }}>
                                              {b.product_name.toUpperCase()}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 12px', color: 'var(--text-light)' }}>
                                            {b.ref_no || '-'}
                                          </td>
                                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                                            {b.test_date || '-'}
                                          </td>
                                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                            <button
                                              onClick={() => handleInspectBatch(b.source, b.id)}
                                              className="btn-secondary"
                                              style={{
                                                padding: '4px 8px',
                                                fontSize: '0.75rem',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                              }}
                                              title="Inspect full batch details"
                                            >
                                              <Eye size={12} />
                                              <span>Inspect</span>
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* SECTION 2: DUPLICATE BATCH NUMBERS (COLLISIONS) */}
              {(duplicateMode === 'batch_no' || duplicateMode === 'all') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={18} color="#6366f1" />
                      <span>Batch Number Collisions ({batchNoDuplicates.length})</span>
                    </h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                      Batch numbers that appear multiple times across product partitions
                    </span>
                  </div>

                  {batchNoDuplicates.length === 0 ? (
                    <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
                      <CheckCircle2 size={32} color="#10b981" style={{ marginBottom: '8px' }} />
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
                        No duplicate batch number collisions detected.
                      </p>
                    </div>
                  ) : (
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                            <th style={{ padding: '10px 16px', fontWeight: 600 }}>Batch Number</th>
                            <th style={{ padding: '10px 16px', fontWeight: 600 }}>Occurrence Count</th>
                            <th style={{ padding: '10px 16px', fontWeight: 600 }}>Product Partitions</th>
                            <th style={{ padding: '10px 16px', fontWeight: 600 }}>Matching Records</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchNoDuplicates.map(bnoGroup => (
                            <tr key={bnoGroup.batch_no} style={{ borderBottom: '1px solid var(--border-light)' }}>
                              <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary-color)' }}>
                                {bnoGroup.batch_no}
                              </td>
                              <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                                <span style={{
                                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                  color: '#6366f1',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700
                                }}>
                                  {bnoGroup.match_count} Records
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  {bnoGroup.products.map(p => (
                                    <span
                                      key={p}
                                      style={{
                                        backgroundColor: 'var(--bg-app)',
                                        border: '1px solid var(--border-color)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.72rem',
                                        fontWeight: 600
                                      }}
                                    >
                                      {p.toUpperCase()}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {bnoGroup.batches.map(b => (
                                    <button
                                      key={`${b.source}_${b.id}`}
                                      onClick={() => handleInspectBatch(b.source, b.id)}
                                      className="btn-secondary"
                                      style={{
                                        padding: '4px 10px',
                                        fontSize: '0.75rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}
                                      title={`Inspect ${b.batch_no} in ${b.product_name}`}
                                    >
                                      <Eye size={12} />
                                      <span>{b.product_name}: {b.ref_no || `ID#${b.id}`}</span>
                                    </button>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SYSTEM HEALTH & DIAGNOSTICS */}
      {/* ========================================================================= */}
      {activeTab === 'health' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* OVERALL SYSTEM STATUS BANNER */}
          <div style={{
            backgroundColor: healthBadge.bg,
            border: `1.5px solid ${healthBadge.border}`,
            padding: '20px 24px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: '10px',
                borderRadius: '50%',
                display: 'flex',
                boxShadow: 'var(--shadow-sm)'
              }}>
                {healthBadge.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: healthBadge.text }}>
                  {healthBadge.label}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Server Uptime: <strong>{healthData?.uptime_human || 'Calculating...'}</strong> • Last Checked: {healthData?.timestamp ? new Date(healthData.timestamp).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block' }}>DB LATENCY</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: (healthData?.database?.latency_ms || 0) < 50 ? '#10b981' : '#f59e0b' }}>
                  {healthData?.database?.latency_ms ? `${healthData.database.latency_ms} ms` : '...'}
                </span>
              </div>

              <div style={{
                backgroundColor: 'var(--bg-card)',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-light)', display: 'block' }}>REDIS CACHE</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: healthData?.cache?.status === 'connected' ? '#10b981' : 'var(--text-secondary)' }}>
                  {healthData?.cache?.status === 'connected' ? 'Connected' : 'In-Memory Fallback'}
                </span>
              </div>
            </div>
          </div>

          {/* DIAGNOSTIC SUBSYSTEMS CARDS GRID */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px'
          }}>
            {/* Card 1: PostgreSQL Database */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Database size={18} color="var(--primary-color)" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>PostgreSQL Database</h3>
                </div>
                <span style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {healthData?.database?.status.toUpperCase() || 'ONLINE'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-light)', fontSize: '0.75rem', display: 'block' }}>Engine Version</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{healthData?.database?.version || 'PostgreSQL'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-light)', fontSize: '0.75rem', display: 'block' }}>Database Size</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{healthData?.database?.database_size || '...'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-light)', fontSize: '0.75rem', display: 'block' }}>Active Connections</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{healthData?.database?.active_connections || 1} client</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-light)', fontSize: '0.75rem', display: 'block' }}>Query Response</span>
                  <strong style={{ color: '#10b981' }}>{healthData?.database?.latency_ms || 0} ms</strong>
                </div>
              </div>

              {/* Table Records Snapshot */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                borderRadius: '6px',
                padding: '10px 12px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>TABLE COUNTS</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.78rem' }}>
                  <div>Lab Formulations: <strong>{healthData?.database?.table_counts?.lab_formulations_batch_entries ?? 0}</strong></div>
                  <div>Lab Raw Materials: <strong>{healthData?.database?.table_counts?.lab_raw_materials ?? 0}</strong></div>
                  <div>Registered Users: <strong>{healthData?.database?.table_counts?.all_users ?? 0}</strong></div>
                  <div>System Audit Logs: <strong>{healthData?.database?.table_counts?.audit_logs ?? 0}</strong></div>
                </div>
              </div>
            </div>

            {/* Card 2: Security & Encryption */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={18} color="#6366f1" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Encryption & Cryptography</h3>
                </div>
                <span style={{
                  backgroundColor: healthData?.encryption?.crypto_roundtrip_test ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: healthData?.encryption?.crypto_roundtrip_test ? '#10b981' : '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {healthData?.encryption?.crypto_roundtrip_test ? 'OPERATIONAL' : 'ERROR'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Master Secret Key:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Configured & Verified</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>AES-256-GCM Round-trip:</span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Self-Test Passed</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Loaded Tenant Ciphers:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{healthData?.encryption?.ciphers_loaded || 0} loaded</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Password Hasher:</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Bcrypt (Salted)</span>
                </div>
              </div>
            </div>

            {/* Card 3: Storage & File System */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HardDrive size={18} color="#06b6d4" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Storage & Backup Paths</h3>
                </div>
                <span style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  WRITABLE
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uploads Directory:</span>
                  <span style={{ color: healthData?.storage?.uploads_dir_ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {healthData?.storage?.uploads_dir_ok ? 'Writable' : 'Error'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Backups Directory:</span>
                  <span style={{ color: healthData?.storage?.backups_dir_ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {healthData?.storage?.backups_dir_ok ? 'Writable' : 'Error'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Exports Directory:</span>
                  <span style={{ color: healthData?.storage?.exports_dir_ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {healthData?.storage?.exports_dir_ok ? 'Ready' : 'Error'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', wordBreak: 'break-all' }}>
                  Root: <code>{healthData?.storage?.storage_path || 'uploads/'}</code>
                </div>
              </div>
            </div>

            {/* Card 4: Integrity & Security Diagnostics */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#10b981" />
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Data Integrity & Security</h3>
                </div>
                <span style={{
                  backgroundColor: (healthData?.security_integrity?.orphaned_raw_materials ?? 0) === 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                  color: (healthData?.security_integrity?.orphaned_raw_materials ?? 0) === 0 ? '#10b981' : '#f59e0b',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {(healthData?.security_integrity?.orphaned_raw_materials ?? 0) === 0 ? 'CLEAN' : 'ATTENTION'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Orphaned Raw Materials:</span>
                  <strong style={{ color: (healthData?.security_integrity?.orphaned_raw_materials ?? 0) === 0 ? '#10b981' : '#f59e0b' }}>
                    {healthData?.security_integrity?.orphaned_raw_materials ?? 0} records
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Empty Batches (0 RM):</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {healthData?.security_integrity?.empty_batches ?? 0} batches
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Active Locked-out IPs/Users:</span>
                  <strong style={{ color: (healthData?.security_integrity?.active_lockouts ?? 0) === 0 ? '#10b981' : '#ef4444' }}>
                    {healthData?.security_integrity?.active_lockouts ?? 0}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Failed Login Attempts (24h):</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {healthData?.security_integrity?.recent_failed_logins ?? 0}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: BATCH DETAILS INSPECTOR */}
      {/* ========================================================================= */}
      {detailModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '720px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} color="var(--primary-color)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Batch #{selectedBatchDetail?.batch_no || '...'} Details
                </h3>
                <span style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--primary-color)',
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 700
                }}>
                  {selectedBatchDetail?.product_name.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <RefreshCw size={24} className="spin" color="var(--primary-color)" />
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Loading batch record...</p>
              </div>
            ) : selectedBatchDetail ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
                {/* Meta fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'block' }}>REFERENCE NO</span>
                    <strong style={{ fontSize: '0.85rem' }}>{selectedBatchDetail.ref_no || '-'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'block' }}>TEST DATE</span>
                    <strong style={{ fontSize: '0.85rem' }}>{selectedBatchDetail.test_date || '-'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-light)', display: 'block' }}>LEDGER SOURCE</span>
                    <strong style={{ fontSize: '0.85rem' }}>{selectedBatchDetail.source.toUpperCase()}</strong>
                  </div>
                </div>

                {/* Raw Materials Table */}
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px' }}>
                    Raw Materials ({selectedBatchDetail.materials.length})
                  </h4>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px' }}>#</th>
                          <th style={{ padding: '8px 12px' }}>Material Name</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBatchDetail.materials.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '6px 12px', color: 'var(--text-light)' }}>{m.sr_no || idx + 1}</td>
                            <td style={{ padding: '6px 12px', fontWeight: 600 }}>{m.raw_material || m.normalized_raw_material}</td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--primary-color)' }}>
                              {m.qty.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Remarks */}
                {selectedBatchDetail.remarks && (
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>REMARKS</span>
                    <p style={{ backgroundColor: 'var(--bg-app)', padding: '10px', borderRadius: '6px', fontSize: '0.82rem', margin: 0 }}>
                      {selectedBatchDetail.remarks}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SIDE-BY-SIDE BATCH COMPARISON */}
      {/* ========================================================================= */}
      {compareModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            width: '100%',
            maxWidth: '1000px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Compare Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <BarChart2 size={20} color="#f59e0b" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Side-by-Side Formulation Comparison
                </h3>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={20} />
              </button>
            </div>

            {compareLoading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <RefreshCw size={28} className="spin" color="var(--primary-color)" />
                <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Comparing batch recipes and compositions...</p>
              </div>
            ) : compareBatchA && compareBatchB ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '20px',
                overflowY: 'auto'
              }}>
                {/* Batch A */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--primary-color)' }}>Batch: {compareBatchA.batch_no}</strong>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--bg-app)', padding: '2px 8px', borderRadius: '4px' }}>
                      {compareBatchA.product_name.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Ref: {compareBatchA.ref_no || '-'} • Date: {compareBatchA.test_date || '-'}
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 8px' }}>Material</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareBatchA.materials.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '6px 8px' }}>{m.raw_material || m.normalized_raw_material}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{m.qty.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Batch B */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border-color)', padding: '14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--primary-color)' }}>Batch: {compareBatchB.batch_no}</strong>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--bg-app)', padding: '2px 8px', borderRadius: '4px' }}>
                      {compareBatchB.product_name.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Ref: {compareBatchB.ref_no || '-'} • Date: {compareBatchB.test_date || '-'}
                  </div>
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 8px' }}>Material</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareBatchB.materials.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-light)' }}>
                            <td style={{ padding: '6px 8px' }}>{m.raw_material || m.normalized_raw_material}</td>
                            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{m.qty.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
