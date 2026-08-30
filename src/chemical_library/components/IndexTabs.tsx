import React from 'react';
import type { CollectionMeta } from '../types';

interface IndexTabsProps {
  collections: CollectionMeta[];
  activeCollection: string;
  onSelectCollection: (id: string) => void;
}

export const IndexTabs: React.FC<IndexTabsProps> = ({
  collections,
  activeCollection,
  onSelectCollection,
}) => {
  return (
    <div className="chem-lib-tabs">
      {collections.map((c) => {
        const isActive = activeCollection === c.id;
        const displayLabel = c.id === 'ALL' ? 'ALL' : c.id;
        return (
          <button
            key={c.id}
            className={`chem-lib-tab-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectCollection(c.id)}
          >
            [ {displayLabel} ]
          </button>
        );
      })}
    </div>
  );
};
