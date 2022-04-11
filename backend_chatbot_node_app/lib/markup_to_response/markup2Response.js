const isHtml = require('is-html');
const html2json = require('html2json').html2json;

function processEmbeddedContent(botUtterance){
    let processors = {
        'url': function (input,mode) {
            let mainRegex = /\[\s*url\(\s*[A-Za-z0x\s\.\/\:\-\_]+\s*,\s*[A-Za-z0x\s\.\/\:\-\_]+\)\s*\]/g;
            let arg1 = /\(\s*[A-Za-z0x\s\.\/\:\-\_]+\s*,/g;
            let arg2 = /,\s*[A-Za-z0x\s\.\/\:\-\_]+\)/g;
            let allMatches = input.match(mainRegex);
            let extractedArg1 = '';
            let extractedArg2 = '';
            let argMatch = null;
            let output = input;

            // console.log(input);
            // console.log(allMatches);

            if (allMatches !== null)
            {
                allMatches.forEach((matchedString)=>{
                    argMatch = matchedString.match(arg1);
                    if (argMatch !== null) {
                        extractedArg1 = argMatch[0];
                        extractedArg1 = extractedArg1.substring(1, extractedArg1.length - 1).trim();

                        argMatch = matchedString.match(arg2);
                        if (argMatch !== null) {
                            extractedArg2 = argMatch[0];
                            extractedArg2 = extractedArg2.substring(1, extractedArg2.length - 1).trim();

                            // console.log(extractedArg1);

                            if (mode === 'VOICE_SCRIPT') {
                                output = output.split(matchedString).join(extractedArg1);

                            }

                            if (mode === 'TEXT') {
                                output = output.split(matchedString).join('<a href="' + extractedArg2 + '" target="_blank">' + extractedArg1 + '</a>');
                            }
                        }
                    }

                });
            }

            return output;

        }
    }

    let processedUtterance = {
        text: botUtterance,
        voiceScript: botUtterance,
    }

    Object.keys(processors).forEach(function (processorName) {
        processedUtterance.text = processors[processorName](processedUtterance.text,'TEXT');
        processedUtterance.voiceScript = processors[processorName](processedUtterance.voiceScript,'VOICE_SCRIPT');
    });

    return processedUtterance;
}

module.exports = function (responseMarkupArray){

    let response = {
        text: [],
        voiceScripts: [],
        graphicElements:[],
        commands:[],
        tags:[],
        sttClue:[]
    }

    responseMarkupArray.forEach(function ( responseMarkup) {

        if(isHtml(responseMarkup) || ! /<\/?[a-z][\s\S]*>/.test(responseMarkup))
        {
            let json = html2json(responseMarkup);
            let currentProcessedUtterance = {};
            json.child.forEach(function (element) {

                if(element.node === 'text'){
                    currentProcessedUtterance = processEmbeddedContent(element.text.trim());
                    response.text.push(currentProcessedUtterance.text);
                    response.voiceScripts.push(currentProcessedUtterance.voiceScript+' <break time="500ms" /> ');
                }

                if(element.node === 'element')
                {
                    switch (element.tag) {
                        case 'select':
                            if (element.child)
                            {
                                let selectObj = {
                                    type: 'select',
                                    options: []
                                };
                                let voiceCluster = '';
                                element.child.forEach(function (option) {
                                    if (option.child && option.child[0].node === 'text')
                                    {
                                        selectObj.options.push(option.child[0].text.trim());
                                        voiceCluster += option.child[0].text.trim()+' <break time="500ms" /> ';
                                    }
                                });
                                response.voiceScripts.push(voiceCluster);
                                response.graphicElements.push(selectObj);
                            }
                            break;

                        case 'a':
                            let linkObj = {
                                type: 'link',
                                href: element.attr.href
                            };
                            if (element.child && element.child[0].node === 'text')
                                linkObj.text = element.child[0].text;
                            response.graphicElements.push(linkObj);
                            break;

                        case 'img':
                            response.graphicElements.push({
                                type: 'image',
                                src: element.attr.src
                            });
                            break;
                        case 'meta':
                            if (element.attr.command)
                            {
                                if (typeof element.attr.command == 'string') {
                                    response.commands.push({
                                        command: element.attr.command
                                    });
                                }
                                else if(Array.isArray(element.attr.command) ) { // assume array by space
                                    element.attr.command.forEach((item) => {
                                        response.commands.push({
                                            command: item
                                        });
                                    });

                                }
                                response.commands.push({
                                    command: element.attr.command
                                });
                            }

                            if (element.attr.tags){
                                if(typeof element.attr.tags == 'string')
                                    response.tags = response.tags.concat(element.attr.tags.split(',').map(x => x.trim()).filter(x => x !== ','));
                                else // assume array
                                    response.tags = response.tags.concat(element.attr.tags.filter(x => x !== ','));

                                response.tags  = response.tags.map(tag=>
                                    {
                                        return tag.replace(/([A-Z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); } ).trim(); // "CamelCase" to "Camel Case"
                                    });
                            }
                            if (element.attr.stt_clue)
                            {
                                let sttClue="";
                                if (typeof element.attr.stt_clue == 'string') {
                                    sttClue =  element.attr.stt_clue;
                                }
                                else if(Array.isArray(element.attr.stt_clue) ) { // assume array by space
                                    element.attr.stt_clue.forEach((item,i) => {
                                        sttClue += (i==0 ? "": " ")+item;
                                    });

                                }
                                response.sttClue.push(sttClue);
                            }
                            if (element.attr.data_tag && typeof element.attr.data_tag == 'string')
                                response.dataTag = element.attr.data_tag.replace(/([A-Z])/g, ' $1').replace(/^./, function(str){ return str.toUpperCase(); } ).trim();
                            if (element.attr.data_name && typeof element.attr.data_name == 'string')
                                response.dataName = element.attr.data_name;
                            if (response.dataName && element.attr.data_value){
                                if (typeof element.attr.data_value == 'string') {
                                    response.dataValue =  element.attr.data_value;
                                }
                                else if(Array.isArray(element.attr.data_value) ) { // assume array
                                    response.dataValue = '';
                                    element.attr.data_value.forEach((item) => {
                                        response.dataValue += item;
                                    });

                                }

                            }
                            break;
                    }
                }

            })
        }
    });
    return  response;
}
