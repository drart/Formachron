class SyncManager {
	constructor(){
		this.mode = 0; // input, select, shift, mute
		this.padsDown = [];
	}

	changeMode( m ) {
		this.mode = m;
	}

	sync( c ){
		if(this.mode === 0){ // entry mode - default
			if(padsDown.length === 2 || padsDown.length === 1){
				post('new region with 1 or two touches');

				var r = new Region(padsDown); 

				var resultingRegion = thegrid.addRegion(r);
				if(resultingRegion === undefined){
					return;/// if region overlaps with another in a non-modifiable way then return
				}
				var regionVector = resultingRegion.toVector();
				var regionIndex = thegrid.getRegionIndex(resultingRegion);

				/// MODE MANAGER TODO BETTER NAMING
				output.something(resultingRegion.toVectorWithOrigin(), regionIndex);

				outlet(2, regionIndex);
				outlet(1, regionVector); 

				//var message = [regionIndex];
				//message.unshift('voice');
				//outlet(0, message);
				//message = [regionVector];
				//message.unshift('shape');
				//message = [sequencer.sequences[regionIndex].getMatches()];
				//message.unshift('matches');

				///// TODO put in other object
				///////// vectoToMatches from sequence.js
				// var sum = 0;
				var myarray = [];
				var beatLength = 1 / regionVector.length;

				for(var i = 0; i < regionVector.length; i++){
					for(var j = 0; j < regionVector[i]; j++){
						myarray.push( i*beatLength + (beatLength / regionVector[i])*j );
					}
				}
				sequences[regionIndex] = new Sequence();
				sequences[regionIndex].vectorToMatches( regionVector );
				post( regionIndex );
				outlet(0, myarray);
				//// end vectorToMatches
				//////// 

				reset();
			}	
			if(padsDown.length > 2){
				post('region with more than 2 touches');
				var r = new Region(padsDown);


				var resultingRegion = thegrid.addRegion(r);
				if(resultingRegion === undefined){
					return;/// if region overlaps with another in a non-modifiable way then return
				}
				post('here');

				var regionVector = resultingRegion.toVector();
				post( regionVector );


			}
		}
		if(this.mode === 2){ // select mode
			for(var i = 0; i < thegrid.regions.length; i++){
				if(thegrid.regions[i].contains(c)){
					post(i); /// TODO SELECT THE REGION OR SELECT THE CELL?
				}
			}
		}
		if(this.mode === 1){ // shift mode
			for(var i = 0; i < thegrid.regions.length; i++){
				post('checking grid for cell');
				if(thegrid.regions[i].containsCell(c)){
					var shift = thegrid.regions[i].cellIndex(c);
					var phaseshift = sequences[i].getMatches()[shift];

					post("the shift is: ");
					post( shift );
					post( phaseshift );
					post("\n")

					outlet(2, i); // regionIndex to address voice
					outlet( 4, phaseshift );
				}
			}
		}


	}

}


export { SyncManager }
