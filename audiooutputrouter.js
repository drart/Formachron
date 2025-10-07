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
    post("AudioOutputRouter: routeChannel called with '" + channelName + "'\n");
    var voiceIndex = inlet;  // Inlet 0-7
    var outputIndex = voiceIndex + 1;  // Output 1-8 (skip output 0 which is default)
    post("AudioOutputRouter: voiceIndex = " + voiceIndex + ", outputIndex = " + outputIndex + "\n");

    if(audioOutputIds.length === 0){
        post("AudioOutputRouter: ERROR - Not initialized. Send bang first.\n");
        return;
    }

    if(outputIndex >= audioOutputIds.length){
        post("AudioOutputRouter: ERROR - Voice " + voiceIndex + " out of range\n");
        return;
    }

    var outputId = audioOutputIds[outputIndex];
    post("AudioOutputRouter: Using outputId = " + outputId + "\n");
    var deviceIO = new LiveAPI(null, "id " + outputId);
    post("AudioOutputRouter: deviceIO.id = " + deviceIO.id + ", deviceIO.type = " + deviceIO.type + "\n");

    // Check current routing_type
    var currentRoutingType = deviceIO.get("routing_type");
    post("AudioOutputRouter: Current routing_type = " + JSON.stringify(currentRoutingType) + "\n");

    // Get available routing types
    var availableRoutingTypes = deviceIO.get("available_routing_types");
    post("AudioOutputRouter: available_routing_types = " + JSON.stringify(availableRoutingTypes) + "\n");

    // Check for special cases: "No Output" or "0"
    if(channelName === "No" || channelName === "none" || channelName === "off" || channelName === "0"){
        post("AudioOutputRouter: Voice " + voiceIndex + " -> No Output\n");
        // Find "No Output" identifier from available_routing_types
        var noOutputId = findRoutingTypeIdentifier(availableRoutingTypes, "No Output");
        if(noOutputId !== null){
            deviceIO.set("routing_type", {"identifier": noOutputId});
        }
        return;
    }

    // Find "Ext. Out" identifier from available_routing_types
    post("AudioOutputRouter: Voice " + voiceIndex + " -> searching for '" + channelName + "'\n");
    var extOutId = findRoutingTypeIdentifier(availableRoutingTypes, "Ext. Out");
    post("AudioOutputRouter: Found Ext. Out identifier = " + extOutId + "\n");

    if(extOutId !== null){
        post("AudioOutputRouter: Setting routing_type to Ext. Out (identifier " + extOutId + ")\n");
        deviceIO.set("routing_type", {"identifier": extOutId});
    } else {
        post("AudioOutputRouter: ERROR - Could not find 'Ext. Out' in available_routing_types\n");
        return;
    }

    // Query available_routing_channels
    post("AudioOutputRouter: Querying available_routing_channels...\n");
    var availableChannels = deviceIO.get("available_routing_channels");
    post("AudioOutputRouter: availableChannels = " + availableChannels + "\n");
    post("AudioOutputRouter: availableChannels type = " + typeof availableChannels + "\n");

    // Find the channel with display_name matching channelName
    var channelIdentifier = findChannelByName(availableChannels, channelName);

    if(channelIdentifier !== null){
        deviceIO.set("routing_channel", {"identifier": channelIdentifier});
        post("AudioOutputRouter: Voice " + voiceIndex + " routed to '" + channelName + "'\n");
    } else {
        post("AudioOutputRouter: ERROR - Channel '" + channelName + "' not found\n");
    }
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
    var channelsData = availableChannels;

    // If it's an array, get the first element
    if(Array.isArray(channelsData) && channelsData.length > 0){
        channelsData = channelsData[0];
    }

    // If it's a string, parse it
    if(typeof channelsData === "string"){
        channelsData = JSON.parse(channelsData);
    }

    var channels = channelsData.available_routing_channels;
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
