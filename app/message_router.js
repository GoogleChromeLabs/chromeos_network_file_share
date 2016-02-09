// Copyright 2015 Google Inc.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.



var MessageRouter = function() {
  log.debug('Initializing message router');

  this.messages = {};
  this.sendMessageFn = null;
  this.isInitialized = false;
  this.initializeResolver = getPromiseResolver();
};

MessageRouter.prototype.initialize = function(sendMessageFn) {
  log.debug('Setting sendMessageFn in message router');
  this.sendMessageFn = sendMessageFn;
  this.isInitialized = true;

  // Resolve once initialize has been called so that send message can wait
  // if necessary.
  this.initializeResolver.resolve();
};

MessageRouter.prototype.sendMessageWithRetry = function(
    message, opt_processDataFn) {
  var operation = message.functionName + '[' + message.messageId + ']';

  // TODO(zentaro): Should retry be configurable?
  return getRetryingPromise(function() {
    return this.sendMessage(message, opt_processDataFn);
  }.bind(this), operation, 3);
};

MessageRouter.prototype.sendMessage = function(message, opt_processDataFn) {
  var messageId = message.messageId;

  if (messageId in this.messages) {
    throw 'Cannot send duplicate message id';
  }

  // this.messages[messageId] = getTimedPromiseResolver(operation);
  this.messages[messageId] = {
    resolver: getPromiseResolver(),
    processDataFn: opt_processDataFn
  };

  // Always make sure initialization is complete before sending messages.
  this.initializeResolver.promise.then(function() {
    this.sendMessageFn(message);
  }.bind(this));

  return this.messages[messageId].resolver.promise;
};

MessageRouter.prototype.handleMessage = function(message) {
  var messageId = message.data.messageId;

  if (!(messageId in this.messages)) {
    log.warning('Ignoring message with unknown id ' + messageId);
    return;
  }

  var error = message.data.result.error;
  var failed = false;
  if (error) {
    failed = true;
    log.error('rejecting message ' + messageId + ' ' + error);
    this.messages[messageId].resolver.reject(error);
  } else {
    var processDataFn = this.messages[messageId].processDataFn;

    if (isDef(processDataFn)) {
      log.debug('streaming data for ' + messageId);
      this.messages[messageId].processDataFn(message.data);

      if (!message.data.hasMore) {
        // TODO(zentaro): Accumulate results here so that the final resolution
        // also gets the full data set.
        this.messages[messageId].resolver.resolve(null);
      }
    } else {
      if (message.data.hasMore) {
        failed = true;
        var errorMessage =
            'No processing function supplied for streamed message ' + messageId;
        log.error(errorMessage);
        this.messages[messageId].resolver.reject(errorMessage);
      } else {
        this.messages[messageId].resolver.resolve(message.data);
      }
    }
  }

  if (failed || !message.data.hasMore) {
    log.debug('Deleting state for message ' + messageId);
    delete this.messages[messageId];
  }
};
