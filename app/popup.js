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



function mapErrorCodeToText(errorCode) {
  switch (errorCode) {
    case 'ACCESS_DENIED':
      return 'Access Denied. Check user name and password are correct.';
    case 'EXISTS':
      return 'This file share is already mounted.';
    case 'NOT_FOUND':
      return 'File share can\'t be found. Check the share path is correct.';
    case 'FAILED':
    default:
      return 'Share could not be mounted.';
  }
}

function onMountClicked() {
  log.debug('Mount clicked');

  var sharePath = document.getElementById('sharePath').sharePath;
  var displayName = document.getElementById('sharePath').displayName;

  var domain = '';
  var user = '';
  var password = '';
  // Defaults to true because when no password is entered it is safe to save.
  var saveCredentials = true;
  var passwordCheckbox = document.getElementById('passwordCheck');
  if (passwordCheckbox.checked) {
    log.debug('Using credential fields.');
    domain = document.getElementById('user_domain_input').domain;
    user = document.getElementById('user_domain_input').user;
    password = document.getElementById('password').value;
    var savePasswordCheckbox = document.getElementById('savePassword');
    saveCredentials = savePasswordCheckbox.checked;
    log.debug('domain=' + domain + ' user=' + user);
  }
  log.info("Saving current share path: " + sharePath);
  var savedUser = user;
  if (domain) {
    savedUser = domain + '\\' + user;
  }
  chrome.storage.local.set({"sharePath": sharePath,
    "shareUser": savedUser});

  var toast = document.getElementById('errorToast');

  if (!document.getElementById('user_domain_input').isValid) {
    toast.text = 'User and domain is incorrectly formatted.';
  }

  var overlay = document.getElementById('spinner_overlay');
  overlay.toggle();

  log.debug('Entered share path: ' + sharePath);
  canonicalizeSambaUrl(sharePath, resolveFileShareHostName)
      .then(
          function(result) {
            log.info(
                'Got server=' + result.server + ' share=' + result.share +
                ' path=' + result.path);
            log.info('Canonical=' + result.canonical);

            var message = {
              functionName: 'mount',
              mountInfo: {
                sharePath: result.canonical,
                displayName: displayName,
                domain: domain,
                user: user,
                password: password,
                server: result.server,
                path: result.path,
                share: result.share,
                serverIP: result.serverIP,
                saveCredentials: saveCredentials
              }
            };

            log.debug('Sending mount to background');
            chrome.runtime.sendMessage(message, function(response) {
              if (response.result) {
                log.info('Mount succeeded');
                window.close();
              } else {
                log.error('Mount failed with ' + response.error);
                overlay.toggle();

                toast.text = mapErrorCodeToText(response.error);
                toast.show();
              }
            });
          },
          function(err) {
            log.error('Canonicalize url failed with ' + err);
            overlay.toggle();
            toast.text = 'Share path is incorrectly formatted.';
            toast.show();
          });
}

function onCancel() {
  log.info('Cancel clicked');
  // getNetworkInterfaces().then(function(interfaces) {
  //   interfaces.forEach(function(iface) {
  //     log.info('Interface ' + iface.name + ' BC=' + iface.broadcastAddress);
  //   });
  // });

  // TODO(zentaro): Left here for now for easy testing.
  //
  // console.log('canonicalizing...');
  // canonicalizeSambaUrl('\\\\Walrus\\fooshare',
  // resolveFileShareHostName).then(function(result) {
  //   console.log('success');
  //   console.log(result);
  // }, function(err) {
  //   console.log('errr' + err);
  // });

  window.close();
}

function onPasswordChecked(changeEvent) {
  var isChecked = changeEvent.target.checked;
  var collapser = document.getElementById('collapsedContent');

  if (isChecked) {
    collapser.show();
  } else {
    collapser.hide();
  }
}

function onLicenseLinkClicked() {
  loadLicensePage();
}

function enumerateFileShares() {
  getAllShareRoots().then(function(hostInfoMap) {
    var hostIPMap = {};
    for (var hostName in hostInfoMap) {
      hostIPMap[hostName] = hostInfoMap[hostName].ipAddress;
    }

    var message = {functionName: 'enumerateFileShares', hostMap: hostIPMap};

    log.debug('enumerateFileShares sending message to background');
    chrome.runtime.sendMessage(message, function(response) {
      if (response.result) {
        log.info('enumerateFileShares succeeded');
        // TODO(zentaro): Do something with this!
      } else {
        log.error('enumerateFileShares failed with ' + response.error);
      }
    });
  });
}

function onDefaultPopupLoaded() {
  // Do something
  log.info('Popup loaded');
  var mountButton = document.getElementById('mountButton');
  var cancelButton = document.getElementById('cancelButton');
  var passwordCheck = document.getElementById('passwordCheck');
  var licenseLink = document.getElementById('licenseLink');

  mountButton.addEventListener('click', onMountClicked);
  cancelButton.addEventListener('click', onCancel);
  passwordCheck.addEventListener('change', onPasswordChecked);
  licenseLink.addEventListener('click', onLicenseLinkClicked);

  var sharePath = document.getElementById('sharePath');
  var checkBox = document.getElementById('passwordCheck');
  var credentialCollapse = document.getElementById('collapsedContent');
  var userInput = document.getElementById('user_domain_input');
  chrome.storage.local.get(['sharePath', 'shareUser'], function(result) {
    if (!isEmpty(result)) {
      sharePath.setValue(result.sharePath);
      if (result.hasOwnProperty('shareUser') && !isEmpty(result.shareUser)) {
        checkBox.checked = true;
        credentialCollapse.toggle();
        userInput.setValue(result.shareUser);
      }
    }
  });

  enumerateFileShares();
  log.debug('Loading lmHosts');
  lmHosts.load().then(function() { log.debug('lmHosts loaded.'); });
}



document.addEventListener('DOMContentLoaded', onDefaultPopupLoaded);
