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
 * Class to cache EntryMetadata. Currently only relevant for caching
 * individual getMetadata requests. readDirectory calls currently don't use the
 * cache (but could with some modification).
 */
MetadataCache = function() {
  this.cache = {};
};


MetadataCache.prototype.cacheDirectoryContents = function(
    fileSystemId, directoryPath, entries) {
  if (!(fileSystemId in this.cache)) {
    log.debug('Starting cache for ' + fileSystemId);
    this.cache[fileSystemId] = {};
  }

  // Just overwrite if anything was there before.
  log.debug('Updating cache for ' + fileSystemId + '|' + directoryPath);
  this.cache[fileSystemId][directoryPath] = {
    'timeCached': window.performance.now(),
    'entries': {}
  };

  entries.forEach(function(entry) {
    this.cache[fileSystemId][directoryPath]['entries'][entry.name] = entry;
  }.bind(this));
};

MetadataCache.prototype.lookupMetadata = function(fileSystemId, entryPath) {
  var pathParts = this.splitEntryPath_(entryPath);
  var dirCache = this.getDirectoryCache_(fileSystemId, pathParts);

  if (!dirCache) {
    return null;
  }

  var entryExpiresAt =
      dirCache['timeCached'] + this.getCacheTimeMs_(pathParts['path']);
  if (window.performance.now() >= entryExpiresAt) {
    // Invalidates the metadata for the entire directory.
    log.debug('Invalidating dir cache for ' + pathParts['path']);
    var fsCache = this.cache[fileSystemId];
    delete fsCache[pathParts['path']];
    return null;
  }

  return dirCache['entries'][pathParts['name']] || null;
};

MetadataCache.prototype.updateMetadata = function(fileSystemId, entryPath, entry) {
  var pathParts = this.splitEntryPath_(entryPath);
  var dirCache = this.getDirectoryCache_(fileSystemId, pathParts);

  // TODO(zentaro): Consider having separate expirations on metadata entries.
  if (dirCache) {
    dirCache['entries'][pathParts['name']] = entry;
  }
};

MetadataCache.prototype.invalidateEntry = function(fileSystemId, entryPath) {
  var pathParts = this.splitEntryPath_(entryPath);
  var dirCache = this.getDirectoryCache_(fileSystemId, pathParts);

  if (!dirCache) {
    return null;
  }

  log.debug('Invalidating metadata entry for ' + entryPath);
  var dirCacheEntries = dirCache['entries'];

  // NOTE: Currently invalidation just deletes the entry in the dirCache which
  // is fine since we only use the cache for individual metadata requests. When
  // the cache misses it will do a real lookup.
  //
  // TODO(zentaro): If this class supports using the dirCache to service readDir
  // requests then this would also invalidate the whole dir. Currently a readDir
  // would refresh the cache in all cases.
  delete dirCacheEntries[pathParts['name']];
};

// Returns how long in ms a directories cache entries are valid.
// Currently just the same value. In theory later policy could mark certain
// directories for longer cache time.
MetadataCache.prototype.getCacheTimeMs_ = function(directoryPath) {
  // 10 second lifetime.
  return 10 * 1000;
};

MetadataCache.prototype.getDirectoryCache_ = function(fileSystemId, pathParts) {
  if (!pathParts) {
    return null;
  }

  var fsCache = this.cache[fileSystemId];

  if (!fsCache) {
    return null;
  }

  return fsCache[pathParts['path']] || null;
};

MetadataCache.prototype.splitEntryPath_ = function(entryPath) {
  // TODO(zentaro): Can simplify.
  if (entryPath == '/') {
    return {'path': '/', 'name': ''};
  }

  var slashAt = entryPath.lastIndexOf('/');
  if (slashAt == -1) {
    return null;
  } else if (slashAt == 0) {
    return {'path': '/', 'name': entryPath.substring(1)};
  } else {
    return {
      'path': entryPath.substring(0, slashAt),
      'name': entryPath.substring(slashAt + 1)
    };
  }
};
