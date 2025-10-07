const Note = require('./note.js');

class Sequence{
	constructor(){
		this.type = "Sequence";
		this.vector; /// takes the vector representation of the region
		this.origin; /// origin of the region
		this.matches; // array of floats representing matches for what~ max/msp object
		this.notes = [];  // array of objects representing each notes
		this.previousStep = 0; // useful if steps aren't sequential
		this.currentStep = 0;
		this.shift = 0;
        this.repetitions = Infinity;

		// Pitch pattern modes (using numbers for consistency with mediator.mode)
		this.loopMode = 0; // 0: forward, 1: reverse, 2: random, 3: pingpong
		this.resetMode = 0; // 0: loop, 1: beat
		this.endBehavior = 0; // 0: hold, 1: repeat
		this.subdivisionMode = "SIXTEENTH_TUPLET"; // Default subdivision mode
	}


	vectorToMatches(vector){
		this.vector = vector;

		var sum = 0;
		var myarray = []
		for(var i = 0; i < vector.length; i++){
			sum += vector[i];
		}

		/// todo do I need to compute shift in this way here? 
		var beatLength = 1 / vector.length;
		for(var i = 0; i < vector.length; i++){
			for(var j = 0; j < vector[i]; j++){
				myarray.push( i*beatLength + (beatLength / vector[i])*j );
			}
		}
		// todo make api better rather than modifying internal state
		this.matches = myarray;

		return this.getMatches();
	}

	// this modifies the matches vector with the shift baked in
	vectorToMatchesWithShift(){
		//this.vector = vector;
		var vector = this.vector;

		var sum = 0;
		var myarray = []
		var ratios = [];
		for(var i = 0; i < vector.length; i++){
			sum += vector[i];
			for(var j = 0; j < vector[i]; j++){
				ratios.push( 1 / (vector[i] * vector.length) );
			}
		}

		/// todo do I need to compute shift in this way here? 
		var beatLength = 1 / vector.length;
		var position = 0;
		for(var i = 0; i < ratios.length; i++){
			var index = (i + this.shift) % ratios.length;
			myarray.push( position );
			position += ratios[index];
		}
		// todo make api better rather than modifying internal state
		//this.matches = myarray;

		return myarray;
	}


	vectorWithOriginToMatches (vectorWithOrigin){
		var orig = [vectorWithOrigin[0], vectorWithOrigin[1]];
		this.origin = orig;
		// TODO hacky
		vectorWithOrigin.shift();
		vectorWithOrigin.shift();
		this.vectorToMatches(vectorWithOrigin);
	}

	getMatches(){
		return this.matches;
	}


	getShiftedPhaseStart (){
		return this.matches[this.shift];
	}

	setShift( s ){
		this.shift = s;
	}

	setStep( s ){

        if( s === this.currentStep ){
            console.log('sequence: already on this step')
            return; 
        }

        // if this.repetitions > 0 else return;
		this.previousStep = this.currentStep;
		this.currentStep = s;
        //console.log( "current step is : " + this.currentStep);
        if( this.currentStep === 0 ){
            this.repetitions--;
        }
	}
	
	getStep(){
		return this.currentStep;
	}

    getPreviousStep(){
        return this.previousStep;
    }

	setVector(vector){
		this.vector = vector;

		var sum = 0;
		var myarray = []
		for(var i = 0; i < vector.length; i++){
			sum += vector[i];
		}

		/// todo do I need to compute shift in this way here? 
		var beatLength = 1 / vector.length;
		for(var i = 0; i < vector.length; i++){
			for(var j = 0; j < vector[i]; j++){
				myarray.push( i*beatLength + (beatLength / vector[i])*j );
				this.notes.push( new Note(60, 127, 1) );
			}
		}
		// todo make api better rather than modifying internal state
		this.matches = myarray;
	}

	getVector(){
		return this.vector;
	}

	setProbabilities( p ){
		for( var i = 0; i < this.notes.length; i++){
			this.notes[i].probability = p;
		}
	}

	getProbabilities(){
		var prob = [];
		for ( var i = 0; i < this.notes.length; i++){
			prob.push( this.notes[i].probability );
		}
		return prob;
	}

	getProbability( i ){
		return this.notes[i].probability;
	}

	setProbability( i, p ){
		this.notes[i].probability = p;
	}

    getNotes(){
        return this.notes;
    }

	// Get pitch list from notes array
	getPitchList(){
		return this.notes.map(n => n.pitch);
	}

	// Set loop mode (number: 0=forward, 1=reverse, 2=random, 3=pingpong)
	setLoopMode(mode){
		if(mode >= 0 && mode <= 3){
			this.loopMode = mode;
		} else {
			post('Invalid loop mode: ' + mode + '. Valid: 0-3 (0=forward, 1=reverse, 2=random, 3=pingpong)\n');
		}
	}

	// Set reset mode (number: 0=loop, 1=beat)
	setResetMode(mode){
		if(mode >= 0 && mode <= 1){
			this.resetMode = mode;
		} else {
			post('Invalid reset mode: ' + mode + '. Valid: 0-1 (0=loop, 1=beat)\n');
		}
	}

	// Set end behavior (number: 0=hold, 1=repeat)
	setEndBehavior(behavior){
		if(behavior >= 0 && behavior <= 1){
			this.endBehavior = behavior;
		} else {
			post('Invalid end behavior: ' + behavior + '. Valid: 0-1 (0=hold, 1=repeat)\n');
		}
	}

	// Get current pitch pattern modes
	getPitchModes(){
		return {
			loopMode: this.loopMode,
			resetMode: this.resetMode,
			endBehavior: this.endBehavior
		};
	}

	// Expects: "QUARTER", "QUARTER_TUPLET", "EIGHTH", etc.
	setSubdivisionMode(mode){
		this.subdivisionMode = mode;
	}

	getSubdivisionMode(){
		return this.subdivisionMode;
	}

}

module.exports = Sequence;
