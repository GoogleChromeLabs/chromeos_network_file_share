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



// This is a bogus data URI. The Files.app will attempt to download whole image
// files to create a thumbnail the first time you visit any folder. A bug
// https://code.google.com/p/chromium/issues/detail?id=548050 tracks not
// doing that for NETWORK providers.
// This work around is to supply an icon but make it bogus so it falls back to
// the generic icon.
var UNKNOWN_IMAGE_DATA_URI = 'data:image/png;base64,X';

var SambaClient = function() {
  log.info('Initializing samba client');
  this.messageId_ = 0;
  this.router = new MessageRouter();
  this.metadataCache = new MetadataCache();
  this.fsp = chrome.fileSystemProvider;
  this.mounts = {};
  this.credentials = new CredStore();
  this.populateResolver = getPromiseResolver();
  this.credentials.load().then(this.populateMounts_.bind(this));
};

SambaClient.prototype.initialize = function(sendMessageFn) {
  log.debug('Setting sendMessageFn in SambaClient with ' + sendMessageFn);
  this.router.initialize(sendMessageFn);
};

SambaClient.prototype.regenerateMountInfo_ = function(sharePath) {
  var resolver = getPromiseResolver();
  log.debug('Regenerating mountInfo for ' + sharePath);
  // TODO(zentaro): No name resolution function is passed here because it should
  // have already been resolved when it was mounted previously. This does mean
  // that if the IP changed this mount might be stale. Alternately more complex
  // logic would be required since this gets called as soon as the machine boots
  // and network connectivity has not even been established in some cases.
  canonicalizeSambaUrl(sharePath).then(function(result) {
    log.debug('Looking for credentials for ' + result.canonical);
    var creds = this.credentials.get(result.canonical);

    var domain = '';
    var username = '';
    var password = '';
    if (creds) {
      domain = creds.domain;
      username = creds.username;
      password = creds.password;
    }

    var mountInfo = {
      sharePath: result.canonical,
      domain: domain,
      user: username,
      password: password,
      server: result.server,
      path: result.path,
      share: result.share,
      serverIP: result.serverIP
    };

    log.debug('MountInfo regenerated for ' + sharePath);
    resolver.resolve(mountInfo);
  }.bind(this));

  return resolver.promise;
};

SambaClient.prototype.remountShare_ = function(fileSystem) {
  var resolver = getPromiseResolver();

  this.mounts[fileSystem.fileSystemId]['mountPromise'] = resolver.promise;

  this.regenerateMountInfo_(fileSystem.fileSystemId).then(function(mountInfo) {
    this.mount_(mountInfo, false)
        .then(
            function() {
              log.debug('Remounted ' + fileSystem.fileSystemId);
              resolver.resolve();
            }.bind(this),
            function(err) {
              log.error('Remounting ' + fileSystem.fileSystemId + ' failed');
              this.mounts[fileSystem.fileSystemId]['mountPromise'] = null;
              resolver.reject(err);
            }.bind(this));
  }.bind(this));

  return resolver.promise;
};

SambaClient.prototype.populateMounts_ = function() {
  log.debug('Looking for existing mounts');
  this.fsp.getAll(function(fileSystems) {
    log.debug('Found ' + fileSystems.length + ' file systems mounted.');
    var unmountPromises = [];
    fileSystems.forEach(function(fileSystem) {
      // If there aren't saved credentials for this share then unmount it.
      // Shares that don't need a password still have a credential entry
      // with empty strings.
      if (this.credentials.exists(fileSystem.fileSystemId)) {
        fileSystem['mountPromise'] = null;
        this.mounts[fileSystem.fileSystemId] = fileSystem;
      } else {
        log.debug(
            'No credentials for ' + fileSystem.fileSystemId + '. Unmounting.');
        // Unmount the fileSystemId with the FSP.
        var unmountOptions = {fileSystemId: fileSystem.fileSystemId};
        var unmountResolver = getPromiseResolver();
        unmountPromises.push(unmountResolver.promise);
        this.fsp.unmount(unmountOptions, function() {
          if (chrome.runtime.lastError) {
            log.error(
                'Unmounting ' + fileSystem.fileSystemId + ' failed: ' +
                chrome.runtime.lastError.message);
            unmountResolver.reject(chrome.runtime.lastError.message);
          } else {
            log.info('Unmounting ' + fileSystem.fileSystemId + ' succeeded');
            unmountResolver.resolve();
          }
        });
      }
    }.bind(this));


    // When all the unmount promises from above resolve then it will resolve the
    // populate resolver.
    attachResolver(
        joinAllIgnoringRejects(unmountPromises), this.populateResolver);

  }.bind(this));
};

SambaClient.prototype.sendMessage_ = function(fnName, args, opt_processDataFn) {
  var messageId = this.getNextMessageId();
  var message = {functionName: fnName, messageId: messageId, args: args};

  var cleansedArgs = args;
  if (fnName == 'mount') {
    // On the mount message scrub the password before logging.
    cleansedArgs = JSON.parse(JSON.stringify(args));
    cleansedArgs[1]['password'] = '***********';
  }

  log.debug(
      'Sending to NaCl fn=' + fnName + ' id=' + messageId + ' args=' +
      JSON.stringify(cleansedArgs));
  if (fnName == 'mount' || fnName == 'unmount') {
    log.debug('Passing through mount/unmount messages');
    // These messages pass straight through.
    return this.router.sendMessageWithRetry(message);
  }

  var resolver = getPromiseResolver();
  log.debug('Waiting for populate resolver');
  this.populateResolver.promise.then(function() {
    var fileSystemId = args[0].fileSystemId;
    log.debug('Sending message for fsid ' + fileSystemId);
    var fileSystem = this.mounts[fileSystemId];

    // It's possible that a message gets sent very early after boot before all
    // the persisted mounts have been remounted or unmounted if there are no
    // saved credentials. If it was unmounted while waiting for the populate
    // resolver then we just fail here.
    if (!fileSystem) {
      resolver.reject('NOT_FOUND');
      return;
    }

    if (!fileSystem['mountPromise']) {
      log.debug('There was no mount promise. Trying to remount.');
      // This will have set the mountPromise by the time it returns.
      this.remountShare_(this.mounts[fileSystemId]);
    }

    this.mounts[fileSystemId]['mountPromise'].then(
        function() {
          log.debug('mount promise resolved. sending message to router');
          this.router.sendMessageWithRetry(message, opt_processDataFn)
              .then(resolver.resolve, resolver.reject);
        }.bind(this),
        function(err) {
          log.error('Trying to send message to failed mount');
          resolver.reject('NOT_FOUND');
        }.bind(this));
  }.bind(this));

  return resolver.promise;
};

SambaClient.prototype.getNextMessageId = function() {
  return this.messageId_++;
};

SambaClient.prototype.mount = function(shareInfo) {
  log.debug('Explicitly mounting');
  return this.mount_(shareInfo, true);
};

SambaClient.prototype.mount_ = function(shareInfo, isNewMount) {
  log.info('Mounting ShareInfo.sharePath=' + shareInfo.sharePath);

  var resolver = getPromiseResolver();
  // TODO(zentaro): Maybe support a friendly display name?
  var options = {
    fileSystemId: shareInfo.sharePath,
    displayName: shareInfo.sharePath,
    writable: true,
  };

  log.debug('Calling into Nacl to mount');
  this.sendMessage_('mount', [options, shareInfo])
      .then(
          function(result) {
            log.debug('Mount with Samba succeeded - calling fsp');

            // A new mount is initiated by the user and after mounting with
            // samba it also needs to register with the files.app. On reboot
            // the mounts are maintained by the files.app and only the samba
            // side needs to be re-activated.
            if (isNewMount) {
              this.fsp.mount(options, function() {
                if (chrome.runtime.lastError) {
                  log.error(
                      'Mount failed: ' + chrome.runtime.lastError.message);
                  resolver.reject(chrome.runtime.lastError.message);
                } else {
                  log.info('Mount succeeded');
                  var fileSystemId = options.fileSystemId;
                  this.fsp.get(fileSystemId, function(fileSystem) {
                    if (chrome.runtime.lastError) {
                      log.error(
                          'Get filesystem failed: ' +
                          chrome.runtime.lastError.message);
                      resolver.reject(chrome.runtime.lastError.message);
                    } else {
                      log.debug('get filesystem succeeded');
                      fileSystem['mountPromise'] = resolver.promise;
                      this.mounts[fileSystemId] = fileSystem;

                      if (shareInfo.saveCredentials) {
                        this.credentials.add(
                            shareInfo.sharePath, shareInfo.domain,
                            shareInfo.user, shareInfo.password);
                        log.info('saving credentials');
                        this.credentials.save().then(
                            function() {
                              log.info('Saving credentials succeeded');
                              resolver.resolve();
                            }.bind(this),
                            function(err) { resolver.reject(err); });
                      } else {
                        log.info('Not saving credentials for this mount');
                        resolver.resolve();
                      }
                    }
                  }.bind(this));
                }
              }.bind(this));
            } else {
              log.info('Remount succeeded');
              resolver.resolve();
            }
          }.bind(this),
          function(err) {
            log.error('Mount with samba failed with ' + err);
            resolver.reject(err);
          });

  return resolver.promise;
};

SambaClient.prototype.noParamsHandler_ = function(
    functionName, options, successFn, errorFn) {
  log.debug('Calling ' + functionName);

  this.sendMessage_(functionName, [options])
      .then(
          function(response) {
            log.debug(
                functionName + ' promise resolved. Calling success callback.');
            successFn();
          },
          function(err) {
            log.error(functionName + ' rejected promise');

            errorFn(err);
          });
};


SambaClient.prototype.unmount = function(options, successFn, errorFn) {
  log.info('Unmounting');
  var resolver = getPromiseResolver();

  this.sendMessage_('unmount', [options])
      .then(
          function(result) {
            log.info('Unmount in samba succeeded. Calling fsp to unmount.');
            // Create a new options without the requestId.
            var unmountOptions = {fileSystemId: options.fileSystemId};
            log.debug('Unmount id ' + unmountOptions.fileSystemId);
            // TODO(zentaro): Chrome complains that lastError doesn't get called
            // because this happens async. Maybe have to just do this regardless
            // and ignore failure on samba side. It should never fail anyway.
            this.fsp.unmount(unmountOptions, function() {
              if (chrome.runtime.lastError) {
                log.error(
                    'Unmount failed: ' + chrome.runtime.lastError.message);
                errorFn();
              } else {
                log.info('Unmount succeeded');
                successFn();
              }

              log.debug('Clearing credentials for unmounted file system');
              this.credentials.clear(unmountOptions.fileSystemId);
              this.credentials.save().then(
                  resolver.resolve.bind(resolver),
                  resolver.reject.bind(resolver));
            }.bind(this));
          }.bind(this),
          function(err) { log.error('unmount rejected promise'); });

  return resolver.promise;
};

SambaClient.prototype.isThumbOnlyRequest_ = function(options) {
  // After Chrome 50 additional options were added to specify whether
  // certain data needs to be returned. If the fields don't exist
  // then it defaults to true (ie. all the data must be provided).
  var getDefaultTrue = function(fieldName) {
    return getDefault(options, fieldName, true);
  };

  return options.thumbnail && !getDefaultTrue('name') &&
      !getDefaultTrue('size') && !getDefaultTrue('modificationTime') &&
      !getDefaultTrue('isDirectory') && !getDefaultTrue('mimeType');
};

SambaClient.prototype.isThumbOnlyRequest_ = function(options) {
  // After Chrome 50 additional options were added to specify whether
  // certain data needs to be returned. If the fields don't exist
  // then it defaults to true (ie. all the data must be provided).
  var getDefaultTrue = function(fieldName) {
    return getDefault(options, fieldName, true);
  };

  return options.thumbnail && !getDefaultTrue('name') &&
      !getDefaultTrue('size') && !getDefaultTrue('modificationTime') &&
      !getDefaultTrue('isDirectory') && !getDefaultTrue('mimeType');
};

SambaClient.prototype.getMetadataHandler = function(
    options, successFn, errorFn) {
  log.debug('getMetadataHandler called');
  // console.log(options);

  var cachedEntry = this.metadataCache.lookupMetadata(
      options.fileSystemId, options.entryPath);

  if (cachedEntry) {
    log.debug('Found cached entry for ' + options.entryPath);
    if (this.isThumbOnlyRequest_(options)) {
      // If this request is just for a thumb then
      // just return this simple object.
      var thumbEntry = {'thumbnail': UNKNOWN_IMAGE_DATA_URI};

      log.debug('Responding with thumb-only result');
      successFn(thumbEntry);
    } else {
      // TODO(zentaro): Support all field combinations.

      // If a thumb was requested clone the cached entry and put a dummy URI
      // in there. See comment below for further details.
      if (options.thumbnail) {
        cachedEntry = cloneObject(cachedEntry);
        cachedEntry['thumbnail'] = UNKNOWN_IMAGE_DATA_URI;
      }

      successFn(cachedEntry);
    }

    return;
  }

  this.sendMessage_('getMetadata', [options])
      .then(
          function(response) {
            log.info('getMetadata succeeded');

            // Convert the date types to be dates from string
            response.result.value.modificationTime =
                new Date(response.result.value.modificationTime * 1000);

            // Workaround to prevent Files.app downloading the entire file
            // to generate a thumb.
            // TODO(zentaro): Turns out the app will ask for the thumb for all
            // files but ignore it for everything except images and vids. So
            // don't bother sending it for other cases.
            if (options.thumbnail) {
              response.result.value.thumbnail = UNKNOWN_IMAGE_DATA_URI;
            }

            successFn(response.result.value);
          },
          function(err) {
            log.error('getMetadata failed with ' + err);
            errorFn(err);
          });
};

SambaClient.prototype.readDirectoryHandler = function(
    options, successFn, errorFn) {
  log.debug('readDirectoryHandler called');

  var entries = [];
  var processDataFn = function(response) {
    // Convert the date types to be dates from string
    response.result.value = response.result.value.map(function(elem) {
      elem.modificationTime = new Date(elem.modificationTime * 1000);

      return elem;
    });

    console.log(response.result.value);

    // Accumulate the entries so they can be set in the cache at the end.
    entries = extendArray(entries, response.result.value);
    log.debug('Sending batch of readDirectory data');
    successFn(response.result.value, response.hasMore);
  }.bind(this);

  this.sendMessage_('readDirectory', [options], processDataFn)
      .then(
          function() {
            log.debug('readDirectory succeeded.');
            this.metadataCache.cacheDirectoryContents(
                options.fileSystemId, options.directoryPath, entries);
          }.bind(this),
          function(err) {
            log.error('readDirectory failed with ' + err);

            // TODO: More specific??
            errorFn('FAILED');
          });
};

SambaClient.prototype.openFileHandler = function(options, successFn, errorFn) {
  // TODO(zentaro): Could be smarter and only do this when opened for write.
  this.metadataCache.invalidateEntry(options.fileSystemId, options.filePath);
  this.noParamsHandler_('openFile', options, successFn, errorFn);
};

SambaClient.prototype.closeFileHandler = function(options, successFn, errorFn) {
  this.noParamsHandler_('closeFile', options, successFn, errorFn);
};

SambaClient.prototype.readFileHandler = function(options, successFn, errorFn) {
  log.debug('readFileHandler called');

  var processDataFn = function(response) {
    log.debug('sending readFile batch');
    successFn(response.result.value, response.hasMore);
  };

  this.sendMessage_('readFile', [options], processDataFn)
      .then(
          function(response) { log.info('readFile succeeded'); },
          function(err) {
            log.error('readFile failed with ' + err);

            // TODO: More specific??
            errorFn('FAILED');
          });
};

SambaClient.prototype.createDirectoryHandler = function(
    options, successFn, errorFn) {
  this.noParamsHandler_('createDirectory', options, successFn, errorFn);
};

SambaClient.prototype.deleteEntryHandler = function(
    options, successFn, errorFn) {
  this.metadataCache.invalidateEntry(options.fileSystemId, options.entryPath);
  this.noParamsHandler_('deleteEntry', options, successFn, errorFn);
};

SambaClient.prototype.createFileHandler = function(
    options, successFn, errorFn) {
  this.noParamsHandler_('createFile', options, successFn, errorFn);
};

SambaClient.prototype.copyEntryHandler = function(options, successFn, errorFn) {
  this.metadataCache.invalidateEntry(options.fileSystemId, options.targetPath);
  this.noParamsHandler_('copyEntry', options, successFn, errorFn);
};

SambaClient.prototype.moveEntryHandler = function(options, successFn, errorFn) {
  this.metadataCache.invalidateEntry(options.fileSystemId, options.targetPath);
  this.noParamsHandler_('moveEntry', options, successFn, errorFn);
};

SambaClient.prototype.truncateHandler = function(options, successFn, errorFn) {
  this.metadataCache.invalidateEntry(options.fileSystemId, options.filePath);
  this.noParamsHandler_('truncate', options, successFn, errorFn);
};

SambaClient.prototype.writeFileHandler = function(options, successFn, errorFn) {
  this.noParamsHandler_('writeFile', options, successFn, errorFn);
};

// TODO(zentaro): Implement abort? Is it even possible?
