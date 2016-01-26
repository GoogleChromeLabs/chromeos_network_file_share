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



/**
 * Simple credential store in local storage. Note each share can only be mounted
 * with a single credential.
 */
CredStore = function() {
  this.creds = {};
};

CredStore.LOCAL_STORAGE_KEY_NAME = 'creds';


/**
 * Returns a an object with a username, domain and password field if there is a
 * credential, otherwise null.
 */
CredStore.prototype.get = function(fileSystemId) {
  return this.creds[fileSystemId] || null;
};


/**
 * Returns true if credentials exist for this fileSystemId.
 */
CredStore.prototype.exists = function(fileSystemId) {
  return this.get(fileSystemId) != null;
};


/**
 * Adds a credential to the store. If a previous credential exists it will be
 * overwritten.
 */
CredStore.prototype.add = function(fileSystemId, domain, username, password) {
  this.creds[fileSystemId] = {
    domain: domain || '',
    username: username || '',
    password: password || ''
  };
};


/**
 * Removes any credential that may have been set for this file system.
 */
CredStore.prototype.clear = function(fileSystemId) {
  log.debug('Clearing credentials for ' + fileSystemId);
  delete this.creds[fileSystemId];
};


/**
 * Removes all saved credentials.
 */
CredStore.prototype.clearAll = function() {
  this.creds = {};
};


/**
 * Stores the current map of credentials to local storage. Returns
 * a promise that will resolve when storing is completed.
 */
CredStore.prototype.save = function() {
  var resolver = getPromiseResolver();

  var data = {};
  data[CredStore.LOCAL_STORAGE_KEY_NAME] = this.creds;
  chrome.storage.local.set(data, function() {
    if (chrome.runtime.lastError) {
      log.error('Failed saving creds ' + chrome.runtime.lastError.message);
      resolver.reject(chrome.runtime.lastError.message);
      return;
    }

    log.debug('Saved ' + keyCount(this.creds) + ' credentials');
    resolver.resolve();
  }.bind(this));

  return resolver.promise;
};


/**
 * Loads a map of credentials from local storage.
 */
CredStore.prototype.load = function() {
  var resolver = getPromiseResolver();

  chrome.storage.local.get(CredStore.LOCAL_STORAGE_KEY_NAME, function(items) {
    if (chrome.runtime.lastError) {
      log.error('Failed loading creds ' + chrome.runtime.lastError.message);
      resolver.reject(chrome.runtime.lastError.message);
      return;
    }

    this.creds = items[CredStore.LOCAL_STORAGE_KEY_NAME] || {};

    log.debug('Loaded ' + keyCount(this.creds) + ' credentials');
    resolver.resolve();
  }.bind(this));

  return resolver.promise;
};
