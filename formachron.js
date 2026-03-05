const Cell = require ( './lib/cell.js');
const Region = require ('./lib/region.js');
const Grid = require('./lib/grid.js');
const Sequence = require ('./lib/sequence.js');
const Sequencer = require('./lib/sequencer.js');

const InputManager = require('./lib/inputmanager.js');
const Mediator = require('./lib/mediator.js');
const OutputManager = require('./lib/outputmanager.js');

// Hardware profiles
const Push3 = require('./lib/hardware/push3.js');
const Push1 = require('./lib/hardware/push1.js');
const Launchpad = require('./lib/hardware/launchpad.js');

var thegrid = new Grid();
var sequencer = new Sequencer();

var input = new InputManager();
var mediator = new Mediator( thegrid , sequencer);
var output = new OutputManager( thegrid );

// Hardware profile and colors (will be set when hardware type is received)
var hardwareProfile = Launchpad;  // Default to Launchpad
var defaultScheme = hardwareProfile.getVoiceColors(8);
var colourNumbers = defaultScheme.voiceColors;
mediator.setColors(defaultScheme.colorNames);


// Sequence mode tracking
var sequenceModes = [
	"QUARTER",
	"QUARTER_TUPLET",
	"EIGHTH",
	"EIGHTH_TUPLET",
	"SIXTEENTH",
	"SIXTEENTH_TUPLET",  // default (button 5)
	"THIRTYSECOND",
	"THIRTYSECOND_TUPLET"
];
var currentSequenceMode = 5;  // Default to SIXTEENTH_TUPLET

// Helper function: translate color name to hardware-specific value
function colorNameToValue(colorName){
	// Handle dimmed colors (pending modification feedback)
	if(colorName.indexOf('dimmed_') === 0){
		var baseName = colorName.substring(7);  // Remove 'dimmed_' prefix
		if(hardwareProfile.dimmedColors && hardwareProfile.dimmedColors[baseName] !== undefined){
			return hardwareProfile.dimmedColors[baseName];
		}
		// Fallback to normal color if dimmed version not defined
		if(hardwareProfile.colors && hardwareProfile.colors[baseName] !== undefined){
			return hardwareProfile.colors[baseName];
		}
		return 0;
	}

	// Handle pending delete (use dimmed red)
	if(colorName === 'pending_delete'){
		if(hardwareProfile.dimmedColors && hardwareProfile.dimmedColors.red !== undefined){
			return hardwareProfile.dimmedColors.red;
		}
		if(hardwareProfile.colors && hardwareProfile.colors.red !== undefined){
			return hardwareProfile.colors.red;
		}
		return 0;
	}

	// Normal colors
	if(hardwareProfile && hardwareProfile.colors && hardwareProfile.colors[colorName] !== undefined){
		return hardwareProfile.colors[colorName];
	}

	// Fallback to 0 if color not found
	return 0;
}

// Helper function: process mediator messages and translate colors
function processMessage(msg){
	if(msg.channel === 'control-surface'){
		// control-surface messages: [x, y, colorName]
		// Translate color name (3rd element) to hardware value
		var x = msg.data[0];
		var y = msg.data[1];
		var colorName = msg.data[2];
		var colorValue = colorNameToValue(colorName);
		post("control-surface: x=" + x + " y=" + y + " color=" + colorName + " value=" + colorValue + "\n");
		outlet(0, 'control-surface', x, y, colorValue);
	} else {
		// All other messages pass through unchanged
		outlet(0, msg.channel, msg.data);
	}
}


// get midi input
function note (n,v){

	var newcell = input.input( n, v );
    if( newcell === undefined){
        return;
    }
	if ( newcell === null ){
		var messages = mediator.input();

        if( messages === undefined ){
            return;
        }

        for(var i = 0; i < messages.length; i++){
            processMessage(messages[i]);
        }
	}else{
		mediator.push( newcell );
	}
}


function cell(x, y, v){
	var newcell = input.cellInput(x,y,v);
	if( newcell === undefined){
        return;
    }
	if ( newcell === null ){
		var messages = mediator.input();

        if( messages === undefined ){
            return;
        }

        for(var i = 0; i < messages.length; i++){
            // Handle sequence selection messages
            if(messages[i].channel === 'sequence_selected'){
                updateSceneButtonsForSelectedSequence(messages[i].data);
                // Send selectedSequence message to Max patch (zero-indexed: 0-7)
                outlet(0, 'selectedSequence', messages[i].data);
            } else if(messages[i].channel === 'sequence_deselected'){
                // post('No sequence selected\n');
            } else {
                processMessage(messages[i]);
            }
        }
	}else{
		mediator.push( newcell );
	}
}

/// get voice and index from sequencer and prepare MIDI for hardware display
function syncstep ( sequenceIndex, voiceNumber ) {
    var messages = mediator.sync( voiceNumber, sequenceIndex );
    for( var i = 0; i < messages.length; i++){
        processMessage(messages[i]);
    }
}

function mode (m){
	mediator.setMode( m );
}

function output_channel(channel){
	// post("output_channel " + channel + ": " + sequenceModes[channel] + "\n");

	// Update current sequence mode
	currentSequenceMode = channel;

	// Apply subdivision mode to selected sequence
	if(mediator.selectedSequence !== null && mediator.selectedSequence !== undefined){
		var seq = mediator.seq.sequences[mediator.selectedSequence];
		if(seq){
			seq.setSubdivisionMode(sequenceModes[channel]);
			// post("Sending setVoice " + mediator.selectedSequence + "\n");

			// Set voice and send subdivision mode
			outlet(0, 'setVoice', mediator.selectedSequence);

			// Send tuplet mode for tuplet buttons (1, 3, 5, 7)
			if(channel === 1 || channel === 3 || channel === 5 || channel === 7){
				// post("Sending tuplet " + sequenceModes[channel] + "\n");
				outlet(0, 'tuplet', sequenceModes[channel]);
			} else {
				// Send straight time mode for non-tuplet buttons (0, 2, 4, 6)
				outlet(0, 'subdivision', sequenceModes[channel]);
			}
		}
	}

	// Update button LEDs - highlight selected mode
	updateSequenceModeButtons();
}

function updateSequenceModeButtons(){
	// Send LED updates for all 8 Scene Launch buttons
	for(var i = 0; i < 8; i++){
		// 14 = Red Medium (selected), 13 = Red Low (unselected)
		// IMPORTANT: Value 10 has flash flag set and causes LEDs to blink
		var color = (i === currentSequenceMode) ? 14 : 13;
		outlet(0, 'scene-button', i, color);
	}
}

function updateSceneButtonsForSelectedSequence(sequenceIndex){
	// post("Updating scene buttons for sequence: " + sequenceIndex + "\n");

	if(sequenceIndex === null || sequenceIndex === undefined){
		return;
	}

	var seq = mediator.seq.sequences[sequenceIndex];
	if(seq){
		var mode = seq.getSubdivisionMode();
		// Find index of this mode in sequenceModes array
		var modeIndex = sequenceModes.indexOf(mode);
		if(modeIndex !== -1){
			currentSequenceMode = modeIndex;
			updateSequenceModeButtons();
			// post("Selected sequence has subdivision mode: " + mode + "\n");
		}
	}
}

// Receive hardware type from controlsurfacehandler and update color palette
function hardware(hwType){
	post("formachron: Received hardware type: " + hwType + "\n");

	// Load appropriate hardware profile
	if(hwType === "Push3"){
		hardwareProfile = Push3;
	} else if(hwType === "Push"){
		hardwareProfile = Push1;
	} else if(hwType === "Launchpad"){
		hardwareProfile = Launchpad;
	} else {
		post("formachron: Unknown hardware type, using default\n");
		return;
	}

	post("formachron: Using " + hardwareProfile.name + " color palette\n");

	// Get voice colors from hardware profile (8 voices)
	var colorScheme = hardwareProfile.getVoiceColors(8);
	colourNumbers = colorScheme.voiceColors;

	mediator.setColors(colorScheme.colorNames);
}

function device_selected(isSelected){
	//post("formachron: device_selected=" + isSelected);

	// When device is selected, redraw all regions
	if(isSelected === 1){
		for(var i = 0; i < thegrid.regions.length; i++){
			// Skip null entries from removed regions
			if(thegrid.regions[i]){
				var region = thegrid.regions[i];

				// Draw all cells in this region with its color
				for(var j = 0; j < region.cells.length; j++){
					outlet(0, 'control-surface', region.cells[j].x, region.cells[j].y, colourNumbers[i]);
				}
			}
		}

		// Light up Scene Launch buttons to show current sequence mode
		updateSequenceModeButtons();
	}
}

// Write sequence to Ableton MIDI clip
// Usage: writeClip(voiceIndex, trackName, clipSlotIndex)
// Example: writeClip(0, "MIDI", 0)
function writeClip(voiceIndex, trackName, clipSlotIndex) {
	post("formachron.writeClip: voice=" + voiceIndex + " track=" + trackName + " slot=" + clipSlotIndex + "\n");

	var success = mediator.writeClip(voiceIndex, trackName, clipSlotIndex);

	if(success) {
		post("formachron.writeClip: Success\n");
	} else {
		post("formachron.writeClip: Failed\n");
	}
}
