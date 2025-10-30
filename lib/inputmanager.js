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

        if( v === 0 ){ // note off
            return null;
        }else{
            var x = (n - 36) % 8;
            var y = Math.floor(( n - 36 ) / 8 );
            var c = new Cell(x, y);
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

module.exports = InputManager;
