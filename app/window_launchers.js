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



function loadForegroundPage() {
  chrome.app.window.create('mount_dialog.html', {
    id: 'main_window',
    innerBounds: {width: 640, height: 390, left: 100, top: 100},
    hidden: false,
    minWidth: 640,
    minHeight: 390,
    frame: {type: 'chrome', color: '#137CD0'}
  });
}
