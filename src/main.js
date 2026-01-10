// Fetch champions data
let championsData = null;
let championKeys = [];
let bingoState = {
    champions: [],
    tiles: {}
};

// State management functions
function saveBingoState() {
    try {
        localStorage.setItem('aram-bingo-state', JSON.stringify(bingoState));
    } catch (error) {
        console.error('Error saving bingo state:', error);
    }
}

function loadBingoState() {
    try {
        const saved = localStorage.getItem('aram-bingo-state');
        if (saved) {
            const parsed = JSON.parse(saved);
            return parsed;
        }
    } catch (error) {
        console.error('Error loading bingo state:', error);
    }
    return null;
}

function resetBingoState() {
    bingoState = {
        champions: [],
        tiles: {}
    };
    saveBingoState();
}

function updateTileState(tileIndex, type) {
    if (!bingoState.tiles[tileIndex]) {
        bingoState.tiles[tileIndex] = { losses: 0, completed: false };
    }
    
    if (type === 'win') {
        bingoState.tiles[tileIndex].completed = true;
    } else if (type === 'loss') {
        bingoState.tiles[tileIndex].losses += 1;
        if (bingoState.tiles[tileIndex].losses >= 2) {
            bingoState.tiles[tileIndex].completed = true;
        }
    }
    
    saveBingoState();
    updateTileUI(tileIndex);
    updateBingoOverlays();
}

function resetTileState(tileIndex) {
    bingoState.tiles[tileIndex] = { losses: 0, completed: false };
    saveBingoState();
    updateTileUI(tileIndex);
    updateBingoOverlays();
}

function isTileCompleted(tileIndex) {
    return bingoState.tiles[tileIndex]?.completed === true;
}

// Get all bingo lines (rows, columns, diagonals)
function getBingoLines() {
    const lines = [];
    
    // Rows (0-4)
    for (let row = 0; row < 5; row++) {
        const line = [];
        for (let col = 0; col < 5; col++) {
            line.push(row * 5 + col);
        }
        lines.push(line);
    }
    
    // Columns (5-9)
    for (let col = 0; col < 5; col++) {
        const line = [];
        for (let row = 0; row < 5; row++) {
            line.push(row * 5 + col);
        }
        lines.push(line);
    }
    
    // Main diagonal (10)
    const mainDiagonal = [];
    for (let i = 0; i < 5; i++) {
        mainDiagonal.push(i * 5 + i);
    }
    lines.push(mainDiagonal);
    
    // Anti-diagonal (11)
    const antiDiagonal = [];
    for (let i = 0; i < 5; i++) {
        antiDiagonal.push(i * 5 + (4 - i));
    }
    lines.push(antiDiagonal);
    
    return lines;
}

// Check if a line is a bingo (all 5 tiles completed)
function isBingoLine(line) {
    return line.every(index => isTileCompleted(index));
}

// Update bingo overlays on all tiles
function updateBingoOverlays() {
    const bingoLines = getBingoLines();
    const winningTiles = new Set();
    
    // Find all winning lines
    bingoLines.forEach(line => {
        if (isBingoLine(line)) {
            line.forEach(index => winningTiles.add(index));
        }
    });
    
    // Update all tiles
    for (let i = 0; i < 25; i++) {
        const tile = document.querySelector(`[data-tile-index="${i}"]`);
        if (!tile) continue;
        
        if (winningTiles.has(i) && isTileCompleted(i)) {
            // Add bingo class to tile (stamp will get shine effect via CSS)
            tile.classList.add('tile-bingo');
        } else {
            // Remove bingo class
            tile.classList.remove('tile-bingo');
        }
    }
}

// Preload all champion tile images
function preloadChampionImages() {
    if (championKeys.length === 0) return;
    
    championKeys.forEach((championKey) => {
        const img = new Image();
        img.src = `data/tiles/${championKey}.png`;
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('data/champions.json');
        championsData = await response.json();
        championKeys = Object.keys(championsData);
        
        // Preload all champion tile images
        preloadChampionImages();
        
        // Set up button click handler
        const generateButton = document.getElementById('generate-bingo-button');
        generateButton.addEventListener('click', generateBingoCard);
        
        // Try to load saved state
        const loaded = loadBingoCardFromState();
        if (!loaded) {
            // No saved state, show empty state (button is already visible)
        }
    } catch (error) {
        console.error('Error loading champions data:', error);
    }
});

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Update tile UI based on state
function updateTileUI(tileIndex) {
    const tile = document.querySelector(`[data-tile-index="${tileIndex}"]`);
    if (!tile) return;
    
    const tileState = bingoState.tiles[tileIndex] || { losses: 0, completed: false };
    const isCompleted = tileState.completed;
    const losses = tileState.losses;
    
    // Update completed state
    if (isCompleted) {
        tile.classList.add('tile-completed');
        const nameLabel = tile.querySelector('.champion-name');
        if (nameLabel) nameLabel.style.display = 'none';
        
        // Show completion stamp if not already present
        let stampContainer = tile.querySelector('.completion-stamp-container');
        if (!stampContainer) {
            stampContainer = document.createElement('div');
            stampContainer.className = 'completion-stamp-container';
            const stamp = document.createElement('img');
            stamp.className = 'completion-stamp';
            stamp.src = 'data/lol_icon.ico';
            stamp.alt = 'Completed';
            stampContainer.appendChild(stamp);
            tile.appendChild(stampContainer);
        }
        stampContainer.style.display = 'block';
    } else {
        tile.classList.remove('tile-completed');
        const nameLabel = tile.querySelector('.champion-name');
        if (nameLabel) nameLabel.style.display = 'block';
        const stampContainer = tile.querySelector('.completion-stamp-container');
        if (stampContainer) stampContainer.style.display = 'none';
    }
    
    // Update loss indicator
    const lossIndicator = tile.querySelector('.loss-indicator');
    if (losses >= 1 && !isCompleted) {
        if (!lossIndicator) {
            const indicator = document.createElement('div');
            indicator.className = 'loss-indicator';
            tile.appendChild(indicator);
        } else {
            lossIndicator.style.display = 'block';
        }
    } else if (lossIndicator) {
        lossIndicator.style.display = 'none';
    }
    
    // Disable buttons if completed
    const winButton = tile.querySelector('.win-button');
    const lossButton = tile.querySelector('.loss-button');
    if (isCompleted) {
        if (winButton) winButton.disabled = true;
        if (lossButton) lossButton.disabled = true;
    } else {
        if (winButton) winButton.disabled = false;
        if (lossButton) lossButton.disabled = false;
    }
}

// Render bingo card from champions array
function renderBingoCard(champions, useSavedState = false) {
    if (!champions || champions.length !== 25) {
        console.error('Invalid champions array');
        return;
    }
    
    if (championKeys.length === 0) {
        console.error('Champions data not loaded');
        return;
    }
    
    // Load or initialize state
    if (useSavedState) {
        const savedState = loadBingoState();
        if (savedState && 
            savedState.champions && 
            savedState.champions.length === 25 &&
            JSON.stringify(savedState.champions) === JSON.stringify(champions)) {
            // Champions match, use saved state
            bingoState = savedState;
        } else {
            // Champions don't match or no saved state, initialize new state
            bingoState.champions = champions;
            bingoState.tiles = {};
            for (let i = 0; i < 25; i++) {
                bingoState.tiles[i] = { losses: 0, completed: false };
            }
        }
    } else {
        // New card - reset state
        resetBingoState();
        bingoState.champions = champions;
        // Initialize empty state for all tiles
        for (let i = 0; i < 25; i++) {
            bingoState.tiles[i] = { losses: 0, completed: false };
        }
    }
    
    // Get grid container
    const gridContainer = document.getElementById('bingo-grid');
    gridContainer.innerHTML = ''; // Clear any existing content
    
    // Create 5x5 grid of champion tiles
    champions.forEach((championKey, index) => {
        const tile = document.createElement('div');
        tile.className = 'champion-tile';
        tile.setAttribute('data-tile-index', index);
        tile.setAttribute('data-champion-key', championKey);
        
        // Champion image
        const img = document.createElement('img');
        img.src = `data/tiles/${championKey}.png`;
        img.alt = championsData[championKey];
        img.loading = 'lazy';
        
        // Champion name
        const nameLabel = document.createElement('div');
        nameLabel.className = 'champion-name';
        nameLabel.textContent = championsData[championKey];
        
        // Hover overlay
        const overlay = document.createElement('div');
        overlay.className = 'tile-overlay';
        
        // Buttons container
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'tile-buttons';
        
        // Win button
        const winButton = document.createElement('button');
        winButton.className = 'win-button';
        winButton.textContent = 'W';
        winButton.setAttribute('aria-label', 'Mark as win');
        winButton.addEventListener('click', (e) => {
            e.stopPropagation();
            updateTileState(index, 'win');
        });
        
        // Loss button
        const lossButton = document.createElement('button');
        lossButton.className = 'loss-button';
        lossButton.textContent = 'L';
        lossButton.setAttribute('aria-label', 'Mark as loss');
        lossButton.addEventListener('click', (e) => {
            e.stopPropagation();
            updateTileState(index, 'loss');
        });
        
        buttonsContainer.appendChild(winButton);
        buttonsContainer.appendChild(lossButton);
        overlay.appendChild(buttonsContainer);
        
        // Loss indicator (initially hidden)
        const lossIndicator = document.createElement('div');
        lossIndicator.className = 'loss-indicator';
        lossIndicator.style.display = 'none';
        
        // Completion stamp container (initially hidden)
        const completionStampContainer = document.createElement('div');
        completionStampContainer.className = 'completion-stamp-container';
        completionStampContainer.style.display = 'none';
        const completionStamp = document.createElement('img');
        completionStamp.className = 'completion-stamp';
        completionStamp.src = 'data/lol_icon.ico';
        completionStamp.alt = 'Completed';
        completionStampContainer.appendChild(completionStamp);
        
        // Add click handler to reset completed tiles
        tile.addEventListener('click', (e) => {
            // Only reset if tile is completed and click is not on buttons or overlay
            if (isTileCompleted(index) && 
                !e.target.closest('.tile-buttons') && 
                !e.target.closest('.tile-overlay')) {
                resetTileState(index);
            }
        });
        
        tile.appendChild(img);
        tile.appendChild(nameLabel);
        tile.appendChild(overlay);
        tile.appendChild(lossIndicator);
        tile.appendChild(completionStampContainer);
        gridContainer.appendChild(tile);
        
        // Update UI based on saved state
        updateTileUI(index);
    });
    
    // Save initial state
    saveBingoState();
    
    // Update bingo overlays after all tiles are rendered
    updateBingoOverlays();
    
    // Toggle states
    gridContainer.classList.remove('hidden');
    
    // Update button text for bingo state
    const generateButton = document.getElementById('generate-bingo-button');
    generateButton.textContent = 'New Bingo Card';
}

// Generate new bingo card with 25 random champions
function generateBingoCard() {
    if (championKeys.length === 0) {
        console.error('Champions data not loaded');
        return;
    }
    
    // Shuffle and take first 25 champions
    const shuffled = shuffleArray(championKeys);
    const selectedChampions = shuffled.slice(0, 25);
    
    // Render with new state (not using saved state)
    renderBingoCard(selectedChampions, false);
    
    // Scroll to top of grid for better UX
    const gridContainer = document.getElementById('bingo-grid');
    gridContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Load bingo card from saved state
function loadBingoCardFromState() {
    const savedState = loadBingoState();
    if (savedState && 
        savedState.champions && 
        savedState.champions.length === 25) {
        // Validate all champions exist in championsData
        const allChampionsValid = savedState.champions.every(champ => 
            championKeys.includes(champ) && championsData[champ]
        );
        
        if (allChampionsValid) {
            // Render with saved state
            renderBingoCard(savedState.champions, true);
            return true;
        }
    }
    return false;
}
