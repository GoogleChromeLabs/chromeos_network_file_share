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

namespace NaclFsp {

class Logger {
 public:
  enum LOG_LEVEL { DEBUG = 0, INFO = 1, WARNING = 2, ERROR = 3 };

  Logger();

  LOG_LEVEL JavaScriptLogLevel;
  LOG_LEVEL PrintfLogLevel;

  void Debug(std::string message);

  void Info(std::string message);

  void Warning(std::string message);

  void Error(std::string message);
};

}  // namespace NaclFsp
