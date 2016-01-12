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

#include <sstream>
#include <string>

namespace Util {

template <typename T>
inline std::string ToString(T value) {
  std::ostringstream ss;
  ss << value;
  return ss.str();
}

inline bool stringEndsWith(const std::string& s, const std::string& suffix) {
  if (s.length() < suffix.length()) {
    return false;
  }

  return s.compare(s.length() - suffix.length(), suffix.length(), suffix) == 0;
}

inline bool stringStartsWith(const std::string& s, const std::string& prefix) {
  if (s.length() < prefix.length()) {
    return false;
  }

  return s.compare(0, prefix.length(), prefix) == 0;
}

}  // namespace Util
