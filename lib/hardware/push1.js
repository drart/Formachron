// Hardware Profile: Push 1

module.exports = {
    name: "Push 1",
    type: "Push",

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

    // Push 1 color palette (different from Push 3)
    colors: {
        red: 120,
        orange: 60,
        yellow: 13,
        green: 21,
        cyan: 33,
        blue: 45,
        purple: 49,
        pink: 53,
        white: 3,
        black: 0
    },

    // Dimmed versions for pending modification feedback
    // Lower brightness palette entries (approximate - tune on hardware)
    dimmedColors: {
        red: 6,      // Darker red
        orange: 9,   // Darker orange
        yellow: 13,  // Already mid-brightness (no change)
        green: 17,   // Darker green
        cyan: 37,    // Darker cyan
        blue: 41,    // Darker blue
        purple: 48,  // Darker purple
        pink: 56,    // Darker pink
        white: 118,  // Gray
        black: 0     // Black stays black
    },

    // Push 1 button mappings
    controls: {
        mode_new: "New_Button",
        mode_shift: "Shift_Button",
        mode_mute: "Mute_Button",  // Different from Push 3!
        mode_delete: "Delete_Button",
        mode_select: "Select_Button",
        mode_convert: null,  // Not available on Push 1

        // Subdivision control using Scene Launch buttons
        subdivision: function(index) {
            return "Scene_Launch_Button" + index;
        },

        // Main button matrix
        button_matrix: "Button_Matrix"
    },

    // Helper function to get voice colors for the application
    getVoiceColors: function(numVoices) {
        // 8 distinct colors for Push 1 (different palette from Push 3)
        var availableColors = [
            60,   // Orange
            120,  // Red
            6,    // Darker red
            13,   // Yellow
            6,    // Darker red (reused)
            13,   // Yellow (reused)
            21,   // Green
            9     // Darker orange
        ];

        var availableDimmed = [
            9,   // Dimmed orange
            6,   // Dimmed red
            6,   // Darker dimmed red (reused)
            13,  // Dimmed yellow (already mid-brightness)
            6,   // Darker dimmed red (reused)
            13,  // Dimmed yellow (reused)
            17,  // Dimmed green
            9    // Darker orange (reused)
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
            playheadColor: 3,   // White (playhead flash)
            offColor: 0         // Black/off
        };
    }
};
