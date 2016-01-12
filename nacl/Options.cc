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

#include "Options.h"

#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_array_buffer.h"
#include "ppapi/cpp/var_dictionary.h"

namespace NaclFsp {

void BaseOptions::Set(const pp::VarDictionary& optionsDict) {
  fileSystemId = optionsDict.Get("fileSystemId").AsString();
}

void TrackedOperationOptions::Set(const pp::VarDictionary& optionsDict) {
  BaseOptions::Set(optionsDict);
  requestId = optionsDict.Get("requestId").AsInt();
}

void DirectoryOperationOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  directoryPath = optionsDict.Get("directoryPath").AsString();
}

void OpenFileOperationOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  openRequestId = optionsDict.Get("openRequestId").AsInt();
}

void FileIOOperationOptions::Set(const pp::VarDictionary& optionsDict) {
  OpenFileOperationOptions::Set(optionsDict);
  offset = optionsDict.Get("offset").AsDouble();

  // NOTE: The base class holds this member but the derived class sets it
  // because in the write case it comes from the size of the ArrayBuffer.
  length = -1;
}

void MountOptions::Set(const pp::VarDictionary& optionsDict) {
  BaseOptions::Set(optionsDict);
  displayName = optionsDict.Get("displayName").AsString();
  writable = optionsDict.Get("writable").AsBool();
  pp::Var openLimitVar(optionsDict.Get("openedFilesLimit"));

  if (openLimitVar.is_int()) {
    openedFilesLimit = optionsDict.Get("openedFilesLimit").AsInt();
  } else {
    openedFilesLimit = 0;
  }
}

void UnmountOptions::Set(const pp::VarDictionary& optionsDict) {
  BaseOptions::Set(optionsDict);
}

void GetMetadataOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  entryPath = optionsDict.Get("entryPath").AsString();
  thumbnail = optionsDict.Get("thumbnail").AsBool();
}

void ReadDirectoryOptions::Set(const pp::VarDictionary& optionsDict) {
  DirectoryOperationOptions::Set(optionsDict);
}

void CreateDirectoryOptions::Set(const pp::VarDictionary& optionsDict) {
  DirectoryOperationOptions::Set(optionsDict);
  recursive = optionsDict.Get("recursive").AsBool();
}

void OpenFileOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  filePath = optionsDict.Get("filePath").AsString();
  std::string fileMode = optionsDict.Get("fileMode").AsString();
  if (fileMode == "READ") {
    mode = FILE_MODE_READ;
  } else {
    // TODO(zentaro): Assert it is write?
    mode = FILE_MODE_WRITE;
  }
}

void CreateFileOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  // TODO(zentaro): Can maybe consolidate filePath with OpenFileOptions.
  filePath = optionsDict.Get("filePath").AsString();
}

void CloseFileOptions::Set(const pp::VarDictionary& optionsDict) {
  OpenFileOperationOptions::Set(optionsDict);
}

void ReadFileOptions::Set(const pp::VarDictionary& optionsDict) {
  FileIOOperationOptions::Set(optionsDict);

  // NOTE: Even though this is in the base class it is set here because the
  // derived write class gets this field from the length of the passed in
  // ArrayBuffer.
  length = optionsDict.Get("length").AsDouble();
}

void WriteFileOptions::Set(const pp::VarDictionary& optionsDict) {
  FileIOOperationOptions::Set(optionsDict);

  // TODO(zentaro): Investigate if there might be an extra copy happening here.
  pp::VarArrayBuffer buffer(optionsDict.Get("data"));
  data = buffer.Map();
  length = buffer.ByteLength();
}

void DeleteEntryOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  entryPath = optionsDict.Get("entryPath").AsString();
  recursive = optionsDict.Get("recursive").AsBool();
}

void CopyEntryOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  sourcePath = optionsDict.Get("sourcePath").AsString();
  targetPath = optionsDict.Get("targetPath").AsString();
}

void MoveEntryOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  sourcePath = optionsDict.Get("sourcePath").AsString();
  targetPath = optionsDict.Get("targetPath").AsString();
}

void TruncateOptions::Set(const pp::VarDictionary& optionsDict) {
  TrackedOperationOptions::Set(optionsDict);
  filePath = optionsDict.Get("filePath").AsString();
  length = optionsDict.Get("length").AsDouble();
}

}  // namespace NaclFsp
