class Note{
	constructor(n,v,p){
		this.pitch = n;
		this.velocity = v;
		this.probability = p;
		this.mute = false;
	}
};

module.exports =   Note ;
