'use strict'

const express = require('express'); // const bodyParser = require('body-parser'); // const path = require('path');
const fs = require('fs');
const util = require('util');
var jsscompress = require("js-string-compression");
const environmentVars = require('dotenv').config();
var ss = require('socket.io-stream');
const app = express();
var cors = require('cors');
const port = process.env.PORT || 1337;
const server = require('http').createServer(app);
var io = require('socket.io')(server, { origins: '*:*'});
let config = require('./config/config.json');
const Voice = require('./lib/voice/Voice');
const Ai= require('./lib/ai/Ai');
const markup2Response = require('./lib/markup_to_response/markup2Response');



const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);

let pauseListening = false;
let FILE_PREFIX = '../../Animation/lipSync/Sounds/';
let IDLE_TIME = 600; // seconds


app.use(cors());

app.use('/assets', express.static(__dirname + '/public'));
app.use('/session/assets', express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

// =========================== ROUTERS ================================ //

app.get('/', function (req, res) {
    res.render('index', {});
});

app.use('/', function (req, res, next) {
    next(); // console.log(`Request Url: ${req.url}`);
});

// =========================== SOCKET.IO ================================ //

io.on('connection', async function (client) {
    console.log('Client Connected to server');
    let firstTimeInteraction = true;
    let recognizeStream = null;
    let botId = "";
    let sessionId = "";
    let voice = new Voice(config);
    let ai;
    let lastActiveTime = new Date();
    let inputTextOnly = false; // If true, the user utterance from voice channel will not be passed to the AI. Only text channel is considered.
    let expireCheck = setInterval(function () {
        let currentTime = new Date();
        if (currentTime.getTime() - lastActiveTime.getTime() > IDLE_TIME*1000)
        {
            stopRecognitionStream
            client.emit('sessionEnd', {reason:'TIME_OUT',sessionId:sessionId});
            client.disconnect(true);
            
            clearInterval(expireCheck);
        }
    },1000);


    client.on('disconnect',function(){
        

    });

    client.on('join', function (data) {
        botId = data.botId;
        sessionId = data.sessionId;
        if (botId !== config.botId || botId === '' || sessionId === ''){
            client.emit('sessionEnd', {reason:'INVALID_CONFIG',sessionId: sessionId});
            client.disconnect(true);
            
        }
        ai = new Ai({...config,sessionId:sessionId});
        

        client.emit('joinAck', {sessionId: sessionId});
    });

    client.on('messages', function (data) {
        client.emit('broad', data);
    });

    client.on('startVoiceStream', function (data) {
        startRecognitionStream(this, data);
    });

    client.on('endVoiceStream', function (data) {
        stopRecognitionStream();
    });

    client.on('binaryData', function (data) {
        if (!pauseListening){
            voice.stt.sttWrite(data);
        }
    });

    client.on('textData',function (data) {
        inputTextOnly = false;
        talkToBotText(this,data);
    });

    client.on('sessionEnd',function(data){
        stopRecognitionStream();
        client.emit('sessionEnd', {reason:'FORCED',sessionId: sessionId});
        client.disconnect(true);
        
        clearInterval(expireCheck);
    });

    async function talkToBotText(client,data) {
        let botResponse = {}, aiResponse = {},fileName='';

        if(firstTimeInteraction)
        {
            
            firstTimeInteraction = false;
        }

        lastActiveTime = new Date(); 

        console.log('Before talk');
        // Bot api call here
        if (inputTextOnly && data.inputMode === 'VOICE')
        {
            let randomText = config.general.inputTextOnlyGuidance[Math.floor(Math.random() * 100) % config.general.inputTextOnlyGuidance.length];
            botResponse = markup2Response([randomText]);
        }
        else{
            if(data.greeting === true) {
                aiResponse = await ai.engine.talk('', true);
                // aiResponse =  {text:config.general.greeting};
            }
            else
            {
                
                aiResponse = await ai.engine.talk(data.text);
                
            }
            console.log(aiResponse);
            botResponse = markup2Response(aiResponse.text);
            console.log(botResponse);
            

            let collectedData = aiResponse.data;

            if(botResponse.dataName)
            {
                collectedData[botResponse.dataName] = typeof botResponse.dataValue == 'undefined' ? data.text : botResponse.dataValue;
            }

            
        }

        if (botResponse.commands)
        {
            botResponse.commands.forEach(function (botCommand) {
                if (botCommand.command === 'INPUT_TEXT_ONLY'){ // Only texts are allowed
                    inputTextOnly = true;
                }

                if (botCommand.command === 'END'){ // Gracefully end the conversation
                    setTimeout(function () {
                        stopRecognitionStream();
                        client.emit('sessionEnd', {reason:'CONV_COMPLETED',sessionId: sessionId});
                        client.disconnect(true);
                        
                        clearInterval(expireCheck);
                    },1000)
                }

                
            });
        }
        console.log('After talk');
        // Generate speech data
        if (data.outputMode === 'VOICE')
        {
            let promiseList = [];
            fileName = 'a'; // TODO
            console.log('Before generate voice....');
            botResponse.voiceScripts.forEach(function (voiceScript) {
                promiseList.push(generateVoice(voiceScript));
            });

            Promise.all(promiseList).then(promiseResolvedValues=>{
                promiseResolvedValues.forEach(function (voiceData,voiceIndex) {
                    console.log('Voice generation done');
                    client.emit('binaryData',voiceData);
                    if (voiceIndex === botResponse.voiceScripts.length-1)
                        client.emit('voiceStartFlag',{status:true});
                });
            })


            console.log('After generate voice....');

            botResponse = {...botResponse,lipSyncToken:fileName}
        }

        if (data.inputMode === 'VOICE'){
            botResponse.inputText = data.text.charAt(0).toUpperCase() + data.text.slice(1)
        }
        client.emit('textData',botResponse)
    }

    function startRecognitionStream(client, data) {
        console.log('--------------------------Session started-----------------------------');

        client.emit('startRec', '');

        voice.stt.on('sttOnSentenceDetect',(data) => {
            // pauseListening = true;
            return talkToBotText(client,{
                text: data.results[0].alternatives[0].transcript,
                inputMode: 'VOICE',
                outputMode: 'VOICE'
            });
        });
        voice.stt.sttStartSession();
    }

    function stopRecognitionStream() {
        client.emit('pauseRec', '');
        console.log('--------------------------Session ended-----------------------------');
        voice.stt.sttEndSession();
    }

    async function generateVoice(text) {

        console.log('Generated text');

        // Write the binary audio content to a local file
        let binaryContent = await voice.tts.synthesize(text);
        
        return binaryContent;
    }
});

// =========================== START SERVER ================================ //

server.listen(port, "0.0.0.0", function () { //http listen, to make socket work
    // app.address = "127.0.0.1";
    console.log('Server started on port:' + port)
});
