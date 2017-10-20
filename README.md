## Overview

This is a Chrome App that extends the built in File Manager to be able to
support connecting to SMB file shares.

The NaCl port is currently patched from Samba 4.1.22.

## Setup

1) Download the NaCl SDK and unzip it as directed.
      https://developer.chrome.com/native-client/sdk/download

2) Update the SDK and get the pepper_50 version.

```
cd nacl_sdk
./naclsdk update
./naclsdk update pepper_50
export NACL_SDK_ROOT=/path/to/nacl_sdk/pepper_50
```

3) Get depot_tools and gclient.
```
git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git
```

4) Put depot_tools on the path (or put it in your .bashrc)
      https://www.chromium.org/developers/how-tos/install-depot-tools

5) Get WebPorts (aka NaCl Ports).
```
mkdir webports
cd webports
gclient config --name=src https://chromium.googlesource.com/webports.git
gclient sync
```

6) Install a missing dependency from the NaCl SDK.
```
sudo apt-get install libglib2.0-0:i386
```

7) Build Samba.
```
cd webports/src
./make_all.sh samba F=1 V=1
```
8) Get the App code.
```
cd ~
git clone https://github.com/GoogleChrome/chromeos_network_file_share
```
9) Install node & npm.
      https://syntaxsugar.github.io/posts/2014/05/how-to-install-bower-on-ubuntu-1404-lts/
      
*Note:
If you are a Google employee, please follow `go/installnode` followed by `sudo npm install -g bower`
```
sudo apt-get install nodejs
sudo ln -s /usr/bin/nodejs /usr/bin/node
sudo apt-get install npm
sudo npm install -g bower
```

10) Get the bower dependencies.
```
cd chromeos_network_file_share/app
bower install
```
11) Install Vulcanize and Crisper.
```
sudo npm install -g vulcanize
sudo npm install -g crisper
```
12) Setup build environment

      Set NACL_SDK_ROOT if not done above

13) Finally you can build!
```
cd chromeos_network_file_share
nacl/build.sh
```
14) Export zip to temp folder
```
tools/to_temp.sh
```

## Tests

We use [Mocha](http://mochajs.org) and [Chai](http://chaijs.com/) as our test framework.

To download the testing dependencies:
```
npm install --only=dev
```
To run the tests:
```
npm test
```

### Arm Nacl_IO Bug

There is currently a bug that causes a crash on ARM Release builds. Until the
bug is fixed the workaround is to build libnacl_io.so with optimizations turned
off. If you don't do this extra step prior to building the app the ARM build
will crash.

Before building the app edit $NACL_SDK_ROOT/src/nacl_io/Makefile and add
the following after the line 'CFLAGS += -DNACL_IO_LOGGING=0'
```
ifeq ($(NACL_ARCH), arm)
  CFLAGS += -O1
endif

// then rebuild nacl_io
cd $NACL_SDK_ROOT/src/nacl_io/
make V=1 CONFIG=Release TOOLCHAIN=glibc NACL_ARCH=arm
```
That will rebuild libnacl_io.so with optimization disabled. Then rebuild the
app.

### Nacl SDK
Update SDK (currently using pepper_canary).
```
./naclsdk update pepper_canary --force
```
### Building The App/Extension

Setup environment
```
export NACL_SDK_ROOT=/path/to/your/nacl/sdk
```
Build
```
nacl/build.sh
```
Package
```
tools/to_temp.sh
```
### Troubleshooting
```
In file included from nacl_fsp.cc:24:
./SambaFsp.h:20:10: fatal error: 'samba/libsmbclient.h' file not found
#include "samba/libsmbclient.h"
```
If you see this error follow the steps above for 'Setup environment'
