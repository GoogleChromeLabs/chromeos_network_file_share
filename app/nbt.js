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
 * Global IP lookup cache.
 */
var ipCache = new IPCache();


/**
 * Send NetBIOS name request on all network interfaces and returns
 * an dictionary of hosts and their IP addresses that contain file shares.
 */
function getAllShareRoots() {
  var resolver = getPromiseResolver();

  // TODO(zentaro): This should probably merge the lists.
  getNetworkInterfaces().then(function(interfaces) {
    var promiseList = [];
    interfaces.forEach(function(iface) {
      promiseList.push(
          getFileSharesOnInterface(iface.broadcastAddress));
    });

    joinAllIgnoringRejects(promiseList).then(function(hostsOnAllInterfaces) {
      var hosts = {};
      hostsOnAllInterfaces.forEach(function(hostsOnInterface) {
        hosts = mergeInterfaceHosts(hosts, hostsOnInterface);
      });

      // Update the cache.
      for (var hostName in hosts) {
        ipCache.add(hostName, hosts[hostName].ipAddress)
      }

      resolver.resolve(hosts);
    });
  });

  return resolver.promise;
}

function mergeInterfaceHosts(result, newHosts) {
  // TODO(zentaro): In future merge IP addresses to a list.
  for (var host in newHosts) {
    result[host] = newHosts[host];
  }

  return result;
}


/**
 * Resolves a NetBIOS host name by sending a name request
 * UDP broadcast on every network interface.
 */
function resolveFileShareHostName(hostName) {
  var resolver = getPromiseResolver();
  var ipAddress;

  if (isValidIpv4(hostName)) {
    // If the host name is an IP address then no need to do anything.
    ipAddress = hostName;
  } else {
    if (ipAddress = lmHosts.resolve(hostName)) {
      log.info('LMHosts resolved ' + hostName + ' to ' + ipAddress);
    } else if (ipAddress = ipCache.resolve(hostName)) {
      log.info('IPCache resolved ' + hostName + ' to ' + ipAddress);
    } else {
      getAllShareRoots().then(function() {
        ipAddress = ipCache.resolve(hostName);
        if (ipAddress) {
          resolver.resolve([ipAddress]);
        } else {
          log.error('Host ' + hostName + ' cannot be resolved');
          resolver.resolve([]);
        }
      }, resolver.reject);

      return resolver.promise;
    }
  }

  resolver.resolve([ipAddress]);
  return resolver.promise;
}

function parseNameResponsePacket(arrayBuffer) {
  var reader = new ArrayBufferReader(arrayBuffer);
  var transId = reader.readUint16();
  var flags = reader.readUint16();

  reader.skip16();  // No questions
  var answerCount = reader.readUint16();
  reader.skip16();  // No authority resources
  reader.skip16();  // No additional resources

  var nameLength = reader.readUint8();
  // TOOD(zentaro): Get the name data??
  reader.skipNBytes(nameLength);

  reader.skip8();   // Length of next segment (should be 0x00)
  reader.skip16();  // Question type/node status (Should be 0x0021 or 0x20)
  reader.skip16();  // Question class (Should be 0x0001)

  // -----------------------------------------------------------
  // That's the end of the part that is essentially repeating back the question
  // (though the flags/questions/answers fields are different).

  // TODO (zentaro): Handle the difference between positive and negative
  // response. This is assuming a positive response.

  reader.skip32();  // Ignore TTL
  var addressListByteCount = reader.readUint16();

  log.debug(
      'packet size = ' + arrayBuffer.byteLength + ' bytes more=' +
      addressListByteCount);

  // TODO(zentaro): Check how many bytes are left in the buffer vs value above.
  var addressListEntryCount = reader.readUint8();
  log.debug('Address list entries = ' + addressListEntryCount);
  log.debug('address left = ' + (addressListEntryCount * 18));

  var addressList = [];
  var i = 0;
  for (i = 0; i < addressListEntryCount; i++) {
    // Each address entry is 18 bytes.
    // NAME (space padded) - 15 bytes
    // TYPE (file share, printer etc) - 1 byte
    // FLAGS - 2 bytes
    var c;
    var name = '';
    for (c = 0; c < 15; c++) {
      name += String.fromCharCode(reader.readUint8());
    }

    name = name.trim().toUpperCase();
    var type = reader.readUint8();
    var flags = reader.readUint16();

    addressList.push({name: name, type: type, flags: flags});

    log.info('Address ' + name + '[' + type + '][' + flags + ']');
  }

  return addressList;
}

function getNameTypesFromResponse(arrayBuffer, desiredTypes, opt_name) {
  return parseNameResponsePacket(arrayBuffer).filter(function(nameInfo) {
    var typeMatches =
        ((desiredTypes.length == 0) ||
         (desiredTypes.indexOf(nameInfo.type) >= 0));
    var nameMatches =
        ((opt_name == undefined) || (opt_name.toUpperCase() == nameInfo.name));
    return typeMatches && nameMatches;
  });
}

function createNameQueryPacket() {
  var transId = 5566;  // TODO(zentaro): generate!
  var flags = 0x0010;  // Only broadcast flag is set
  var questionCount = 1;
  var answerResourceCount = 0;
  var authorityResourceCount = 0;
  var additionalResourceCount = 0;

  var bufferWriter = new ArrayBufferWriter(50);
  bufferWriter.writeUint16(transId);
  bufferWriter.writeUint16(flags);
  bufferWriter.writeUint16(questionCount);
  bufferWriter.writeUint16(answerResourceCount);
  bufferWriter.writeUint16(authorityResourceCount);
  bufferWriter.writeUint16(additionalResourceCount);

  // Length of name. 16 bytes of name encoded to 32 bytes.
  bufferWriter.writeUint8(0x20);

  // '*' character encodes to 2 bytes.
  bufferWriter.writeUint8(0x43);
  bufferWriter.writeUint8(0x4b);

  // Write the remaining 15 nulls which encode to 30* 0x41
  var i = 0;
  for (i = 0; i < 30; i++) {
    bufferWriter.writeUint8(0x41);
  }

  //
  // That's 45 bytes so far. 5 more to go in the coda.
  //

  // Length of next segment.
  bufferWriter.writeUint8(0);

  // Question type: Node status
  bufferWriter.writeUint16(0x21);

  // Question class: Internet
  bufferWriter.writeUint16(0x01);

  // Assert that the entire buffer was filled and return it.
  console.assert(bufferWriter.isFull());
  return bufferWriter.getArrayBuffer();
}

function getFileSharesOnInterface(broadcastAddress, opt_name) {
  // https://tools.ietf.org/html/rfc1002
  // Query is section 4.2.12
  //
  log.info(
      'Looking for name [' + opt_name + '] at broadcast ' + broadcastAddress);
  var resolver = getPromiseResolver();

  var buf = createNameQueryPacket();
  log.debug('Sending name request query');
  printPacket(buf);

  var nameLookup = {};
  var sockProps = {};
  var responseTimeout = 5000;
  var socketId;

  var timeoutId = window.setTimeout(function() {
    // If the timeout fires just resolve with the results we already have.
    resolver.resolve(nameLookup);
    closeUdpSocket(socketId);
  }, responseTimeout);

  // TODO(zentaro): Unbind/close the socket.
  chrome.sockets.udp.onReceive.addListener(function(info) {
    log.debug('UDP Received: ' + JSON.stringify(info));
    log.debug('----------------------');

    printPacket(info.data);

    getNameTypesFromResponse(info.data, [0x20], opt_name)
        .forEach(function(nameInfo) {
          log.info(
              'FOUND FILE SHARE: ' + nameInfo.name + '[' + info.remoteAddress +
              ']');
          nameInfo['ipAddress'] = info.remoteAddress;
          nameLookup[nameInfo.name] = nameInfo;

          if (opt_name && (opt_name.toUpperCase() == nameInfo.name)) {
            resolver.resolve(nameLookup);

            // Cancel the timer since the promise already resolved.
            window.clearTimeout(timeoutId);
            closeUdpSocket(socketId);
          }
        });
  });

  var socket = chrome.sockets.udp.create(sockProps, function(createInfo) {
    socketId = createInfo.socketId;
    log.debug('Socket id is ' + socketId);

    chrome.sockets.udp.bind(socketId, '0.0.0.0', 0, function(result) {
      log.debug('bind result ' + result);
      chrome.sockets.udp.setBroadcast(
          socketId, true, function(broadcastResult) {
            log.debug('setBroadcast result = ' + broadcastResult);

            chrome.sockets.udp.send(
                socketId, buf, broadcastAddress, 137, function(sendInfo) {
                  log.debug('send result ' + sendInfo.resultCode);
                  log.debug('bytesSent ' + sendInfo.bytesSent);
                });
          });
    });
  });


  return resolver.promise;
}
