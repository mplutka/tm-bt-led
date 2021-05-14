#include "r3e.h"
#include "utils.h"

#define _USE_MATH_DEFINES

#include <math.h>
#include <stdio.h>
#include <time.h>
#include <Windows.h>
#include <tchar.h>

#pragma optimize("",off)
using namespace std;

#define ALIVE_SEC 600
#define INTERVAL_MS 100

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  	return r3e::SetExports(env, exports);
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll);

Napi::Object r3e::SetExports(Napi::Env env, Napi::Object exports)
{
	exports.Set("initMaps", Napi::Function::New(env, r3e::InitMaps));
	exports.Set("getData", Napi::Function::New(env, r3e::GetData));
	exports.Set("cleanup", Napi::Function::New(env, r3e::Cleanup));
	return exports;
}


HANDLE map_handle = INVALID_HANDLE_VALUE;
r3e_shared* map_buffer = NULL;

HANDLE map_open()
{
    return OpenFileMapping(
        FILE_MAP_READ,
        FALSE,
        TEXT(R3E_SHARED_MEMORY_NAME));
}

BOOL map_exists()
{
    HANDLE handle = map_open();

    if (handle != NULL)
        CloseHandle(handle);
        
    return handle != NULL;
}

int map_init()
{
    map_handle = map_open();

    if (map_handle == NULL)
    {
        wprintf_s(L"Failed to open mapping");
        return 1;
    }

    map_buffer = (r3e_shared*)MapViewOfFile(map_handle, FILE_MAP_READ, 0, 0, sizeof(r3e_shared));
    if (map_buffer == NULL)
    {
        wprintf_s(L"Failed to map buffer");
        return 1;
    }

    return 0;
}

void map_close()
{
    if (map_buffer) UnmapViewOfFile(map_buffer);
    if (map_handle) CloseHandle(map_handle);
}

Napi::Number r3e::InitMaps(const Napi::CallbackInfo& info)
{
	Napi::Env env = info.Env();

	map_init();

	return Napi::Number::New(env, 0);
}

Napi::Object r3e::GetData(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	Napi::Object ret = Napi::Object::New(env);
    if (!map_exists()) {
        return ret;
    }

	ret.Set("gear", Napi::Number::New(env, map_buffer->gear));
    ret.Set("pit_limiter", Napi::Number::New(env, map_buffer->pit_limiter));

    ret.Set("yellowFlag", Napi::Number::New(env, map_buffer->flags.yellow));
    ret.Set("blueFlag", Napi::Number::New(env, map_buffer->flags.blue));
    ret.Set("blackFlag", Napi::Number::New(env, map_buffer->flags.black));
    ret.Set("blackWhiteFlag", Napi::Number::New(env, map_buffer->flags.black_and_white));
    
    ret.Set("engine_rpm", Napi::Number::New(env, map_buffer->engine_rps * RPS_TO_RPM));
    ret.Set("max_engine_rpm", Napi::Number::New(env, map_buffer->max_engine_rps * RPS_TO_RPM));

    ret.Set("car_speed", Napi::Number::New(env, map_buffer->car_speed * MPS_TO_KPH));
    ret.Set("fuel_left", Napi::Number::New(env, map_buffer->fuel_left));
    

    
    /*double tyreTemp = 0;
    tyreTe*/
    double tireTemp = 0;
    tireTemp = map_buffer->tire_temp[0].current_temp[1] + map_buffer->tire_temp[1].current_temp[1] + map_buffer->tire_temp[2].current_temp[1] + map_buffer->tire_temp[3].current_temp[1];
    ret.Set("tireTemp", Napi::Number::New(env, tireTemp / 4));

    double tirePress = 0;
    tirePress = map_buffer->tire_pressure[0] + map_buffer->tire_pressure[1] + map_buffer->tire_pressure[2] + map_buffer->tire_pressure[3];
    ret.Set("tirePress", Napi::Number::New(env, tirePress / 4));

    double brakeTemp = 0;
    brakeTemp = map_buffer->brake_temp[0].current_temp + map_buffer->brake_temp[1].current_temp + map_buffer->brake_temp[2].current_temp + map_buffer->brake_temp[3].current_temp;
    ret.Set("brakeTemp", Napi::Number::New(env, brakeTemp / 4));

    ret.Set("engine_oil_temp", Napi::Number::New(env, map_buffer->engine_oil_temp));

    
    ret.Set("lap_time_current_self", Napi::Number::New(env, map_buffer->lap_time_current_self));
    ret.Set("time_delta_best_self", Napi::Number::New(env, map_buffer->time_delta_best_self));
    ret.Set("lap_time_previous_self", Napi::Number::New(env, map_buffer->lap_time_previous_self));
    ret.Set("lap_time_best_self", Napi::Number::New(env, map_buffer->lap_time_best_self));
    ret.Set("position", Napi::Number::New(env, map_buffer->position));
    ret.Set("completed_laps", Napi::Number::New(env, map_buffer->completed_laps));
    ret.Set("number_of_laps", Napi::Number::New(env, map_buffer->number_of_laps));

	return ret;
}

Napi::Number r3e::Cleanup(const Napi::CallbackInfo& info)
{
	Napi::Env env = info.Env();

	map_close();

	return Napi::Number::New(env, 0);
}


/*int main()
{
    clock_t clk_start = 0, clk_last = 0;
    clock_t clk_delta_ms = 0, clk_elapsed = 0;
    int err_code = 0;
    BOOL mapped_r3e = FALSE;

    clk_start = clock();
    clk_last = clk_start;

    wprintf_s(L"Looking for RRRE.exe...\n");

    for(;;)
    {
        clk_elapsed = (clock() - clk_start) / CLOCKS_PER_SEC;
        if (clk_elapsed >= ALIVE_SEC)
            break;

        clk_delta_ms = (clock() - clk_last) / CLOCKS_PER_MS;
        if (clk_delta_ms < INTERVAL_MS)
        {
            Sleep(1);
            continue;
        }

        clk_last = clock();

        if (!mapped_r3e && map_exists())
        {
            wprintf_s(L"Found RRRE.exe, mapping shared memory...\n");

            err_code = map_init();
            if (err_code)
                return err_code;

            wprintf_s(L"Memory mapped successfully\n");

            mapped_r3e = TRUE;
            clk_start = clock();
        }

        if (mapped_r3e)
        {
            if (map_buffer->gear > -2)
            {
                wprintf_s(L"Gear: %i\n", map_buffer->gear);
            }

            if (map_buffer->engine_rps > -1.f)
            {
                wprintf_s(L"RPM: %.3f\n", map_buffer->engine_rps * RPS_TO_RPM);
                wprintf_s(L"Speed: %.3f km/h\n", map_buffer->car_speed * MPS_TO_KPH);
            }

            wprintf_s(L"\n");
        }
    }

    map_close();

    wprintf_s(L"All done!");
    system("PAUSE");

    return 0;
}*/