// receive midi notes - output cells
const Cell = require('./cell.js');

class InputManager{
	constructor(){
	};

	input( n, v ){
        if ( n > 99 || n < 36){
            console.log('note out of range');
            return;
        }

        if( v === 0 ){
            //console.log('note off');
            return null;
        }else{
            var x = (n - 36) % 8;
            var y = Math.floor(( n - 36 ) / 8 );
            var c = new Cell(x, y);
            //console.log(c);
            return c;
        }
	}

    cellInput(x, y, v){
        if( v === 0){
            return null;
        }else{
            var c = new Cell(x, y);
            return c;
        }
    }
}

var abletonPushMapping = {
    name : "Ableton Push",
    noteToCell: function pushNoteToCellPosition(note, velo){
        if(velo == 0 ){
            outlet(0, "reset");
            return;
        }

        var position = [1,1];
        position[0] = (note - 36) % 8 ;
        position[1] = Math.floor(( note - 36) / 8);
        return position;
    }
};

var abletonPush3Mapping = {};
var p5jsMapping = {};
var novationLaunchPadMapping = {};

function midiInput(msg, mappingName){
    // find event.note in json
    // return mapped thing? 
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

module.exports = InputManager;
