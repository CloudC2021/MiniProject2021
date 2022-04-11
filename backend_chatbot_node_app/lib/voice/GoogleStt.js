const speech = require('@google-cloud/speech');
const config = require('../../config/config.json');

const LOG_ENABLED = true;
const STREAM_RESTART_INTERVAL = 65; // Seconds
const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'en-US'; //en-US

let request = {
    config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        languageCode: languageCode,
        profanityFilter: false,
        enableWordTimeOffsets: false,
        phoneCall: false,
        speechContexts: [{
            phrases: config.voice.options && config.voice.options.contexts ? config.voice.options.contexts : []
           }] // add your own speech context for better recognition
    },
    interimResults: false // If you want interim results, set this to true
};

module.exports = class GoogleStt {

    constructor(config) {
        let ground = this;

        this._sttListening = true;
        this._speachClient = new speech.SpeechClient(config.options.authentication);
        this._sttOnSentenceDetectCallback = function(){};

        request.config.languageCode = config.language;

        this._sttOnDataCallback = function(data){
            if (LOG_ENABLED)
            {
                process.stdout.write(
                    (data.results[0] && data.results[0].alternatives[0])
                        ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
                        : `\n\nReached transcription time limit, press Ctrl+C\n`);

            }

            // if end of utterance, let's restart stream
            // this is a small hack. After 65 seconds of silence, the stream will still throw an error for speech length limit
            if (data.results[0] && data.results[0].isFinal) {
                ground._sttOnSentenceDetectCallback(data);
                ground.sttRestartSession()
            }
        }

    }

    sttStartSession(){

        // if(this._resetTimer === null || typeof this._resetTimer === 'undefined'){
        //
        //     console.log('Timer created for restart.')
        //
        //     this._resetTimer = setInterval( ()=> {
        //         console.log('Timer triggered');
        //         this.sttRestartSession();
        //     },STREAM_RESTART_INTERVAL*1000);
        // }

        this._sttStream = this._speachClient.streamingRecognize(request)
            .on('error', console.error)
            .on('data', this._sttOnDataCallback);

        this._sttListening = true;
    }

    sttRestartSession(){
        console.log('Restart called');
        this.sttEndSession();
        this.sttStartSession();
    }

    sttEndSession(){
        console.log('Session end called')
        if (this._sttStream) {
            this._sttStream.removeListener('data', this._sttOnDataCallback);
            this._sttStream.end();
            this._sttStream = null;
            this._sttListening = false;
        }
        if (this._resetTimer)
        {
            console.log('Cleared interval');
            clearInterval(this._resetTimer);
            this._resetTimer = null;
        }

    }

    sttWrite(data){
        if (this._sttListening && typeof this._sttStream !== 'undefined')
            this._sttStream.write(data);
    }

    on(event,callback){

        switch (event) {
            case 'sttOnSentenceDetect':
                this._sttOnSentenceDetectCallback = function (data) {
                    if (typeof callback === 'function'){
                        return callback(data);
                    }
                };
                break;
        }
    }
}