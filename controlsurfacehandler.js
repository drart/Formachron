// Control Surface Handler
// Manages control surface button claiming/releasing and outputs to Max patch
// Separate v8 object from formachron.js

const ControlSurface = require('./lib/controlsurface.js');

inlets = 1;
outlets = 1;

var controlSurface = null;
var thisDeviceId = null;
var selectedDeviceObserver = null;
var isDeviceSelected = false;

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

    // Find first active control surface
    var controlSurfaceAPI = null;
    for(var i = 0; i < controlSurfaceCount; i++){
        var cs = new LiveAPI(null, "control_surfaces " + i);

        if(cs.id !== '0'){
            controlSurfaceAPI = cs;
            post("ControlSurfaceHandler: Using control surface " + i + ": " + cs.type + "\n");
            break;
        }
    }

    if(!controlSurfaceAPI || controlSurfaceAPI.id === '0'){
        post("ControlSurfaceHandler: No active control surface found\n");
        return;
    }

    // Create ControlSurface wrapper
    controlSurface = new ControlSurface(controlSurfaceAPI);

    // Setup device selection monitoring FIRST
    setupDeviceSelection();

    // Log available controls for debugging
    post("ControlSurfaceHandler: Available controls:\n");
    var names = controlSurface.getControlNames();
    for(var i = 0; i < names.length; i++){
        post("  " + names[i] + "\n");
    }

    // Setup button mappings AFTER observer is established
    setupButtons();

    // Check initial selection state (since early callbacks were blocked)
    var currentSelectedDevice = selectedDeviceObserver.get("selected_device");
    var currentIds = parseObjectIds(currentSelectedDevice);
    if(currentIds.length > 0){
        var currentDeviceId = currentIds[0];
        var currentObj = new LiveAPI(null, "id " + currentDeviceId);
        // Accept any device type (MaxDevice, PluginDevice, etc)
        if(currentObj.type.indexOf("Device") !== -1 && currentDeviceId === thisDeviceId){
            post("ControlSurfaceHandler: This device is selected on init\n");
            isDeviceSelected = true;
            controlSurface.onDeviceSelectionChange(true);
            // Notify formachron that device is selected
            outlet(0, "device_selected", 1);
        }
    }

    post("ControlSurfaceHandler: Initialization complete\n");
}

function setupDeviceSelection(){
    // Observe selected_device property on track view FIRST
    selectedDeviceObserver = new LiveAPI(selectedDeviceCallback, "live_set view selected_track view");
    selectedDeviceObserver.property = "selected_device";

    // Get this device's ID AFTER observer is set up
    thisDeviceId = parseInt(new LiveAPI(null, "this_device").id);
    post("ControlSurfaceHandler: This device ID: " + thisDeviceId + "\n");
}

function selectedDeviceCallback(args){
    // Don't process if not fully initialized
    if(!controlSurface || thisDeviceId === null){
        return;
    }

    // Args format: ["selected_device", "id", deviceId]
    var ids = parseObjectIds(args.join(','));

    if(ids.length === 0){
        return;
    }

    var selectedDeviceId = ids[0];

    // Filter out non-device objects (like the View itself)
    var selectedObj = new LiveAPI(null, "id " + selectedDeviceId);
    var objType = selectedObj.type;

    // Accept Device, MaxDevice, PluginDevice, etc - anything containing "Device"
    if(objType.indexOf("Device") === -1){
        return;
    }

    var isSelected = (selectedDeviceId === thisDeviceId);

    post("ControlSurfaceHandler: Device " + (isSelected ? "selected" : "deselected") + "\n");

    // Track selection state
    var wasSelected = isDeviceSelected;
    isDeviceSelected = isSelected;

    // Notify ControlSurface about selection change
    controlSurface.onDeviceSelectionChange(isSelected);

    // Notify formachron about device selection change
    // Delay 100ms to allow hardware to settle after grab/release
    var selectedValue = isSelected ? 1 : 0;
    var t = new Task(function(){
        outlet(0, "device_selected", selectedValue);
    });
    t.schedule(100);
}

function setupButtons(){
    if(!controlSurface){
        post("ControlSurfaceHandler: No control surface available\n");
        return;
    }

    // Mode buttons - always active, don't release on deselect
    // Callbacks receive full args array: ["value", velocity, ...]

    // New Button → Mode 0 (default/entry mode)
    controlSurface.claimControl("New_Button", function(args){
        if(args.length > 1 && args[1] > 0){
            outlet(0, "mode", 0);
        }
    }, {
        mode: "observe",
        requireSelection: false,
        releaseOnDeselect: false
    });

    // Shift Button → Mode 1 (phase shift)
    controlSurface.claimControl("Shift_Button", function(args){
        if(args.length > 1 && args[1] > 0){
            outlet(0, "mode", 1);
        }
    }, {
        mode: "observe",
        requireSelection: false,
        releaseOnDeselect: false
    });

    // Global Mute Button → Mode 3 (mute notes)
    controlSurface.claimControl("Global_Mute_Button", function(args){
        if(args.length > 1 && args[1] > 0){
            outlet(0, "mode", 3);
        }
    }, {
        mode: "observe",
        requireSelection: false,
        releaseOnDeselect: false
    });

    // Delete Button → Mode 4 (remove region)
    controlSurface.claimControl("Delete_Button", function(args){
        if(args.length > 1 && args[1] > 0){
            outlet(0, "mode", 4);
        }
    }, {
        mode: "observe",
        requireSelection: false,
        releaseOnDeselect: false
    });

    // Select Button → Mode 2 (select sequence/cell)
    controlSurface.claimControl("Select_Button", function(args){
        if(args.length > 1 && args[1] > 0){
            outlet(0, "mode", 2);
        }
    }, {
        mode: "observe",
        requireSelection: false,
        releaseOnDeselect: false
    });

    // Convert Button → Mode 5 (move region)
    controlSurface.claimControl("Convert", function(args){
        if(args.length > 1 && args[1] > 0){
            outlet(0, "mode", 5);
        }
    }, {
        mode: "observe",
        requireSelection: false,
        releaseOnDeselect: false
    });

    // Scene Select Buttons (0-7) - map to output channels
    for(var i = 0; i < 8; i++){
        (function(index){
            controlSurface.claimControl("Scene_Launch_Button" + index, function(args){
                if(args.length > 1 && args[1] > 0){
                    outlet(0, "output_channel", index);
                }
            }, {
                mode: "grab",
                requireSelection: true,
                releaseOnDeselect: true
            });
        })(i);
    }

    // Button Matrix - grab when device selected, release when deselected
    controlSurface.claimControl("Button_Matrix", function(args){
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

// Handle incoming messages from formachron (LED updates, etc.)
function anything(){
    var messageName = messagename;
    var args = arrayfromargs(arguments);

    if(messageName === "control-surface"){
        // args: [x, y, colorNumber]
        if(args.length >= 3 && controlSurface){
            var x = args[0];
            var y = args[1];
            var colorNumber = args[2];

            // Only send to hardware when device is selected
            if(isDeviceSelected){
                controlSurface.sendValue("Button_Matrix", x, y, colorNumber);
            }
        }
    }

    if(messageName === "scene-button"){
        // args: [buttonIndex, colorNumber]
        if(args.length >= 2 && controlSurface){
            var buttonIndex = args[0];
            var colorNumber = args[1];

            // Only send to hardware when device is selected
            if(isDeviceSelected){
                controlSurface.sendValue("Scene_Launch_Button" + buttonIndex, colorNumber);
            }
        }
    }
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

    // Stop observing selected device
    if(selectedDeviceObserver){
        selectedDeviceObserver.property = "";
        selectedDeviceObserver = null;
    }

    // Release all control surface controls
    if(controlSurface){
        controlSurface.releaseAll();
        controlSurface = null;
    }

    post("ControlSurfaceHandler: Cleanup complete\n");
}
