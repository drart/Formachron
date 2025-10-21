// Audio Output Router
// Routes 8 voices to external audio outputs
// Inlet 0-7: receives channel number (0 = no output, 1-16 = Ext. Out channel)

inlets = 8;
outlets = 1;

var audioOutputIds = [];  // IDs of the 9 DeviceIO objects (index 0 = default, 1-8 = voices)

function bang(){
    post("AudioOutputRouter: Initializing...\n");

    var thisDevice = new LiveAPI(null, "this_device");
    post("AudioOutputRouter: thisDevice.id = " + thisDevice.id + "\n");

    var audioOutputs = thisDevice.get("audio_outputs");
    post("AudioOutputRouter: audioOutputs raw = " + audioOutputs + "\n");
    post("AudioOutputRouter: audioOutputs type = " + typeof audioOutputs + "\n");
    post("AudioOutputRouter: audioOutputs is Array = " + Array.isArray(audioOutputs) + "\n");

    // Parse IDs
    audioOutputIds = parseIds(audioOutputs);
    post("AudioOutputRouter: Found " + audioOutputIds.length + " audio outputs\n");
    post("AudioOutputRouter: Parsed IDs: " + JSON.stringify(audioOutputIds) + "\n");

    if(audioOutputIds.length !== 9){
        post("AudioOutputRouter: WARNING - Expected 9 outputs, found " + audioOutputIds.length + "\n");
    }

    post("AudioOutputRouter: Ready. Send integers 0-16 to inlets 0-7\n");
    post("  0 = No Output, 1-16 = Ext. Out channels 1-16\n");
}

function msg_int(channel){
    post("AudioOutputRouter: msg_int received: " + channel + " (type: " + typeof channel + ")\n");
    // Convert integer to string and route
    routeChannel(channel.toString());
}

function anything(){
    post("AudioOutputRouter: anything() called\n");
    post("AudioOutputRouter: messagename = '" + messagename + "' (type: " + typeof messagename + ")\n");
    post("AudioOutputRouter: arguments.length = " + arguments.length + "\n");
    for(var i = 0; i < arguments.length; i++){
        post("AudioOutputRouter: argument[" + i + "] = '" + arguments[i] + "' (type: " + typeof arguments[i] + ")\n");
    }
    // Get the message name as the channel name
    var channelName = messagename;
    routeChannel(channelName);
}

function routeChannel(channelName){
    var voiceIndex = inlet;  // Inlet 0-7
    var outputIndex = voiceIndex + 1;  // Output 1-8 (skip output 0 which is default)

    // Check if initialized
    if(audioOutputIds.length === 0){
        post("AudioOutputRouter: Not initialized, attempting auto-initialization...\n");
        bang();

        if(audioOutputIds.length === 0){
            post("AudioOutputRouter: ERROR - Auto-initialization failed for voice " + voiceIndex + "\n");
            return;
        }
    }

    if(outputIndex >= audioOutputIds.length){
        post("AudioOutputRouter: ERROR - Voice " + voiceIndex + " out of range (outputIndex " + outputIndex + " >= " + audioOutputIds.length + ")\n");
        return;
    }

    var success = attemptRoute(voiceIndex, outputIndex, channelName);

    if(!success){
        post("AudioOutputRouter: First attempt failed for voice " + voiceIndex + ", reinitializing...\n");

        // Reinitialize
        bang();

        if(audioOutputIds.length === 0){
            post("AudioOutputRouter: ERROR - Reinitialization failed for voice " + voiceIndex + "\n");
            return;
        }

        // Retry once
        success = attemptRoute(voiceIndex, outputIndex, channelName);

        if(!success){
            post("AudioOutputRouter: ERROR - Routing failed after retry for voice " + voiceIndex + "\n");
            return;
        }
    }

    post("AudioOutputRouter: ✓ Voice " + voiceIndex + " routed to '" + channelName + "'\n");
}

// Validate ID and perform routing - returns true on success, false on failure
function attemptRoute(voiceIndex, outputIndex, channelName){
    var expectedOutputId = audioOutputIds[outputIndex];

    // Create LiveAPI reference
    var deviceIO = new LiveAPI(null, "id " + expectedOutputId);

    // Verify the DeviceIO ID matches what we expect
    var actualId = parseInt(deviceIO.id);
    if(actualId !== expectedOutputId){
        post("AudioOutputRouter: ID mismatch for voice " + voiceIndex + " (expected " + expectedOutputId + ", got " + actualId + ")\n");
        return false;
    }

    // Verify it's actually a DeviceIO object
    if(deviceIO.type !== "DeviceIO"){
        post("AudioOutputRouter: Wrong type for voice " + voiceIndex + " (expected DeviceIO, got " + deviceIO.type + ")\n");
        return false;
    }

    post("AudioOutputRouter: Validated DeviceIO for voice " + voiceIndex + " (ID: " + actualId + ")\n");

    // Get available routing types
    var availableRoutingTypes = deviceIO.get("available_routing_types");

    // Handle "No Output" case
    if(channelName === "No" || channelName === "none" || channelName === "off" || channelName === "0"){
        var noOutputId = findRoutingTypeIdentifier(availableRoutingTypes, "No Output");

        if(noOutputId === null){
            post("AudioOutputRouter: ERROR - 'No Output' routing type not found for voice " + voiceIndex + "\n");
            return false;
        }

        deviceIO.set("routing_type", {"identifier": noOutputId});
        post("AudioOutputRouter: Voice " + voiceIndex + " set to No Output\n");
        return true;
    }

    // Find Ext. Out routing type
    var extOutId = findRoutingTypeIdentifier(availableRoutingTypes, "Ext. Out");

    if(extOutId === null){
        post("AudioOutputRouter: ERROR - 'Ext. Out' not available for voice " + voiceIndex + "\n");
        return false;
    }

    // Set routing type to Ext. Out
    post("AudioOutputRouter: Setting voice " + voiceIndex + " routing_type to Ext. Out (identifier: " + extOutId + ")\n");
    deviceIO.set("routing_type", {"identifier": extOutId});

    // Verify ID hasn't changed after the set operation
    var verifyId = parseInt(deviceIO.id);
    if(verifyId !== expectedOutputId){
        post("AudioOutputRouter: ERROR - ID changed after setting routing_type for voice " + voiceIndex + "\n");
        post("  Expected ID: " + expectedOutputId + ", Got ID: " + verifyId + "\n");
        return false;
    }

    // Query available_routing_channels (depends on routing_type being set)
    var availableChannels = deviceIO.get("available_routing_channels");
    var channelIdentifier = findChannelByName(availableChannels, channelName);

    if(channelIdentifier === null){
        post("AudioOutputRouter: ERROR - Channel '" + channelName + "' not found for voice " + voiceIndex + "\n");
        return false;
    }

    // Set the routing channel
    post("AudioOutputRouter: Setting voice " + voiceIndex + " to channel '" + channelName + "' (identifier: " + channelIdentifier + ")\n");
    deviceIO.set("routing_channel", {"identifier": channelIdentifier});

    // Final verification - ensure ID is still correct
    var finalId = parseInt(deviceIO.id);
    if(finalId !== expectedOutputId){
        post("AudioOutputRouter: ERROR - ID changed after setting routing_channel for voice " + voiceIndex + "\n");
        post("  Expected ID: " + expectedOutputId + ", Got ID: " + finalId + "\n");
        return false;
    }

    return true;
}

// Find routing type identifier by matching display_name
function findRoutingTypeIdentifier(availableRoutingTypes, typeName){
    if(!availableRoutingTypes || availableRoutingTypes.length === 0){
        post("AudioOutputRouter: ERROR - No available routing types\n");
        return null;
    }

    // Parse the response
    var typesData = availableRoutingTypes;
    if(typeof typesData === "string"){
        typesData = JSON.parse(typesData);
    }

    // Handle array format
    if(Array.isArray(typesData) && typesData.length > 0){
        if(typeof typesData[0] === "string"){
            typesData = JSON.parse(typesData[0]);
        }
    }

    var types = typesData.available_routing_types;
    if(!types){
        post("AudioOutputRouter: ERROR - Could not parse routing types\n");
        return null;
    }

    // Look for exact match of display_name
    for(var i = 0; i < types.length; i++){
        if(types[i].display_name === typeName){
            return types[i].identifier;
        }
    }

    return null;
}

// Find channel identifier by matching display_name
function findChannelByName(availableChannels, channelName){
    if(!availableChannels){
        post("AudioOutputRouter: ERROR - No available channels\n");
        return null;
    }

    // Handle different response formats
    if(Array.isArray(availableChannels) && availableChannels.length > 0){
        availableChannels = availableChannels[0];
    }

    if(typeof availableChannels === "string"){
        availableChannels = JSON.parse(availableChannels);
    }

    var channels = availableChannels.available_routing_channels;
    if(!channels){
        post("AudioOutputRouter: ERROR - Could not parse channels\n");
        return null;
    }

    // Look for exact match of display_name
    for(var i = 0; i < channels.length; i++){
        if(channels[i].display_name === channelName){
            return channels[i].identifier;
        }
    }

    // Not found - list available channels
    post("AudioOutputRouter: Available channels: ");
    for(var i = 0; i < channels.length; i++){
        post("'" + channels[i].display_name + "' ");
    }
    post("\n");

    return null;
}

// Parse "id", id1, "id", id2 format into array of IDs
function parseIds(response){
    var ids = [];
    if(!response || response.length === 0){
        return ids;
    }

    var arr = Array.isArray(response) ? response : String(response).split(',');
    for(var i = 0; i < arr.length; i++){
        if(arr[i] === "id" && i + 1 < arr.length){
            ids.push(parseInt(arr[i + 1]));
            i++; // Skip the next element
        }
    }
    return ids;
}


// older code
function test_channels(){
    if(audioOutputIds.length === 0){
        post("AudioOutputRouter: ERROR - Not initialized. Send bang first.\n");
        return;
    }

    post("\n=== Testing available channels for output 1 (voice 0) ===\n");

    var outputId = audioOutputIds[1];  // Voice 0 = output index 1
    var deviceIO = new LiveAPI(null, "id " + outputId);

    // Get available routing types and find Ext. Out
    var availableRoutingTypes = deviceIO.get("available_routing_types");
    var extOutId = findRoutingTypeIdentifier(availableRoutingTypes, "Ext. Out");

    if(extOutId === null){
        post("ERROR: Could not find 'Ext. Out' in available_routing_types\n");
        return;
    }

    // Set to Ext. Out
    post("Setting routing_type to Ext. Out (identifier " + extOutId + ")...\n");
    deviceIO.set("routing_type", {"identifier": extOutId});

    // Get available channels
    var availableChannels = deviceIO.get("available_routing_channels");
    post("available_routing_channels: " + JSON.stringify(availableChannels) + "\n");
    post("Type: " + typeof availableChannels + "\n");

    post("=== Done ===\n");
}

