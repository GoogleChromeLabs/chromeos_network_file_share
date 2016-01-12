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



/**
 * Helper class for writing protocol data to an array buffer. Takes a size in
 * the constructor and allows a single sequential write pass as is usual when
 * construction a network packet. Data is written big endian.
 * TODO(zentaro): Add other write* functions if needed.
 * TODO(zentaro): Add optional endian param to write* methods if needed.
 */
ArrayBufferWriter = function(size) {
  this.size_ = size;
  this.upto_ = 0;
  this.arrayBuffer_ = new ArrayBuffer(size);
  this.dataView_ = new DataView(this.arrayBuffer_);
};

ArrayBufferWriter.prototype.writeUint8 = function(value) {
  this.assertSize_(1);
  this.dataView_.setUint8(this.upto_, value);
  this.upto_++;
};

ArrayBufferWriter.prototype.writeUint16 = function(value) {
  this.assertSize_(2);
  this.dataView_.setUint16(this.upto_, value);
  this.upto_ += 2;
};

ArrayBufferWriter.prototype.isFull = function() {
  return this.upto_ == this.size_;
};

ArrayBufferWriter.prototype.getArrayBuffer = function() {
  return this.arrayBuffer_;
};

ArrayBufferWriter.prototype.assertSize_ = function(bytesToWrite) {
  console.assert((this.upto_ + bytesToWrite) <= this.size_);
};



/**
 * Helper class for reading sequential protocol data from an array buffer.
 * Takes the array buffer in the constructor. Data is read big endian.
 * TODO(zentaro): Add other read* functions if needed.
 * TODO(zentaro): Add optional endian param to read* methods if needed.
 */
ArrayBufferReader = function(arrayBuffer) {
  this.upto_ = 0;
  this.arrayBuffer_ = arrayBuffer;
  this.dataView_ = new DataView(this.arrayBuffer_);
};

ArrayBufferReader.prototype.readUint8 = function() {
  this.assertSize_(1);
  var result = this.dataView_.getUint8(this.upto_);
  this.upto_++;
  return result;
};

ArrayBufferReader.prototype.readUint16 = function() {
  this.assertSize_(2);
  var result = this.dataView_.getUint16(this.upto_);
  this.upto_ += 2;
  return result;
};

ArrayBufferReader.prototype.skip8 = function() {
  this.assertSize_(1);
  this.upto_ += 1;
};

ArrayBufferReader.prototype.skip16 = function() {
  this.assertSize_(2);
  this.upto_ += 2;
};

ArrayBufferReader.prototype.skip32 = function() {
  this.assertSize_(4);
  this.upto_ += 4;
};

ArrayBufferReader.prototype.skipNBytes = function(numberOfBytes) {
  this.assertSize_(numberOfBytes);
  this.upto_ += numberOfBytes;
};


ArrayBufferReader.prototype.isEndOfBuffer = function() {
  return this.upto_ == this.arrayBuffer_.byteLength;
};

ArrayBufferReader.prototype.assertSize_ = function(bytesToRead) {
  console.assert((this.upto_ + bytesToRead) <= this.arrayBuffer_.byteLength);
};
