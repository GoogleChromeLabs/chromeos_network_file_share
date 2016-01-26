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

MessageRouter.prototype.sendMessageWithRetry = function(message) {
  var operation = message.functionName + '[' + message.messageId + ']';

  // TODO(zentaro): Should retry be configurable?
  return getRetryingPromise(function() {
    return this.sendMessage(message);
  }.bind(this), operation, 3);
};

MessageRouter.prototype.sendMessage = function(message) {
  var messageId = message.messageId;

  if (messageId in this.messages) {
    throw 'Cannot send duplicate message id';
  }

  //// Uncomment these and comment line below to enable some timing traces.
  // var operation = message.functionName + '[' + messageId + ']';
  // this.messages[messageId] = getTimedPromiseResolver(operation);
  this.messages[messageId] = getPromiseResolver();

  // Always make sure initialization is complete before sending messages.
  this.initializeResolver.promise.then(function() {
    this.sendMessageFn(message);
  }.bind(this));

  return this.messages[messageId].promise;
};

MessageRouter.prototype.handleMessage = function(message) {
  var messageId = message.data.messageId;

  if (!(messageId in this.messages)) {
    log.warning('Ignoring message with unknown id ' + messageId);
    return;
  }

  var error = message.data.result.error;
  if (error) {
    log.error('rejecting message ' + messageId + ' ' + error);
    this.messages[messageId].reject(error);
  } else {
    log.debug('resolving a message with id ' + messageId);
    this.messages[messageId].resolve(message.data);
  }

  delete this.messages[messageId];
};
