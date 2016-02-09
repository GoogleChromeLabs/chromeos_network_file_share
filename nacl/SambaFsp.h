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

#include <cstring>
#include "BaseNaclFsp.h"
#include "ppapi/cpp/var_dictionary.h"
#include "samba/libsmbclient.h"

namespace NaclFsp {

class ShareData {
 public:
  std::string shareRoot;
  int smbShareId;
};

class SambaMountConfig {
 public:
  // TODO(zentaro): Rename to uri?
  std::string sharePath;
  std::string domain;
  std::string user;
  std::string password;
  std::string server;
  std::string serverIP;
  std::string path;
  std::string share;
};

class SambaCredTuple {
 public:
  std::string domain;
  std::string user;
  std::string password;
};

class OpenFileInfo {
 public:
  int sambaFileId;
  size_t lengthAtOpen;
  off_t offset;
  OpenFileMode mode;
};

class SambaFsp : public BaseNaclFsp {
 public:
  explicit SambaFsp();

 protected:
  static void auth_fn(const char* srv, const char* shr, char* wg, int wglen,
                      char* un, int unlen, char* pw, int pwlen);

  virtual void handleCustomMessage(const std::string& functionName,
                                   const pp::VarArray& args,
                                   pp::VarDictionary* result);
  virtual void mount(const MountOptions& options,
                     const pp::VarDictionary& mountInfo,
                     pp::VarDictionary* result);
  virtual void unmount(const UnmountOptions& options,
                       pp::VarDictionary* result);
  virtual void getMetadata(const GetMetadataOptions& options,
                           pp::VarDictionary* result);
  virtual bool readDirectory(const ReadDirectoryOptions& options, int messageId,
                             pp::VarDictionary* result);
  virtual void createDirectory(const CreateDirectoryOptions& options,
                               pp::VarDictionary* result);
  virtual void deleteEntry(const DeleteEntryOptions& options,
                           pp::VarDictionary* result);
  virtual void moveEntry(const MoveEntryOptions& options,
                         pp::VarDictionary* result);
  virtual void copyEntry(const CopyEntryOptions& options,
                         pp::VarDictionary* result);
  virtual void truncate(const TruncateOptions& options,
                        pp::VarDictionary* result);
  virtual void writeFile(const WriteFileOptions& options,
                         pp::VarDictionary* result);
  virtual void createFile(const CreateFileOptions& options,
                          pp::VarDictionary* result);
  virtual void openFile(const OpenFileOptions& options,
                        pp::VarDictionary* result);
  virtual void readFile(const ReadFileOptions& options,
                        pp::VarDictionary* result);
  virtual void closeFile(const CloseFileOptions& options,
                         pp::VarDictionary* result);

 private:
  typedef std::map<std::string, ShareData> MountMap;
  MountMap mounts;
  std::map<int, OpenFileInfo> openFiles;

  // TODO(zentaro): Use a dedicated class for credentials.
  typedef std::map<std::string, SambaCredTuple> CredentialStore;
  static CredentialStore Credentials;
  void saveCredentials(const SambaMountConfig& mountConfig);
  void removeCredentials(const SambaMountConfig& mountConfig);
  std::string createCredentialLookupKey(const SambaMountConfig& mountConfig);
  std::string mapDirectoryTypeToString(unsigned int dirType);
  std::string getNameFromPath(std::string path);
  std::string getFullPathFromRelativePath(const std::string& fileSystemId,
                                          const std::string& relativePath);
  void deleteEntry(const std::string& fullPath, bool recursive,
                   pp::VarDictionary* result);
  bool deleteFile(const std::string& fullPath, pp::VarDictionary* result);
  bool deleteDirectoryContentsRecursive(const std::string& fullPath,
                                        pp::VarDictionary* result);
  bool deleteEmptyDirectory(const std::string& fullPath,
                            pp::VarDictionary* result);
  bool readDirectoryEntries(const std::string& dirFullPath,
                            std::vector<EntryMetadata>* entries,
                            pp::VarDictionary* result);
  void populateStatInfoVector(std::vector<EntryMetadata>* entries);

  // TODO(zentaro): I don't think this is used any more.
  std::string flipSlashes(std::string path);
  void createMountConfig(const pp::VarDictionary& mountInfo,
                         SambaMountConfig* mountConfig);
  void LogErrorAndSetErrorResult(std::string operationName,
                                 pp::VarDictionary* result);
};

}  // namespace NaclFsp
