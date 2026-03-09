import React, { useState, useEffect, useRef } from 'react';
import './index.css';

const API_BASE = 'http://localhost:3001/api';

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Audio Player State
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Restored features
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'list'
  const [sortBy, setSortBy] = useState('date'); // 'name', 'date', 'export'
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Advanced Filtering States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterGenre, setFilterGenre] = useState('');
  const [filterProgress, setFilterProgress] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterInterest, setFilterInterest] = useState(0);

  const [filterHasExports, setFilterHasExports] = useState(false);
  const [navCategory, setNavCategory] = useState('all'); // 'all', 'recent', 'favorites', 'trash'
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('ableton_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [trash, setTrash] = useState(() => {
    const saved = localStorage.getItem('ableton_trash');
    return saved ? JSON.parse(saved) : [];
  });

  // New Metadata states (Stored as object maps where Key = project.path)
  const [projectMetadata, setProjectMetadata] = useState(() => {
    const saved = localStorage.getItem('ableton_project_metadata');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('ableton_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('ableton_trash', JSON.stringify(trash));
  }, [trash]);

  useEffect(() => {
    localStorage.setItem('ableton_project_metadata', JSON.stringify(projectMetadata));
  }, [projectMetadata]);

  useEffect(() => {
    const fetchProjects = () => {
      fetch(`${API_BASE}/projects`)
        .then(res => res.json())
        .then(data => {
          setProjects(data);
          setLoading(false);
          setInitialLoadComplete(true);

          if (selectedProject) {
            const updated = data.find(p => p.path === selectedProject.path);
            if (updated) setSelectedProject(updated);
          }
        })
        .catch(err => console.error('Fetch error:', err));
    };

    fetchProjects();
    const interval = setInterval(fetchProjects, 5000);
    return () => clearInterval(interval);
  }, [selectedProject?.path]);

  // Audio Playback Effects
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(err => console.error(err));
    }
  }, [currentTrack]);

  const toggleFavorite = (e, path) => {
    if (e) e.stopPropagation();
    setFavorites(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const toggleTrash = (e, path) => {
    if (e) e.stopPropagation();
    setTrash(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
    // If we trash it, also remove it from favorites
    if (!trash.includes(path)) {
      setFavorites(prev => prev.filter(p => p !== path));
    }
  };

  const updateProjectMetadata = (path, field, value) => {
    setProjectMetadata(prev => {
      const existing = prev[path] || {};
      return {
        ...prev,
        [path]: {
          ...existing,
          [field]: value
        }
      };
    });
  };

  // Helper to add/remove tags as an array
  const handleTagToggle = (path, tag) => {
    setProjectMetadata(prev => {
      const existing = prev[path] || {};
      const currentTags = existing.tags || [];
      const newTags = currentTags.includes(tag)
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag];

      return {
        ...prev,
        [path]: {
          ...existing,
          tags: newTags
        }
      };
    });
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setCurrentTime(current);
      if (dur > 0) {
        setProgress((current / dur) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const bounds = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - bounds.left) / bounds.width;
    const time = percent * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFilteredProjects = () => {
    let list = [...projects];

    if (navCategory === 'trash') {
      list = list.filter(p => trash.includes(p.path));
    } else {
      // For all other views, hide trashed projects
      list = list.filter(p => !trash.includes(p.path));

      if (navCategory === 'favorites') {
        list = list.filter(p => favorites.includes(p.path));
      } else if (navCategory === 'recent') {
        list = list.filter(p => p.exports.length > 0);
        list.sort((a, b) => new Date(b.exports[0].mtime) - new Date(a.exports[0].mtime));
        return list.slice(0, 15);
      }
    }

    if (filterHasExports) {
      list = list.filter(p => p.exports.length > 0);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(query) || p.relativeDir.toLowerCase().includes(query));
    }

    // Advanced Metadata Filters
    if (filterGenre) {
      list = list.filter(p => projectMetadata[p.path]?.genre === filterGenre);
    }
    if (filterProgress) {
      list = list.filter(p => projectMetadata[p.path]?.progress === filterProgress);
    }
    if (filterInterest > 0) {
      list = list.filter(p => (projectMetadata[p.path]?.interest || 0) >= filterInterest);
    }
    if (filterTag) {
      list = list.filter(p => (projectMetadata[p.path]?.tags || []).includes(filterTag));
    }

    return list.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortBy === 'date') {
        valA = new Date(a.mtime || 0).getTime();
        valB = new Date(b.mtime || 0).getTime();
      } else if (sortBy === 'export') {
        valA = a.exports.length > 0 ? 1 : 0;
        valB = b.exports.length > 0 ? 1 : 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const currentProjects = getFilteredProjects();

  // Dynamically collect all unique genres and tags
  const uniqueGenres = React.useMemo(() => {
    const genres = new Set();
    // Default system genres so the list isn't empty
    ['Techno', 'House', 'Trance', 'Hip Hop', 'Pop', 'Ambient', 'Other'].forEach(g => genres.add(g));

    Object.values(projectMetadata).forEach(meta => {
      if (meta.genre && typeof meta.genre === 'string') {
        genres.add(meta.genre);
      }
    });
    return Array.from(genres).sort();
  }, [projectMetadata]);

  const uniqueTags = React.useMemo(() => {
    const tags = new Set();
    // Default system tags
    ['banger', 'chill', 'collab', 'live set', 'mixing', 'vocals'].forEach(t => tags.add(t));

    Object.values(projectMetadata).forEach(meta => {
      if (Array.isArray(meta.tags)) {
        meta.tags.forEach(t => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  }, [projectMetadata]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const playTrack = (track, project) => {
    setCurrentTrack({ ...track, project });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="app">
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <h1>APVee</h1>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-btn ${navCategory === 'all' ? 'active' : ''}`} onClick={() => setNavCategory('all')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ marginRight: '12px' }}><path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" /></svg>
            All Projects
          </button>
          <button className={`nav-btn ${navCategory === 'recent' ? 'active' : ''}`} onClick={() => setNavCategory('recent')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ marginRight: '12px' }}><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg>
            Recent Exports
          </button>
          <button className={`nav-btn ${navCategory === 'favorites' ? 'active' : ''}`} onClick={() => setNavCategory('favorites')}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ marginRight: '12px' }}><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
            Favorites
          </button>

          <div className="nav-divider" style={{ height: '1px', background: 'var(--border)', margin: '1rem 0' }}></div>

          <button className={`nav-btn ${navCategory === 'trash' ? 'active' : ''}`} onClick={() => setNavCategory('trash')} style={{ color: navCategory === 'trash' ? '#ff4d4d' : '#888' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ marginRight: '12px' }}><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
            Trash
          </button>

          <div className="nav-divider" style={{ height: '1px', background: 'var(--border)', margin: '1rem 0' }}></div>

          <button className="nav-btn" onClick={() => setIsFilterOpen(!isFilterOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ marginRight: '12px' }}><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" /></svg>
              Advanced Filters
            </div>
            <span>{isFilterOpen ? '▲' : '▼'}</span>
          </button>

          {isFilterOpen && (
            <div className="advanced-filters">
              <div className="filter-group">
                <label>Genre</label>
                <input
                  type="text"
                  value={filterGenre}
                  onChange={e => setFilterGenre(e.target.value)}
                  placeholder="All Genres"
                  list="sidebar-genre-suggestions"
                  className="custom-meta-input"
                />
                <datalist id="sidebar-genre-suggestions">
                  {uniqueGenres.map(genre => (
                    <option key={genre} value={genre} />
                  ))}
                </datalist>
              </div>

              <div className="filter-group">
                <label>Progress</label>
                <select value={filterProgress} onChange={e => setFilterProgress(e.target.value)}>
                  <option value="">Any Status</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Ideation">Ideation</option>
                  <option value="Needs Revision">Needs Revision</option>
                  <option value="Final Touches">Final Touches</option>
                  <option value="Completed">Completed</option>
                  <option value="Released">Released</option>
                  <option value="Abandoned">Abandoned</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Min Interest (Stars)</label>
                <input
                  type="range"
                  min="0" max="5" step="1"
                  value={filterInterest}
                  onChange={(e) => setFilterInterest(Number(e.target.value))}
                  className="filter-slider"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                  <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
                </div>
              </div>

              <div className="filter-group">
                <label>Tag</label>
                <input
                  type="text"
                  value={filterTag}
                  onChange={e => setFilterTag(e.target.value)}
                  placeholder="All Tags"
                  list="sidebar-tag-suggestions"
                  className="custom-meta-input"
                />
                <datalist id="sidebar-tag-suggestions">
                  {uniqueTags.map(tag => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>
              </div>

              {(filterGenre || filterProgress || filterTag || filterInterest > 0) && (
                <button
                  className="clear-filters-btn"
                  onClick={() => {
                    setFilterGenre('');
                    setFilterProgress('');
                    setFilterTag('');
                    setFilterInterest(0);
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </nav>
      </aside>

      <div className="app-content-wrapper">
        <header className="app-header">
          <div className="header-title">
            <h2>{navCategory === 'all' ? 'All Projects' : navCategory === 'recent' ? 'Recent Exports' : navCategory === 'favorites' ? 'Favorites' : 'Trash'}</h2>
            {(initialLoadComplete && currentProjects.length >= 0) && (
              <span className="count-badge">{currentProjects.length}</span>
            )}
            {(loading && initialLoadComplete) && (
              <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '0.5rem', fontStyle: 'italic' }}>Syncing...</span>
            )}
          </div>

          <div className="header-controls">
            <div className="search-bar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" /></svg>
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className={`control-btn ${filterHasExports ? 'active' : ''}`}
              onClick={() => setFilterHasExports(!filterHasExports)}
            >
              Has Exports
            </button>
            <div className="control-group">
              <button
                className={`control-btn ${viewMode === 'cards' ? 'active' : ''}`}
                onClick={() => setViewMode('cards')}
              >Grid</button>
              <button
                className={`control-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >List</button>
            </div>
            <div className="control-group">
              <button className={`control-btn ${sortBy === 'name' ? 'active' : ''}`} onClick={() => toggleSort('name')}>
                Name {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
              <button className={`control-btn ${sortBy === 'date' ? 'active' : ''}`} onClick={() => toggleSort('date')}>
                Date {sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            </div>
          </div>
        </header>

        <main className="app-main">
          {(!initialLoadComplete && loading) ? (
            <div className="loading">Loading projects...</div>
          ) : viewMode === 'cards' ? (
            <div className="projects-grid">
              {currentProjects.map((project, idx) => (
                <div
                  key={idx}
                  className={`project-card ${selectedProject?.path === project.path ? 'selected' : ''}`}
                  onClick={() => setSelectedProject(project)}
                >
                  <button
                    className={`favorite-btn ${favorites.includes(project.path) ? 'active' : ''}`}
                    onClick={(e) => toggleFavorite(e, project.path)}
                  >
                    ★
                  </button>
                  <div className="project-card-header">
                    <h2>{project.name}</h2>
                    <span className="project-dir">{project.relativeDir}</span>
                  </div>
                  <div className="project-stats">
                    <span>{project.metadata?.tempo !== 'Unknown' ? `${project.metadata?.tempo} BPM` : '--- BPM'}</span>
                    <span>{project.exports.length} Exports</span>
                  </div>
                  {project.exports.length > 0 && (
                    <button
                      className="play-latest-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        playTrack(project.exports[0], project);
                      }}
                    >
                      Play Master
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style={{ marginLeft: '6px' }}><path d="M8 5v14l11-7z" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="projects-list">
              <div className="list-header">
                <div className="col-fav"></div>
                <div className="col-name" onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>Name</div>
                <div className="col-date" onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>Modified</div>
                <div className="col-exports">Exports</div>
                <div className="col-tempo">Tempo</div>
              </div>
              {currentProjects.map((project, idx) => (
                <div
                  key={idx}
                  className={`list-row ${selectedProject?.path === project.path ? 'selected' : ''}`}
                  onClick={() => setSelectedProject(project)}
                >
                  <div className="col-fav">
                    <button
                      className={`favorite-btn-list ${favorites.includes(project.path) ? 'active' : ''}`}
                      onClick={(e) => toggleFavorite(e, project.path)}
                    >
                      ★
                    </button>
                  </div>
                  <div className="col-name">
                    <span className="fw-500">{project.name}</span>
                    <span className="project-dir">{project.relativeDir}</span>
                  </div>
                  <div className="col-date">{new Date(project.mtime).toLocaleDateString()}</div>
                  <div className="col-exports">
                    {project.exports.length > 0 ? (
                      <span style={{ color: 'var(--text-highlight)' }}>{project.exports.length} Revs</span>
                    ) : '--'}
                  </div>
                  <div className="col-tempo">{project.metadata?.tempo !== 'Unknown' ? project.metadata?.tempo : '--'}</div>
                </div>
              ))}
            </div>
          )}

          {/* Slide-in Details Panel */}
          <div className={`panel-backdrop ${selectedProject ? 'open' : ''}`} onClick={() => setSelectedProject(null)}></div>
          <div className={`project-details-panel ${selectedProject ? 'open' : ''}`}>
            {selectedProject && (
              <>
                <div className="details-header">
                  <div className="details-title">
                    <h2>{selectedProject.name}</h2>
                    <span className="project-dir">{selectedProject.path}</span>
                  </div>
                  <button className="close-panel-btn" onClick={() => setSelectedProject(null)}>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                  </button>
                </div>

                <div className="panel-actions" style={{ display: 'flex', gap: '0.8rem' }}>
                  <button
                    className={`action-btn ${favorites.includes(selectedProject.path) ? 'active' : ''}`}
                    onClick={() => toggleFavorite(null, selectedProject.path)}
                  >
                    {favorites.includes(selectedProject.path) ? '★ Favorited' : '☆ Add to Favorites'}
                  </button>
                  <button
                    className={`action-btn`}
                    style={{
                      borderColor: trash.includes(selectedProject.path) ? 'rgba(255, 77, 77, 0.3)' : 'var(--border)',
                      color: trash.includes(selectedProject.path) ? '#ff4d4d' : 'var(--text-main)',
                      background: trash.includes(selectedProject.path) ? 'rgba(255, 77, 77, 0.05)' : 'var(--bg-card)'
                    }}
                    onClick={() => {
                      toggleTrash(null, selectedProject.path);
                      if (!trash.includes(selectedProject.path)) setSelectedProject(null); // Close panel if we trash it
                    }}
                  >
                    {trash.includes(selectedProject.path) ? 'Restore from Trash' : 'Move to Trash'}
                  </button>
                </div>

                <div className="metadata-list">
                  <h3>User Data</h3>

                  <div className="meta-item-editable">
                    <span>Genre</span>
                    <div style={{ display: 'flex', width: '100%', maxWidth: '150px', position: 'relative' }}>
                      <input
                        type="text"
                        value={projectMetadata[selectedProject.path]?.genre || ''}
                        onChange={(e) => updateProjectMetadata(selectedProject.path, 'genre', e.target.value)}
                        placeholder="e.g. Techno"
                        list="genre-suggestions"
                        className="custom-meta-input"
                      />
                      <datalist id="genre-suggestions">
                        {uniqueGenres.map(genre => (
                          <option key={genre} value={genre} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  <div className="meta-item-editable">
                    <span>Progress</span>
                    <select
                      value={projectMetadata[selectedProject.path]?.progress || ''}
                      onChange={(e) => updateProjectMetadata(selectedProject.path, 'progress', e.target.value)}
                    >
                      <option value="">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Ideation">Ideation</option>
                      <option value="Needs Revision">Needs Revision</option>
                      <option value="Final Touches">Final Touches</option>
                      <option value="Completed">Completed</option>
                      <option value="Released">Released</option>
                      <option value="Abandoned">Abandoned</option>
                    </select>
                  </div>

                  <div className="meta-item-editable">
                    <span>Interest Level</span>
                    <div className="rating-stars">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          className={`star-btn ${(projectMetadata[selectedProject.path]?.interest || 0) >= star ? 'filled' : ''}`}
                          onClick={() => updateProjectMetadata(selectedProject.path, 'interest', star)}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="meta-item-tags">
                    <span>Tags</span>
                    <div className="tags-container">
                      {/* Render active tags for this project first */}
                      {(projectMetadata[selectedProject.path]?.tags || []).map(tag => (
                        <button
                          key={tag}
                          className="tag-chip active"
                          onClick={() => handleTagToggle(selectedProject.path, tag)}
                        >
                          {tag} <span className="tag-remove">×</span>
                        </button>
                      ))}

                      {/* Add new tag input field */}
                      <input
                        type="text"
                        className="add-tag-input"
                        placeholder="+ Add Tag..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim() !== '') {
                            e.preventDefault();
                            const newTag = e.target.value.trim().toLowerCase();
                            const currentTags = projectMetadata[selectedProject.path]?.tags || [];
                            if (!currentTags.includes(newTag)) {
                              handleTagToggle(selectedProject.path, newTag);
                            }
                            e.target.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="metadata-list">
                  <h3>Ableton Project Info</h3>
                  <div className="meta-item"><span>Tempo</span> <span>{selectedProject.metadata?.tempo}</span></div>
                  <div className="meta-item"><span>Tracks</span> <span>{selectedProject.metadata?.trackCount}</span></div>
                  <div className="meta-item"><span>Audio / MIDI</span> <span>{selectedProject.metadata?.audioTracks || 0} / {selectedProject.metadata?.midiTracks || 0}</span></div>
                  <div className="meta-item"><span>Ableton Ver</span> <span>{selectedProject.metadata?.majorVersion}.{selectedProject.metadata?.minorVersion}</span></div>
                </div>

                <div className="exports-list">
                  <h3>Export History ({selectedProject.exports.length})</h3>
                  {selectedProject.exports.length === 0 ? (
                    <div className="no-exports">No exports found for this project.</div>
                  ) : (
                    <div className="exports-items">
                      {selectedProject.exports.map((exp, i) => (
                        <div key={i} className={`export-item ${currentTrack?.path === exp.path ? 'playing' : ''}`}>
                          <div className="export-info">
                            <span className="export-name">{exp.name}</span>
                            <span className="export-meta">
                              {new Date(exp.mtime).toLocaleString()} • {formatSize(exp.size)}
                            </span>
                          </div>
                          <button className="play-btn-circle" onClick={() => playTrack(exp, selectedProject)}>
                            {currentTrack?.path === exp.path ? (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>

        <footer className={`player-bar ${currentTrack ? 'active' : ''}`}>
          {currentTrack ? (
            <div className="player-ui">
              <div className="player-info">
                <span className="player-track-name">{currentTrack.name}</span>
                <span className="player-project-name">{currentTrack.project?.name}</span>
                {currentTrack.project && currentTrack.project.exports.length > 1 && (
                  <select
                    className="version-select"
                    value={currentTrack.path}
                    onChange={(e) => {
                      const selectedExport = currentTrack.project.exports.find(exp => exp.path === e.target.value);
                      if (selectedExport) playTrack(selectedExport, currentTrack.project);
                    }}
                  >
                    {currentTrack.project.exports.map((exp, i) => (
                      <option key={i} value={exp.path}>
                        {i === 0 ? 'Live (Latest)' : exp.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="player-mid-controls">
                <div className="player-buttons">
                  <button className="main-play-btn" onClick={togglePlay}>
                    {isPlaying ? (
                      <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" style={{ marginLeft: '4px' }}><path d="M8 5v14l11-7z" /></svg>
                    )}
                  </button>
                </div>
                <div className="player-progress-area">
                  <span className="time-text">{formatTime(currentTime)}</span>
                  <div className="progress-container" onClick={handleSeek}>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${progress}%` }}>
                        <div className="progress-handle"></div>
                      </div>
                    </div>
                  </div>
                  <span className="time-text">{formatTime(duration)}</span>
                </div>
              </div>

              <div className="player-volume">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="#aaa"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                <input
                  type="range"
                  className="volume-slider"
                  min="0" max="1" step="0.01"
                  value={volume}
                  onChange={(e) => {
                    setVolume(e.target.value);
                    if (audioRef.current) audioRef.current.volume = e.target.value;
                  }}
                />
              </div>

              {/* Hidden audio element that provides the logic */}
              <audio
                ref={audioRef}
                src={`${API_BASE}/stream?path=${encodeURIComponent(currentTrack.path)}`}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
              />
            </div>
          ) : (
            <div className="player-empty">Standby</div>
          )}
        </footer>
      </div>
    </div>
  );
}

export default App;
