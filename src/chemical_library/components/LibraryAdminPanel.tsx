import React, { useState } from 'react';
import {
  ShieldCheck, Database, KeyRound, Download, Upload, RotateCcw,
  Plus, Search, Trash2, Edit3, CheckCircle2, AlertTriangle, FileText, Lock
} from 'lucide-react';
import type { ChemicalRecord } from '../types';

interface LibraryAdminPanelProps {
  records: ChemicalRecord[];
  onUpdateRecords: (records: ChemicalRecord[]) => void;
  onClose: () => void;
}

export const LibraryAdminPanel: React.FC<LibraryAdminPanelProps> = ({
  records,
  onUpdateRecords,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'records' | 'security' | 'import_export'>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Record Form
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Editing existing record in table
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ChemicalRecord>>({});

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 3500);
  };

  // Filter records for the table
  const filteredRecords = records.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.code || r.callNumber || '').toLowerCase().includes(q) ||
      (r.name || '').toLowerCase().includes(q) ||
      (r.category || '').toLowerCase().includes(q)
    );
  }).slice(0, 100); // Top 100 in admin preview for high performance

  // Add Single Record
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) {
      showNotification('Product Code is required.', 'error');
      return;
    }

    const prefix = newCode.split('-')[0] || 'MISC';
    const newRec: ChemicalRecord = {
      id: `custom_${Date.now()}`,
      callNumber: newCode.trim(),
      code: newCode.trim(),
      name: newName.trim(),
      category: newCategory.trim(),
      description: newDesc.trim(),
      drawer: 'ADMIN-DRAWER',
      prefix,
      num: '9999',
    };

    const next = [newRec, ...records];
    onUpdateRecords(next);
    setNewCode('');
    setNewName('');
    setNewCategory('');
    setNewDesc('');
    setShowAddForm(false);
    showNotification(`Record ${newRec.code} successfully created!`);
  };

  // Save Inline Edit
  const handleSaveInlineEdit = (id: string) => {
    const next = records.map(r => r.id === id ? { ...r, ...editFormData } : r);
    onUpdateRecords(next);
    setEditingRecordId(null);
    setEditFormData({});
    showNotification('Record updated successfully.');
  };

  // Delete Record
  const handleDeleteRecord = (id: string, code: string) => {
    if (confirm(`Are you sure you want to delete ${code}?`)) {
      const next = records.filter(r => r.id !== id);
      onUpdateRecords(next);
      showNotification(`Record ${code} deleted.`);
    }
  };

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `chemical_archive_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showNotification(`Exported ${records.length} records to JSON.`);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["Product Code", "Name", "Category", "Description", "Prefix"];
    const rows = records.map(r => [
      `"${r.code || r.callNumber}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      `"${r.prefix}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `chemical_archive_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showNotification(`Exported ${records.length} records to CSV.`);
  };

  // Import JSON File
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onUpdateRecords(parsed);
          showNotification(`Successfully imported ${parsed.length} records!`);
        } else {
          showNotification('Invalid JSON format. Expected an array of chemical records.', 'error');
        }
      } catch {
        showNotification('Error parsing JSON file.', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Reset to Baseline
  const handleResetBaseline = () => {
    if (confirm("WARNING: This will reset all records to the baseline product code catalog. Proceed?")) {
      localStorage.removeItem('chemical_archive_records_v1');
      window.location.reload();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(56, 47, 21, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div
        style={{
          width: '1200px',
          maxWidth: '96vw',
          height: '90vh',
          background: '#FDF7E3',
          border: '2px solid #574A24',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
          borderRadius: '4px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 28px',
            background: '#F6E2A3',
            borderBottom: '1.5px solid #574A24',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                background: '#574A24',
                color: '#FAE8B4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '2px',
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 800,
                  color: '#574A24',
                  letterSpacing: '1px',
                  margin: 0,
                }}
              >
                CHEMICAL ARCHIVE ADMIN PANEL
              </h2>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#80775C' }}>
                ADMINISTRATIVE CONTROL & DATABASE MANAGEMENT
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={onClose}
              style={{
                background: '#574A24',
                color: '#FAE8B4',
                border: 'none',
                padding: '8px 20px',
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '2px',
              }}
            >
              RETURN TO CATALOG ?
            </button>
          </div>
        </div>

        {/* Status notification */}
        {statusMsg && (
          <div
            style={{
              padding: '10px 24px',
              background: statusMsg.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: statusMsg.type === 'success' ? '#166534' : '#991b1b',
              borderBottom: `1px solid ${statusMsg.type === 'success' ? '#bbf7d0' : '#f87171'}`,
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #CBBD93', background: '#E8D399' }}>
          <button
            onClick={() => setActiveTab('records')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: activeTab === 'records' ? '#FDF7E3' : 'transparent',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              color: '#574A24',
              cursor: 'pointer',
              borderBottom: activeTab === 'records' ? '2px solid #574A24' : 'none',
            }}
          >
            DATABASE RECORDS ({records.length})
          </button>
          <button
            onClick={() => setActiveTab('import_export')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: activeTab === 'import_export' ? '#FDF7E3' : 'transparent',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              color: '#574A24',
              cursor: 'pointer',
              borderBottom: activeTab === 'import_export' ? '2px solid #574A24' : 'none',
            }}
          >
            IMPORT / EXPORT / BACKUP
          </button>
          <button
            onClick={() => setActiveTab('security')}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: activeTab === 'security' ? '#FDF7E3' : 'transparent',
              fontFamily: 'var(--font-display)',
              fontSize: '12px',
              fontWeight: 700,
              color: '#574A24',
              cursor: 'pointer',
              borderBottom: activeTab === 'security' ? '2px solid #574A24' : 'none',
            }}
          >
            SECURITY & 2FA POLICIES
          </button>
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'records' && (
            <div>
              {/* Controls bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '16px' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '450px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#80775C' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search records in admin table..."
                    style={{
                      width: '100%',
                      height: '38px',
                      paddingLeft: '36px',
                      paddingRight: '12px',
                      background: '#F6E2A3',
                      border: '1px solid #CBBD93',
                      fontFamily: 'var(--font-sans)',
                      fontSize: '13px',
                      color: '#574A24',
                      borderRadius: '2px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  style={{
                    background: '#574A24',
                    color: '#FAE8B4',
                    border: 'none',
                    padding: '9px 18px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '2px',
                  }}
                >
                  <Plus size={15} /> {showAddForm ? 'CANCEL' : 'ADD NEW RECORD'}
                </button>
              </div>

              {/* Add New Record Inline Form */}
              {showAddForm && (
                <form
                  onSubmit={handleAddRecord}
                  style={{
                    background: '#F6E2A3',
                    border: '1.5px solid #574A24',
                    padding: '20px',
                    borderRadius: '2px',
                    marginBottom: '24px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C' }}>Product Code</label>
                    <input
                      type="text"
                      placeholder="e.g. MISC-081, D-501"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      required
                      style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#FDF7E3', border: '1px solid #CBBD93', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C' }}>Product Name</label>
                    <input
                      type="text"
                      placeholder="Product title"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#FDF7E3', border: '1px solid #CBBD93', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C' }}>Category</label>
                    <input
                      type="text"
                      placeholder="Category"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#FDF7E3', border: '1px solid #CBBD93', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="submit"
                      style={{
                        width: '100%',
                        height: '35px',
                        background: '#574A24',
                        color: '#FAE8B4',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderRadius: '2px',
                      }}
                    >
                      SAVE RECORD
                    </button>
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <label style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#80775C' }}>Description</label>
                    <textarea
                      rows={2}
                      placeholder="Product specification details..."
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px', background: '#FDF7E3', border: '1px solid #CBBD93', boxSizing: 'border-box' }}
                    />
                  </div>
                </form>
              )}

              {/* Records Table */}
              <div style={{ border: '1px solid #CBBD93', borderRadius: '2px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#E8D399', borderBottom: '1px solid #CBBD93' }}>
                      <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#574A24' }}>CODE</th>
                      <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#574A24' }}>NAME</th>
                      <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#574A24' }}>CATEGORY</th>
                      <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#574A24' }}>DESCRIPTION</th>
                      <th style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#574A24', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #CBBD93', background: editingRecordId === item.id ? '#F6E2A3' : 'transparent' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#574A24' }}>
                          {editingRecordId === item.id ? (
                            <input
                              type="text"
                              value={editFormData.code ?? item.code ?? item.callNumber}
                              onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value, callNumber: e.target.value })}
                              style={{ width: '90px', padding: '4px', background: '#FFF' }}
                            />
                          ) : (
                            item.code || item.callNumber
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#574A24' }}>
                          {editingRecordId === item.id ? (
                            <input
                              type="text"
                              value={editFormData.name ?? item.name}
                              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                              style={{ width: '100%', padding: '4px', background: '#FFF' }}
                            />
                          ) : (
                            item.name || '?'
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#80775C' }}>
                          {editingRecordId === item.id ? (
                            <input
                              type="text"
                              value={editFormData.category ?? item.category}
                              onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                              style={{ width: '100%', padding: '4px', background: '#FFF' }}
                            />
                          ) : (
                            item.category || '?'
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#80775C', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {editingRecordId === item.id ? (
                            <input
                              type="text"
                              value={editFormData.description ?? item.description}
                              onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                              style={{ width: '100%', padding: '4px', background: '#FFF' }}
                            />
                          ) : (
                            item.description || '?'
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          {editingRecordId === item.id ? (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                onClick={() => handleSaveInlineEdit(item.id)}
                                style={{ background: '#166534', color: '#FFF', border: 'none', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', borderRadius: '2px' }}
                              >
                                SAVE
                              </button>
                              <button
                                onClick={() => { setEditingRecordId(null); setEditFormData({}); }}
                                style={{ background: '#80775C', color: '#FFF', border: 'none', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', borderRadius: '2px' }}
                              >
                                CANCEL
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                onClick={() => { setEditingRecordId(item.id); setEditFormData(item); }}
                                style={{ background: 'none', border: '1px solid #CBBD93', padding: '4px 8px', color: '#574A24', cursor: 'pointer', borderRadius: '2px' }}
                                title="Edit Record"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(item.id, item.code || item.callNumber)}
                                style={{ background: 'none', border: '1px solid #f87171', padding: '4px 8px', color: '#991b1b', cursor: 'pointer', borderRadius: '2px' }}
                                title="Delete Record"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'import_export' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={{ background: '#F6E2A3', border: '1px solid #CBBD93', padding: '24px', borderRadius: '2px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#574A24', marginTop: 0 }}>
                  EXPORT & ARCHIVE BACKUP
                </h3>
                <p style={{ fontSize: '13px', color: '#80775C', lineHeight: '1.5' }}>
                  Download the current state of the chemical library (all 3,381+ product codes and custom entered specifications) in standard portable formats.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button
                    onClick={handleExportJSON}
                    style={{
                      background: '#574A24',
                      color: '#FAE8B4',
                      border: 'none',
                      padding: '10px 18px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '2px',
                    }}
                  >
                    <Download size={14} /> EXPORT FULL JSON
                  </button>
                  <button
                    onClick={handleExportCSV}
                    style={{
                      background: '#574A24',
                      color: '#FAE8B4',
                      border: 'none',
                      padding: '10px 18px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '2px',
                    }}
                  >
                    <FileText size={14} /> EXPORT CSV SPREADSHEET
                  </button>
                </div>
              </div>

              <div style={{ background: '#F6E2A3', border: '1px solid #CBBD93', padding: '24px', borderRadius: '2px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#574A24', marginTop: 0 }}>
                  IMPORT & RESTORE
                </h3>
                <p style={{ fontSize: '13px', color: '#80775C', lineHeight: '1.5' }}>
                  Upload a previously exported JSON archive backup to restore or batch-update records across all collections.
                </p>
                <div style={{ marginTop: '20px' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#574A24',
                      color: '#FAE8B4',
                      padding: '10px 18px',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      borderRadius: '2px',
                    }}
                  >
                    <Upload size={14} /> CHOOSE BACKUP JSON
                    <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              <div style={{ gridColumn: '1/-1', background: '#FDF7E3', border: '1px dashed #991b1b', padding: '20px', borderRadius: '2px' }}>
                <h4 style={{ color: '#991b1b', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} /> RESET CATALOG TO NIST BASELINE
                </h4>
                <p style={{ fontSize: '13px', color: '#80775C', margin: 0 }}>
                  Clears local storage overrides and re-initializes all 3,381 clean baseline product codes.
                </p>
                <button
                  onClick={handleResetBaseline}
                  style={{
                    marginTop: '12px',
                    background: '#991b1b',
                    color: '#FFF',
                    border: 'none',
                    padding: '8px 16px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    borderRadius: '2px',
                  }}
                >
                  RESET ARCHIVE DATABASE
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: '#F6E2A3', border: '1px solid #CBBD93', padding: '20px', borderRadius: '2px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#574A24', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} /> ACTIVE SECURITY SPECIFICATION
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div style={{ background: '#FDF7E3', padding: '14px', border: '1px solid #CBBD93', borderRadius: '2px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>ENCRYPTION STANDARD</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, color: '#574A24', marginTop: '4px' }}>AES-256-GCM</div>
                  </div>
                  <div style={{ background: '#FDF7E3', padding: '14px', border: '1px solid #CBBD93', borderRadius: '2px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>HASHING ALGORITHM</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, color: '#574A24', marginTop: '4px' }}>SHA-256 (WebCrypto)</div>
                  </div>
                  <div style={{ background: '#FDF7E3', padding: '14px', border: '1px solid #CBBD93', borderRadius: '2px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#80775C' }}>2FA ROTATION WINDOW</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 800, color: '#574A24', marginTop: '4px' }}>30 SECONDS</div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#F6E2A3', border: '1px solid #CBBD93', padding: '20px', borderRadius: '2px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#574A24', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Lock size={18} /> ACCESS POLICIES & LOCKOUT RULES
                </h3>
                <ul style={{ fontSize: '13px', color: '#574A24', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
                  <li><strong>Maximum Failed Login Attempts:</strong> 5 attempts before automated 5-minute security lockout.</li>
                  <li><strong>Session Duration:</strong> 2 Hours with automated AES-256 token expiration.</li>
                  <li><strong>2-Factor Authentication:</strong> Required on every initial library session login.</li>
                  <li><strong>Zero-Plaintext Storage:</strong> Passwords and credentials never stored in raw text.</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
