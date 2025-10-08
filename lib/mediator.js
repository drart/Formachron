const Region = require('./region.js');
const Sequence = require('./sequence.js');

var colours = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'indigo', 'violet'];
var colourNumbers = [127, 3, 13, 21, 33, 45, 49];

const MAX_VOICES = 8;

class Mediator {
    constructor( g , s){
        this.mode = 0; // input, select, shift, mute, move regions
        this.padsDown = [];
        this.grid = g; // reference to the main grid
        this.seq = s; //
        this.addMode = 'sync'; // or 'immediate'
        this.selectedSequence = null; // index of currently selected sequence
        this.selectedCell = null; // selected cell within the sequence
    }

    input( c ){ // bug? c is often called with undefined -- todo check is if this is still the case
        //console.log( "sync input is: " + c );

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

                var resultingRegion;
                if( this.addMode === 'sync' ) { 
                    resultingRegion = this.grid.addRegion(r);
                    //resultingRegion = this.grid.tryAddRegion(r);
                }else{
                    resultingRegion = this.grid.addRegion(r);
                }

                console.log('region added ' + resultingRegion.cells.length + ' cells long');
                var regionVector = resultingRegion.toVector();
                var regionIndex = this.grid.getRegionIndex(resultingRegion);

                // Check if sequence already exists (modification) or needs to be created (new region)
                var sequenceIndex;
                if(this.seq.sequences[regionIndex] !== null && this.seq.sequences[regionIndex] !== undefined){
                    // Existing sequence - update it
                    console.log('modifying existing sequence at index ' + regionIndex);
                    this.seq.sequences[regionIndex].setVector( regionVector );
                    sequenceIndex = regionIndex;
                } else {
                    // New sequence - create it
                    console.log('creating new sequence');
                    var newSequence = new Sequence();
                    newSequence.setVector( regionVector );
                    sequenceIndex = this.seq.add( newSequence );

                    // Verify grid and sequencer indices match
                    if(regionIndex !== sequenceIndex){
                        console.log('ERROR: Region index ' + regionIndex + ' does not match sequence index ' + sequenceIndex);

                        // Clean up - remove what we just added
                        this.grid.removeRegion(resultingRegion);
                        this.seq.remove(sequenceIndex);

                        return messages; // Return empty messages array, abort the operation
                    }

                    // Set new sequence as selected
                    this.selectedSequence = sequenceIndex;
                    this.selectedCell = resultingRegion.cells[0]; // Select first cell of new region
                }

                messages.push({channel: 'setVoice', data: regionIndex});
                messages.push({channel: 'createSequence', data: [...regionVector ]});

                var whatindices = this.seq.sequences[regionIndex].getMatches();
                messages.push({ channel: 'what', data: [...whatindices ]});

                for( var i = 0; i < resultingRegion.cells.length; i++){
                    var currentNote = CellToPushNote( resultingRegion.cells[i].x, resultingRegion.cells[i].y, colours[regionIndex]);
                    messages.push({ channel: 'midi-output', data: [144, currentNote[0], currentNote[1] ]});
                    messages.push({ channel: 'control-surface', data: [resultingRegion.cells[i].x, resultingRegion.cells[i].y, colourNumbers[regionIndex] ] }); 
                }

                var unusedCells = resultingRegion.removedCells;
                for ( var i = 0; i < unusedCells.length; i++){
                    var currentNote = CellToPushNote( unusedCells[i].x, unusedCells[i].y, 0);
                    messages.push({ channel: 'midi-output', data: [144, currentNote[0], 0 ]});
                    messages.push({ channel: 'control-surface', data: [ unusedCells[i].x, unusedCells[i].y, 0]});
                }
                resultingRegion.removedCells = [];

                var pitchModes = this.seq.sequences[regionIndex].getPitchModes();
                messages.push({ channel: 'loopMode', data: pitchModes.loopMode });
                messages.push({ channel: 'resetMode', data: pitchModes.resetMode });
                messages.push({ channel: 'endBehavior', data: pitchModes.endBehavior });

                // Notify formachron that this sequence is now selected (updates scene buttons)
                messages.push({channel: 'sequence_selected', data: regionIndex});

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
                    var currentNote = CellToPushNote(c.x, c.y, 'white');
                    messages.push({channel: 'midi-output', data: [144, currentNote[0], currentNote[1]]});
                    messages.push({channel: 'control-surface', data: [c.x, c.y, 1]});

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
                    var currentNote = CellToPushNote(regionToRemove.cells[i].x, regionToRemove.cells[i].y, 0);
                    messages.push({channel: 'midi-output', data: [144, currentNote[0], 0]});
                    messages.push({channel: 'control-surface', data: [regionToRemove.cells[i].x, regionToRemove.cells[i].y, 0]});
                }

                // Remove from grid and sequencer
                this.grid.removeRegion(regionToRemove);
                this.seq.remove(regionIndex);

                // Tell Max to clear this voice's what~ thresholds
                messages.push({channel: 'setVoice', data: regionIndex});
                // NOTE: Sends empty array. Max patch routes 'what' and outputs bang when no data present,
                //       which triggers the 'clear' message to what~
                // TODO: Future option - send 'clear' symbol directly: {channel: 'what', data: 'clear'}
                messages.push({channel: 'what', data: []});

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
                    var currentNote = CellToPushNote(oldCells[i].x, oldCells[i].y, 0);
                    messages.push({channel: 'midi-output', data: [144, currentNote[0], 0]});
                    messages.push({channel: 'control-surface', data: [oldCells[i].x, oldCells[i].y, 0]});
                }

                // Light LEDs at new position
                for(var i = 0; i < regionToMove.cells.length; i++){
                    var currentNote = CellToPushNote(regionToMove.cells[i].x, regionToMove.cells[i].y, colours[regionIndex]);
                    messages.push({channel: 'midi-output', data: [144, currentNote[0], currentNote[1]]});
                    messages.push({channel: 'control-surface', data: [regionToMove.cells[i].x, regionToMove.cells[i].y, colourNumbers[regionIndex]]});
                }
            } else {
                post('Cannot move region: out of bounds or overlaps');
            }

            this.clear();
            return messages;
        }
    }

    modifyRegionSequence(index, vector){
        /// do the work
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

        if( sequenceIndex === 0 ){
            if( r.shouldCompute ){
                r.compute();
                console.log('region should compute');
            }
        }

        // Safety check: ensure cells exist at the requested indices
        if(!r.cells[sequenceIndex]){
            post('Mediator.sync: ERROR - No cell at sequenceIndex ' + sequenceIndex + ' for voice ' + voiceNumber + '\n');
            return messages;
        }

        var currentNote = CellToPushNote( r.cells[sequenceIndex].x, r.cells[sequenceIndex].y, 'white');
        var previousStep = this.seq.sequences[voiceNumber].getPreviousStep();

        // Safety check: ensure previous step cell exists
        if(!r.cells[previousStep]){
            post('Mediator.sync: ERROR - No cell at previousStep ' + previousStep + ' for voice ' + voiceNumber + '\n');
            return messages;
        }

        var previousNote = CellToPushNote( r.cells[ previousStep ].x,  r.cells[ previousStep ].y, colours[voiceNumber] );

        messages.push({ channel: 'midi-output', data: [144, currentNote[0], currentNote[1] ]});
        messages.push({ channel: 'midi-output', data: [144, previousNote[0], previousNote[1] ]});

        return messages;
    }

    syncControlSurface(voiceNumber, sequenceIndex){
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

        if( sequenceIndex === 0 ){
            if( r.shouldCompute ){
                r.compute();
                console.log('region should compute');
            }
        }

        var previousStep = this.seq.sequences[voiceNumber].getPreviousStep();
        console.log("previous step is: " +  previousStep );
        console.log("current step is: " +  sequenceIndex );

        // Safety check: ensure cells exist at the requested indices
        if(!r.cells[sequenceIndex]){
            post('Mediator.syncControlSurface: ERROR - No cell at sequenceIndex ' + sequenceIndex + ' for voice ' + voiceNumber + '\n');
            return messages;
        }

        if(!r.cells[previousStep]){
            post('Mediator.syncControlSurface: ERROR - No cell at previousStep ' + previousStep + ' for voice ' + voiceNumber + '\n');
            return messages;
        }

        messages.push({ channel: 'control-surface', data: [ r.cells[previousStep].x,  r.cells[previousStep].y, colourNumbers[voiceNumber]] });
        messages.push({ channel: 'control-surface', data: [ r.cells[sequenceIndex].x,  r.cells[sequenceIndex].y, 1] });
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
	var outputcolour = 3;
	switch(colour){
		case 'white':
			outputcolour = 3;
			break;
		case 'red': 
			outputcolour = 127;
			break;
		case 'orange':
			outputcolour = 3;
			break;
		case 'yellow':
			outputcolour = 13;
			break;
		case 'green':
			outputcolour = 21;
			break;
		case 'cyan':
			outputcolour = 33;
		case 'blue':
			outputcolour = 45;
			break;
		case 'indigo':
			outputcolour = 49;
		default:
			break;
	}
	
	return( [note, outputcolour] );
}

module.exports = Mediator;
