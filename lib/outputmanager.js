class OutputManager{
	constructor( g ){
		this.shapes = []; // this is a cached version of the region shapes
		this.grid = g;
	}

    output( messages ){
        console.log( messages ); 
        for(var i = 0; i < messages.length; i++){
            Max.output( messages[i].channel, messages[i].data );
        }
    }
    
    controlSurfaceOutput( messages ){
        console.log( messages ); 
        for( var i = 0; i < messages.length; i++){
            Max.output( 'cell', 'set', messages[i].x, messages[i].y, messages[i].c );
        }
    }

	// TODO this is unused right now
	process( args ){ // todo fix the return from syncmanager

		var index = args.pop();
		var vectorWithOrigin = args;

		console.log ( 'the args to process are: ' + args );
		console.log( 'the index is: ' + index );

		/*
		/// there is a problem with this bit
		if( vectorWithOrigin  === undefined ){
			console.log('doing nothing in output manager');
			return;
		}
		*/

		var r = this.grid.regions[index];
		console.log( r );


		if(this.shapes[index] === undefined){ // add region
			console.log('create a vector region' );
			for(var i = 0 ; i < r.cells.length; i++){
				var celllist = [r.cells[i].x, r.cells[i].y,  colours[index] ];
				// TODO 
				var data = CellToPushNote( r.cells[i].x, r.cells[i].y, colours[index] );
				var msg = [ 144, data[0], data[1] ];
				console.log( msg );
				Max.outlet('midi-output', msg);
			}
		}else{ // modify the region
			console.log('modify a region' );
			var c = new Cell(vectorWithOrigin[0], vectorWithOrigin[1]);
			for(var i = 2; i < vectorWithOrigin.length; i++){

				if(vectorWithOrigin[i] !== this.shapes[index][i]){
					if(vectorWithOrigin[i] > this.shapes[index][i]){
						for(var j = this.shapes[index][i]; j < vectorWithOrigin[i]; j++){
							var x = vectorWithOrigin[0] + j;
							var y = vectorWithOrigin[1] + i - 2;
							var celllist = [x, y, colours[index]];
							// TODO

							var msg = CellToPushNote( x, y, colours[index] );
							Max.outlet('midi-output', msg);
						}
					}else{
						for(var j = vectorWithOrigin[i]; j < this.shapes[index][i]; j++){
							var x = vectorWithOrigin[0] + j;
							var y = vectorWithOrigin[1] + i - 2;
							var celllist = [x, y, 0];
							var msg = CellToPushNote( x, y, colours[index] );
							msg[2] = 0;
							// TODO - also set this to 0? 
							//outlet(3, celllist);
							Max.outlet('midi-output', msg);
						}
					}
				}
			}
		}

		this.shapes[index] = vectorWithOrigin;
	}
}


// DEAD CODE - Unused mapping objects and CellToPushNote duplicate
// Active CellToPushNote is in lib/mediator.js
/*
var abletonPushMapping = {
    name : "Ableton Push",
    noteToCell: function CellToPushNote(x, y, colour){
        var note = y*8 + x + 36;
        var outputcolour = 3;
        if(colour === 'blue'){
            outputcolour = 45;
        }
        //outlet(1, note, outputcolour);
        return midinote;
    }
};

var abletonPush3Mapping = {};
var p5jsMapping = {};
var novationLaunchPadMapping = {};

function midiOutput(msg, mappingName){
    switch( mappingName ){
        case abletonPushMapping.name :
            return abletonPushMapping.noteToCell(msg.note, msg.velo);
        case abletonPush3Mapping.name :
            break;
        case p5jsMapping.name :
            break;
        default:
            break;
    }
}
*/







/*
//https://forum.ableton.com/viewtopic.php?t=192920
BLACK = 0

WHITE_HI = 3
WHITE_LO = 1

RED_HI = 120
RED_LO = 7

ORANGE_HI = 60
ORANGE_LO = 10

YELLOW_HI = 13
YELLOW_LO = 15

GREEN_HI = 21
GREEN_LO = 23

CYAN_HI = 33
CYAN_LO = 35

BLUE_HI = 45
BLUE_LO = 47

INDIGO_HI = 49
INDIGO_LO = 51

VIOLET_HI = 53
VIOLET_LO = 55
*/

module.exports = OutputManager;
