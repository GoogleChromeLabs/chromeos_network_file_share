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
 * Takes an IPv4 address string in dotted format eg. 192.168.2.66 and converts
 * it to an unsigned 32-bit int. If it is invalid null is returned.
 */
function ipv4ToUint32(ipv4) {
  var parts = ipv4.split('.');
  if (parts.length != 4) {
    return null;
  }

  // TODO(zentaro): Handle the case where the parts are outside 0-255.
  return lshift(parseInt(parts[0], 10), 24) +
      lshift(parseInt(parts[1], 10), 16) + lshift(parseInt(parts[2], 10), 8) +
      parseInt(parts[3], 10);
}

/**
 * Takes a Uint32 and converts to a dot-notation IPv4 string.
 */
function uint32ToIpv4(ipIntValue) {
  return ((ipIntValue >>> 24) & 0xff).toString() + '.' +
      ((ipIntValue >>> 16) & 0xff).toString() + '.' +
      ((ipIntValue >>> 8) & 0xff).toString() + '.' +
      (ipIntValue & 0xff).toString();
}

/**
 * Takes an IPv4 address string and the number of bits are the subnet prefix and
 * returns the broadcast address. Essentially all the non-prefix bits set to 1.
 */
function makeBroadcastAddress(ipv4, prefixLength) {
  var ipValue = ipv4ToUint32(ipv4);
  if (ipValue == null) {
    return null;
  }

  // The mask that will be OR'd with the address to get the broadcast
  // address. NOTE that this is the inverted subnet mask. Unsigned
  // shift >>> is necessary here to ensure 0's are added to the left.
  var broadcastMask = 0xffffffff >>> prefixLength;
  var broadcastAddressValue = ipValue | broadcastMask;

  return uint32ToIpv4(broadcastAddressValue);
}
