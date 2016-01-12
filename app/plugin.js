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



// Init client.
var smbfs = new SambaClient();

function unmountRequestedHandler(options, successFn, failureFn) {
  log.debug('Unmount requested - calling onUnmount on ' + options.fileSystemId);

  smbfs.unmount(options, successFn, failureFn)
      .then(
          function() {
            log.debug('unmount resolved in unmountRequestedHandler');
          },
          function() {
            log.error('unmount rejected in unmountRequestedHandler');
          });
}

function mountRequestedHandler(options, successFn, failureFn) {
  log.debug('Mount requested - popping dialog');
  loadForegroundPage();
}

function naclLoaded() {
  log.debug('nacl module loaded. Setting function pointer');
  smbfs.initialize(common.naclModule.postMessage);
}

// This function is called by common.js when a message is received from the
// NaCl module.
function handleMessage(message) {
  if (typeof message.data == 'string') {
    logger.handleMessage(message);
  } else {
    smbfs.router.handleMessage(message);
  }
}

function listenForFileSystemEvents() {
  log.info('************* Setting up event listeners ********');

  // Setup the event listeners that the Files App will use to get data from
  // the extension.
  chrome.fileSystemProvider.onUnmountRequested.addListener(
      unmountRequestedHandler);

  chrome.fileSystemProvider.onGetMetadataRequested.addListener(
      smbfs.getMetadataHandler.bind(smbfs));

  chrome.fileSystemProvider.onReadDirectoryRequested.addListener(
      smbfs.readDirectoryHandler.bind(smbfs));

  chrome.fileSystemProvider.onOpenFileRequested.addListener(
      smbfs.openFileHandler.bind(smbfs));

  chrome.fileSystemProvider.onCloseFileRequested.addListener(
      smbfs.closeFileHandler.bind(smbfs));

  chrome.fileSystemProvider.onReadFileRequested.addListener(
      smbfs.readFileHandler.bind(smbfs));

  chrome.fileSystemProvider.onCreateFileRequested.addListener(
      smbfs.createFileHandler.bind(smbfs));

  chrome.fileSystemProvider.onCreateDirectoryRequested.addListener(
      smbfs.createDirectoryHandler.bind(smbfs));

  chrome.fileSystemProvider.onTruncateRequested.addListener(
      smbfs.truncateHandler.bind(smbfs));

  chrome.fileSystemProvider.onWriteFileRequested.addListener(
      smbfs.writeFileHandler.bind(smbfs));

  chrome.fileSystemProvider.onMoveEntryRequested.addListener(
      smbfs.moveEntryHandler.bind(smbfs));

  // TODO(zentaro): Not implemented yet. They will fail in the NaCl module.
  chrome.fileSystemProvider.onDeleteEntryRequested.addListener(
      smbfs.deleteEntryHandler.bind(smbfs));

  chrome.fileSystemProvider.onCopyEntryRequested.addListener(
      smbfs.copyEntryHandler.bind(smbfs));

  // onMountRequested is only supported in Chrome 44 forward.
  // TODO(zentaro): Implement.
  if (chrome.fileSystemProvider.onMountRequested) {
    log.info('onMountRequested is supported in this version of chrome.');
    chrome.fileSystemProvider.onMountRequested.addListener(
        mountRequestedHandler);
  }

  // This listener handles messages coming from the UI/popup that have
  // been send to the background. This should only be mount/unmount
  //
  // Most other functionality of FSP is handled through event listeners setup
  // directly from the background page.
  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.functionName == 'mount') {
      log.debug('Calling SambaClient.mount from the background');
      smbfs.mount(message.mountInfo)
          .then(
              function() {
                log.debug('Sending success response to popup');
                sendResponse({result: true});
              },
              function(err) {
                sendResponse({result: false, error: err});
                log.error('Sending err response to popup');
              });
    } else if (message.functionName == 'unmount') {
      // TODO(zentaro): This code path maybe doesn't make sense with
      // multiple mounts.
      log.debug('Calling SambaClient.unmount from the background via message');
      smbfs.unmount();
    } else {
      log.error('ERROR: Unknown message passed.');
      log.error(message);
    }

    // Keeps the sendResponse function alive to get an async message.
    return true;
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // Listen for when the module loads so a pointer to post message can be setup.
  var listenerDiv = document.getElementById('listener');
  listenerDiv.addEventListener('load', naclLoaded, true);
});

listenForFileSystemEvents();
chrome.app.runtime.onLaunched.addListener(loadForegroundPage);
