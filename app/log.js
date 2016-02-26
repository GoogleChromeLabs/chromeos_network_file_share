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
 * Simple logger that handles log messages send back from NaCl.
 */
NaclLogger = function() {};

NaclLogger.prototype.handleMessage = function(message) {
  console.log(message.data);
};


/**
 * Simple logger for javascript.
 */
JsLogger = function() {};

var JSLOG_DEBUG = 0;
var JSLOG_INFO = 1;
var JSLOG_WARNING = 2;
var JSLOG_ERROR = 3;

var jsLogLevel = JSLOG_WARNING;
var traceEnabled = true;

JsLogger.prototype.trace = function(operation, start, end) {
  if (traceEnabled) {
    var elapsedMs = Math.round(end - start);
    this.write_(
        JSLOG_DEBUG, 'TRACE: ', operation + ':' + Math.round(start) + '-' +
            Math.round(end) + ' = ' + elapsedMs);
  }
};

JsLogger.prototype.debug = function(message) {
  this.write_(JSLOG_DEBUG, 'DEBUG: ', message);
};

JsLogger.prototype.info = function(message) {
  this.write_(JSLOG_INFO, 'INFO: ', message);
};

JsLogger.prototype.warning = function(message) {
  this.write_(JSLOG_WARNING, 'WARNING: ', message);
};

JsLogger.prototype.error = function(message) {
  this.write_(JSLOG_ERROR, 'ERROR: ', message);
};

JsLogger.prototype.write_ = function(level, prefix, message) {
  if (level >= jsLogLevel) {
    console.log(prefix + message);
  }
};

// Global logger.
var log = new JsLogger();
