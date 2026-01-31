// Fetch champions data
let championsData = null;
let championKeys = [];

// Expose championKeys globally for migration
if (typeof window !== 'undefined') {
    window.championKeys = championKeys;
    window.championsData = championsData;
}
let bingoState = {
    champions: [],
    tiles: {}
};

// State management functions
function resetBingoState() {
    bingoState = {
        champions: [],
        tiles: {}
    };
    saveBingoState(bingoState);
}

function updateTileState(tileIndex, championName) {
    bingoState.tiles[tileIndex] = championName;
    saveBingoState(bingoState);
    updateTileUI(tileIndex);
    updateBingoOverlays();
}

function resetTileState(tileIndex) {
    delete bingoState.tiles[tileIndex];
    saveBingoState(bingoState);
    updateTileUI(tileIndex);
    updateBingoOverlays();
}

function isTileCompleted(tileIndex) {
    return bingoState.tiles[tileIndex] !== undefined;
}

function getCompletedChampion(tileIndex) {
    return bingoState.tiles[tileIndex];
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
        
        // Update global references for migration
        if (typeof window !== 'undefined') {
            window.championKeys = championKeys;
            window.championsData = championsData;
        }
        
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
    
    const markedChampion = getCompletedChampion(tileIndex);
    const isCompleted = markedChampion !== undefined;
    
    const topHalf = tile.querySelector('.champion-top');
    const bottomHalf = tile.querySelector('.champion-bottom');
    const stampContainer = tile.querySelector('.completion-stamp-container');
    
    // Update completed state
    if (isCompleted) {
        tile.classList.add('tile-marked');
        tile.classList.add('tile-completed');
        tile.setAttribute('data-marked-champion', markedChampion);
        
        // Expand the marked champion, hide the other
        if (topHalf && topHalf.getAttribute('data-champion') === markedChampion) {
            topHalf.classList.add('champion-expanded');
            if (bottomHalf) bottomHalf.classList.add('champion-hidden');
        } else if (bottomHalf && bottomHalf.getAttribute('data-champion') === markedChampion) {
            bottomHalf.classList.add('champion-expanded');
            if (topHalf) topHalf.classList.add('champion-hidden');
        }
        
        // Show completion stamp
        if (stampContainer) {
            stampContainer.style.display = 'block';
        }
    } else {
        tile.classList.remove('tile-marked');
        tile.classList.remove('tile-completed');
        tile.removeAttribute('data-marked-champion');
        
        // Reset both halves to normal state
        if (topHalf) {
            topHalf.classList.remove('champion-expanded');
            topHalf.classList.remove('champion-hidden');
        }
        if (bottomHalf) {
            bottomHalf.classList.remove('champion-expanded');
            bottomHalf.classList.remove('champion-hidden');
        }
        
        // Hide completion stamp
        if (stampContainer) {
            stampContainer.style.display = 'none';
        }
    }
}

// Render bingo card from champions pairs array
function renderBingoCard(championPairs, useSavedState = false) {
    if (!championPairs || championPairs.length !== 25) {
        console.error('Invalid champions array - expected 25 pairs');
        return;
    }
    
    // Validate pairs structure
    if (!championPairs.every(pair => Array.isArray(pair) && pair.length === 2)) {
        console.error('Invalid champions format - expected array of pairs');
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
            JSON.stringify(savedState.champions) === JSON.stringify(championPairs)) {
            // Champions match, use saved state
            bingoState = savedState;
        } else {
            // Champions don't match or no saved state, initialize new state
            bingoState.champions = championPairs;
            bingoState.tiles = {};
        }
    } else {
        // New card - reset state
        resetBingoState();
        bingoState.champions = championPairs;
        bingoState.tiles = {};
    }
    
    // Get grid container
    const gridContainer = document.getElementById('bingo-grid');
    gridContainer.innerHTML = ''; // Clear any existing content
    
    // Create 5x5 grid of champion tiles with two champions each
    championPairs.forEach((pair, index) => {
        const [champion1, champion2] = pair;
        const tile = document.createElement('div');
        tile.className = 'champion-tile';
        tile.setAttribute('data-tile-index', index);
        
        // Track currently hovered champion based on mouse position
        let hoveredChampion = null;
        
        // Create top half (champion 1) - top triangle
        const topHalf = document.createElement('div');
        topHalf.className = 'champion-half champion-top';
        topHalf.setAttribute('data-champion', champion1);
        const topImg = document.createElement('img');
        topImg.src = `data/tiles/${champion1}.png`;
        topImg.alt = championsData[champion1];
        topImg.loading = 'lazy';
        const topName = document.createElement('div');
        topName.className = 'champion-name';
        topName.textContent = championsData[champion1];
        topHalf.appendChild(topImg);
        topHalf.appendChild(topName);
        
        // Create bottom half (champion 2) - bottom triangle
        const bottomHalf = document.createElement('div');
        bottomHalf.className = 'champion-half champion-bottom';
        bottomHalf.setAttribute('data-champion', champion2);
        const bottomImg = document.createElement('img');
        bottomImg.src = `data/tiles/${champion2}.png`;
        bottomImg.alt = championsData[champion2];
        bottomImg.loading = 'lazy';
        const bottomName = document.createElement('div');
        bottomName.className = 'champion-name';
        bottomName.textContent = championsData[champion2];
        bottomHalf.appendChild(bottomImg);
        bottomHalf.appendChild(bottomName);
        
        // Completion stamp container (initially hidden)
        const completionStampContainer = document.createElement('div');
        completionStampContainer.className = 'completion-stamp-container';
        completionStampContainer.style.display = 'none';
        const completionStamp = document.createElement('img');
        completionStamp.className = 'completion-stamp';
        completionStamp.src = 'data/lol_icon.ico';
        completionStamp.alt = 'Completed';
        completionStampContainer.appendChild(completionStamp);
        
        // Position-based hover handler on the tile
        tile.addEventListener('mousemove', (e) => {
            if (!isTileCompleted(index)) {
                const rect = tile.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Determine which triangle based on position
                // Diagonal from bottom-left (0, 100%) to top-right (100%, 0)
                // Equation: y = height - (height/width) * x
                // Or: y/height + x/width = 1
                // If y/height + x/width < 1, we're in the top triangle
                // If y/height + x/width > 1, we're in the bottom triangle
                const relativeX = x / rect.width;
                const relativeY = y / rect.height;
                
                // Check if we're in top triangle (above diagonal)
                // Top triangle: y/height + x/width < 1
                const isTopTriangle = relativeY + relativeX < 1;
                
                const newHoveredChampion = isTopTriangle ? champion1 : champion2;
                
                if (hoveredChampion !== newHoveredChampion) {
                    hoveredChampion = newHoveredChampion;
                    tile.setAttribute('data-hovered', hoveredChampion);
                    
                    // Update classes: expanded for hovered, hidden for non-hovered
                    if (hoveredChampion === champion1) {
                        topHalf.classList.add('champion-expanded');
                        topHalf.classList.remove('champion-hidden');
                        bottomHalf.classList.add('champion-hidden');
                        bottomHalf.classList.remove('champion-expanded');
                    } else {
                        bottomHalf.classList.add('champion-expanded');
                        bottomHalf.classList.remove('champion-hidden');
                        topHalf.classList.add('champion-hidden');
                        topHalf.classList.remove('champion-expanded');
                    }
                }
            }
        });
        
        tile.addEventListener('mouseleave', () => {
            if (!isTileCompleted(index)) {
                hoveredChampion = null;
                tile.removeAttribute('data-hovered');
                topHalf.classList.remove('champion-expanded', 'champion-hidden');
                bottomHalf.classList.remove('champion-expanded', 'champion-hidden');
            }
        });
        
        // Click handler to mark/unmark tile
        tile.addEventListener('click', () => {
            if (isTileCompleted(index)) {
                resetTileState(index);
            } else if (hoveredChampion) {
                updateTileState(index, hoveredChampion);
            }
        });
        
        tile.appendChild(topHalf);
        tile.appendChild(bottomHalf);
        tile.appendChild(completionStampContainer);
        gridContainer.appendChild(tile);
        
        // Update UI based on saved state
        updateTileUI(index);
    });
    
    // Save initial state
    saveBingoState(bingoState);
    
    // Update bingo overlays after all tiles are rendered
    updateBingoOverlays();
    
    // Toggle states
    gridContainer.classList.remove('hidden');
    
    // Update button text for bingo state
    const generateButton = document.getElementById('generate-bingo-button');
    generateButton.textContent = 'New Bingo Card';
}

// Generate new bingo card with 25 pairs of random champions
function generateBingoCard() {
    if (championKeys.length === 0) {
        console.error('Champions data not loaded');
        return;
    }
    
    // Shuffle and take first 50 champions, then pair them
    const shuffled = shuffleArray(championKeys);
    const selectedChampions = shuffled.slice(0, 50);
    const championPairs = [];
    for (let i = 0; i < 25; i++) {
        championPairs.push([selectedChampions[i * 2], selectedChampions[i * 2 + 1]]);
    }
    
    // Render with new state (not using saved state)
    renderBingoCard(championPairs, false);
    
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
        // Check if it's pairs format (new) or single champions (old - will be migrated)
        const isPairsFormat = Array.isArray(savedState.champions[0]) && savedState.champions[0].length === 2;
        
        if (isPairsFormat) {
            // Validate all champions in pairs exist in championsData
            const allChampionsValid = savedState.champions.every(pair => 
                Array.isArray(pair) && 
                pair.length === 2 &&
                pair.every(champ => championKeys.includes(champ) && championsData[champ])
            );
            
            if (allChampionsValid) {
                // Render with saved state
                renderBingoCard(savedState.champions, true);
                return true;
            }
        }
        // If not pairs format, migration will handle it
    }
    return false;
}
