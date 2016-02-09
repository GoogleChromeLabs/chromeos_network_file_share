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

#include "BaseNaclFsp.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_array_buffer.h"
#include "ppapi/cpp/var_dictionary.h"
#include "util.h"

#include "ppapi_simple/ps.h"
#include "ppapi_simple/ps_interface.h"

namespace NaclFsp {

BaseNaclFsp::BaseNaclFsp() { this->logger.Info("BaseNaclFsp constructor"); }

void BaseNaclFsp::HandleMount(const pp::VarArray& args,
                              pp::VarDictionary* result) {
  MountOptions options;
  pp::VarDictionary optionsDict(args.Get(0));
  this->logger.Info("Setting mount options");
  options.Set(optionsDict);
  this->logger.Info("Done setting mount options");

  this->logger.Info("Calling into samba to mount");
  // The second arg is arbitrary extra data that can be passed to mount
  // and handled by the specific provider.
  pp::VarDictionary mountInfo(args.Get(1));
  this->mount(options, mountInfo, result);
}

void BaseNaclFsp::HandleUnmount(const pp::VarDictionary& optionsDict,
                                pp::VarDictionary* result) {
  UnmountOptions options;
  options.Set(optionsDict);
  this->unmount(options, result);
}

void BaseNaclFsp::HandleMessage(pp::Var var_message) {
  if (var_message.is_string()) {
    std::string message = var_message.AsString();
    this->logger.Info("You sent me string '" + message + "'");
  } else if (var_message.is_dictionary()) {
    pp::VarDictionary message(var_message);
    std::string functionName = message.Get("functionName").AsString();
    int messageId = message.Get("messageId").AsInt();
    pp::VarArray args(message.Get("args"));
    pp::VarDictionary optionsDict(args.Get(0));
    pp::VarDictionary result;

    // TODO(zentaro): Turn this into a map to function pointers. At the
    // least reorder by most used.
    if (functionName == "mount") {
      // NOTE: HandleMount takes args not optionsDict because it handles
      // additional data in the second arg.
      HandleMount(args, &result);
    } else if (functionName == "unmount") {
      HandleUnmount(optionsDict, &result);
    } else if (functionName == "getMetadata") {
      GetMetadataOptions options;
      options.Set(optionsDict);
      this->getMetadata(options, &result);
    } else if (functionName == "readDirectory") {
      ReadDirectoryOptions options;
      options.Set(optionsDict);
      this->readDirectory(options, &result);
    } else if (functionName == "openFile") {
      OpenFileOptions options;
      options.Set(optionsDict);
      this->openFile(options, &result);
    } else if (functionName == "readFile") {
      ReadFileOptions options;
      options.Set(optionsDict);
      this->readFile(options, &result);
    } else if (functionName == "writeFile") {
      WriteFileOptions options;
      options.Set(optionsDict);
      this->writeFile(options, &result);
    } else if (functionName == "closeFile") {
      CloseFileOptions options;
      options.Set(optionsDict);
      this->closeFile(options, &result);
    } else if (functionName == "createFile") {
      CreateFileOptions options;
      options.Set(optionsDict);
      this->createFile(options, &result);
    } else if (functionName == "createDirectory") {
      CreateDirectoryOptions options;
      options.Set(optionsDict);
      this->createDirectory(options, &result);
    } else if (functionName == "deleteEntry") {
      DeleteEntryOptions options;
      options.Set(optionsDict);
      this->deleteEntry(options, &result);
    } else if (functionName == "truncate") {
      TruncateOptions options;
      options.Set(optionsDict);
      this->truncate(options, &result);
    } else if (functionName == "moveEntry") {
      MoveEntryOptions options;
      options.Set(optionsDict);
      this->moveEntry(options, &result);
    } else if (functionName == "copyEntry") {
      CopyEntryOptions options;
      options.Set(optionsDict);
      this->copyEntry(options, &result);
    } else if (Util::stringStartsWith(functionName, "custom_")) {
      // Custom message just pass it on.
      // TODO(zentaro): Implement
      this->handleCustomMessage(functionName, args, &result);
    } else {
      this->logger.Info("Unknown function - " + functionName);
      return;
    }

    this->sendMessage(functionName, messageId, result, false);
  }
}

void BaseNaclFsp::sendMessage(const std::string& functionName, int messageId,
                              const pp::VarDictionary& result, bool hasMore) {
  pp::VarDictionary response;
  response.Set(pp::Var("functionName"), functionName);
  response.Set(pp::Var("messageId"), messageId);
  response.Set(pp::Var("result"), result);
  response.Set(pp::Var("hasMore"), hasMore);

  PSInterfaceMessaging()->PostMessage(PSGetInstanceId(), response.pp_var());
}

void BaseNaclFsp::setEntryMetadata(const EntryMetadata& entry,
                                   pp::VarDictionary* value) {
  value->Set(pp::Var("isDirectory"), pp::Var(entry.isDirectory));
  value->Set(pp::Var("name"), pp::Var(entry.name));
  value->Set(pp::Var("size"), pp::Var(entry.size));
  value->Set(pp::Var("modificationTime"), pp::Var(entry.modificationTime));
}

void BaseNaclFsp::setResultFromEntryMetadata(const EntryMetadata& entry,
                                             pp::VarDictionary* result) {
  pp::VarDictionary entryDict;

  this->setEntryMetadata(entry, &entryDict);

  result->Set(pp::Var("value"), entryDict);
}

void BaseNaclFsp::setResultFromEntryMetadataArray(
    const std::vector<EntryMetadata>& entries, pp::VarDictionary* result) {
  pp::VarArray entriesArray;

  for (size_t i = 0; i < entries.size(); i++) {
    pp::VarDictionary entryDict;
    this->setEntryMetadata(entries[i], &entryDict);
    entriesArray.Set(i, entryDict);
  }

  result->Set(pp::Var("value"), entriesArray);
}

void BaseNaclFsp::setResultFromArrayBuffer(const pp::VarArrayBuffer& buffer,
                                           pp::VarDictionary* result) {
  result->Set(pp::Var("value"), buffer);
}

void BaseNaclFsp::setErrorResult(const std::string& error,
                                 pp::VarDictionary* result) {
  result->Set(pp::Var("error"), error);
}

std::string BaseNaclFsp::stringify(const EntryMetadata& entry) {
  std::ostringstream ss;
  ss << "Name=" << entry.name << ", "
     << "IsDir=" << entry.isDirectory << ", "
     << "Size=" << entry.size << ", "
     << "Time=" << entry.modificationTime;

  return ss.str();
}

}  // namespace NaclFsp
