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
 * Lookup service to emulate Windows LMHosts file. This currently uses local
 * storage.
 * TODO(zentaro): Support getting data from enterprise policy
 * eg .chrome.storage.managed
 */
LMHosts = function() {
  this.hosts = {};
};

LMHosts.LOCAL_STORAGE_KEY_NAME = 'lmhosts';


/**
 * Resolves the hostname to an ip address or returns null if unknown.
 */
LMHosts.prototype.resolve = function(hostName) {
  return this.hosts[hostName.toUpperCase()] || null;
};


/**
 * Adds a hostname and ip address pair to the list of hosts.
 */
LMHosts.prototype.add = function(hostName, ipAddress) {
  this.hosts[hostName.toUpperCase()] = ipAddress;
};


/**
 * Stores the current map of host to ip addresses to local storage. Returns
 * a promise that will resolve when storing is completed.
 */
LMHosts.prototype.save = function() {
  var resolver = getPromiseResolver();

  var data = {};
  data[LMHosts.LOCAL_STORAGE_KEY_NAME] = this.hosts;
  chrome.storage.local.set(data, function() {
    if (chrome.runtime.lastError) {
      log.error('Failed saving lmhosts ' + chrome.runtime.lastError.message);
      resolver.reject(chrome.runtime.lastError.message);
      return;
    }

    resolver.resolve();
  });

  return resolver.promise;
};


/**
 * Loads a map of hostnames to IP addresses from local storage.
 */
LMHosts.prototype.load = function() {
  var resolver = getPromiseResolver();

  chrome.storage.local.get(LMHosts.LOCAL_STORAGE_KEY_NAME, function(items) {
    if (chrome.runtime.lastError) {
      log.error('Failed loading lmhosts ' + chrome.runtime.lastError.message);
      resolver.reject(chrome.runtime.lastError.message);
      return;
    }

    this.hosts = items[LMHosts.LOCAL_STORAGE_KEY_NAME] || {};

    resolver.resolve();
  }.bind(this));

  return resolver.promise;
};


/**
 * Global object that can be used by the plugin to perform name resolution
 * before trying to use NetBIOS over TCP.
 */
var lmHosts = new LMHosts();
