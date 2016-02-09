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

#include <string>

#include "Options.h"
#include "ppapi/cpp/instance.h"

namespace pp {
class VarDictionary;
class VarArray;
class VarArrayBuffer;
}

namespace NaclFsp {

class EntryMetadata {
 public:
  EntryMetadata() : size(-1.0), modificationTime(-1) {}

  bool isDirectory;
  std::string name;
  double size;

  int modificationTime;
  std::string mimeType;
  std::string thumbnail;

  /**
   * When stat info is populated size will be >=0. When this
   * returns true only name and isDirectory are populated.
   */
  bool hasStatInfo() { return this->size >= 0; }
};

class INaclFsp {
 public:
  virtual void HandleMessage(pp::Var var_message) = 0;

 protected:
  virtual void handleCustomMessage(const std::string& functionName,
                                   const pp::VarArray& args,
                                   pp::VarDictionary* result) = 0;

  // API Methods
  virtual void mount(const MountOptions& options,
                     const pp::VarDictionary& mountInfo,
                     pp::VarDictionary* result) = 0;
  virtual void unmount(const UnmountOptions& options,
                       pp::VarDictionary* result) = 0;
  virtual void getMetadata(const GetMetadataOptions& options,
                           pp::VarDictionary* result) = 0;
  virtual void readDirectory(const ReadDirectoryOptions& options,
                             pp::VarDictionary* result) = 0;
  virtual void createDirectory(const CreateDirectoryOptions& options,
                               pp::VarDictionary* result) = 0;
  virtual void deleteEntry(const DeleteEntryOptions& options,
                           pp::VarDictionary* result) = 0;
  virtual void moveEntry(const MoveEntryOptions& options,
                         pp::VarDictionary* result) = 0;
  virtual void copyEntry(const CopyEntryOptions& options,
                         pp::VarDictionary* result) = 0;
  virtual void truncate(const TruncateOptions& options,
                        pp::VarDictionary* result) = 0;
  virtual void writeFile(const WriteFileOptions& options,
                         pp::VarDictionary* result) = 0;
  virtual void createFile(const CreateFileOptions& options,
                          pp::VarDictionary* result) = 0;
  virtual void openFile(const OpenFileOptions& options,
                        pp::VarDictionary* result) = 0;
  virtual void readFile(const ReadFileOptions& options,
                        pp::VarDictionary* result) = 0;
  virtual void closeFile(const CloseFileOptions& options,
                         pp::VarDictionary* result) = 0;
};
}
