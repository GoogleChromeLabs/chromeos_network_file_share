#!/bin/bash

# Copyright 2015 Google Inc.
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

THIS_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

pushd $THIS_DIR
rm -rf glibc
rm -rf pnacl
rm -rf ../app/glibc
rm -rf ../app/bower_components
  pushd ../app
    rm -f mount_dialog.html
    rm -f mount_dialog.js
    rm -f common.js
  popd
popd
