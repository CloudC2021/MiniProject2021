const GoogleDialogFlow = require('./GoogleDialogFlow');

module.exports = class  {
    constructor(config) {
        switch (config.voice.engine) {
            case 'GOOGLE':
                this.engine = new GoogleDialogFlow(config.sessionId,config.ai);
                break;
        }
    }
}