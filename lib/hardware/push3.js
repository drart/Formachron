// Hardware Profile: Push 3

module.exports = {
    name: "Push 3",
    type: "Push3",

    grid: {
        width: 8,
        height: 8,
        midiNoteOffset: 36,

        cellToNote: function(x, y) {
            return y * 8 + x + 36;
        },

        noteToCell: function(note) {
            var adjusted = note - 36;
            return {
                x: adjusted % 8,
                y: Math.floor(adjusted / 8)
            };
        }
    },

    // Push 3 color palette (velocity values)
    colors: {
        red: 127,
        orange: 3,
        yellow: 7,
        green: 126,
        cyan: 14,
        blue: 125,
        purple: 20,
        pink: 21,
        white: 120,
        black: 0
    },

    // Dimmed versions for pending modification feedback
    // Lower brightness palette entries (approximate - tune on hardware)
    dimmedColors: {
        red: 6,      // Darker red
        orange: 65,  // Darker orange
        yellow: 13,  // Darker yellow
        green: 25,   // Darker green
        cyan: 37,    // Darker cyan
        blue: 46,    // Darker blue
        purple: 55,  // Darker purple
        pink: 57,    // Darker pink
        white: 119,  // Gray
        black: 0     // Black stays black
    },

    // Push 3 button mappings
    controls: {
        mode_new: "New_Button",
        mode_shift: "Shift_Button",
        mode_mute: "Global_Mute_Button",
        mode_delete: "Delete_Button",
        mode_select: "Select_Button",
        mode_convert: "Convert",

        // Subdivision control using Scene Launch buttons
        subdivision: function(index) {
            return "Scene_Launch_Button" + index;
        },

        // Main button matrix
        button_matrix: "Button_Matrix"
    },

    // Helper function to get voice colors for the application
    getVoiceColors: function(numVoices) {
        // 8 distinct colors for Push 3 (velocity-based palette)
        var availableColors = [
            3,    // Orange
            127,  // Red
            6,    // Darker red
            7,    // Yellow
            5,    // Dark red
            13,   // Lime/yellow-green
            126,  // Green
            84    // Light orange
        ];

        var availableDimmed = [
            65,  // Dimmed orange
            6,   // Dimmed red
            5,   // Darker dimmed red
            13,  // Dimmed yellow/lime
            4,   // Very dark red
            12,  // Dimmed lime
            25,  // Dimmed green
            9    // Very dimmed orange
        ];

        var voiceColors = [];
        var dimmedColors = [];

        for(var i = 0; i < numVoices; i++) {
            voiceColors.push(availableColors[i % availableColors.length]);
            dimmedColors.push(availableDimmed[i % availableDimmed.length]);
        }

        return {
            voiceColors: voiceColors,
            dimmedColors: dimmedColors,
            colorNames: ['orange', 'red', 'red', 'yellow', 'red', 'yellow', 'green', 'orange'],
            playheadColor: 120,  // White (playhead flash)
            offColor: 0          // Black/off
        };
    }
};
