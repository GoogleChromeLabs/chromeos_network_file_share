# Copyright (c) 2013 The Chromium Authors. All rights reserved.
# Use of this source code is governed by a BSD-style license that can be
# found in the LICENSE file.

# GNU Makefile based on shared rules provided by the Native Client SDK.
# See README.Makefiles for more details.

# TODO(XXXXX): What to do with this? It's based on a sample copied from NaCl SDK.

TARGET = nacl_fsp

include $(NACL_SDK_ROOT)/tools/common.mk

EXTRA_INC_PATHS = ${NACL_SDK_ROOT}/ports/include
EXTRA_LIB_PATHS = ${NACL_SDK_ROOT}/ports/lib

#VALID_TOOLCHAINS := pnacl newlib glibc clang-newlib linux
VALID_TOOLCHAINS := glibc

DEPS = ppapi_simple_cpp nacl_io
LIBS = ppapi_simple_cpp nacl_io ppapi ppapi_cpp pthread smbclient

CFLAGS = -Wall
SOURCES = Logger.cc Options.cc nacl_fsp.cc SambaFsp.cc BaseNaclFsp.cc

# Build rules generated by macros from common.mk:

$(foreach dep,$(DEPS),$(eval $(call DEPEND_RULE,$(dep))))
$(foreach src,$(SOURCES),$(eval $(call COMPILE_RULE,$(src),$(CFLAGS))))

# The PNaCl workflow uses both an unstripped and finalized/stripped binary.
# On NaCl, only produce a stripped binary for Release configs (not Debug).
ifneq (,$(or $(findstring pnacl,$(TOOLCHAIN)),$(findstring Release,$(CONFIG))))
$(eval $(call LINK_RULE,$(TARGET)_unstripped,$(SOURCES),$(LIBS),$(DEPS)))
$(eval $(call STRIP_RULE,$(TARGET),$(TARGET)_unstripped))
else
$(eval $(call LINK_RULE,$(TARGET),$(SOURCES),$(LIBS),$(DEPS)))
endif

$(eval $(call NMF_RULE,$(TARGET),))
