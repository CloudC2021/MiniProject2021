let GoogleStt  = require('./GoogleStt');
let GoogleTts  = require('./GoogleTts');

module.exports = class Voice {

    constructor(config){

        switch (config.voice.engine) {
            case 'GOOGLE':
                this.stt = new GoogleStt(config.voice);
                this.tts = new GoogleTts(config.voice);
                break;
        }
    }
}