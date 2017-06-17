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

require('../../app/metadata_cache');
require('../../app/log');
var chai = require('chai');
var assert = chai.assert;

// Declare global `log` because of implicit dependency in MetadataCache
global.log = new JsLogger();

describe('MetadataCache', function() {

  describe("Inserting and deleting value", function() {
    var cache = new MetadataCache();
    const fileSystemId = "smb://127.0.0.1/testshare";
    const directoryPath = "/tmp";
    const entryName = "test.jpg";
    var entry = {
      fullPath : "",
      name : entryName,
      isDirectory : false
    };
    var date = new Date();
    const requestEntryPath = directoryPath + "/" + entry.name;

    it("should be empty", function() {
      var emptyItem = cache.lookupMetadata(fileSystemId, requestEntryPath,
          date.getTime());
      assert.isNull(emptyItem);
    });

    it("should insert a value", function() {
      cache.cacheDirectoryContents(fileSystemId, directoryPath, [],
          date.getTime());
      cache.updateMetadata(fileSystemId, requestEntryPath, entry);
      var item = cache.lookupMetadata(fileSystemId, requestEntryPath);
      assert(item);
      assert.equal(item.name, entryName);
    });

    it("should delete value", function() {
      cache.invalidateEntry(fileSystemId, requestEntryPath);
      var deletedItem = cache.lookupMetadata(fileSystemId, requestEntryPath);
      assert.isNull(deletedItem);
    });
  });
});
