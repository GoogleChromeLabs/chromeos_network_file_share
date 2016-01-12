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
#include <stdio.h>
#include "ppapi/cpp/var.h"

#include "ppapi_simple/ps.h"
#include "ppapi_simple/ps_event.h"
#include "ppapi_simple/ps_interface.h"
#include "ppapi_simple/ps_main.h"

#include "SambaFsp.h"

int plugin_main(int argc, char* argv[]) {
  printf("plugin main: XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx");
  NaclFsp::SambaFsp fsp;
  PSEvent* ps_event = NULL;
  PSEventSetFilter(PSE_INSTANCE_HANDLEMESSAGE);

  while ((ps_event = PSEventWaitAcquire()) != NULL) {
    pp::Var var(ps_event->as_var);
    fsp.HandleMessage(var);
    PSEventRelease(ps_event);
  }

  return 0;
}

// Register the function to call once the Instance Object is initialized.
// see: pappi_simple/ps_main.h
PPAPI_SIMPLE_REGISTER_MAIN(plugin_main);
