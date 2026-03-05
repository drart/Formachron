Formachron
==========

An 8-voice ansiorhythmic sequencer for Ableton Push and Launchpad, designed for live performance and quick creation of complex polyrhythmic, polymetric, and polyphasic patterns.

## Hardware Compatibility

Formachron supports multiple hardware controllers with automatic detection:
- **Push 3** (recommended) - Full feature support
- **Push 1** - Full feature support with Push 1 color palette
- **Launchpad Mini MK1** - Core features (limited mode buttons)
- **MIDI Input** - Works without control surface hardware (no hardware mode)

The device automatically detects your connected hardware and loads the appropriate button mappings and color palette.

## Overview

Formachron reimagines grid-based sequencing by allowing each region to have independent:
- **Length** (1-8 beats)
- **Subdivision** (any number of subdivisions of a beat, from 1-8, and the ability to change subdivision for each beat of the sequence)
- **Phase** (starting point within the loop)

Unlike traditional grid sequencers that limit all patterns to a single subdivision, Formachron's spatial notation system lets you draw regions anywhere on an 8x8 grid, with each region representing a unique rhythmic voice.

## Features

### Implemented
- **8 independent voices** with spatial grid representation
- **Hardware abstraction** - Auto-detects Push 1/3 and Launchpad controllers
- **Mode switching** via hardware buttons (Shift, Select, Mute, Delete, New, etc.)
- **Subdivision control** - Scene Launch buttons (Push) or right-side clip buttons (Launchpad)
- **Phase shifting**: Set start point within sequence loop
- **Per-step muting**: Individual note probability control
- **Audio routing**: Route each voice to external outputs (1-16)
- **Live API integration**: Device selection awareness and control surface management
- **Graceful degradation**: Works with or without control surface hardware

## TODO
- Add debugging tools to log phasor state vs. sequencer state vs. visual feedback
- Consider options: wait for downbeat, reset phase to 0, or queue sequences
- Send `selectedSequence -1` when all sequences are deleted (deselection case)
- Write sequences into Ableton clips
- Read clips into Formachron sequences
- Queue region changes to next bar
- heuristics for note generation

## Troubleshooting

### Control Surface Not Detected

If formachron detects the wrong controller or shows "ghost devices":

1. **Check Live Preferences**:
   - Open Live → Preferences → Link/Tempo/MIDI
   - For unused/disconnected controllers, set **Control Surface** to "None"
   - Keep **Input** and **Output** ports selected (don't set to "None")
   - This tells Live you deliberately disabled that controller

2. **Verify Connected Hardware**:
   - Check Max Console for "Using hardware profile: [device name]"
   - Send `listsurfaces` message to controlsurfacehandler to see detected devices
   - Use `selectsurface N` to manually choose a different controller

3. **Restart Live**:
   - After changing MIDI preferences, restart Live for changes to take effect

### Manual Hardware Selection

If you have multiple controllers and want to switch between them:

1. Send `listsurfaces` to controlsurfacehandler object
2. Note the index number of your desired controller
3. Send `selectsurface N` (where N is the index) to switch

### Launchpad Limitations

Launchpad Mini MK1 lacks dedicated mode buttons. Workarounds:
- Use MIDI mapping in Ableton to map mode changes to computer keys
- Use unused Launchpad buttons for mode switching (requires code modification)
- Control modes from Max patch interface

## Known Issues
- Single-note regions don't flash (design decision: should they subdivide?)
- button_matrix syncing isn't super tight (syncing via v8 javascript isn't ideal)
- **Region modification visual-audio desync**: When a region is modified, LED feedback updates immediately but the audio pattern doesn't change until the current loop completes, creating a disconnect between what the user sees and hears

## Citation

If you use Formachron in your research or practice, please cite:

> Tindale, A., & Clark, C. (2024). Formachron: A Grid-based Interface for Polymetric Sequences. In _Proceedings of the International Conference on New Interfaces for Musical Expression_ (NIME 2024). https://nime.org/proc/nime2024_44/

**NIME 2024 Presentation**: Watch the conference talk at https://www.youtube.com/watch?v=6PSifo_Buy4

## References
- https://forum.ableton.com/viewtopic.php?f=35&t=222861
- http://www.edsko.net/2020/12/26/trichords-part1/
- http://www.edsko.net/2020/12/27/trichords-part2/
- https://maxforlive.com/resources/M4L-Production-Guidelines.pdf
- https://cycling74.com/tutorials/ableton-push-programming-tutorials/
- https://cycling74.com/forums/using-control_surface-grab_control-is-not-putting-midi-out-where-i-expect-it-push2
- https://cycling74.com/forums/push-2-observe-control
- https://cycling74.com/forums/setting-and-getting-the-selected_track-from-liveapi

