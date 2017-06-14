/**
 * @fileoverview Description of this file.
 */

var assert = require('assert');
require('../../app/metadata_cache');
require('../../app/log');

describe('MetadataCache', function() {

  describe("cache", function() {
    var cache = new MetadataCache();
    it("should work", function() {
      var emptyItem = cache.lookupMetadata("hey", "ho");
      assert(emptyItem === null);
    });
    it("blah", function() {
      var entry = {
        fullPath : "",
        name : "test.jpg",
        isDirectory : false
      };
      const fileSystemId = "smb://127.0.0.1/testshare";
      const directorypath = "/tmp";
      const requestEntryPath = directorypath + "/" + entry.name;
      cache.cacheDirectoryContents(fileSystemId, directorypath, []);
      cache.updateMetadata(fileSystemId, requestEntryPath, entry);
      var item = cache.lookupMetadata(fileSystemId, requestEntryPath);
      assert(item === null);
    })
  });
});
