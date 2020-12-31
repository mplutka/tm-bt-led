#include <napi.h>

namespace AssettoCorsaSharedMemory {

    Napi::Object GetPhysics(const Napi::CallbackInfo& info);

    Napi::Object GetGraphics(const Napi::CallbackInfo& info);

    Napi::Object GetStatics(const Napi::CallbackInfo& info);

    Napi::Object Init(Napi::Env env, Napi::Object exports);
    Napi::Number Cleanup(const Napi::CallbackInfo& info);
}