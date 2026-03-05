// Hardware Profile: Launchpad Mini MK1
// Bi-color LED system (red + green = amber)

module.exports = {
    name: "Launchpad Mini MK1",
    type: "Launchpad",

    grid: {
        width: 8,
        height: 8,
        midiNoteOffset: 0,

        cellToNote: function(x, y) {
            // Launchpad uses row*16 + column layout
            return y * 16 + x;
        },

        noteToCell: function(note) {
            return {
                x: note % 16,
                y: Math.floor(note / 16)
            };
        }
    },

    // Launchpad Mini MK1 uses RED/GREEN bit encoding
    // Formula: velocity = (16 × green) + red + flags (where flags = 12 for normal)
    // Green Full (60) is reserved as the playhead color — not used for voices
    // 8 distinct voice colors with no bright/dim crossover
    colors: {
        // Voice-specific colors (8 distinct, no duplicates)
        red_full:   15,  // Voice 0: Red Full   (g=0, r=3)
        orange:     47,  // Voice 1: Orange     (g=2, r=3)
        amber_full: 63,  // Voice 2: Amber Full (g=3, r=3)
        yellow:     62,  // Voice 3: Yellow     (g=3, r=2)
        lime:       61,  // Voice 4: Lime       (g=3, r=1)
        green_med:  44,  // Voice 5: Green Med  (g=2, r=0)
        red_med:    14,  // Voice 6: Red Med    (g=0, r=2)
        amber_med:  46,  // Voice 7: Amber Med  (g=2, r=2)

        // Special colors
        playhead: 60,    // Green Full (g=3, r=0) — reserved for playhead only
        white: 60,       // Alias for playhead (used by mediator for playhead flash)
        black: 12        // Off (g=0, r=0, flags=12)
    },

    // Dimmed versions for pending modification feedback
    // Dim values never equal any bright voice value (no crossover confusion)
    dimmedColors: {
        red_full:   13,  // Voice 0 dimmed: Red Low   (g=0, r=1)
        orange:     30,  // Voice 1 dimmed: Orange Dim (g=1, r=2)
        amber_full: 29,  // Voice 2 dimmed: Amber Low (g=1, r=1)
        yellow:     45,  // Voice 3 dimmed: Lime Med  (g=2, r=1)
        lime:       28,  // Voice 4 dimmed: Green Low (g=1, r=0)
        green_med:  28,  // Voice 5 dimmed: Green Low (g=1, r=0)
        red_med:    13,  // Voice 6 dimmed: Red Low   (g=0, r=1)
        amber_med:  29,  // Voice 7 dimmed: Amber Low (g=1, r=1)

        // Special colors
        black: 12        // Black stays black
    },

    // Launchpad button mappings
    // Note: Launchpad doesn't have dedicated mode buttons like Push
    controls: {
        // Mode buttons - not available on Launchpad
        mode_new: null,
        mode_shift: null,
        mode_mute: null,
        mode_delete: null,
        mode_select: null,
        mode_convert: null,

        // Subdivision control - disabled for now (will decide on button mapping later)
        subdivision: function(index) {
            return null;
        },

        // Main button matrix
        button_matrix: "Button_Matrix"
    },

    // Helper function to get voice colors for the application
    getVoiceColors: function(numVoices) {
        // 8 distinct colors optimized for Launchpad's bi-color LEDs
        // Formula: velocity = (16 × green) + red + 12
        // Green Full (60) is reserved for the playhead — not included here
        var availableColors = [
            15,  // Voice 0: Red Full   (g=0, r=3)
            47,  // Voice 1: Orange     (g=2, r=3)
            63,  // Voice 2: Amber Full (g=3, r=3)
            62,  // Voice 3: Yellow     (g=3, r=2)
            61,  // Voice 4: Lime       (g=3, r=1)
            44,  // Voice 5: Green Med  (g=2, r=0)
            14,  // Voice 6: Red Med    (g=0, r=2)
            46   // Voice 7: Amber Med  (g=2, r=2)
        ];

        var availableDimmed = [
            13,  // Voice 0 dimmed: Red Low   (g=0, r=1)
            30,  // Voice 1 dimmed: Orange Dim (g=1, r=2)
            29,  // Voice 2 dimmed: Amber Low (g=1, r=1)
            45,  // Voice 3 dimmed: Lime Med  (g=2, r=1)
            28,  // Voice 4 dimmed: Green Low (g=1, r=0)
            28,  // Voice 5 dimmed: Green Low (g=1, r=0)
            13,  // Voice 6 dimmed: Red Low   (g=0, r=1)
            29   // Voice 7 dimmed: Amber Low (g=1, r=1)
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
            colorNames: ['red_full', 'orange', 'amber_full', 'yellow', 'lime', 'green_med', 'red_med', 'amber_med'],
            playheadColor: 60,  // Green full (high visibility, good contrast with red/amber/orange voices)
            offColor: 12        // Black/off
        };
    }
};
