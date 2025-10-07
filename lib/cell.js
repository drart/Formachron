class Cell{
	constructor(x, y) {
		this.type = "Cell";
		this.x = x;
		this.y = y;	
	}
	//this.midinote;

	equals (other){
		if (this.y === other.y && this.x === other.x) return true;
			return false;
	};

/*
exports.Cell.prototype.fromMIDINote = function(midinote){
	this.y = Math.floor( (midinote[1] - 36 ) / 8);
	this.x = (midinote[1] - 36 )% 8;
};

exports.Cell.prototype.toMIDINote = function(){
	return (Math.floor(this.x + 36) / 8) + ((this.y + 36) % 8);
};
*/

};

module.exports =   Cell ;
