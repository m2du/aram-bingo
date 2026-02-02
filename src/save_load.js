// Version constant for save format
const CURRENT_VERSION = 2;

const MIGRATION_FUNCTIONS = [
  updateToV0,
  updateToV1,
  updateToV2
]

function updateToV0(data) {
  // Wrap unversioned data in version 0 format
  if (data && typeof data === 'object' && 'version' in data) {
    return data;
  }
  return { version: 0, value: data };
}

function updateToV1(data) {
  // Migrate from version 0 (single champions) to version 1 (pairs)
  if (data.version !== 0) {
    return data;
  }
  
  const state = data.value;
  if (!state || !state.champions) {
    return { version: 1, value: state };
  }
  
  // Check if already in pairs format
  if (Array.isArray(state.champions) && 
      state.champions.length > 0 && 
      Array.isArray(state.champions[0]) && 
      state.champions[0].length === 2) {
    // Already pairs format, just update version
    return { version: 1, value: state };
  }
  
  // Convert single champions to pairs
  const migratedState = { ...state };
  
  // Pair each champion with a random new champion
  if (Array.isArray(state.champions) && state.champions.length === 25) {
    // Get all available champions from global scope (set by main.js)
    const allChampions = typeof window !== 'undefined' && window.championKeys ? 
      [...window.championKeys] : 
      [];
    
    if (allChampions.length === 0) {
      // Fallback: duplicate each champion
      migratedState.champions = state.champions.map(champ => [champ, champ]);
    } else {
      // Remove already-used champions and shuffle the rest
      const availableChampions = allChampions.filter(champ => !state.champions.includes(champ));
      
      // If we don't have enough unique champions, allow duplicates but prefer unique
      const pool = availableChampions.length >= 25 ? availableChampions : allChampions;
      
      // Shuffle the pool
      const shuffled = [...pool];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Pair each existing champion with a random partner
      let shuffleIndex = 0;
      migratedState.champions = state.champions.map(champ => {
        // Get a partner, preferring one that's different
        let partner = shuffled[shuffleIndex % shuffled.length];
        // Try to avoid pairing with itself if possible
        if (partner === champ && shuffled.length > 1) {
          shuffleIndex++;
          partner = shuffled[shuffleIndex % shuffled.length];
        }
        shuffleIndex++;
        return [champ, partner];
      });
    }
  }
  
  // Convert tiles format from {0: {completed: true}} to {0: "championName"}
  if (state.tiles && typeof state.tiles === 'object') {
    const migratedTiles = {};
    for (const [tileIndex, tileData] of Object.entries(state.tiles)) {
      const index = parseInt(tileIndex);
      if (!isNaN(index)) {
        if (tileData && typeof tileData === 'object' && tileData.completed === true) {
          // Old format: get the champion from the old champions array
          if (state.champions && state.champions[index]) {
            migratedTiles[index] = state.champions[index];
          }
        } else if (typeof tileData === 'string') {
          // Already migrated format
          migratedTiles[index] = tileData;
        }
      }
    }
    migratedState.tiles = migratedTiles;
  }
  
  return { version: 1, value: migratedState };
}

function updateToV2(data) {
  // Migrate from version 1 (direct state) to version 2 (wrapped with id and name)
  if (data.version !== 1) {
    return data;
  }
  
  const state = data.value;
  
  // Wrap the state in the new format with id and name
  const migratedValue = {
    id: generateId(),
    name: 'Unnamed Card',
    state: state
  };
  
  return { version: 2, value: [migratedValue] };
}

// Migration function to convert old format to current format
function migrateSaveData(data) {
    // First wrap in version 0 if not versioned
    let currentData = updateToV0(data);
    
    // Then migrate through versions up to current
    let currentVersion = currentData.version || 0;
    
    while (currentVersion < CURRENT_VERSION) {
      const nextVersion = currentVersion + 1;
      const migrationFn = MIGRATION_FUNCTIONS[nextVersion];
      if (migrationFn) {
        currentData = migrationFn(currentData);
        currentVersion = currentData.version;
      } else {
        break;
      }
    }
    
    return currentData;
}

// Save bingo state to localStorage with versioned format
// Update CURRENT_VERSION whenever this function changes
function saveBingoState(state) {
    try {
        const versionedData = {
            version: CURRENT_VERSION,
            value: state
        };
        localStorage.setItem('aram-bingo-state', JSON.stringify(versionedData));
    } catch (error) {
        console.error('Error saving bingo state:', error);
    }
}

// Load bingo state from localStorage with automatic migration
function loadBingoState() {
    try {
        const saved = localStorage.getItem('aram-bingo-state');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Migrate if needed (handles old format without version)
            const migrated = migrateSaveData(parsed);
            // Return the actual state value
            return migrated.value;
        }
    } catch (error) {
        console.error('Error loading bingo state:', error);
    }
    return null;
}

// Load all boards from localStorage (handles backward compatibility)
function loadAllBoards() {
    try {
        const saved = localStorage.getItem('aram-bingo-state');
        if (saved) {
            const parsed = JSON.parse(saved);
            const originalVersion = parsed.version;
            
            // Migrate if needed
            const migrated = migrateSaveData(parsed);
            
            // If migration occurred (version changed or was unversioned), save the migrated data back
            const needsSave = originalVersion === undefined || originalVersion !== migrated.version || migrated.version < CURRENT_VERSION;
            
            if (needsSave) {
                // Normalize to array format
                let boardsArray = [];
                if (Array.isArray(migrated.value)) {
                    boardsArray = migrated.value;
                } else if (migrated.value && typeof migrated.value === 'object') {
                    // Single board object, wrap in array
                    boardsArray = [migrated.value];
                }
                saveAllBoards(boardsArray);
                return boardsArray;
            }
            
            // Handle backward compatibility: if value is a single object (old v2), wrap it in array
            if (migrated.value && !Array.isArray(migrated.value)) {
                // Single board object, wrap in array
                return [migrated.value];
            }
            
            // Already an array (new v2 format)
            return Array.isArray(migrated.value) ? migrated.value : [];
        }
    } catch (error) {
        console.error('Error loading all boards:', error);
    }
    return [];
}

// Save all boards to localStorage as version 2 format
function saveAllBoards(boards) {
    try {
        if (!Array.isArray(boards)) {
            console.error('saveAllBoards: boards must be an array');
            return;
        }
        
        const versionedData = {
            version: 2,
            value: boards
        };
        localStorage.setItem('aram-bingo-state', JSON.stringify(versionedData));
    } catch (error) {
        console.error('Error saving all boards:', error);
    }
}

// Save or update a single board in the boards array
function saveBingoBoard(board) {
    try {
        if (!board || !board.id) {
            console.error('saveBingoBoard: board must have an id');
            return;
        }
        
        const boards = loadAllBoards();
        const existingIndex = boards.findIndex(b => b.id === board.id);
        
        if (existingIndex >= 0) {
            // Update existing board
            boards[existingIndex] = board;
        } else {
            // Add new board
            boards.push(board);
        }
        
        saveAllBoards(boards);
    } catch (error) {
        console.error('Error saving bingo board:', error);
    }
}

// Delete a board by ID
function deleteBingoBoard(boardId) {
    try {
        const boards = loadAllBoards();
        const filteredBoards = boards.filter(b => b.id !== boardId);
        saveAllBoards(filteredBoards);
    } catch (error) {
        console.error('Error deleting bingo board:', error);
    }
}

// Load a specific board by ID
function loadBingoBoard(boardId) {
    try {
        const boards = loadAllBoards();
        return boards.find(b => b.id === boardId) || null;
    } catch (error) {
        console.error('Error loading bingo board:', error);
        return null;
    }
}

// Update a board's name
function updateBoardName(boardId, newName) {
    try {
        const board = loadBingoBoard(boardId);
        if (board) {
            board.name = newName;
            saveBingoBoard(board);
        }
    } catch (error) {
        console.error('Error updating board name:', error);
    }
}
