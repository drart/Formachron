// Control Surface Handler
// Manages control surface button claiming/releasing and outputs to Max patch
// Separate v8 object from formachron.js

const ControlSurface = require('./lib/controlsurface.js');

// Hardware profiles
const Push3 = require('./lib/hardware/push3.js');
const Push1 = require('./lib/hardware/push1.js');
const Launchpad = require('./lib/hardware/launchpad.js');

inlets = 1;
outlets = 2;

var controlSurface = null;
var hardwareProfile = null;
var thisDeviceId = null;
var thisDeviceTrackId = null;  // Which track is our device on?
var selectedTrackObserver = null;  // Observes track changes
var isDeviceSelected = false;
var availableSurfaces = [];  // Store list of available surfaces

// Utility to parse Live API object ID responses
function parseObjectIds(rawResponse) {
    if (rawResponse && rawResponse !== "5e-324" && rawResponse !== "") {
        var ids = [];
        var parts = String(rawResponse).split(',');
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === "id" && i + 1 < parts.length) {
                ids.push(parseInt(parts[i + 1]));
                i++;
            }
        }
        return ids;
    }
    return [];
}

// Initialize on bang
function bang(){
    post("ControlSurfaceHandler: Initializing...\n");

    // Query for available control surfaces
    var liveApp = new LiveAPI(null, 'live_app');
    var controlSurfaceCount = liveApp.getcount('control_surfaces');

    if(controlSurfaceCount === 0){
        post("ControlSurfaceHandler: No control surfaces found\n");
        return;
    }

    post("ControlSurfaceHandler: Found " + controlSurfaceCount + " control surface(s)\n");

    // Find all available control surfaces and check connectivity
    availableSurfaces = [];  // Reset module-level variable
    for(var i = 0; i < controlSurfaceCount; i++){
        var cs = new LiveAPI(null, "control_surfaces " + i);

        if(cs.id !== '0'){
            // Check if control surface is actually connected by trying to get controls
            var controlNames = cs.call("get_control_names");
            var hasControls = (controlNames && controlNames.length > 0);

            post("ControlSurfaceHandler: Surface " + i + ": " + cs.type +
                 " (id=" + cs.id + ", hasControls=" + hasControls + ")\n");

            if(hasControls){
                availableSurfaces.push({
                    index: i,
                    api: cs,
                    type: cs.type,
                    controlCount: controlNames.length
                });
            }
        }
    }

    if(availableSurfaces.length === 0){
        post("ControlSurfaceHandler: No connected control surfaces found\n");
        return;
    }

    // Log all available surfaces
    post("ControlSurfaceHandler: Found " + availableSurfaces.length + " connected surface(s):\n");
    for(var i = 0; i < availableSurfaces.length; i++){
        post("  [" + i + "] " + availableSurfaces[i].type +
             " (index " + availableSurfaces[i].index + ", " +
             availableSurfaces[i].controlCount + " controls)\n");
    }

    // Prefer Push 3 > Push 1 > other surfaces
    var selectedSurface = null;
    for(var i = 0; i < availableSurfaces.length; i++){
        if(availableSurfaces[i].type === "Push3"){
            selectedSurface = availableSurfaces[i];
            post("ControlSurfaceHandler: Selected Push 3 (preferred)\n");
            break;
        }
    }

    if(!selectedSurface){
        for(var i = 0; i < availableSurfaces.length; i++){
            if(availableSurfaces[i].type === "Push"){
                selectedSurface = availableSurfaces[i];
                post("ControlSurfaceHandler: Selected Push 1 (preferred)\n");
                break;
            }
        }
    }

    // Fall back to first available surface if no Push found
    if(!selectedSurface){
        selectedSurface = availableSurfaces[0];
        post("ControlSurfaceHandler: Selected " + selectedSurface.type + " (first available)\n");
    }

    var controlSurfaceAPI = selectedSurface.api;

    // Create ControlSurface wrapper
    controlSurface = new ControlSurface(controlSurfaceAPI);

    // Detect hardware type and load appropriate profile
    var csType = controlSurfaceAPI.type;
    post("ControlSurfaceHandler: Control surface type: " + csType + "\n");

    if(csType === "Push3"){
        hardwareProfile = Push3;
    } else if(csType === "Push"){
        hardwareProfile = Push1;
    } else if(csType === "Launchpad"){
        hardwareProfile = Launchpad;
    } else {
        post("ControlSurfaceHandler: Unknown control surface type, defaulting to Push 3\n");
        hardwareProfile = Push3;
    }

    post("ControlSurfaceHandler: Using hardware profile: " + hardwareProfile.name + "\n");

    // Notify formachron about hardware type
    outlet(0, "hardware", hardwareProfile.type);

    // Log available controls for debugging
    post("ControlSurfaceHandler: Available controls:\n");
    var names = controlSurface.getControlNames();
    for(var i = 0; i < names.length; i++){
        post("  " + names[i] + "\n");
    }

    // Setup button mappings FIRST (before observers)
    setupButtons();

    // Setup device selection monitoring (observer will fire immediately)
    setupDeviceSelection();

    post("ControlSurfaceHandler: Initialization complete\n");
}

function setupDeviceSelection(){
    // Get this device's ID and find which track it's on
    var thisDevice = new LiveAPI(null, "this_device");
    thisDeviceId = parseInt(thisDevice.id);

    var canonicalParent = thisDevice.get("canonical_parent");
    var trackIds = parseObjectIds(canonicalParent);
    if(trackIds.length > 0){
        thisDeviceTrackId = trackIds[0];
        post("ControlSurfaceHandler: This device ID: " + thisDeviceId + ", on track ID: " + thisDeviceTrackId + "\n");
    } else {
        post("ControlSurfaceHandler: Could not determine device's track\n");
        return;
    }

    // Watch selected_track - when it changes, check if it's our track
    selectedTrackObserver = new LiveAPI(trackChangeCallback, "live_set view");
    selectedTrackObserver.property = "selected_track";
    post("ControlSurfaceHandler: Track observer established\n");
}

function checkAndUpdateSelection(){
    if(!controlSurface || thisDeviceTrackId === null){
        return;
    }

    // Get the currently selected track
    var liveSetView = new LiveAPI(null, "live_set view");
    var currentSelectedTrack = liveSetView.get("selected_track");
    var trackIds = parseObjectIds(currentSelectedTrack);

    if(trackIds.length === 0){
        return;
    }

    var selectedTrackId = trackIds[0];
    var newIsSelected = (selectedTrackId === thisDeviceTrackId);

    post("ControlSurfaceHandler: Selected track ID: " + selectedTrackId + ", our track ID: " + thisDeviceTrackId + " -> " + (newIsSelected ? "SELECTED" : "NOT SELECTED") + "\n");

    // Only update if state changed
    if(newIsSelected !== isDeviceSelected){
        isDeviceSelected = newIsSelected;
        controlSurface.onDeviceSelectionChange(isDeviceSelected);

        var selectedValue = isDeviceSelected ? 1 : 0;
        var t = new Task(function(){
            outlet(0, "device_selected", selectedValue);
        });
        t.schedule(100);
    }
}

function trackChangeCallback(args){
    post("ControlSurfaceHandler: Track changed\n");
    checkAndUpdateSelection();
}


function setupButtons(){
    if(!controlSurface || !hardwareProfile){
        post("ControlSurfaceHandler: No control surface or hardware profile available\n");
        return;
    }

    // Mode buttons - always active, don't release on deselect
    // Callbacks receive full args array: ["value", velocity, ...]

    // New Button → Mode 0 (default/entry mode)
    if(hardwareProfile.controls.mode_new){
        controlSurface.claimControl(hardwareProfile.controls.mode_new, function(args){
            if(args.length > 1 && args[1] > 0){
                outlet(0, "mode", 0);
            }
        }, {
            mode: "observe",
            requireSelection: false,
            releaseOnDeselect: false
        });
    }

    // Shift Button → Mode 1 (phase shift)
    if(hardwareProfile.controls.mode_shift){
        controlSurface.claimControl(hardwareProfile.controls.mode_shift, function(args){
            if(args.length > 1 && args[1] > 0){
                outlet(0, "mode", 1);
            }
        }, {
            mode: "observe",
            requireSelection: false,
            releaseOnDeselect: false
        });
    }

    // Mute Button → Mode 3 (mute notes)
    if(hardwareProfile.controls.mode_mute){
        controlSurface.claimControl(hardwareProfile.controls.mode_mute, function(args){
            if(args.length > 1 && args[1] > 0){
                outlet(0, "mode", 3);
            }
        }, {
            mode: "observe",
            requireSelection: false,
            releaseOnDeselect: false
        });
    }

    // Delete Button → Mode 4 (remove region)
    if(hardwareProfile.controls.mode_delete){
        controlSurface.claimControl(hardwareProfile.controls.mode_delete, function(args){
            if(args.length > 1 && args[1] > 0){
                outlet(0, "mode", 4);
            }
        }, {
            mode: "observe",
            requireSelection: false,
            releaseOnDeselect: false
        });
    }

    // Select Button → Mode 2 (select sequence/cell)
    if(hardwareProfile.controls.mode_select){
        controlSurface.claimControl(hardwareProfile.controls.mode_select, function(args){
            if(args.length > 1 && args[1] > 0){
                outlet(0, "mode", 2);
            }
        }, {
            mode: "observe",
            requireSelection: false,
            releaseOnDeselect: false
        });
    }

    // Convert Button → Mode 5 (move region)
    if(hardwareProfile.controls.mode_convert){
        controlSurface.claimControl(hardwareProfile.controls.mode_convert, function(args){
            if(args.length > 1 && args[1] > 0){
                outlet(0, "mode", 5);
            }
        }, {
            mode: "observe",
            requireSelection: false,
            releaseOnDeselect: false
        });
    }

    // Subdivision Buttons (0-7) - map to output channels
    for(var i = 0; i < 8; i++){
        (function(index){
            var buttonName = hardwareProfile.controls.subdivision(index);
            if(buttonName){
                controlSurface.claimControl(buttonName, function(args){
                    if(args.length > 1 && args[1] > 0){
                        outlet(0, "output_channel", index);
                    }
                }, {
                    mode: "grab",
                    requireSelection: true,
                    releaseOnDeselect: true
                });
            }
        })(i);
    }

    // Button Matrix - grab when device selected, release when deselected
    if(hardwareProfile.controls.button_matrix){
        controlSurface.claimControl(hardwareProfile.controls.button_matrix, function(args){
            // args format: ["value", velocity, x, y, 1]
            // velocity: 0 for release, >0 for press
            // x, y: 0-7 grid coordinates
            // last arg: always 1 (purpose unknown)
            if(args.length >= 5){
                var velocity = args[1];
                var x = args[2];
                var y = args[3];

                // Normalize velocity to 0 or 1 for formachron
                var normalizedVelocity = (velocity > 0) ? 1 : 0;

                // Send cell message to formachron: cell x y (0|1)
                outlet(0, "cell", x, y, normalizedVelocity);
            }
        }, {
            mode: "grab",
            requireSelection: true,
            releaseOnDeselect: true
        });
    }
}

// Handle incoming messages from formachron (LED updates, etc.)
function anything(){
    var messageName = messagename;
    var args = arrayfromargs(arguments);

    if(messageName === "control-surface"){
        // args: [x, y, colorNumber]
        if(args.length >= 3 && controlSurface && hardwareProfile){
            var x = args[0];
            var y = args[1];
            var colorNumber = args[2];

            // Only send to hardware when device is selected
            if(isDeviceSelected && hardwareProfile.controls.button_matrix){
                controlSurface.sendValue(hardwareProfile.controls.button_matrix, x, y, colorNumber);
            }
        }
    }

    if(messageName === "scene-button"){
        // args: [buttonIndex, colorNumber]
        if(args.length >= 2 && controlSurface && hardwareProfile){
            var buttonIndex = args[0];
            var colorNumber = args[1];

            // Only send to hardware when device is selected
            if(isDeviceSelected){
                var buttonName = hardwareProfile.controls.subdivision(buttonIndex);
                if(buttonName){
                    controlSurface.sendValue(buttonName, colorNumber);
                }
            }
        }
    }
}

// List all available control surfaces
function listsurfaces(){
    if(availableSurfaces.length === 0){
        post("ControlSurfaceHandler: No control surfaces detected\n");
        post("  Run 'bang' to scan for control surfaces\n");
        return;
    }

    post("ControlSurfaceHandler: Available control surfaces:\n");
    for(var i = 0; i < availableSurfaces.length; i++){
        var marker = "";
        if(controlSurface && availableSurfaces[i].api.id === controlSurface.controlSurface.id){
            marker = " [CURRENT]";
        }
        post("  [" + i + "] " + availableSurfaces[i].type +
             " (Live index " + availableSurfaces[i].index + ", " +
             availableSurfaces[i].controlCount + " controls)" + marker + "\n");
    }
    post("\nTo select a surface, send: selectsurface <number>\n");
}

// Manually select a control surface by array index
function selectsurface(index){
    if(availableSurfaces.length === 0){
        post("ControlSurfaceHandler: No surfaces available. Run 'bang' first.\n");
        return;
    }

    if(index < 0 || index >= availableSurfaces.length){
        post("ControlSurfaceHandler: Invalid index " + index + ". Valid range: 0-" + (availableSurfaces.length - 1) + "\n");
        return;
    }

    post("ControlSurfaceHandler: Switching to surface " + index + ": " + availableSurfaces[index].type + "\n");

    // Clean up current surface
    if(controlSurface){
        controlSurface.releaseAll();
    }
    if(selectedTrackObserver){
        selectedTrackObserver.property = "";
    }

    // Re-initialize with selected surface
    var controlSurfaceAPI = availableSurfaces[index].api;

    // Create ControlSurface wrapper
    controlSurface = new ControlSurface(controlSurfaceAPI);

    // Detect hardware type and load appropriate profile
    var csType = controlSurfaceAPI.type;
    post("ControlSurfaceHandler: Control surface type: " + csType + "\n");

    if(csType === "Push3"){
        hardwareProfile = Push3;
    } else if(csType === "Push"){
        hardwareProfile = Push1;
    } else if(csType === "Launchpad"){
        hardwareProfile = Launchpad;
    } else {
        post("ControlSurfaceHandler: Unknown control surface type, defaulting to Push 3\n");
        hardwareProfile = Push3;
    }

    post("ControlSurfaceHandler: Using hardware profile: " + hardwareProfile.name + "\n");

    // Notify formachron about hardware type
    outlet(0, "hardware", hardwareProfile.type);

    // Setup buttons first
    setupButtons();

    // Setup device selection monitoring (observer will fire immediately)
    setupDeviceSelection();

    post("ControlSurfaceHandler: Switch complete\n");
}

// List all available control names (for debugging)
function listcontrols(){
    if(!controlSurface){
        post("ControlSurfaceHandler: No control surface available\n");
        return;
    }

    var names = controlSurface.getControlNames();
    post("ControlSurfaceHandler: Available controls (" + names.length + "):\n");
    for(var i = 0; i < names.length; i++){
        post("  " + names[i] + "\n");
    }
}

// Release all controls on cleanup
function notifydeleted(){
    post("ControlSurfaceHandler: Cleaning up...\n");

    // Stop observing selected track
    if(selectedTrackObserver){
        selectedTrackObserver.property = "";
        selectedTrackObserver = null;
    }

    // Release all control surface controls
    if(controlSurface){
        controlSurface.releaseAll();
        controlSurface = null;
    }

    post("ControlSurfaceHandler: Cleanup complete\n");
}

