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
make V=1 TOOLCHAIN=glibc VALID_ARCHES='x86_64 arm'


if [ $? -eq 0 ]; then
  echo Build successful.

  echo Removing existing built code in app
  rm -rf ../app/glibc

  echo Copying built code back to app
  cp -r glibc ../app

  echo Removing old copy of bower_components
  rm -rf ../app/bower_components

  echo Copying bower_components into the app
  cp -r ../third_party/bower_components ../app

  echo Copying common.js from third_party into the app
  cp ../third_party/nacl_sdk/common.js ../app

  echo Vulcanizing mount dialog
  pushd ../app
    vulcanize window.html --inline-script | crisper --html mount_dialog.html --js mount_dialog.js
  popd
fi
popd
