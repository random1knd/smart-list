import React from 'react';
import Button from '@atlaskit/button';
import './styles.css';

/**
 * Filter Bar Component
 * Provides filter controls for notes list
 */
const FilterBar = ({ activeFilter, onFilterChange }) => {
  return (
    <div className="filter-bar">
      <div className="filter-buttons">
        <Button
          appearance={activeFilter === 'all' ? 'primary' : 'subtle'}
          onClick={() => onFilterChange('all')}
        >
          All Notes
        </Button>
        <Button
          appearance={activeFilter === 'mine' ? 'primary' : 'subtle'}
          onClick={() => onFilterChange('mine')}
        >
          My Notes
        </Button>
        <Button
          appearance={activeFilter === 'shared' ? 'primary' : 'subtle'}
          onClick={() => onFilterChange('shared')}
        >
          Shared with Me
        </Button>
      </div>
    </div>
  );
};

export default FilterBar;
