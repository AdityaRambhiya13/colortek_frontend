import React from 'react';
import { Archive } from 'lucide-react';
import type { CollectionMeta } from '../types';

interface SidebarProps {
  collections: CollectionMeta[];
  activeCollection: string;
  onSelectCollection: (id: string) => void;
}

export const CollectionSidebar: React.FC<SidebarProps> = ({
  collections,
  activeCollection,
  onSelectCollection,
}) => {
  return (
    <aside className="chem-lib-sidebar">
      <div className="chem-lib-sidebar-title">
        <span>Collection Index</span>
        <Archive size={14} />
      </div>
      <ul className="chem-lib-nav-list">
        {collections.map((c) => {
          const isActive = activeCollection === c.id;
          return (
            <li key={c.id}>
              <button
                className={`chem-lib-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => onSelectCollection(c.id)}
              >
                <div className="chem-lib-nav-info">
                  <span className="chem-lib-nav-title">{c.label}</span>
                  <span className="chem-lib-nav-range">{c.range}</span>
                </div>
                <span className="chem-lib-nav-count">{c.count.toLocaleString()}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
};
