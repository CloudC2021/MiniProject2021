const dialogflow = require('@google-cloud/dialogflow');
const googleCredentials = require('../../'+process.env.GOOGLE_APPLICATION_CREDENTIALS);
module.exports = class GoogleDialogFlow {

    constructor(sessionId,config) {
        this.config = config;
        this.sessionId = sessionId;
        this._aiClient = new dialogflow.SessionsClient();
        this._context = null;

        // The path to identify the agent that owns the created intent.

        this._sessionPath = this._aiClient.projectAgentSessionPath(
            googleCredentials.project_id,
            this.sessionId
        );
    }

    async  _detectIntent(
        query,
        contexts,
        isInitial
    ) {


        // The text query request.
        let request = {};
        if (isInitial)
        {
            request = {
                session: this._sessionPath,
                queryInput: {
                    event: {
                        name: 'WELCOME',
                        languageCode: this.config.language
                    }
                },
            };
        }else {
            request = {
                session: this._sessionPath,
                queryInput: {
                    text: {
                        text: query,
                        languageCode: this.config.language,
                    },
                },
            };
        }

        if (contexts && contexts.length > 0) {
            request.queryParams = {
                contexts: contexts,
            };
        }

        const responses = await this._aiClient.detectIntent(request);
        return responses[0];
    }

    async talk(query,isInitial) {
        let context = this._context;
        let intentResponse;
        let allMessages = [];
        try {
            console.log(`Sending Query: ${query}`);
            intentResponse = await this._detectIntent(
                query,
                context,
                isInitial
            );
            this._context = intentResponse.queryResult.outputContexts;
            intentResponse.queryResult.fulfillmentMessages.forEach(function (message) {
                allMessages = allMessages.concat(message.text.text)
                // console.log(v.text);
                // console.log('....................................................................');
            });
            // console.log(allMessages);
            // console.log('....................................................................');

            let collectedData = {};
            Object.keys(intentResponse.queryResult.parameters.fields).forEach((key) => {
                collectedData[key] = intentResponse.queryResult.parameters.fields[key].stringValue
            });

            return {
                // text: intentResponse.queryResult.fulfillmentText
                text: allMessages,
                data: collectedData
            }
        } catch (error) {
            console.log(error);
        }
    }

}
