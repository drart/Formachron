
class Grid{

	constructor(){
		this.type = "Grid";
		this.regions = [];
		this.allowOverlap = false;
	}

    addRegion (region){
        if(this.allowOverlap){
            // Find first null slot when overlap is allowed
            var insertIndex = this.findFirstNullSlot();
            if(insertIndex !== -1){
                this.regions[insertIndex] = region;
                return region;
            } else {
                this.regions.push(region);
                return region;
            }
        }

        var doesOverlap = this.doesRegionOverlap( region );
        if( doesOverlap ){
            var overlappingRegions = this.getOverlappingRegions(region);
            if(overlappingRegions.length === 1){
                if(region.leftSideAligned(overlappingRegions[0])){
                    overlappingRegions[0].modify(region);
                    return overlappingRegions[0];
                }
            }
            return undefined;
        }else{
            // Find first null slot to reuse removed region indices
            var insertIndex = this.findFirstNullSlot();
            if(insertIndex !== -1){
                this.regions[insertIndex] = region;
                return region;
            } else {
                this.regions.push(region);
                return region;
            }
        }
    }

    tryAddRegion( region ){
        if(this.allowOverlap){
            // Use same slot-filling logic as addRegion
            var insertIndex = this.findFirstNullSlot();
            if(insertIndex !== -1){
                this.regions[insertIndex] = region;
                return region;
            } else {
                this.regions.push(region);
                return region;
            }
        }

        var doesOverlap = this.doesRegionOverlap( region );
        if( doesOverlap ){
            var overlappingRegions = this.getOverlappingRegions(region);
            if(overlappingRegions.length === 1){
                if(region.leftSideAligned(overlappingRegions[0])){
                    overlappingRegions[0].tryModify(region);
                    return overlappingRegions[0];
                }
            }
            return undefined;
        }else{
            // Use same slot-filling logic as addRegion
            var insertIndex = this.findFirstNullSlot();
            if(insertIndex !== -1){
                this.regions[insertIndex] = region;
                return region;
            } else {
                this.regions.push(region);
                return region;
            }
        }
    }

    checkRegion( region ){
        var overlappingRegions = this.getOverlappingRegions( region );
        if( overlappingRegions.length > 1 ){
            return false;
        }
        if( overlappingRegions.length === 1 ){
            if( region.leftSideAligned( overlappingRegions[0] ) ){
                return true;
            }else{
                return false;
            }
        }
        if( overlappingRegions.length === 0 ){
            return true;
        }
    }

    doesRegionOverlap (region){
        for ( var i = 0; i < this.regions.length; i++){
            // Skip null entries from removed regions
            if(this.regions[i] && this.regions[i].doesOverlap(region) ){
                return true;
            }
        }
        return false;
    }

    getOverlappingRegions (region){
        var overlappingRegions = [];
        for(var i = 0; i < this.regions.length; i++){
            // Skip null entries from removed regions
            if( this.regions[i] && this.regions[i].doesOverlap( region ) ){
                overlappingRegions.push( this.regions[i] );
            }
        }
        return overlappingRegions;
    }

	containsCell (cell){
		for(var i = 0; i < this.regions.length; i++){
			// Skip null entries from removed regions
			if(this.regions[i] && this.regions[i].containsCell(cell)){
				return true;
			}
		}
		return false;
	};

    getRegionIndex (region){
        for(var i = 0; i < this.regions.length; i++){
            // Skip null entries from removed regions
            if(this.regions[i] && this.regions[i].equals(region) ){
                return i;
            }
        }
        return -1;
    }

	removeRegion (region){
		var regionLocation = this.getRegionIndex( region );

		if( regionLocation !== -1){
			// Set to null instead of splice to preserve indices
			this.regions[regionLocation] = null;
		}
	}

	findFirstNullSlot (){
		// Find first null slot to reuse removed region indices
		for(var i = 0; i < this.regions.length; i++){
			if(this.regions[i] === null){
				return i;
			}
		}
		return -1; // No null slots found
	};

	moveRegion (region, newOrigin){ // newOrigin is a cell representing the new bottom left (or origin of the cell)
		// Calculate offset from current origin to new origin
		var currentOrigin = region.bottomLeft;
		var dx = newOrigin.x - currentOrigin.x;
		var dy = newOrigin.y - currentOrigin.y;

		// Check validity of all new positions before moving
		for(var i = 0; i < region.cells.length; i++){
			var newX = region.cells[i].x + dx;
			var newY = region.cells[i].y + dy;

			// NOTE: Hardcoded grid size (8x8, indices 0-7) for Ableton Push
			// TODO: Make extensible by adding width/height properties to Grid class
			if(newX < 0 || newX > 7 || newY < 0 || newY > 7){
				return false; // Out of bounds
			}

			var newCell = {x: newX, y: newY};

			// Check if new position is occupied by another region
			for(var j = 0; j < this.regions.length; j++){
				if(this.regions[j] && this.regions[j].containsCell(newCell)){
					// Cell is occupied - check if it's the region we're moving
					if(this.regions[j] !== region){
						return false; // Overlaps with a different region
					}
				}
			}
		}

		// Valid move - update region cells in place
		for(var i = 0; i < region.cells.length; i++){
			region.cells[i].x += dx;
			region.cells[i].y += dy;
		}
		region.checkCorners(); // Recalculate bottomLeft, topRight, etc.

		return true;
	}

	testTwoObjects ( object1, object2 ){

		// this would be better
		//return( Object.keys(object1).every(function(key){ return object1[key] === object2[key]; });
		//return Object.keys(object1).every((key) =>  object1[key] === object2[key]);

		// works
		return JSON.stringify(object1) === JSON.stringify(object2);
	}


	//exports.Grid.prototype.toString = function(){ return "grid"; );

}

//export { Grid };
module.exports = Grid;
