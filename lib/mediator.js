const Region = require('./region.js');
const Sequence = require('./sequence.js');
const Clip = require('./clip.js');
const ClipManager = require('./clipmanager.js');

var colours = ['orange', 'red', 'red', 'yellow', 'red', 'yellow', 'green', 'orange']; // Default color order

const MAX_VOICES = 8;


/// this class is largely responsible for managing the synchronization between the sequences and regions
/// regions and sequences are managed by the grid and the sequencer, with mediator making sure to manage the respective indices
class Mediator {
    constructor( g , s){
        this.mode = 0; // input, select, shift, mute, move regions
        this.padsDown = [];
        this.grid = g; // reference to the main grid
        this.seq = s; // reference to the sequencer object
        this.clipManager = new ClipManager(); // optional clip storage
        this.addMode = 'sync'; // or 'immediate'
        this.selectedSequence = null; // index of currently selected sequence
        this.selectedCell = null; // selected cell within the sequence
        this.gridDict = null; // Dict for syncing to Max (initialized on first sync)
        this.pendingModifications = new Map(); // voiceIndex -> {oldCells: [...], oldVector: [...], previousIndex: -1}
    }

    // Set color names for hardware abstraction
    setColors(colorArray){
        if(colorArray && colorArray.length === 8){
            colours = colorArray;
        }
    }

    getGridJSON(){
        var json = {
            regions: []
        };

        for(var i = 0; i < this.grid.regions.length; i++){
            if(this.grid.regions[i] === null){
                json.regions.push(null);
            } else {
                var region = this.grid.regions[i];
                json.regions.push({
                    voice: i,
                    color: colours[i],
                    cells: region.cells.map(function(cell){
                        return {x: cell.x, y: cell.y};
                    })
                });
            }
        }

        return json;
    }

    syncGridToDict(dictName){
        if(!dictName){
            dictName = "grid_state";
        }

        if(this.gridDict === null){
            this.gridDict = new Dict(dictName);
        }

        var json = this.getGridJSON();
        this.gridDict.parse(JSON.stringify(json));
    }

    input( c ){ 
        var messages = [];

        if(this.mode === 0){ // entry mode - default
            if(this.padsDown.length === 2 || this.padsDown.length === 1){
                console.log('new region with 1 or two touches');

                var r = new Region( [...this.padsDown] ); // create a shallow copy of the padsdown array
                this.clear();

                if( this.grid.checkRegion ( r ) === false ){
                    console.log('region add failed');
                    return messages;/// if region overlaps with another in a non-modifiable way then return
                }

                // BEFORE modifying grid: Check if this will be a modification (not new region)
                // If so, cache the OLD state before it's changed
                var overlappingRegions = this.grid.getOverlappingRegions(r);
                var isModification = false;
                var existingRegionIndex = -1;
                var oldCells = null;
                var oldVector = null;

                // Check if this is a modification (exactly one overlap, left-side aligned)
                if(overlappingRegions.length === 1 && r.leftSideAligned(overlappingRegions[0])){
                    isModification = true;
                    existingRegionIndex = this.grid.getRegionIndex(overlappingRegions[0]);

                    if(!this.pendingModifications.has(existingRegionIndex)){
                        // First modification - cache current (old) state
                        oldCells = overlappingRegions[0].cells.slice(); // Copy cells array
                        oldVector = this.seq.sequences[existingRegionIndex].getVector().slice(); // Copy vector
                    }
                }

                var resultingRegion;
                if( this.addMode === 'sync' ) {
                    resultingRegion = this.grid.addRegion(r);
                    //resultingRegion = this.grid.tryAddRegion(r);
                }else{
                    resultingRegion = this.grid.addRegion(r);
                }

                var regionVector = resultingRegion.toVector();
                var regionIndex = this.grid.getRegionIndex(resultingRegion);

                // Check if sequence already exists (modification) or needs to be created (new region)
                var sequenceIndex;
                var isPendingModification = false;
                if(this.seq.sequences[regionIndex] !== null && this.seq.sequences[regionIndex] !== undefined){
                    // Existing sequence - MODIFICATION
                    this.seq.sequences[regionIndex].setVector( regionVector );
                    sequenceIndex = regionIndex;

                    // If we cached old state, this is a pending modification
                    if(isModification && oldCells !== null){
                        isPendingModification = true;

                        // Create cachedCells with embedded pendingColor
                        var newCellsSet = new Set();
                        for(var j = 0; j < resultingRegion.cells.length; j++){
                            var cellKey = resultingRegion.cells[j].x + ',' + resultingRegion.cells[j].y;
                            newCellsSet.add(cellKey);
                        }

                        var cachedCells = [];
                        for(var j = 0; j < oldCells.length; j++){
                            var cellKey = oldCells[j].x + ',' + oldCells[j].y;
                            var isInNewPattern = newCellsSet.has(cellKey);

                            cachedCells.push({
                                x: oldCells[j].x,
                                y: oldCells[j].y,
                                pendingColor: isInNewPattern ?
                                    'dimmed_' + colours[regionIndex] :  // Still exists (dimmed)
                                    'pending_delete'                     // Removed (pending delete)
                            });
                        }

                        // Store in pendingModifications Map
                        this.pendingModifications.set(regionIndex, {
                            oldCells: cachedCells,  // Each has {x, y, pendingColor}
                            oldVector: oldVector,
                            previousIndex: -1
                        });

                        // Send dimmed colors for cached cells
                        for(var j = 0; j < cachedCells.length; j++){
                            messages.push({
                                channel: 'control-surface',
                                data: [cachedCells[j].x, cachedCells[j].y, cachedCells[j].pendingColor]
                            });
                        }

                        // Send dimmed colors for any NEW cells not in old pattern
                        for(var j = 0; j < resultingRegion.cells.length; j++){
                            var cellKey = resultingRegion.cells[j].x + ',' + resultingRegion.cells[j].y;
                            var wasInOld = false;
                            for(var k = 0; k < oldCells.length; k++){
                                if(oldCells[k].x === resultingRegion.cells[j].x && oldCells[k].y === resultingRegion.cells[j].y){
                                    wasInOld = true;
                                    break;
                                }
                            }
                            if(!wasInOld){
                                // This is a NEW cell - send dimmed color
                                messages.push({
                                    channel: 'control-surface',
                                    data: [resultingRegion.cells[j].x, resultingRegion.cells[j].y, 'dimmed_' + colours[regionIndex]]
                                });
                            }
                        }

                        // Don't send Gen~ messages yet (will be sent at step 0)
                        // Skip: createSequence, what, prob, loopMode, resetMode, endBehavior, subdivision/tuplet
                    }
                } else {
                    // New sequence - create it
                    var newSequence = new Sequence();
                    newSequence.setVector( regionVector );
                    sequenceIndex = this.seq.add( newSequence );

                    // Verify grid and sequencer indices match
                    if(regionIndex !== sequenceIndex){
                        post('ERROR: Region index ' + regionIndex + ' does not match sequence index ' + sequenceIndex + '\n');

                        // Clean up - remove what we just added
                        this.grid.removeRegion(resultingRegion);
                        this.seq.remove(sequenceIndex);

                        return messages; // Return empty messages array, abort the operation
                    }

                    // Set new sequence as selected
                    this.selectedSequence = sequenceIndex;
                    this.selectedCell = resultingRegion.cells[0]; // Select first cell of new region
                }

                // Only send Gen~ messages if NOT a pending modification
                if(!isPendingModification){
                    messages.push({channel: 'setVoice', data: regionIndex});
                    messages.push({channel: 'createSequence', data: [...regionVector ]});

                    var whatindices = this.seq.sequences[regionIndex].getMatches();
                    messages.push({ channel: 'what', data: [...whatindices ]});

                    for( var i = 0; i < resultingRegion.cells.length; i++){
                        messages.push({ channel: 'control-surface', data: [resultingRegion.cells[i].x, resultingRegion.cells[i].y, colours[regionIndex] ] });
                    }

                    var unusedCells = resultingRegion.removedCells;
                    for ( var i = 0; i < unusedCells.length; i++){
                        messages.push({ channel: 'control-surface', data: [ unusedCells[i].x, unusedCells[i].y, 'black']});
                    }
                    resultingRegion.removedCells = [];

                    var pitchModes = this.seq.sequences[regionIndex].getPitchModes();
                    messages.push({ channel: 'loopMode', data: pitchModes.loopMode });
                    messages.push({ channel: 'resetMode', data: pitchModes.resetMode });
                    messages.push({ channel: 'endBehavior', data: pitchModes.endBehavior });

                    // Send initial probability values (all notes default to probability 1)
                    var probs = this.seq.sequences[regionIndex].getProbabilities();
                    messages.push({ channel: 'prob', data: [...probs] });

                    // Send subdivision/tuplet mode to restart the voice rate
                    var subdivisionMode = this.seq.sequences[regionIndex].getSubdivisionMode();
                    // Tuplet modes end with _TUPLET
                    if(subdivisionMode.indexOf('_TUPLET') !== -1){
                        messages.push({ channel: 'tuplet', data: subdivisionMode });
                    } else {
                        messages.push({ channel: 'subdivision', data: subdivisionMode });
                    }

                    // Notify formachron that this sequence is now selected (updates scene buttons)
                    messages.push({channel: 'sequence_selected', data: regionIndex});
                }

                // Sync grid state to dict for Max LED rendering
                this.syncGridToDict();

                return messages;

            }
        }

        if(this.mode === 2){ // select mode
            var c = this.padsDown[0];
            var messages = [];

            // Find which region contains this cell
            for(var i = 0; i < this.grid.regions.length; i++){
                // Skip null entries from removed regions
                if(this.grid.regions[i] && this.grid.regions[i].containsCell(c)){
                    this.selectedSequence = i;
                    this.selectedCell = c;
                    console.log('Selected sequence: ' + i + ', cell: (' + c.x + ', ' + c.y + ')');

                    // Send visual feedback: flash the selected cell white
                    messages.push({channel: 'control-surface', data: [c.x, c.y, 'white']});

                    // Notify formachron that sequence was selected
                    messages.push({channel: 'sequence_selected', data: i});

                    this.clear();
                    return messages;
                }
            }

            // No region found at this cell - deselect
            console.log('No region found - deselecting');
            this.selectedSequence = null;
            this.selectedCell = null;
            this.clear();
            return messages;
        }

        if(this.mode === 1){ // shift mode
            var messages = [];
            var c = this.padsDown[0];
            for(var i = 0; i < this.grid.regions.length; i++){
                console.log('checking grid for cell');
                // Skip null entries from removed regions
                if(this.grid.regions[i] && this.grid.regions[i].containsCell(c)){
                    var shift = this.grid.regions[i].cellIndex(c);

                    const regionIndex = i;
                    messages.push({channel: 'setVoice', data: regionIndex});
                    messages.push({ channel: 'phaseOffset', data: shift});
                    console.log("the shift is: " + shift);
                    /*
                    Max.outlet( 'setVoice', i );
                    Max.outlet( 'phaseShift', phaseshift );

                    // send out shift index
                    let vec = sequences[i].getVector();
                    Max.outlet('sequenceBeats', vec.length);
                    let sum = 0; 
                    for( let k = 0; k < vec.length; k++){
                        sum += vec[k];
                    }
                    Max.outlet('sequenceEvents');
                    */
                    this.clear();
                    return messages;
                }
            }
        }
        if(this.mode === 3){ // mute mode
            var c = this.padsDown[0];
            var messages = [];
            for( var i = 0; i < this.grid.regions.length; i++){
                // Skip null entries from removed regions
                if(this.grid.regions[i] && this.grid.regions[i].containsCell(c)){

                    let index = this.grid.regions[i].cellIndex( c ) ;
                if( this.seq.sequences[i].getProbability( index ) === 0 ){
                        this.seq.sequences[i].setProbability( index, 1 );
                    }else{
                        this.seq.sequences[i].setProbability( index, 0 );
                    }
                    var probs = this.seq.sequences[i].getProbabilities();
                    const muteindex = i;
                    messages.push({channel: 'setVoice', data: muteindex});
                    messages.push({channel: 'prob', data: [...probs]});
                    
                    this.clear();// 

                    return messages;
                }
            }
        }
        if(this.mode === 4){ // remove mode
            var c = this.padsDown[0];
            var messages = [];

            // Check if we have a valid cell
            if(!c){
                this.clear();
                return messages;
            }

            // Find which region contains this cell
            var regionToRemove = null;
            var regionIndex = -1;
            for(var i = 0; i < this.grid.regions.length; i++){
                // Skip null entries from removed regions
                if(this.grid.regions[i] && this.grid.regions[i].containsCell(c)){
                    regionToRemove = this.grid.regions[i];
                    regionIndex = i;
                    break;
                }
            }

            if(regionToRemove !== null){
                // Clear LEDs for all cells in the region
                for(var i = 0; i < regionToRemove.cells.length; i++){
                    messages.push({channel: 'control-surface', data: [regionToRemove.cells[i].x, regionToRemove.cells[i].y, 'black']});
                }

                // Remove from grid and sequencer
                this.grid.removeRegion(regionToRemove);
                this.seq.remove(regionIndex);

                // Tell Max to clear this voice
                messages.push({channel: 'setVoice', data: regionIndex});
                messages.push({channel: 'clearVoice', data: []});

                // Handle selected sequence if the deleted region was selected
                if(this.selectedSequence === regionIndex){
                    // Find first non-null sequence to select
                    var newSelection = null;
                    for(var j = 0; j < this.seq.sequences.length; j++){
                        if(this.seq.sequences[j] !== null && this.seq.sequences[j] !== undefined){
                            newSelection = j;
                            break;
                        }
                    }
                    this.selectedSequence = newSelection;
                    this.selectedCell = null;
                    // post('Deleted selected sequence, new selection: ' + newSelection + '\n');

                    // Notify formachron to update scene buttons
                    if(newSelection !== null){
                        messages.push({channel: 'sequence_selected', data: newSelection});
                    } else {
                        messages.push({channel: 'sequence_deselected', data: null});
                    }
                }

                // Sync grid state to dict for Max LED rendering
                this.syncGridToDict();
            }

            this.clear();
            return messages;
        }
        if(this.mode === 5){ // move mode
            var messages = [];

            // Need exactly 2 touches
            if(this.padsDown.length !== 2){
                return messages;
            }

            var firstCell = this.padsDown[0];
            var secondCell = this.padsDown[1];

            // Find which region contains the first cell
            var regionToMove = null;
            var regionIndex = -1;
            for(var i = 0; i < this.grid.regions.length; i++){
                if(this.grid.regions[i] && this.grid.regions[i].containsCell(firstCell)){
                    regionToMove = this.grid.regions[i];
                    regionIndex = i;
                    break;
                }
            }

            // No region found at first touch
            if(regionToMove === null){
                this.clear();
                return messages;
            }

            // Store old cell positions for clearing LEDs (only if move succeeds)
            var oldCells = [];
            for(var i = 0; i < regionToMove.cells.length; i++){
                oldCells.push({x: regionToMove.cells[i].x, y: regionToMove.cells[i].y});
            }

            // Calculate new origin based on which cell was touched
            var offsetX = firstCell.x - regionToMove.bottomLeft.x;
            var offsetY = firstCell.y - regionToMove.bottomLeft.y;
            var newOrigin = {x: secondCell.x - offsetX, y: secondCell.y - offsetY};

            // Attempt to move
            var success = this.grid.moveRegion(regionToMove, newOrigin);

            if(success){
                post('Region moved successfully');

                // Clear LEDs at old position
                for(var i = 0; i < oldCells.length; i++){
                    messages.push({channel: 'control-surface', data: [oldCells[i].x, oldCells[i].y, 'black']});
                }

                // Light LEDs at new position
                for(var i = 0; i < regionToMove.cells.length; i++){
                    messages.push({channel: 'control-surface', data: [regionToMove.cells[i].x, regionToMove.cells[i].y, colours[regionIndex]]});
                }

                // Sync grid state to dict for Max LED rendering
                this.syncGridToDict();
            } else {
                post('Cannot move region: out of bounds or overlaps');
            }

            this.clear();
            return messages;
        }
    }

    modifyRegionSequence(index, vector){
        /// TODO do the work
    }

    sync(voiceNumber, sequenceIndex){
        var messages = [];

        // Check if voice has been removed
        if( voiceNumber >= this.seq.sequences.length || this.seq.sequences[voiceNumber] === null ){
            console.log('sequence array out of bounds or null');
            return messages;
        }

        var r = this.grid.regions[voiceNumber];
        if( r === null ){
            console.log('region is null');
            return messages;
        }

        this.seq.sequences[voiceNumber].setStep( sequenceIndex );

        // Check if this voice has a pending modification
        var hasPendingMod = this.pendingModifications.has(voiceNumber);
        var pendingMod = hasPendingMod ? this.pendingModifications.get(voiceNumber) : null;

        if( sequenceIndex === 0 ){
            if( r.shouldCompute ){
                r.compute();
                console.log('region should compute');
            }

            // Apply pending modification at step 0
            if(hasPendingMod){
                console.log('Applying pending modification for voice ' + voiceNumber);

                // Send Gen~ messages to apply the new pattern
                var regionVector = r.toVector();
                messages.push({channel: 'setVoice', data: voiceNumber});
                messages.push({channel: 'createSequence', data: [...regionVector]});

                var whatindices = this.seq.sequences[voiceNumber].getMatches();
                messages.push({ channel: 'what', data: [...whatindices]});

                // Send normal colors for the new pattern
                for(var i = 0; i < r.cells.length; i++){
                    messages.push({
                        channel: 'control-surface',
                        data: [r.cells[i].x, r.cells[i].y, colours[voiceNumber]]
                    });
                }

                // Clear any cells that were in old pattern but not in new
                var newCellsSet = new Set();
                for(var i = 0; i < r.cells.length; i++){
                    newCellsSet.add(r.cells[i].x + ',' + r.cells[i].y);
                }
                for(var i = 0; i < pendingMod.oldCells.length; i++){
                    var cellKey = pendingMod.oldCells[i].x + ',' + pendingMod.oldCells[i].y;
                    if(!newCellsSet.has(cellKey)){
                        // This cell was removed - turn it black
                        messages.push({
                            channel: 'control-surface',
                            data: [pendingMod.oldCells[i].x, pendingMod.oldCells[i].y, 'black']
                        });
                    }
                }

                var pitchModes = this.seq.sequences[voiceNumber].getPitchModes();
                messages.push({ channel: 'loopMode', data: pitchModes.loopMode });
                messages.push({ channel: 'resetMode', data: pitchModes.resetMode });
                messages.push({ channel: 'endBehavior', data: pitchModes.endBehavior });

                var probs = this.seq.sequences[voiceNumber].getProbabilities();
                messages.push({ channel: 'prob', data: [...probs] });

                var subdivisionMode = this.seq.sequences[voiceNumber].getSubdivisionMode();
                if(subdivisionMode.indexOf('_TUPLET') !== -1){
                    messages.push({ channel: 'tuplet', data: subdivisionMode });
                } else {
                    messages.push({ channel: 'subdivision', data: subdivisionMode });
                }

                // Clear the pending modification
                this.pendingModifications.delete(voiceNumber);
                pendingMod = null;
                hasPendingMod = false;
            }
        }

        // Use cached cells for playhead if pending modification exists
        var cellsToUse = hasPendingMod ? pendingMod.oldCells : r.cells;
        var previousStep = this.seq.sequences[voiceNumber].getPreviousStep();

        // Safety check: ensure cells exist at the requested indices
        if(!cellsToUse[sequenceIndex]){
            post('Mediator.sync: ERROR - No cell at sequenceIndex ' + sequenceIndex + ' for voice ' + voiceNumber + '\n');
            return messages;
        }

        if(!cellsToUse[previousStep]){
            post('Mediator.sync: ERROR - No cell at previousStep ' + previousStep + ' for voice ' + voiceNumber + '\n');
            return messages;
        }

        // Restore previous cell and flash current cell
        if(hasPendingMod){
            // Use pendingColor from cached cell for previous step
            messages.push({
                channel: 'control-surface',
                data: [cellsToUse[previousStep].x, cellsToUse[previousStep].y, cellsToUse[previousStep].pendingColor]
            });
            // Flash current cell white
            messages.push({
                channel: 'control-surface',
                data: [cellsToUse[sequenceIndex].x, cellsToUse[sequenceIndex].y, 'white']
            });
        } else {
            // Normal operation - restore to voice color
            messages.push({
                channel: 'control-surface',
                data: [r.cells[previousStep].x, r.cells[previousStep].y, colours[voiceNumber]]
            });
            // Flash current cell white
            messages.push({
                channel: 'control-surface',
                data: [r.cells[sequenceIndex].x, r.cells[sequenceIndex].y, 'white']
            });
        }

        return messages;
    }

    setMode ( m ){
        this.mode = m;
    }	
    clear (){
        this.padsDown = [];
    }
    push ( c ){
        this.padsDown.push( c );
    }
}

// Ableton Push 1,2,3 colour mapping
function CellToPushNote(x, y, colour){
	var note = y*8 + x + 36;
	var outputcolour = 0;
	switch(colour){
		case 'white':
			outputcolour = 120;
			break;
		case 'red':
			outputcolour = 127;
			break;
		case 'orange':
			outputcolour = 3;
			break;
		case 'yellow':
			outputcolour = 7;
			break;
		case 'green':
			outputcolour = 126;
			break;
		case 'cyan':
			outputcolour = 14;
			break;
		case 'blue':
			outputcolour = 125;
			break;
		case 'purple':
			outputcolour = 20;
			break;
		case 'pink':
			outputcolour = 21;
			break;
		default:
			outputcolour = 0;
			break;
	}

	return( [note, outputcolour] );
}

// Write sequence to Ableton MIDI clip
Mediator.prototype.writeClip = function(voiceIndex, trackName, clipSlotIndex) {
	// Validate sequence exists
	if(voiceIndex < 0 || voiceIndex >= this.seq.sequences.length ||
	   this.seq.sequences[voiceIndex] === null || this.seq.sequences[voiceIndex] === undefined) {
		post("Mediator.writeClip: No sequence at voice " + voiceIndex + "\n");
		return false;
	}

	var sequence = this.seq.sequences[voiceIndex];

	// Expand clips array with nulls if needed
	while(this.clipManager.clips.length <= voiceIndex) {
		this.clipManager.clips.push(null);
	}

	// Check if clip already exists for this voice
	var clip = this.clipManager.clips[voiceIndex];

	if(clip === null) {
		// Create new clip object
		clip = new Clip(trackName, clipSlotIndex);
		this.clipManager.clips[voiceIndex] = clip;
	} else {
		// Update existing clip's target location (user might want different track/slot)
		clip.trackName = trackName;
		clip.clipSlotIndex = clipSlotIndex;
	}

	// Write sequence to clip
	return clip.write(sequence);
};

module.exports = Mediator;
