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
#include <vector>

#include "INaclFsp.h"
#include "Logger.h"

namespace NaclFsp {

class BaseNaclFsp : public INaclFsp {
 public:
  explicit BaseNaclFsp();

  // TODO(zentaro): Maybe this shouldn't be virtual??
  virtual void HandleMessage(pp::Var var_message);

 protected:
  Logger logger;

  void setErrorResult(const std::string& error, pp::VarDictionary* result);

  void setEntryMetadata(const EntryMetadata& entry, pp::VarDictionary* value);

  void setResultFromEntryMetadata(const EntryMetadata& entry,
                                  pp::VarDictionary* result);

  void setResultFromEntryMetadataArray(const std::vector<EntryMetadata>& entry,
                                       pp::VarDictionary* result);

  void setResultFromArrayBuffer(const pp::VarArrayBuffer& buffer,
                                pp::VarDictionary* result);

  void sendMessage(const std::string& functionName, int messageId,
                   const pp::VarDictionary& result, bool hasMore);

  std::string stringify(const EntryMetadata& entry);

 private:
  // API Handler Methods
  void HandleMount(const pp::VarArray& args, pp::VarDictionary* result);
  void HandleUnmount(const pp::VarDictionary& optionsDict,
                     pp::VarDictionary* result);
};

}  // namespace NaclFsp
