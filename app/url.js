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



// Converts any backslashes (\) to forward slashes (/).
function flipBackSlashes(original) {
  // This is effectively a replace all.
  // See http://jsperf.com/replace-all-vs-split-join
  return original.split('\\').join('/');
}

// Converts any forward slashes  (\) to backslashes (/).
function flipForwardSlashes(original) {
  // This is effectively a replace all.
  // See http://jsperf.com/replace-all-vs-split-join
  return original.split('/').join('\\');
}


// Canonicalizes and validates a url. If the url is invalid it returns null.
// Attempt to accept either windows form \\server\share\path\to\file or
// canonical smb://server/share/path/to/file and return the canonical form.
function canonicalizeSambaUrl(original, opt_nameLookupFn) {
  var resolver = getPromiseResolver();
  // TODO(zentaro): Regex is probably shorter.
  original = original.trim();
  var flipped = flipBackSlashes(original);
  var windowsForm;
  var canonical;

  if (flipped.startsWith('smb://')) {
    canonical = flipped;
    flipped = flipped.substring(4);
    // Strip smb: from the front and make them back slashes.
    windowsForm = flipForwardSlashes(original.substring(4));
  } else if (flipped.startsWith('//')) {
    canonical = 'smb:' + flipped;
    windowsForm = original;
  } else {
    // Not one of the 2 valid forms.
    resolver.reject('Invalid start of url format');
    return resolver.promise;
  }

  // Take the // from the front.
  var working = flipped.substring(2);
  var nextSlash = working.indexOf('/');
  if (nextSlash == -1) {
    resolver.reject('Invalid url format');
    return resolver.promise;
  }

  // Extract the server part.
  var server = working.substring(0, nextSlash);
  working = working.substring(nextSlash + 1);

  // The share is either the rest of the string or upto the next slash.
  var share;
  nextSlash = working.indexOf('/');
  if (nextSlash == -1) {
    share = working;
    working = '';
  } else {
    share = working.substring(0, nextSlash);
    working = working.substring(nextSlash + 1);
  }

  // TODO(zentaro): In future potentially support enumerating the server
  // (share.length == 0) or the entire network when supported
  // (server.length == 0)
  if (server.length == 0 || share.length == 0) {
    resolver.reject('No server or share');
    return resolver.promise;
  }

  // TODO(zentaro): Investigate what should happen if there is subsequent path?
  // Should the mount start deeper in the directory structure?
  var result = {
    original: original,
    canonical: canonical,
    windowsForm: windowsForm,
    server: server,
    share: share,
    path: working
  };

  log.debug('Canonicalize result: ' + JSON.stringify(result));

  if (opt_nameLookupFn == undefined) {
    // No IP lookup.
    resolver.resolve(result);
  } else {
    opt_nameLookupFn(server).then(
        function(ipAddresses) {
          if (ipAddresses.length == 0) {
            log.warning('Name could not be resolved');
            result['serverIP'] = '';
            resolver.resolve(result);
          } else {
            if (ipAddresses.length > 1) {
              log.warning(
                  'name resolved to multiple IP addresses. using first');
            }

            result['serverIP'] = ipAddresses[0];
            // Make sure it's in the right place before replacing.
            if (canonical.toUpperCase().indexOf(server.toUpperCase()) ==
                'smb://'.length) {
              // Replace the first instance of server with the ip address.
              var regex = new RegExp('(' + regexEscape(server) + ')', 'i');
              result['canonical'] =
                  canonical.replace(regex, result['serverIP']);
              log.debug('resolved canonical ' + result['canonical']);
            }

            resolver.resolve(result);
          }
        },
        function(err) {
          log.error('name lookup failed ' + err);
          resolver.reject(err);
        });
  }

  return resolver.promise;
}
