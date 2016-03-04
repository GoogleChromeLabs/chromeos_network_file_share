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

#include "Logger.h"
#include <stdio.h>
#include "ppapi/cpp/var.h"

#include "ppapi_simple/ps.h"
#include "ppapi_simple/ps_interface.h"

namespace NaclFsp {

Logger::Logger() {
  JavaScriptLogLevel = Logger::WARNING;
  // JavaScriptLogLevel = Logger::DEBUG;

  // TODO(zentaro): Probably make INFO by release time.
  PrintfLogLevel = Logger::WARNING;
}

void Logger::Debug(std::string message) {
  if (JavaScriptLogLevel <= Logger::DEBUG) {
    pp::Var var_message("NACL DEBUG: " + message);
    PSInterfaceMessaging()->PostMessage(PSGetInstanceId(),
                                        var_message.pp_var());
  }

  if (PrintfLogLevel <= Logger::DEBUG) {
    printf("%s\n", message.c_str());
  }
}

void Logger::Info(std::string message) {
  if (JavaScriptLogLevel <= Logger::INFO) {
    pp::Var var_message("NACL INFO: " + message);
    PSInterfaceMessaging()->PostMessage(PSGetInstanceId(),
                                        var_message.pp_var());
  }

  if (PrintfLogLevel <= Logger::INFO) {
    printf("%s\n", message.c_str());
  }
}

void Logger::Warning(std::string message) {
  if (JavaScriptLogLevel <= Logger::WARNING) {
    pp::Var var_message("NACL WARNING: " + message);
    PSInterfaceMessaging()->PostMessage(PSGetInstanceId(),
                                        var_message.pp_var());
  }

  if (PrintfLogLevel <= Logger::WARNING) {
    printf("%s\n", message.c_str());
  }
}

void Logger::Error(std::string message) {
  if (JavaScriptLogLevel <= Logger::ERROR) {
    pp::Var var_message("NACL ERROR: " + message);
    PSInterfaceMessaging()->PostMessage(PSGetInstanceId(),
                                        var_message.pp_var());
  }

  if (PrintfLogLevel <= Logger::ERROR) {
    printf("%s\n", message.c_str());
  }
}

}  // namespace NaclFsp
