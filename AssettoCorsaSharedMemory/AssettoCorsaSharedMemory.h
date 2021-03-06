#include <napi.h>

namespace AssettoCorsaSharedMemory {
    Napi::Object SetExports(Napi::Env env, Napi::Object exports);
    Napi::Number InitMaps(const Napi::CallbackInfo& info);

    Napi::Object GetPhysics(const Napi::CallbackInfo& info);
    Napi::Object GetGraphicsAssetto(const Napi::CallbackInfo& info);
    Napi::Object GetGraphicsACC(const Napi::CallbackInfo& info);
    Napi::Object GetStatics(const Napi::CallbackInfo& info);

    Napi::Number Cleanup(const Napi::CallbackInfo& info);
}