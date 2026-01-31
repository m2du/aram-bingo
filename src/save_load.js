// Version constant for save format
const CURRENT_VERSION = 0;

const MIGRATION_FUNCTIONS = [
  updateToV0
]

function updateToV0(data) {
  return { version: 0, value: data };
}

// Migration function to convert old format to current format
function migrateSaveData(data) {
    let migrateFrom = 0;
    if ("version" in data) {
      if (data.version === CURRENT_VERSION) return data;
      migrateFrom = data.version + 1;
    }
    
    const migratedData = data;
    for (const fn of MIGRATION_FUNCTIONS) {
      migratedData = fn(migratedData);
    }
    return migratedData
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
