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

MetadataCache = function(cachePurgeLengthMs) {
  this.cache = {};
  if (cachePurgeLengthMs) {
    setInterval(function () {
      log.debug("Purging cache");
      this.cache = {};
    }.bind(this), cachePurgeLengthMs);
  }
};


MetadataCache.prototype.cacheDirectoryContents = function(
    fileSystemId, directoryPath, entries, currentTime) {
  if (!(fileSystemId in this.cache)) {
    log.debug('Starting cache for ' + fileSystemId);
    this.cache[fileSystemId] = {};
  }

  // Just overwrite if anything was there before.
  log.debug('Updating cache for ' + fileSystemId + '|' + directoryPath);
  this.cache[fileSystemId][directoryPath] = {
    'timeCached': currentTime,
    'entries': {},
    'incomplete_entries': {}
  };

  entries.forEach(function(entry) {
    // Make sure the full entry path is stored in the entry for convenience.
    entry['entryPath'] = this.joinEntryPath_(directoryPath, entry.name);
    this.cache[fileSystemId][directoryPath]['entries'][entry.name] = entry;
    if (entry.size == -1) {
      log.debug('Adding incomplete entry for ' + entry.name);
      this.cache[fileSystemId][directoryPath]['incomplete_entries']
                [entry.name] = true;
    }
  }.bind(this));
};

MetadataCache.prototype.lookupMetadata = function(
    fileSystemId, entryPath, currentTime) {
  var pathParts = this.splitEntryPath_(entryPath);
  var dirCache = this.getDirectoryCache_(fileSystemId, pathParts);

  if (!dirCache) {
    return null;
  }

  var entryExpiresAt =
      dirCache['timeCached'] + this.getCacheTimeMs_(pathParts['path']);
  if (currentTime >= entryExpiresAt) {
    // Invalidates the metadata for the entire directory.
    log.debug('Invalidating dir cache for ' + pathParts['path']);
    var fsCache = this.cache[fileSystemId];
    delete fsCache[pathParts['path']];
    return null;
  }

  return dirCache['entries'][pathParts['name']] || null;
};

MetadataCache.prototype.getBatchToUpdate = function(
    fileSystemId, entryPath, batchSize) {
  var pathParts = this.splitEntryPath_(entryPath);
  var dirCache = this.getDirectoryCache_(fileSystemId, pathParts);

  if (!dirCache) {
    return [];
  }

  var upto = 1;
  var batch = [entryPath];
  var toRemove = [];

  // TODO(zentaro): Might also have to put a promise on the entry
  // while a batch is in flight to prevent a race condition.
  for (var name in dirCache['incomplete_entries']) {
    if (name != pathParts['name']) {
      var fullPath = this.joinEntryPath_(pathParts['path'], name);
      batch.push(fullPath);
    }

    // Put a resolver in the cache entry that subsequent
    // calls can wait on.
    dirCache['entries'][name]['stat_resolver'] = getPromiseResolver();
    toRemove.push(name);

    if (upto++ >= batchSize) {
      break;
    }
  }

  toRemove.forEach(function(name) {
    delete dirCache['incomplete_entries'][name];
  });

  return batch;
};

MetadataCache.prototype.updateMetadata = function(
    fileSystemId, requestEntryPath, entry) {
  var pathParts = this.splitEntryPath_(requestEntryPath);
  var dirCache = this.getDirectoryCache_(fileSystemId, pathParts);

  // requestEntryPath could be a sibling in the case of batch updates so
  // always build the actual entry path explicitly.
  entry['entryPath'] = this.joinEntryPath_(pathParts['path'], entry.name);
  // TODO(zentaro): Is is actually necessary to store it in the entry?
  log.debug('Updating metadata for ' + entry['entryPath']);

  // TODO(zentaro): Consider having separate expirations on metadata entries.
  if (dirCache) {
    // Grab the resolver if it is there.
    var oldEntry = dirCache['entries'][entry['name']];
    if (oldEntry) {
      var statResolver = oldEntry['stat_resolver'];
      if (statResolver) {
        log.debug('Firing pending stat_resolver for ' + entry['entryPath']);
        statResolver.resolve(entry);
      }
    }

    // Assumption is that updateMetadata is only called with complete entries.
    dirCache['entries'][entry['name']] = entry;

    // Remove from the incomplete_entries set.
    log.debug('Removing incomplete ' + entry['entryPath']);
    delete dirCache['incomplete_entries'][entry['name']];
  }
};

MetadataCache.prototype.invalidateEntry = function(fileSystemId, entryPath) {
  var pathParts = this.splitEntryPath_(entryPath);
  var dirCache = this.getDirectoryCache_(fileSystemId, pathParts);

  if (!dirCache) {
    return null;
  }

  log.debug('Invalidating metadata entry for ' + entryPath);

  // NOTE: Currently invalidation just deletes the entry in the dirCache which
  // is fine since we only use the cache for individual metadata requests. When
  // the cache misses it will do a real lookup.
  //
  // TODO(zentaro): If this class supports using the dirCache to service readDir
  // requests then this would also invalidate the whole dir. Currently a readDir
  // would refresh the cache in all cases.
  delete dirCache['entries'][pathParts['name']];
  delete dirCache['incomplete_entries'][pathParts['name']];
};

// Returns how long in ms a directories cache entries are valid.
// Currently just the same value. In theory later policy could mark certain
// directories for longer cache time.
MetadataCache.prototype.getCacheTimeMs_ = function(directoryPath) {
  // Allow a 5 min cache. This should be safe because any subsequent
  // readDirectory will refresh. This prevents the case where for a large
  // directory, part of set of stat()s hit the cache but then it degrades
  // from batching due to a total cache miss.
  return 5 * 60 * 1000;
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

MetadataCache.prototype.joinEntryPath_ = function(path, name) {
  if (path == '/') {
    return path + name;
  } else {
    return path + '/' + name;
  }
};
