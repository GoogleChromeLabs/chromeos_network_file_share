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
 * Simple lookup of names to IP Addresses.
 */
IPCache = function() {
  this.hosts = {};
};


/**
 * Resolves the hostname to an ip address or returns null if unknown.
 */
IPCache.prototype.resolve = function(hostName) {
  return this.hosts[hostName.toUpperCase()] || null;
};


/**
 * Adds a hostname and ip address pair to the list of hosts.
 */
IPCache.prototype.add = function(hostName, ipAddress) {
  // TODO(zentaro): Handle having multiple IP Addresses.
  this.hosts[hostName.toUpperCase()] = ipAddress;
};
