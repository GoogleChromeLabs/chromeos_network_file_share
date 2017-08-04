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
SOURCE_PATH="${THIS_DIR}/../app"
TEMP_DIR=/tmp/samba
PACKAGE_NAME="samba_fsp_app"
PACKAGE_FILE="${PACKAGE_NAME}.zip"
LOCAL_OUTPUT_PATH="${TEMP_DIR}/${PACKAGE_FILE}"

echo Zipping up the extension:
echo From: $SOURCE_PATH
echo To  : $LOCAL_OUTPUT_PATH

pushd $SOURCE_PATH
  echo Zippppping
  zip -r $LOCAL_OUTPUT_PATH .
popd

echo Zip Location: $LOCAL_OUTPUT_PATH

echo Done.
