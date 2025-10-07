

class Sequencer{
    constructor(){
        this.sequences = [];
    }

    add( s ) {
        // Find first null slot to reuse removed sequence indices
        var insertIndex = -1;
        for(var i = 0; i < this.sequences.length; i++){
            if(this.sequences[i] === null){
                insertIndex = i;
                break;
            }
        }

        if(insertIndex !== -1){
            // Fill null slot
            this.sequences[insertIndex] = s;
            return insertIndex;
        } else {
            // No null slots, append to end
            this.sequences.push(s);
            return this.sequences.length - 1;
        }
    }

    remove( index ){
        // Set to null instead of splice to preserve indices
        if(index >= 0 && index < this.sequences.length){
            this.sequences[index] = null;
        }
    }

    get( i ){
        return this.sequences[i];
    }
}


module.exports = Sequencer;
