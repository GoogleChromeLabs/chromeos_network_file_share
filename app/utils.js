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


var isDef = function(value) {
  return value !== void 0;
};

var thenAlways = function(promise, fn) {
  promise.then(fn, fn);
  return promise;
};

var getPromiseResolver = function() {
  var resolveFn, rejectFn;
  // TODO(zentaro): Add timeout support.
  var promise = new Promise(function(resolve, reject) {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return {promise: promise, resolve: resolveFn, reject: rejectFn};
};

var getTimeoutResolver = function(timeoutMs) {
  var resolver = getPromiseResolver();

  var timeout = setTimeout(function() { resolver.reject(); }, timeoutMs);

  thenAlways(resolver.promise, function() { clearTimeout(timeout); });

  return resolver;
};

// TODO(zentaro): This isn't as generic as it could be since it
// special cases certain types of errors. Since some 'errors' are good errors.
// For example when you try to save a new file ChromeOS will probe to try and
// open a file with the new name. It is expecting to get a NOT_FOUND error in
// response (which is expected and should not be retryied).
//
// The current way these situations are being held is that a certain set of
// internal errors (like timeout, connection reset/abort) get mapped to a
// fake error called SHOULD_RETRY. That error can never be bubbled up to CrOS
// or it would cause a failure. The logic here will only retry when that is
// the error and in the terminating case will replace that error with a generic
// 'FAILED'.
var getRetryingPromise = function(promiseFn, operationName, attemptCount) {
  if (attemptCount <= 0) {
    log.error('No attempt made for ' + operationName);
    return Promise.reject('FAILED');
  }

  var attempts = 0;
  var resolver = getPromiseResolver();

  // Declare outside since it is called recursively within the function.
  var retryFn;
  retryFn = function(err) {
    attempts++;
    if (attempts >= attemptCount) {
      log.error(
          operationName + ' failed on attempt ' + attempts + ' of ' +
          attemptCount + '. Retrying...');
      if (err == 'SHOULD_RETRY') {
        err = 'FAILED';
      }

      resolver.reject(err);
    } else {
      // There are still more attempts so try again if it is retryable.
      if (err == 'SHOULD_RETRY') {
        log.warning(
            operationName + ' failed on attempt ' + attempts + ' of ' +
            attemptCount + '. Retrying...');

        promiseFn().then(resolver.resolve, retryFn);
      } else {
        // Non retry errors should just be passed through.
        resolver.reject(err);
      }
    }
  };

  // Make the first attempt.
  promiseFn().then(resolver.resolve, retryFn);

  return resolver.promise;
};

var getTimedPromiseResolver = function(operation) {
  var start = window.performance.now();
  var end;
  var resolveFn, rejectFn;

  var traceFn = function() {
    end = window.performance.now();
    log.trace(operation, start, end);
  };

  // TODO(zentaro): Add timeout support.
  var promise = new Promise(function(resolve, reject) {
    resolveFn = function(result) {
      resolve(result);
      traceFn();
    };

    rejectFn = function(err) {
      reject(err);
      traceFn();
    };
  });

  return {promise: promise, resolve: resolveFn, reject: rejectFn};
};

function cloneObject(obj) {
  var newObj = {};
  for (var prop in obj) {
    newObj[prop] = obj[prop];
  }

  return newObj;
}

function getDefault(obj, fieldName, defaultValue) {
  var value = obj[fieldName];
  if (!isDef(value)) {
    value = defaultValue;
  }

  return value;
}

function regexEscape(value) {
  return value.replace(/[-\/\\^$*+?.()|[/]{}]/g, '\\$&');
}

// Workaround javascripts unintuitive shift operators which wrap around like
// signed 32 bit ints. However multiplication works.
function lshift(num, bits) {
  return num * Math.pow(2, bits);
}

var hexChar = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'
];

function byteToHex(b) {
  return hexChar[(b >> 4) & 0x0f] + hexChar[b & 0x0f];
}

function printPacket(arrayBuffer) {
  var packetLength = arrayBuffer.byteLength;
  var view = new Uint8Array(arrayBuffer);

  var s = '';
  for (i = 0; i < packetLength; i++) {
    s = s + byteToHex(view[i]) + ' ';
  }

  log.debug('PACKET: ' + s);
}


/**
 * Returns the number of keys in the supplied object.
 */
function keyCount(obj) {
  return Object.keys(obj).length;
}

/**
 * This function behaves like goog.Promise.all() except that it ignores
 * promises in the list that reject rather than rejecting the entire list.
 * Only the results from the promises that resolve are put into the output list.
 */
function joinAllIgnoringRejects(promiseList) {
  var resolver = getPromiseResolver();

  var resultList = [];
  var promisesRemaining = promiseList.length;

  // If the there are no promises, resolve with an empty list.
  if (promisesRemaining == 0) {
    resolver.resolve(resultList);
  }

  // Helper function to keep track of how many of the promises resolved and
  // rejected then resolve the outer promise when they are all completed.
  var onFulfilled = function() {
    promisesRemaining--;
    if (promisesRemaining == 0) {
      resolver.resolve(resultList);
    }
  };

  // Iterate over each promise. For the ones that resolve, put the value into
  // resultList. Each resolve or reject decrements a counter, then resolves the
  // outer promise when all promises have been fulfilled.
  promiseList.forEach(function(promise) {
    promise = promise.then(
        function(result) { resultList.push(result); }, function() {});
    thenAlways(promise, onFulfilled);
  });

  return resolver.promise;
}


/**
 * Attaches the resolver's resolve and reject functions to a different promise.
 * This is useful for cases where an inner promise should resolve an outer
 * promise and the resolve value and reject values just pass through.
 */
function attachResolver(promise, resolver) {
  promise.then(resolver.resolve, resolver.reject);
}


/**
 * Appends tail to arr and returns arr.
 */
function extendArray(arr, tail) {
  var originalLength = arr.length;
  arr.length += tail.length;

  for (var i = originalLength, tailLen = tail.length, j = 0; j < tailLen;
       ++i, ++j) {
    arr[i] = tail[j];
  }

  return arr;
}

function sliceArray(arr, begin, length) {
  var usableLength = clamp(length, 0, arr.length - begin);
  var result = new Array(usableLength);

  for (var i = 0, j = begin; i < usableLength; ++i, ++j) {
    result[i] = arr[j];
  }

  return result;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
