import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Trash2, Edit3, Download, RefreshCw, 
  Tag, List, BarChart3, HelpCircle, Layers, ShieldAlert
} from 'lucide-react';
import { ProductMasterAPI } from '../services/api';
import * as XLSX from 'xlsx';

interface ProductsMasterProps {
  onShowToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface ProductItem {
  product: string;
  sub_product: string;
  date_added: string;
}

export const ProductsMaster: React.FC<ProductsMasterProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(false);
  const [productsData, setProductsData] = useState<ProductItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Input states
  const [categoryName, setCategoryName] = useState('');
  const [subProductNames, setSubProductNames] = useState('');

  // Edit Modal Drawer State
  const [isEditing, setIsEditing] = useState(false);
  const [oldProduct, setOldProduct] = useState('');
  const [oldSubProduct, setOldSubProduct] = useState('');
  const [editProduct, setEditProduct] = useState('');
  const [editSubProduct, setEditSubProduct] = useState('');

  const loadProductsList = async () => {
    setLoading(true);
    const [success, data] = await ProductMasterAPI.getProductsList();
    setLoading(false);

    if (success && typeof data !== 'string') {
      setProductsData(data.products || []);
    } else {
      onShowToast('Could not fetch Master Product lists.', 'error');
    }
  };

  useEffect(() => {
    loadProductsList();
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const prodUpper = categoryName.trim().toUpperCase();
    const subsStr = subProductNames.trim().toUpperCase();

    if (!prodUpper) {
      onShowToast('Category Name is required.', 'warning');
      return;
    }

    const subProductsList = subsStr.split(',')
      .map(s => s.trim())
      .filter(Boolean);

    setLoading(true);
    const [success, data] = await ProductMasterAPI.addProduct(prodUpper, subProductsList);
    setLoading(false);

    if (success) {
      const message = data?.message || 'Product entries added successfully.';
      const status = data?.status || 'success';
      onShowToast(message, status === 'info' ? 'warning' : 'success');
      
      setCategoryName('');
      setSubProductNames('');
      loadProductsList();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Failed to add products.', 'error');
    }
  };

  const handleOpenEditModal = (product: string, subProduct: string) => {
    setOldProduct(product);
    setOldSubProduct(subProduct);
    setEditProduct(product);
    setEditSubProduct(subProduct);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const prodUpper = editProduct.trim().toUpperCase();
    const subUpper = editSubProduct.trim().toUpperCase();

    if (!prodUpper) {
      onShowToast('Category Name cannot be empty.', 'warning');
      return;
    }

    setLoading(true);
    const [success, data] = await ProductMasterAPI.updateProduct(oldProduct, oldSubProduct, prodUpper, subUpper);
    setLoading(false);

    if (success) {
      onShowToast(data?.message || 'Entry updated successfully.', 'success');
      setIsEditing(false);
      loadProductsList();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Update failed.', 'error');
    }
  };

  const handleDeleteSubproduct = async (product: string, subProduct: string) => {
    if (!window.confirm(`Are you sure you want to delete the specific entry "${product} - ${subProduct}"?`)) {
      return;
    }

    setLoading(true);
    const [success, data] = await ProductMasterAPI.deleteProduct(product, subProduct);
    setLoading(false);

    if (success) {
      onShowToast(data?.message || 'Entry deleted.', 'warning');
      loadProductsList();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Deletion failed.', 'error');
    }
  };

  const handleDeleteProductSweep = async (product: string) => {
    if (!window.confirm(`⚠️ WARNING ⚠️\n\nAre you sure you want to delete ALL master entries under Category "${product}"?\nThis deletes the category and all its associated subproducts.`)) {
      return;
    }

    setLoading(true);
    const [success, data] = await ProductMasterAPI.deleteProduct(product, null);
    setLoading(false);

    if (success) {
      onShowToast(data?.message || `Category "${product}" deleted completely.`, 'warning');
      loadProductsList();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Category deletion failed.', 'error');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('🔥 CRITICAL ACTION 🔥\n\nAre you absolutely sure you want to clear ALL product database entries?\nThis wipes out the entire Products Master catalog.')) {
      return;
    }

    setLoading(true);
    const [success, data] = await ProductMasterAPI.clearProducts();
    setLoading(false);

    if (success) {
      onShowToast(data?.message || 'All product records wiped.', 'warning');
      loadProductsList();
    } else {
      onShowToast(typeof data === 'string' ? data : 'Wipe failed.', 'error');
    }
  };

  const handleExportData = () => {
    if (productsData.length === 0) {
      onShowToast('No product records available to export.', 'warning');
      return;
    }

    const wb = XLSX.utils.book_new();
    const headers = ['Category (Product)', 'Sub-Product (Brand)', 'Date Added'];
    const rows = productsData.map(i => [
      i.product || '',
      i.sub_product || '',
      i.date_added ? new Date(i.date_added).toLocaleString() : 'N/A'
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, 'Products Master');
    XLSX.writeFile(wb, `products_master_export.xlsx`);
    onShowToast('Excel product catalog downloaded.', 'success');
  };

  // Filter products by search term
  const filteredProducts = productsData.filter(i => {
    const term = searchTerm.trim().toUpperCase();
    if (!term) return true;
    return (
      (i.product || '').toUpperCase().includes(term) ||
      (i.sub_product || '').toUpperCase().includes(term)
    );
  });

  // Calculate statistics
  const uniqueProductsCount = new Set(productsData.map(i => i.product)).size;
  const totalEntriesCount = productsData.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header View */}
      <div className="glass-card animated-fade" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', padding: '12px', borderRadius: '12px', color: 'var(--primary-color)' }}>
            <Tag size={32} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Products Master Registry</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Organize product classes, categories, and specific brand listings centrally.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportData} className="btn-secondary" style={{ padding: '10px 16px', gap: '8px', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
            <Download size={14} />
            <span>Export Excel</span>
          </button>
          <button onClick={loadProductsList} className="btn-secondary" style={{ padding: '10px 16px', gap: '8px' }} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin-loader' : ''} />
            <span>Sync Catalog</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="glass-card interactive animated-fade" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)', padding: '10px', borderRadius: '50%' }}>
            <BarChart3 size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>UNIQUE CATEGORIES</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{uniqueProductsCount}</span>
          </div>
        </div>

        <div className="glass-card interactive animated-fade" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--color-info-light)', color: 'var(--color-info)', padding: '10px', borderRadius: '50%' }}>
            <List size={20} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>TOTAL ENTRIES</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{totalEntriesCount}</span>
          </div>
        </div>
      </div>

      {/* Adding Form */}
      <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
          <Plus size={18} color="var(--primary-color)" />
          <span>Add New Product Entry</span>
        </h3>

        <form onSubmit={handleAddProduct} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div className="form-input-container" style={{ flex: '1 1 240px' }}>
            <span className="form-label">Category Name</span>
            <input 
              type="text" 
              className="field-input" 
              value={categoryName} 
              onChange={e => setCategoryName(e.target.value.toUpperCase())}
              placeholder="e.g. PU_CRYSTAL"
              required
            />
          </div>

          <div className="form-input-container" style={{ flex: '2 1 360px' }}>
            <span className="form-label">Product Name(s) (optional, comma-separated)</span>
            <input 
              type="text" 
              className="field-input" 
              value={subProductNames} 
              onChange={e => setSubProductNames(e.target.value.toUpperCase())}
              placeholder="e.g. WHITE_GLOSS, BLACK_GLOSS, CLEAR_MATT"
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
            <button type="submit" className="btn-primary" style={{ height: '42px', padding: '0 24px', backgroundColor: 'var(--color-success)' }} disabled={loading}>
              <span>Add Product</span>
            </button>
            <button type="button" onClick={handleClearAll} className="btn-primary" style={{ height: '42px', padding: '0 20px', backgroundColor: 'var(--color-error)' }} disabled={loading}>
              <span>Wipe Catalog</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Database Table */}
      <div className="glass-card animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Product Database Ledger</h3>
          
          <div style={{ position: 'relative', width: '280px' }}>
            <input 
              type="text" 
              className="field-input" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Search product..." 
              style={{ paddingLeft: '32px' }}
            />
            <Search size={14} color="var(--text-light)" style={{ position: 'absolute', left: '10px', top: '12px' }} />
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', fontStyle: 'italic' }}>
            No matching product catalog records found.
          </div>
        ) : (
          <div className="table-scroll-container" style={{ maxHeight: '420px' }}>
            <table className="table-locked-header">
              <thead>
                <tr>
                  <th>Category (Product)</th>
                  <th>Sub Product Name</th>
                  <th style={{ width: '180px' }}>Date Added</th>
                  <th style={{ width: '180px', textAlign: 'center' }}>Catalog Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Keep track of row colors and first occurrences for group sweeps
                  const renderedGroups: Record<string, boolean> = {};

                  return filteredProducts.map((item, index) => {
                    const isFirstInGroup = !renderedGroups[item.product];
                    renderedGroups[item.product] = true;

                    return (
                      <tr key={index} style={{ backgroundColor: isFirstInGroup ? 'var(--primary-light)' : 'transparent' }}>
                        <td style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{item.product}</td>
                        <td style={{ fontWeight: 500 }}>{item.sub_product || <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>Main Category</span>}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {item.date_added ? new Date(item.date_added).toLocaleString() : 'Historical'}
                        </td>
                        <td style={{ padding: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                            {isFirstInGroup ? (
                              <button 
                                onClick={() => handleDeleteProductSweep(item.product)}
                                className="btn-secondary"
                                style={{ border: 'none', backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)', padding: '6px' }}
                                title={`Wipe all entries in "${item.product}"`}
                              >
                                <Trash2 size={13} /> Sweep
                              </button>
                            ) : (
                              <div style={{ width: '65px' }} />
                            )}
                            <button 
                              onClick={() => handleOpenEditModal(item.product, item.sub_product)}
                              className="btn-secondary"
                              style={{ border: 'none', backgroundColor: 'var(--border-light)', padding: '6px' }}
                              title="Edit Entry"
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                            <button 
                              onClick={() => handleDeleteSubproduct(item.product, item.sub_product)}
                              className="btn-secondary"
                              style={{ border: 'none', backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)', padding: '6px' }}
                              title="Delete subproduct"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT MODAL DIALOG */}
      {isEditing && (
        <div className="modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="modal-content animated-scale" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary-color)', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
              Edit Product Details
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div className="form-input-container">
                <span className="form-label">Category Name</span>
                <input 
                  type="text" 
                  className="field-input" 
                  value={editProduct} 
                  onChange={e => setEditProduct(e.target.value.toUpperCase())}
                />
              </div>

              <div className="form-input-container">
                <span className="form-label">Product Name</span>
                <input 
                  type="text" 
                  className="field-input" 
                  value={editSubProduct} 
                  onChange={e => setEditSubProduct(e.target.value.toUpperCase())}
                  placeholder="Leave empty for main Category"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsEditing(false)} className="btn-secondary" disabled={loading}>
                Cancel
              </button>
              <button onClick={handleSaveEdit} className="btn-primary" style={{ backgroundColor: 'var(--color-success)' }} disabled={loading}>
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
