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

#include "SambaFsp.h"
#include <errno.h>
#include <stdio.h>
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_array_buffer.h"
#include "ppapi/cpp/var_dictionary.h"
#include "util.h"

namespace NaclFsp {

// Define static
SambaFsp::CredentialStore SambaFsp::Credentials;

SambaFsp::SambaFsp() {
  // TODO(zentaro): Move to init function instead?
  int debugLevel = 100;

  this->logger.Debug("SambaFsp constructor");

  this->logger.Debug("Creating samba context");
  SMBCCTX* context = smbc_new_context();
  if (!context) {
    this->logger.Error("SambaFsp: Could not create context");
    return;
  }

  this->logger.Debug("SambaFsp: Setting debug level");
  smbc_setDebug(context, debugLevel);

  this->logger.Debug("SambaFsp: Setting up the auth callback function");
  smbc_setFunctionAuthData(context, SambaFsp::auth_fn);
  smbc_setOptionUseKerberos(context, 1);
  smbc_setOptionFallbackAfterKerberos(context, 1);

  this->logger.Debug("SambaFsp: Initializing the context");
  if (!smbc_init_context(context)) {
    smbc_free_context(context, 0);
    this->logger.Error("SambaFsp: Could not initialize smbc context");
    return;
  }

  this->logger.Debug("SambaFsp: Setting the context");
  smbc_set_context(context);
}

void SambaFsp::auth_fn(const char* srv, const char* shr, char* wg, int wglen,
                       char* un, int unlen, char* pw, int pwlen) {
  // TODO(zentaro): Do better than this. Note duplication in saveCredentials.
  std::string lookup = std::string(srv) + "$$$" + std::string(shr);
  printf("TEMP: lookup=%s\n", lookup.c_str());
  CredentialStore::iterator it = SambaFsp::Credentials.find(lookup);

  if (it == SambaFsp::Credentials.end()) {
    if (wglen <= 0 || unlen <= 0 || pwlen <= 0) {
      printf("One of the credential buffers has no size.");
      return;
    }

    // TODO(zentaro): Implement callback to js. For now assume open.
    printf("NO CREDENTIALS FOUND - LEAVING EMPTY\n");
    wg[0] = '\0';
    un[0] = '\0';
    pw[0] = '\0';
  } else {
    std::string domain = it->second.domain;
    std::string user = it->second.user;
    std::string password = it->second.password;

    if ((static_cast<int>(domain.length()) + 1 > wglen) ||
        (static_cast<int>(user.length()) + 1 > unlen) ||
        (static_cast<int>(password.length()) + 1 > pwlen)) {
      printf("Credential buffers are too small for input\n");
      return;
    }

    strncpy(wg, domain.c_str(), domain.length());
    wg[domain.length()] = '\0';

    strncpy(un, user.c_str(), user.length());
    un[user.length()] = '\0';

    strncpy(pw, password.c_str(), password.length());
    pw[password.length()] = '\0';
  }
}

void SambaFsp::handleCustomMessage(const std::string& functionName,
                                   const pp::VarArray& args,
                                   pp::VarDictionary* result) {
  // TODO(zentaro): Implement.
}

void SambaFsp::createMountConfig(const pp::VarDictionary& mountInfo,
                                 SambaMountConfig* mountConfig) {
  mountConfig->sharePath = mountInfo.Get("sharePath").AsString();
  mountConfig->domain = mountInfo.Get("domain").AsString();
  mountConfig->user = mountInfo.Get("user").AsString();
  mountConfig->password = mountInfo.Get("password").AsString();
  mountConfig->server = mountInfo.Get("server").AsString();
  mountConfig->path = mountInfo.Get("path").AsString();
  mountConfig->share = mountInfo.Get("share").AsString();
  mountConfig->serverIP = mountInfo.Get("serverIP").AsString();
}

void SambaFsp::saveCredentials(const SambaMountConfig& mountConfig) {
  this->logger.Info("Saving creds for " + mountConfig.user + "@" +
                    mountConfig.server + "->" + mountConfig.path);
  // If the path starts with a slash just remove it.
  // TODO(zentaro): Do something better than this!!
  std::string path = mountConfig.path;
  if (Util::stringStartsWith(path, "/")) {
    path = path.substr(1, std::string::npos);
  }

  std::string lookupKey = createCredentialLookupKey(mountConfig);
  this->logger.Info("Saving with lookup string=" + lookupKey);
  SambaCredTuple creds;
  creds.domain = mountConfig.domain;
  creds.user = mountConfig.user;
  creds.password = mountConfig.password;

  SambaFsp::Credentials[lookupKey] = creds;

  this->logger.Debug("Cred store size after saving = " +
                     Util::ToString(SambaFsp::Credentials.size()));
}

void SambaFsp::removeCredentials(const SambaMountConfig& mountConfig) {
  this->logger.Info("Removing creds for " + mountConfig.user + "@" +
                    mountConfig.server + "->" + mountConfig.path);

  // If the path starts with a slash just remove it.
  // TODO(zentaro): Do something better than this!!
  std::string path = mountConfig.path;
  if (Util::stringStartsWith(path, "/")) {
    path = path.substr(1, std::string::npos);
  }

  std::string lookupKey = createCredentialLookupKey(mountConfig);
  this->logger.Debug("Removing with lookup string=" + lookupKey);

  CredentialStore::iterator it = SambaFsp::Credentials.find(lookupKey);

  if (it != SambaFsp::Credentials.end()) {
    SambaFsp::Credentials.erase(it);
  } else {
    logger.Error("Creds not found to remove.");
  }

  this->logger.Debug("Cred store size after removing = " +
                     Util::ToString(SambaFsp::Credentials.size()));
}

void SambaFsp::mount(const MountOptions& options,
                     const pp::VarDictionary& mountInfo,
                     pp::VarDictionary* result) {
  // TODO(zentaro): Check for dupes etc.
  // TODO(zentaro): Make configurable from js.
  // TODO(zentaro): Check for errors and fail.
  SambaMountConfig mountConfig;
  this->logger.Info("Calling createMountConfig");
  this->createMountConfig(mountInfo, &mountConfig);
  this->logger.Info("Done with createMountConfig");
  this->saveCredentials(mountConfig);
  this->logger.Info("Done with saveCredentials");

  this->logger.Info("****************** Opening " + mountConfig.sharePath);
  int shareId = smbc_opendir(mountConfig.sharePath.c_str());
  if (shareId < 0) {
    LogErrorAndSetErrorResult("mount:smbc_opendir", result);
    removeCredentials(mountConfig);
    return;
  }
  this->logger.Info("Opened share with id " + Util::ToString(shareId));
  ShareData data;

  // TODO(zentaro): Helper function. What about multiple trailing slashes?
  // TODO(zentaro): Possible problems with using the share from stored data
  // when generating the lookup key to remove the credentials that the key
  // was generated before this.
  if (Util::stringEndsWith(mountConfig.sharePath, std::string("/"))) {
    data.shareRoot =
        mountConfig.sharePath.substr(0, mountConfig.sharePath.length() - 1);
  } else {
    data.shareRoot = mountConfig.sharePath;
  }

  // TODO(zentaro): Is it even needed to store the shareId?
  data.smbShareId = shareId;
  this->mounts[options.fileSystemId] = data;

  smbc_closedir(shareId);
}

void SambaFsp::unmount(const UnmountOptions& options,
                       pp::VarDictionary* result) {
  this->logger.Info("Hello from unmount");
  MountMap::iterator it = this->mounts.find(options.fileSystemId);
  if (it != this->mounts.end()) {
    this->mounts.erase(it);
  }
}

void SambaFsp::getMetadata(const GetMetadataOptions& options,
                           pp::VarDictionary* result) {
  this->logger.Info("getMetadata: " + options.entryPath);

  std::string relativePath = options.entryPath;

  EntryMetadata entry;
  if (options.entryPath == "/") {
    entry.isDirectory = true;
    entry.name = "";
    entry.size = 0;
    entry.modificationTime = 0;
  } else {
    struct stat statInfo;
    entry.name = getNameFromPath(relativePath);
    entry.size = 0;
    std::string fullPath =
        getFullPathFromRelativePath(options.fileSystemId, relativePath);
    if (smbc_stat(fullPath.c_str(), &statInfo) < 0) {
      this->LogErrorAndSetErrorResult("getMetadata:smbc_stat", result);
      return;
    } else {
      // TODO(zentaro): Handle some special file types, links etc???
      entry.isDirectory = S_ISDIR(statInfo.st_mode);
      if (!entry.isDirectory) {
        entry.size = statInfo.st_size;
      }

      entry.modificationTime = statInfo.st_mtime;
    }
  }

  this->logger.Info("getMeta: " + this->stringify(entry));
  this->setResultFromEntryMetadata(entry, result);
}

void SambaFsp::LogErrorAndSetErrorResult(std::string operationName,
                                         pp::VarDictionary* result) {
  this->logger.Error("Error performing " + operationName + ": errno=" +
                     Util::ToString(errno) + " errtxt=" + strerror(errno));

  std::string errorString;
  switch (errno) {
    case EPERM:
    case EACCES:
      errorString = "ACCESS_DENIED";
      break;
    case ENOENT:
      errorString = "NOT_FOUND";
      break;
    case EMFILE:
    case ENFILE:
      errorString = "TOO_MANY_OPENED";
      break;
    case ECONNABORTED:
    case ECONNRESET:
    case ETIMEDOUT:
      // This block of error codes are ones that the JS side should consider
      // retryable. A special "SHOULD_RETRY" error code is returned. Since
      // the ChromeOS will complain that this isn't a valid error type it is
      // up to the retry logic in JS app to use this code as an indicator to
      // retry but once retrying fails to respond with a valid error code.
      errorString = "SHOULD_RETRY";
      break;
    default:
      errorString = "FAILED";
      break;
  }
  // TODO(zentaro): Better error code mapping.
  this->setErrorResult(errorString, result);
}

std::string SambaFsp::createCredentialLookupKey(
    const SambaMountConfig& mountConfig) {
  std::string host = mountConfig.serverIP;
  if (host.size() == 0) {
    host = mountConfig.server;
  }

  return host + "$$$" + mountConfig.share;
}

void SambaFsp::readDirectory(const ReadDirectoryOptions& options,
                             pp::VarDictionary* result) {
  this->logger.Info("readDirectory: " + options.directoryPath);
  std::vector<EntryMetadata> entries;
  std::string relativePath = options.directoryPath;

  // TODO(zentaro): Possibly expose servers as the root so that the shares
  // TODO(zentaro): Handle id missing properly.
  std::string fullPath =
      getFullPathFromRelativePath(options.fileSystemId, relativePath);

  if (!readDirectoryEntries(fullPath, &entries, result)) {
    return;
  }

  this->setResultFromEntryMetadataArray(entries, result);
}

void SambaFsp::openFile(const OpenFileOptions& options,
                        pp::VarDictionary* result) {
  this->logger.Info("openFile: " + options.filePath);

  std::string relativePath = options.filePath;

  // TODO(zentaro): Possibly expose servers as the root so that the shares
  // TODO(zentaro): Handle id missing properly.
  std::string fullPath =
      getFullPathFromRelativePath(options.fileSystemId, relativePath);

  // int openFileFlags = options.mode == FILE_MODE_READ ? O_RDONLY : O_WRONLY;
  this->logger.Info("openFileMode: " + Util::ToString(options.mode));
  // TODO(zentaro): File modes.
  int openFileId = smbc_open(fullPath.c_str(), O_RDWR, 0);

  if (openFileId < 0) {
    this->LogErrorAndSetErrorResult("openFile:smbc_open", result);
    return;
  }

  struct stat statInfo;
  if (smbc_stat(fullPath.c_str(), &statInfo) < 0) {
    this->LogErrorAndSetErrorResult("openFile:smbc_stat", result);
    return;
  }

  this->logger.Info("openFile: Size at open " +
                    Util::ToString(statInfo.st_size));

  OpenFileInfo fileInfo;
  fileInfo.sambaFileId = openFileId;
  fileInfo.lengthAtOpen = statInfo.st_size;
  fileInfo.offset = 0;
  fileInfo.mode = options.mode;

  this->openFiles[options.requestId] = fileInfo;
}

void SambaFsp::readFile(const ReadFileOptions& options,
                        pp::VarDictionary* result) {
  this->logger.Info("readFile: " + Util::ToString(options.openRequestId) + "@" +
                    Util::ToString(options.offset));

  std::map<int, OpenFileInfo>::iterator it =
      this->openFiles.find(options.openRequestId);

  if (it != this->openFiles.end()) {
    // TODO(zentaro): Error handling.
    // TODO(zentaro): Check buffer size.
    // TODO(zentaro): API with >2GB file size???
    // TODO(zentaro): Alias it->second
    int openFileId = it->second.sambaFileId;
    int lengthAtOpen = it->second.lengthAtOpen;
    off_t actualOffset = it->second.offset;

    if ((actualOffset < 0) || (actualOffset != options.offset)) {
      actualOffset =
          smbc_lseek(openFileId, static_cast<int>(options.offset), SEEK_SET);
      if ((actualOffset < 0) || (actualOffset != options.offset)) {
        this->LogErrorAndSetErrorResult("readFile:smbc_lseek", result);
        return;
      }

      if (actualOffset != options.offset) {
        setErrorResult("FAILED", result);
        return;
      }
    } else {
      this->logger.Debug("readFiles: Skipped redundant seek");
    }

    this->logger.Info("readFiles: lengthAtOpen=" +
                      Util::ToString(lengthAtOpen));
    // Even though the Files app knows how big the file is, it will still
    // try to read past the end of the file so this ensures totalBytesToRead
    // is restricted to the number of remaining bytes in the file.
    // TODO(zentaro): Use min.
    uint32_t remainingFileLength = lengthAtOpen - options.offset;
    uint32_t totalBytesToRead = remainingFileLength < options.length 
        ? remainingFileLength 
        : options.length;

    this->logger.Info("readFiles req=" + Util::ToString(options.length) +
                      " reading=" + Util::ToString(totalBytesToRead));
    pp::VarArrayBuffer buffer(totalBytesToRead);

    const size_t MAX_BYTES_PER_READ = 128 * 1024;

    // Nothing to do if 0 bytes requested.
    if (totalBytesToRead > 0) {
      void* buf = static_cast<void*>(buffer.Map());
      size_t bytesLeftToRead = totalBytesToRead;

      while (bytesLeftToRead > 0) {
        // TODO(zentaro): Use min.
        size_t bytesToRead = bytesLeftToRead < MAX_BYTES_PER_READ 
            ? bytesLeftToRead 
            : MAX_BYTES_PER_READ;

        this->logger.Debug("readFiles: " + 
            Util::ToString(totalBytesToRead - bytesLeftToRead) + 
            "-" + 
            Util::ToString(totalBytesToRead - bytesLeftToRead + bytesToRead - 1) + 
            " of " + Util::ToString(totalBytesToRead));
        ssize_t bytesRead = smbc_read(openFileId, buf, bytesToRead);
        this->logger.Info("readFiles:Done");
        if (bytesRead < 0) {
          it->second.offset = -1;
          LogErrorAndSetErrorResult("readFile:smbc_read", result);
          return;
        }

        if (static_cast<uint32_t>(bytesRead) != bytesToRead) {
          // TODO(zentaro): Does smbc_read ever do a short read?
          // Invalidate the offset to be same to force a seek if this file is
          // read again.
          it->second.offset = -1;
          this->logger.Error("Read mismatch: req=" +
                             Util::ToString(bytesToRead) + " got=" +
                             Util::ToString(bytesRead));
          setErrorResult("FAILED", result);
          return;
        }

        it->second.offset += bytesRead;
        bytesLeftToRead -= bytesRead;
        buf = static_cast<void*>(static_cast<uint8_t*>(buf) + bytesRead);
      }
    }

    this->setResultFromArrayBuffer(buffer, result);
  } else {
    // TODO(zentaro): Handle error.
    this->logger.Error("readFile: Invalid FD");
    this->setErrorResult("INVALID_OPERATION", result);
  }
}

void SambaFsp::closeFile(const CloseFileOptions& options,
                         pp::VarDictionary* result) {
  this->logger.Info("closeFile: " + Util::ToString(options.openRequestId));
  std::map<int, OpenFileInfo>::iterator it =
      this->openFiles.find(options.openRequestId);

  if (it != this->openFiles.end()) {
    if (smbc_close(it->second.sambaFileId) < 0) {
      // TODO(zentaro): Should this actually error?
      this->logger.Error("closeFile:smbc_close: Error closing fd");
    }

    // TODO(zentaro): Error handling?
    this->openFiles.erase(it);
  } else {
    this->logger.Error("closeFile: Tryed to close an unopened request id");
  }
}

void SambaFsp::createFile(const CreateFileOptions& options,
                          pp::VarDictionary* result) {
  this->logger.Info("createFile: " + options.filePath);
  std::string fullPath =
      getFullPathFromRelativePath(options.fileSystemId, options.filePath);

  int fileId = smbc_creat(fullPath.c_str(), 0755);

  if (fileId < 0) {
    this->LogErrorAndSetErrorResult("createFile:smbc_creat", result);
    return;
  }

  smbc_close(fileId);
}

void SambaFsp::createDirectory(const CreateDirectoryOptions& options,
                               pp::VarDictionary* result) {
  this->logger.Info("createDirectory: " + options.directoryPath);

  std::string fullPath =
      getFullPathFromRelativePath(options.fileSystemId, options.directoryPath);

  // TODO(zentaro): Error check. And handles EXISTS error.
  // TODO(zentaro): Handle recursive.
  if (smbc_mkdir(fullPath.c_str(), 0755) < 0) {
    this->LogErrorAndSetErrorResult("createDirectory:smbc_mkdir", result);
    return;
  }
}

void SambaFsp::deleteEntry(const DeleteEntryOptions& options,
                           pp::VarDictionary* result) {
  this->logger.Info("deleteEntry: " + options.entryPath + " recurse: " +
                    Util::ToString(options.recursive));

  std::string relativePath = options.entryPath;
  std::string fullPath =
      getFullPathFromRelativePath(options.fileSystemId, relativePath);

  deleteEntry(fullPath, options.recursive, result);
}

void SambaFsp::deleteEntry(const std::string& fullPath, bool recursive,
                           pp::VarDictionary* result) {
  struct stat statInfo;
  if (smbc_stat(fullPath.c_str(), &statInfo) < 0) {
    this->LogErrorAndSetErrorResult("deleteEntry:smbc_stat", result);
    return;
  }

  bool isDir = S_ISDIR(statInfo.st_mode);
  bool isFile = S_ISREG(statInfo.st_mode);

  if (isFile) {
    deleteFile(fullPath, result);
  } else if (isDir) {
    logger.Info("deleteEntry: Delete as directory");
    if (recursive) {
      // Delete the contents of this directory first.
      if (!deleteDirectoryContentsRecursive(fullPath, result)) {
        return;
      }
    }

    // This will fail if the directory is not empty.
    if (!deleteEmptyDirectory(fullPath, result)) {
      return;
    }
  } else {
    logger.Error("deleteEntry: Neither file nor directory: " + fullPath);
    this->setErrorResult("FAILED", result);
    return;
  }
}

bool SambaFsp::deleteFile(const std::string& fileFullPath,
                          pp::VarDictionary* result) {
  logger.Info("deleteEntry: [FILE] - " + fileFullPath);
  if (smbc_unlink(fileFullPath.c_str()) < 0) {
    this->LogErrorAndSetErrorResult("deleteEntry:smbc_unlink", result);
    return false;
  }

  return true;
}

bool SambaFsp::deleteEmptyDirectory(const std::string& dirFullPath,
                                    pp::VarDictionary* result) {
  logger.Info("deleteEntry: [DIR] - " + dirFullPath);
  if (smbc_rmdir(dirFullPath.c_str()) < 0) {
    this->LogErrorAndSetErrorResult("deleteEntry:smbc_rmdir", result);
    return false;
  }

  return true;
}

bool SambaFsp::deleteDirectoryContentsRecursive(const std::string& dirFullPath,
                                                pp::VarDictionary* result) {
  std::vector<EntryMetadata> entries;

  if (!readDirectoryEntries(dirFullPath, &entries, result)) {
    return false;
  }

  this->logger.Info("Found " + Util::ToString(entries.size()) +
                    " entries to delete under " + dirFullPath);
  for (std::vector<EntryMetadata>::iterator it = entries.begin();
       it != entries.end(); ++it) {
    std::string childFullPath = dirFullPath + "/" + it->name;
    if (it->isDirectory) {
      if ((it->name == "..") || (it->name == ".")) {
        continue;
      }

      // Recurse
      if (!deleteDirectoryContentsRecursive(childFullPath, result)) {
        return false;
      }

      if (!deleteEmptyDirectory(childFullPath, result)) {
        return false;
      }
    } else {
      if (!deleteFile(childFullPath, result)) {
        return false;
      }
    }
  }

  return true;
}

bool SambaFsp::readDirectoryEntries(const std::string dirFullPath,
                                    std::vector<EntryMetadata>* entries,
                                    pp::VarDictionary* result) {
  int dirId = -1;
  if ((dirId = smbc_opendir(dirFullPath.c_str())) < 0) {
    this->LogErrorAndSetErrorResult("readDirectory:smbc_opendir", result);
    return false;
  }

  // TODO(zentaro): Possibly per class buffer?
  int bufferSize = 1024 * 32;
  unsigned char* dirBuf = new unsigned char[bufferSize];
  int itemCount = 0;
  int bytesRemaining = 0;

  while ((bytesRemaining = smbc_getdents(
              dirId, reinterpret_cast<struct smbc_dirent*>(dirBuf),
              bufferSize)) > 0) {
    // smbc_getdents writes into the supplied buffer but it can't be treated
    // as an array because the structs are variable length. Each iteration
    // moves the pointer forward dirent->dirlen in the buffer and casts that
    // location in the buffer to a smbc_dirent.
    this->logger.Info("smbc_getdents returned " +
                      Util::ToString(bytesRemaining));
    struct smbc_dirent* dirent = reinterpret_cast<struct smbc_dirent*>(dirBuf);

    while (bytesRemaining > 0) {
      std::string dirType = this->mapDirectoryTypeToString(dirent->smbc_type);

      // TODO(zentaro): Handle other things? Like shares as folders.
      bool isFile = dirent->smbc_type == SMBC_FILE;
      bool isDirectory = dirent->smbc_type == SMBC_DIR;

      std::string childFullPath = dirFullPath + "/" + dirent->name;
      if (isFile || isDirectory) {
        EntryMetadata entry;
        struct stat statInfo;

        entry.name = dirent->name;
        entry.isDirectory = isDirectory;
        entry.size = 0;
        if (smbc_stat(childFullPath.c_str(), &statInfo) < 0) {
          // TODO(zentaro): Should this continue here?
          this->logger.Error("Failed to stat " + childFullPath);
        } else {
          entry.size = statInfo.st_size;
          entry.modificationTime = statInfo.st_mtime;
        }

        this->logger.Info("readDir: " + Util::ToString(itemCount) + ") " +
                          this->stringify(entry));
        entries->push_back(entry);
      } else {
        this->logger.Info("readDir: " + Util::ToString(itemCount) +
                          ") Ignored " + dirType + ": " + childFullPath);
      }
      itemCount++;
      bytesRemaining -= dirent->dirlen;
      // TODO(zentaro): Assert bytesRemaining >= 0

      // Advance in the buffer by dirent->dirlen
      dirent = reinterpret_cast<struct smbc_dirent*>(
          reinterpret_cast<unsigned char*>(dirent) + dirent->dirlen);
    }
  }

  bool success = true;
  if (bytesRemaining < 0) {
    // When numRead is less than 0 an error occured.
    LogErrorAndSetErrorResult("readDirectory:smbc_getdents", result);
    success = false;
  }

  delete[] dirBuf;
  smbc_closedir(dirId);
  return success;
}

void SambaFsp::moveEntry(const MoveEntryOptions& options,
                         pp::VarDictionary* result) {
  this->logger.Info("moveEntry: " + options.sourcePath + " to " +
                    options.targetPath);

  std::string fullSourcePath =
      getFullPathFromRelativePath(options.fileSystemId, options.sourcePath);

  std::string fullTargetPath =
      getFullPathFromRelativePath(options.fileSystemId, options.targetPath);

  // TODO(zentaro): Error check.
  // TODO(zentaro): NOTE this fails if the rename is cross-share
  if (smbc_rename(fullSourcePath.c_str(), fullTargetPath.c_str()) < 0) {
    this->LogErrorAndSetErrorResult("moveEntry:smbc_rename", result);
    return;
  }
}

void SambaFsp::copyEntry(const CopyEntryOptions& options,
                         pp::VarDictionary* result) {
  // Samba doesn't have a copy function looks like it expects read/write.
  // TODO(zentaro): Implement later. Will the FilesApp do it the manual way?
  this->setErrorResult("FAILED", result);
  // this->logger.Info("copyEntry: " + options.sourcePath + " to " +
  // options.targetPath);
  // std::string fullSourcePath = getFullPathFromRelativePath(
  //           options.fileSystemId,
  //           options.sourcePath);

  // std::string fullTargetPath = getFullPathFromRelativePath(
  //           options.fileSystemId,
  //           options.targetPath);
}

void SambaFsp::truncate(const TruncateOptions& options,
                        pp::VarDictionary* result) {
  // This function is different to expected in a POSIX system. It seems like
  // this operation it isn't necessary to open the file first.
  this->logger.Info("truncate: " + options.filePath);

  std::string fullPath =
      getFullPathFromRelativePath(options.fileSystemId, options.filePath);

  int openFileId = smbc_open(fullPath.c_str(), O_RDWR, 0);
  if (openFileId < 0) {
    this->LogErrorAndSetErrorResult("truncate:smbc_open", result);
    return;
  }

  // TODO(zentaro): Error checks
  if (smbc_ftruncate(openFileId, static_cast<off_t>(options.length)) < 0) {
    this->LogErrorAndSetErrorResult("truncate:smbc_ftruncate", result);
  }

  smbc_close(openFileId);
}

void SambaFsp::writeFile(const WriteFileOptions& options,
                         pp::VarDictionary* result) {
  this->logger.Info("writeFile: " + Util::ToString(options.openRequestId) +
                    "@" + Util::ToString(options.offset));

  std::map<int, OpenFileInfo>::iterator it =
      this->openFiles.find(options.openRequestId);

  if (it != this->openFiles.end()) {
    // TODO(zentaro): Error handling.
    // TODO(zentaro): Check buffer size.
    // TODO(zentaro): API with >2GB file size???
    int openFileId = it->second.sambaFileId;
    off_t actualOffset = it->second.offset;

    if ((actualOffset < 0) || (actualOffset != options.offset)) {
      // TODO(zentaro): What happens after EOF?
      actualOffset =
          smbc_lseek(openFileId, static_cast<off_t>(options.offset), SEEK_SET);
      if ((actualOffset < 0) || (actualOffset != options.offset)) {
        it->second.offset = -1;
        this->logger.Debug("writeFile: Unexpected offset after seek " +
                           Util::ToString(actualOffset));
        this->LogErrorAndSetErrorResult("writeFile:smbc_lseek", result);
        return;
      }
    } else {
      this->logger.Debug("writeFile: Skipping redundant seek");
    }

    uint32_t length = static_cast<uint32_t>(options.length);
    if (length > 0) {
      // Doesn't seem to like it when it is zero length.
      if (smbc_write(openFileId, options.data, length) < 0) {
        it->second.offset = -1;
        this->LogErrorAndSetErrorResult("writeFile:smbc_write", result);
        return;
      }

      it->second.offset += length;
    }
  } else {
    this->logger.Error("Invalid FD");
    this->setErrorResult("INVALID_OPERATION", result);
    return;
  }
}

std::string SambaFsp::getNameFromPath(std::string fullPath) {
  size_t slashAt = fullPath.rfind("/");
  std::string name;
  if (slashAt == std::string::npos) {
    // Don't think this should ever happen?
    name = fullPath;
  } else {
    name = fullPath.substr(slashAt + 1, std::string::npos);
  }

  this->logger.Info("getNameFromPath: Mapped " + fullPath + " -> " + name);
  return name;
}

std::string SambaFsp::getFullPathFromRelativePath(
    const std::string& fileSystemId, const std::string& relativePath) {
  if (relativePath == "/") {
    return mounts[fileSystemId].shareRoot;
  }

  // TODO(zentaro): Handle missing id.
  // TODO(zentaro): Handle trailing / on shareRoot
  std::string fullPath = mounts[fileSystemId].shareRoot + relativePath;
  this->logger.Info("getFullPathFromRelativePath: Mapped " + relativePath +
                    " -> " + fullPath);

  return fullPath;
}

std::string SambaFsp::mapDirectoryTypeToString(unsigned int dirType) {
  switch (dirType) {
    case SMBC_WORKGROUP:
      return "WORKGROUP";
    case SMBC_SERVER:
      return "SERVER";
    case SMBC_FILE_SHARE:
      return "FILE_SHARE";
    case SMBC_PRINTER_SHARE:
      return "PRINTER_SHARE";
    case SMBC_COMMS_SHARE:
      return "COMMS_SHARE";
    case SMBC_IPC_SHARE:
      return "IPC_SHARE";
    case SMBC_DIR:
      return "DIR";
    case SMBC_FILE:
      return "FILE";
    case SMBC_LINK:
      return "LINK";
    default:
      return "UNKNOWN";
  }
}

}  // namespace NaclFsp
