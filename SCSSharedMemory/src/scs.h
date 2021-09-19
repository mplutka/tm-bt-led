#pragma once

#include <stdint.h>
#include <napi.h>

namespace scs {
    Napi::Object SetExports(Napi::Env env, Napi::Object exports);
    Napi::Number InitMaps(const Napi::CallbackInfo& info);
    Napi::Object GetData(const Napi::CallbackInfo& info);
    Napi::Number Cleanup(const Napi::CallbackInfo& info);
}
