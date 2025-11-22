// Control Surface
// Utility class for interacting with a single control surface
// Handles claiming/releasing controls, querying available controls, and sending feedback

class ControlSurface {
    constructor(controlSurface){
        this.controlSurface = controlSurface;
        this.claimedControls = {};
    }

    getType(){
        return this.controlSurface.type;
    }

    // Get list of all available control names on this surface
    getControlNames(){
        var result = this.controlSurface.call("get_control_names");
        if(!result || result.length === 0){
            post("ControlSurface: No control names found\n");
            return [];
        }
        return result;
    }

    // Claim a control by name with a callback
    // controlName: string like "Shift_Button" or "Button_Matrix"
    // callback: function(velocity) called when control state changes
    // options: configuration object:
    //   {
    //     mode: "observe" or "grab" (default: "observe")
    //     requireSelection: true/false (default: false - always active)
    //     releaseOnDeselect: true/false (default: true - release when deselected)
    //   }
    claimControl(controlName, callback, options){
        if(this.claimedControls[controlName]){
            post("ControlSurface: Control already claimed: " + controlName + "\n");
            return false;
        }

        options = options || {};
        var mode = options.mode || "observe";
        var requireSelection = options.requireSelection !== undefined ? options.requireSelection : false;
        var releaseOnDeselect = options.releaseOnDeselect !== undefined ? options.releaseOnDeselect : true;

        var config = {
            callback: callback,
            mode: mode,
            requireSelection: requireSelection,
            releaseOnDeselect: releaseOnDeselect,
            isActive: false,  // Track if currently active
            api: null
        };

        this.claimedControls[controlName] = config;

        // If requireSelection is true, don't activate now (wait for selection)
        if(requireSelection){
            post("ControlSurface: Control registered (awaiting selection): " + controlName + "\n");
            return true;
        }

        // Otherwise, activate immediately
        return this._activateControl(controlName);
    }

    // Internal method to actually activate a control
    _activateControl(controlName){
        var config = this.claimedControls[controlName];
        if(!config || config.isActive){
            return false;
        }

        try {
            if(config.mode === "grab"){
                // First check if control exists before trying to grab
                var checkResult = this.controlSurface.call("get_control_by_name", controlName);
                if(!checkResult || checkResult.length < 2){
                    post("ControlSurface: Control does not exist (skipping): " + controlName + "\n");
                    return false;
                }

                // Grab exclusive control (prevents Live from using it)
                this.controlSurface.call("grab_control", controlName);
                post("ControlSurface: Grabbed exclusive control: " + controlName + "\n");

                // If callback provided, also observe the control
                if(config.callback){
                    var result = this.controlSurface.call("get_control_by_name", controlName);
                    post("ControlSurface: get_control_by_name returned: " + result + "\n");
                    if(result && result.length >= 2){
                        var expectedId = parseInt(result[1]);
                        var idString = "id " + expectedId;
                        post("ControlSurface: Creating observer for " + controlName + " with id: " + idString + "\n");
                        var wrapperCallback = function(args){
                            post("ControlSurface: Callback fired for " + controlName + ": " + args + "\n");
                            // Pass full args array to callback
                            config.callback(args);
                        };
                        var controlAPI = new LiveAPI(wrapperCallback, idString);

                        // Validate ID matches what we expect
                        var actualId = parseInt(controlAPI.id);
                        post("ControlSurface: ID validation for " + controlName + " - expected: " + expectedId + ", actual: " + actualId + "\n");
                        if(actualId !== expectedId){
                            post("ControlSurface: ID mismatch for " + controlName + " (expected " + expectedId + ", got " + actualId + ")\n");
                            return false;
                        }

                        controlAPI.property = "value";
                        config.api = controlAPI;
                        post("ControlSurface: Observer setup complete for " + controlName + "\n");
                    } else {
                        post("ControlSurface: get_control_by_name failed for " + controlName + " (result invalid)\n");
                    }
                }
            } else {
                // Observe mode - just listen to state changes
                var result = this.controlSurface.call("get_control_by_name", controlName);

                if(!result || result.length < 2){
                    post("ControlSurface: Could not find control (skipping): " + controlName + "\n");
                    return false;
                }

                var expectedId = parseInt(result[1]);
                var idString = "id " + expectedId;

                var wrapperCallback = function(args){
                    // Pass full args array to callback
                    config.callback(args);
                };

                var controlAPI = new LiveAPI(wrapperCallback, idString);

                // Validate ID matches what we expect
                var actualId = parseInt(controlAPI.id);
                if(actualId !== expectedId){
                    post("ControlSurface: ID mismatch for " + controlName + " (expected " + expectedId + ", got " + actualId + ")\n");
                    return false;
                }

                controlAPI.property = "value";
                config.api = controlAPI;

                post("ControlSurface: Observing control: " + controlName + "\n");
            }

            config.isActive = true;
            return true;
        } catch(e) {
            post("ControlSurface: Error activating control '" + controlName + "': " + e + "\n");
            return false;
        }
    }

    // Internal method to deactivate a control
    _deactivateControl(controlName){
        var config = this.claimedControls[controlName];
        if(!config || !config.isActive){
            return false;
        }

        // If it was grabbed, release it
        if(config.mode === "grab"){
            this.controlSurface.call("release_control", controlName);
            post("ControlSurface: Released grabbed control: " + controlName + "\n");
        }

        // Stop observing if we have an API object
        if(config.api){
            config.api.property = "";
            config.api = null;
        }

        config.isActive = false;
        return true;
    }

    // Called when device selection state changes
    // isSelected: true if device is now selected, false otherwise
    onDeviceSelectionChange(isSelected){
        post("ControlSurface: Device selection changed: " + (isSelected ? "selected" : "deselected") + "\n");

        var controlNames = Object.keys(this.claimedControls);
        for(var i = 0; i < controlNames.length; i++){
            var name = controlNames[i];
            var config = this.claimedControls[name];

            if(isSelected){
                // Device selected - activate controls that require selection
                if(config.requireSelection && !config.isActive){
                    this._activateControl(name);
                }
            } else {
                // Device deselected - deactivate controls that should release
                if(config.releaseOnDeselect && config.isActive){
                    this._deactivateControl(name);
                }
            }
        }
    }

    // Release a claimed control
    // controlName: string like "Shift_Button"
    releaseControl(controlName){
        if(!this.claimedControls[controlName]){
            post("ControlSurface: Control not claimed: " + controlName + "\n");
            return false;
        }

        // Deactivate if active
        this._deactivateControl(controlName);

        // Remove from claimed controls
        delete this.claimedControls[controlName];
        post("ControlSurface: Removed control: " + controlName + "\n");
        return true;
    }

    // Release all claimed controls
    releaseAll(){
        var controlNames = Object.keys(this.claimedControls);
        for(var i = 0; i < controlNames.length; i++){
            this.releaseControl(controlNames[i]);
        }
    }

    // Send a value to a control (for LED feedback, etc.)
    // controlName: string like "Shift_Button" or "Button_Matrix"
    // For simple controls: sendValue("Shift_Button", 127)
    // For matrix controls: sendValue("Button_Matrix", x, y, color)
    sendValue(controlName){
        try {
            var result = this.controlSurface.call("get_control_by_name", controlName);

            if(!result || result.length < 2){
                // Silently skip - control may not exist on this hardware
                return false;
            }

            var expectedId = parseInt(result[1]);
            var idString = "id " + expectedId;
            var controlAPI = new LiveAPI(null, idString);

            // Validate ID matches what we expect (prevent stale ID issues)
            var actualId = parseInt(controlAPI.id);
            if(actualId !== expectedId){
                post("ControlSurface: ID mismatch for " + controlName + " (expected " + expectedId + ", got " + actualId + ")\n");
                return false;
            }

            // Build arguments array from all arguments after controlName
            var args = ["send_value"];
            for(var i = 1; i < arguments.length; i++){
                args.push(arguments[i]);
            }

            // post("ControlSurface: Calling send_value on " + controlName + " (id: " + idString + ") with args: " + args + "\n");

            // Call with variable arguments
            var returnValue = controlAPI.call.apply(controlAPI, args);

            // post("ControlSurface: send_value returned: " + returnValue + "\n");

            return true;
        } catch(e) {
            // Silently ignore errors for controls that don't exist
            return false;
        }
    }
}

module.exports = ControlSurface;
