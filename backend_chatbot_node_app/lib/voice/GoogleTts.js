const textToSpeech = require('@google-cloud/text-to-speech');
const ttsConfig = require('../../config/config.json');

module.exports = class GoogleTts {

    constructor(config){
        this.config = config;
        this._speechClient = new textToSpeech.TextToSpeechClient();
    }

    async synthesize(text){
        let request = {
            input: {ssml: ""},
            // Select the language and SSML voice gender (optional)
            // voice: {"name": 'en-US-Wavenet-F', "languageCode": "en-US"},
            voice: {
                "name": ttsConfig.voice.options.voiceType,
                "languageCode": ttsConfig.voice.language,
            },
            // select the type of audio encoding
            audioConfig: {audioEncoding: 'LINEAR16'},
        };
        request.voice.languageCode = this.config.language;
        request.input.ssml = '<speak>'+text+'</speak>';
        const [response]  = await this._speechClient.synthesizeSpeech(request);
        return response.audioContent;
    }

}