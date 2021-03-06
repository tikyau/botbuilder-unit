function BotMessage(config, bot, logReporter) {
  this.config = config;
  this.bot = bot;
  this.logReporter = logReporter;
  this.step = 0;
  this.beforeFunc = this.config.before || function () {
      return Promise.resolve();
    }
  this.afterFunc = this.config.after || function () {
      return Promise.resolve();
    };
}
BotMessage.prototype.getDefaultBotMessageValidator = function () {
  return (bot, receivedMessage) => {
    return new Promise((resolve, reject)=> {
      if (this.config.bot) {
        try {
          this.validateBotMessage(receivedMessage);
          this.validateSuggestedActions(receivedMessage);
        } catch (e) {
          this.logReporter.expectationError(this.step, receivedMessage, this.config);
          reject(e);
        }
      }
      else {
        let msg = `No input message in step configuration:\n${JSON.stringify(this.config)}`
        this.logReporter.error(step, msg);
        reject(msg);
      }
      resolve(true);

    })

  }
}
BotMessage.prototype.validate = function (step, receivedMessage) {
  this.step = step;
  return new Promise((resolve, reject) => {
    this.beforeFunc(this.config, this.bot)
      .then(() => {
        if ("undefined" != typeof this.config.bot) {
          let filter = null;
          if (typeof this.config.bot === 'function') {
            filter = this.config.bot
          }
          else {
            filter = this.getDefaultBotMessageValidator();
          }
          return filter(this.bot, receivedMessage);
        } else if (this.config.endConversation) {
          this.logReporter.endConversation(step);
          return true;
        } else if (this.config.typing) {
          this.logReporter.typing(step);
          return true;
        } else {
          let msg = `Unable to find matching validator. Step config:\n${JSON.stringify(this.config)}`;
          this.logReporter.error(step, msg);
          reject(msg);
        }
      })
      .then(() => {
        return this.afterFunc(this.config, this.bot);
      })
      .then(() => {
        resolve();
      })
      .catch((err) => {
        reject(err);
      })
  });
}

BotMessage.prototype.validateBotMessage = function (receivedMessage) {
  let isRegExp = this.config.bot.test ? true : false;
  let result = false;
  if (isRegExp) {
    result = this.config.bot.test(receivedMessage.text);
  } else {
    result = receivedMessage.text === this.config.bot;
  }
  if (!result) {
    let error = `Step #${this.step}, <${receivedMessage.text}> does not match <${this.config.bot}>`;
    throw (error);
  }
  return result;
}

BotMessage.prototype.validateSuggestedActions = function (receivedMessage) {
  let isSuggestedActionsNeeded = this.config.suggestedActions && this.config.suggestedActions.length;
  if (!isSuggestedActionsNeeded) {
    return;
  }
  let isSuggestedActionsPresent = receivedMessage.suggestedActions
    && receivedMessage.suggestedActions.actions
    && receivedMessage.suggestedActions.actions.length;
  if (!isSuggestedActionsPresent) {
    let msg = `Step #${this.step}, Message misses Suggested Actions`;
    throw (msg);
  }
  let isRangeError = this.config.suggestedActions.length != receivedMessage.suggestedActions.actions.length;
  if (isRangeError) {
    throw (`Step #${this.step}, amount of received suggested actions (${receivedMessage.suggestedActions.actions.length}) differs from expected  (${this.config.suggestedActions.length})`);
  }

  for (let i = 0; i < this.config.suggestedActions.length; i++) {
    let expectedAction = this.config.suggestedActions[i];
    let messageAction = receivedMessage.suggestedActions.actions[i];
    //
    let isSameType = messageAction['type'] == expectedAction.data['type'];
    let isSameValue = messageAction['value'] == expectedAction.data['value'];
    let isSameTitle = messageAction['title'] == expectedAction.data['title'];

    let isOk = isSameTitle && isSameType && isSameValue;
    if (!isOk) {
      let msg = `Step #${this.step}, Failed to compare actions with index ${i}. Reasons:`
        + (!isSameTitle ? "\n- Title differs" : '')
        + (!isSameType ? "\n- Wrong type of the card" : '')
        + (!isSameValue ? "\n - Messages are different" : '');

      throw (msg);
    }
  }
}

module.exports = BotMessage;