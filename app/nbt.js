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



function resolveFileShareHostName(hostName) {
  var resolver = getPromiseResolver();

  var ipAddress = lmHosts.resolve(hostName);
  if (ipAddress) {
    log.info('LMHosts resolved ' + hostName + ' to ' + ipAddress);
    resolver.resolve([ipAddress]);
    return resolver.promise;
  }

  var promiseList = [];
  getNetworkInterfaces().then(function(interfaces) {
    interfaces.forEach(function(iface) {
      promiseList.push(
          getFileSharesOnInterface(iface.broadcastAddress, hostName));
    });

    var ipAddresses = [];
    var promisesRemaining = promiseList.length;
    if (promisesRemaining == 0) {
      log.error('No network interfaces available');
      resolver.reject('No network interfaces available');
    } else {
      promiseList.forEach(function(promise) {
        promise.then(
            function(nameInfoMap) {
              var nameInfo = nameInfoMap[hostName.toUpperCase()];
              if (nameInfo != undefined) {
                log.info('found ip ' + nameInfo.ipAddress + ' for ' + hostName);
                // Add the IP if it isn't already in the list.
                if (ipAddresses.indexOf(nameInfo.ipAddress) == -1) {
                  ipAddresses.push(nameInfo.ipAddress);
                }
              } else {
                log.debug(hostName + ' not found on this interface');
              }

              // TODO(zentaro): Implement a thenAlways()
              promisesRemaining--;
              if (promisesRemaining <= 0) {
                resolver.resolve(ipAddresses);
              }
            },
            function(err) {
              log.error(
                  'getFileSharesOnInterface promise rejected with ' + err);
              promisesRemaining--;
              if (promisesRemaining <= 0) {
                resolver.resolve(ipAddresses);
              }
            });
      });
    }

  });

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
