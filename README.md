Formachron
==========

An 8-voice ansiorhythmic sequencer for Ableton Push, designed for live performance and quick creation of complex polyrhythmic, polymetric, and polyphasic patterns. Current development is focused on Ableton Push Standalone. 

## Overview

Formachron reimagines grid-based sequencing by allowing each region to have independent:
- **Length** (1-8 beats)
- **Subdivision** (any number of subdivisions of a beat, from 1-8, and the ability to change subdivision for each beat of the sequence)
- **Phase** (starting point within the loop)

Unlike traditional grid sequencers that limit all patterns to a single subdivision, Formachron's spatial notation system lets you draw regions anywhere on an 8x8 grid, with each region representing a unique rhythmic voice.

## Features

### Implemented
- **8 independent voices** with spatial grid representation
- **Mode switching** via Push buttons (Shift, Select, Mute, Delete, New, etc.)
- **Scene Launch buttons** control subdivision mode per sequence
- **Phase shifting**: Set start point within sequence loop
- **Per-step muting**: Individual note probability control
- **Audio routing**: Route each voice to external outputs (1-16)
- **Live API integration**: Device selection awareness and control surface management
- **LED feedback**: Real-time visual feedback on Push pads and buttons

## TODO
- Add debugging tools to log phasor state vs. sequencer state vs. visual feedback
- Consider options: wait for downbeat, reset phase to 0, or queue sequences
- Send `selectedSequence -1` when all sequences are deleted (deselection case)
- Write sequences into Ableton clips
- Read clips into Formachron sequences
- End behavior modes (hold, repeat)
- Queue region changes to next bar
- Advanced heuristics for note generation

## Known Issues
- Single-note regions don't flash (design decision: should they subdivide?)
- button_matrix syncing isn't super tight (recursive v8 calls probably not good)

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

