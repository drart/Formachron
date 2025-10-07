//import { Cell } from "./cell.js"

const Cell = require('./cell.js');


// requires array of cells
class Region{
	constructor( arrayOfCells ){

		this.type = "Region";
		this.beats = 0; // int
		this.cells = []; //Array of Cells
        this.removedCells = [];
        this.shouldCompute = false;
        this.computedCells = [];



		// TODO
		// test to make sure arrayOfCells is an array
		// handle case where it is a single cell or an array with length 0
        
        if( arrayOfCells === undefined){
            return;
        }

		if( arrayOfCells.length === 1 ){
			this.bottomLeft = new Cell( arrayOfCells[0].x, arrayOfCells[0].y );
			this.topRight = new Cell( arrayOfCells[0].x, arrayOfCells[0].y );
			this.topLeft = new Cell( arrayOfCells[0].x, arrayOfCells[0].y );
			this.bottomRight = new Cell( arrayOfCells[0].x, arrayOfCells[0].y );

			this.beats = 1;

			this.cells.push( new Cell( arrayOfCells[0].x, arrayOfCells[0].y ));
		}

		if( arrayOfCells.length === 2 ) { // todo sort bottom to top
			var firstPoint = arrayOfCells[0];
			var secondPoint = arrayOfCells[1];	
			
			this.bottomLeft = new Cell(Math.min(firstPoint.x, secondPoint.x), Math.min(firstPoint.y, secondPoint.y));
			this.topRight = new Cell(Math.max(firstPoint.x, secondPoint.x), Math.max(firstPoint.y, secondPoint.y));
			this.topLeft = new Cell(Math.min(firstPoint.x, secondPoint.x), Math.max(firstPoint.y, secondPoint.y));
			this.bottomRight = new Cell(Math.max(firstPoint.x, secondPoint.x), Math.min(firstPoint.y, secondPoint.y));

			this.beats = 0;
			for(var i = this.bottomLeft.y; i <= this.topLeft.y; i++){
				for(var j = this.bottomLeft.x; j <= this.bottomRight.x; j++){
					var c = new Cell(j, i);
					this.cells.push(c);
				}
				this.beats++;
			} 
		}

		/// TODO
		if (arrayOfCells.length > 2 ) {
			// sort cells from bottom to top
			// find leftmost cell
			// todo check to see if there are two touches on a line

			// sort cells from bottom to top
			arrayOfCells.sort( function(a,b){
				return a.y - b.y;
			})
			// find leftmost cell
			var leftmost = arrayOfCells[0].x;
			for( var i = 1; i < arrayOfCells.length; i++){
				if( arrayOfCells[i].x < leftmost ){
					leftmost = arrayOfCells[i].x;
				}
			}

			var currentcell = arrayOfCells[0];
			var currentcellindex = 0;
			for( var y = arrayOfCells[0].y; y <= arrayOfCells[arrayOfCells.length-1].y; y++){
				if ( y != currentcell.y ){
					currentcellindex++;
					currentcell = arrayOfCells[ currentcellindex ];
				}
				for( var x = leftmost; x <= currentcell.x; x++){
					var c = new Cell( x, y );
					this.cells.push( c );
				}
			}

			this.beats = arrayOfCells[ arrayOfCells.length -1 ].y - arrayOfCells[0].y + 1;
		}
	}

	// requires region input
    modify(r){
        if( this.leftSideAligned(r) ){ // todo reduce one level of indentation

            var newRegionRows = []; // get the y indices of all of the rows in new region
            newRegionRows[0] = r.cells[0].y;
            for(var i = 1; i < r.cells.length; i++){
                if ( r.cells[i-1].y != r.cells[i].y ){
                    newRegionRows.push( r.cells[i].y );
                }
            }
        
            for (let i = 0; i < newRegionRows.length; i++ ){
                var cells = this.cells.filter( c => ( c.y === newRegionRows[i] && !r.containsCell(c) ));
                this.removedCells = this.removedCells.concat( cells );
            }
            console.log('modifying region');
            
            // difference between removed cells and current cells. removed the cells on the modified regions
            this.cells = this.cells.filter( x => !this.removedCells.includes(x));

            this.cells = this.cells.concat( r.cells.filter(c => !this.containsCell(c)) );

            this.cells.sort( function(a, b){
                if( a.y < b.y){
                    return -1; 
                }
                if( a.y > b.y){
                    return 1;
                }
                return 0; 
            });

            this.checkCorners();
            return true;
        }
        return false;
    }

    tryModify( r ){
        if( !this.leftSideAligned( r ) ){
            return undefined;
        }

        this.computedRegion = new Region();
        this.computedRegion.cells = [...this.cells];
        this.computedRegion.checkCorners();
        this.computedRegion.modify( r );
        console.log( this.computedRegion ) ;
        
        this.shouldCompute = true;
        return this.computedRegion;
    }

    compute(){
        this.cells = [...this.computedRegion.cells];
        this.computedRegion = undefined;
        this.checkCorners();
        this.shouldCompute = false;
    }

    checkCorners(){
        var firstPoint = this.cells[0];
        var secondPoint = this.cells[this.cells.length-1];
        this.bottomLeft = new Cell(Math.min(firstPoint.x, secondPoint.x), Math.min(firstPoint.y, secondPoint.y));
        this.topRight = new Cell(Math.max(firstPoint.x, secondPoint.x), Math.max(firstPoint.y, secondPoint.y));
        this.topLeft = new Cell(Math.min(firstPoint.x, secondPoint.x), Math.max(firstPoint.y, secondPoint.y));
        this.bottomRight = new Cell(Math.max(firstPoint.x, secondPoint.x), Math.min(firstPoint.y, secondPoint.y));
    }

	// returns vector representation of region
	toVector(){
		if(this.cells.length == 1){
			return [1];
		}

	    var regionlist = [];

		var s = 1;
		for(var i = 1; i < this.cells.length; i++){
			if(this.cells[i-1].y != this.cells[i].y){
				regionlist.push(s);
				s = 1
			}else{
				s++;
			}

		}
		regionlist.push(s);
	    return regionlist;
	}

	// returns vector representtion starting with origin, useful in maxmsp
	toVectorWithOrigin(){
		var origin = [this.bottomLeft.x, this.bottomLeft.y];
		var regionlist = this.toVector();
		var biglist = origin.concat(regionlist);
		return biglist;
	};

	// returns number of steps in region
	numberOfSteps(){
		return this.cells.length;
	};

	// requires cell input
	containsCell(c){
		for(var i = 0; i < this.cells.length; i++){
			if(c.x === this.cells[i].x && c.y === this.cells[i].y){
				return true;
			}
		}
		return false;
	}

	// requires cell input
	cellIndex(c){
	    if ( !this.containsCell(c) ){
		return -1;
	    }

	    for(var i = 0; i < this.cells.length; i++){
			if(c.x === this.cells[i].x && c.y === this.cells[i].y){
				return i;
			}
	    }
	}

	// regquires region input
	doesOverlap(r){
		for(var i = 0; i < r.cells.length; i++){
			if(this.containsCell(r.cells[i])){
				return true;
			}
		}
		return false;
	}

	// requires region input
	leftSideAligned(r){
		if(r.bottomLeft.x === this.bottomLeft.x){
			return true;
		}
		return false;
	}

	/////// legacy code, maybe useful?
	toNotes(){
		var newnotes = {};
		newnotes.notes = [];
		
		for (var i = 0; i < this.rows.length; i++){
			for (var j = 0; j < this.rows[i].length; j++){
				newnotes.notes.push({
					pitch: 60 + i + j, 
					start_time: (j / this.rows[i].length ) + i,
					duration: 0.5 / this.rows[i].length		
				});
			}
		}
		return newnotes;
	}

	equals(r){
	    return  r == this;
	}
}

//export { Region };
module.exports = Region;
