#include "scs.h"
//#include "utils.h"

#define _USE_MATH_DEFINES

#include <math.h>
#include <stdio.h>
#include <time.h>
#include <Windows.h>
#include <tchar.h>

#include "../scs-telemetry/inc/scs-telemetry-common.hpp"

#pragma optimize("",off)
using namespace std;

#define ALIVE_SEC 600
#define INTERVAL_MS 100

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  	return scs::SetExports(env, exports);
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll);

Napi::Object scs::SetExports(Napi::Env env, Napi::Object exports)
{
	exports.Set("initMaps", Napi::Function::New(env, scs::InitMaps));
	exports.Set("getData", Napi::Function::New(env, scs::GetData));
	exports.Set("cleanup", Napi::Function::New(env, scs::Cleanup));
	return exports;
}


HANDLE map_handle = INVALID_HANDLE_VALUE;
scsTelemetryMap_t* map_buffer = NULL;

HANDLE map_open()
{
    return OpenFileMapping(
        FILE_MAP_READ,
        FALSE,
        TEXT(SCS_PLUGIN_MMF_NAME));
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

    map_buffer = (scsTelemetryMap_t*)MapViewOfFile(map_handle, FILE_MAP_READ, 0, 0, sizeof(scsTelemetryMap_t));
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

Napi::Number scs::InitMaps(const Napi::CallbackInfo& info)
{
	Napi::Env env = info.Env();

	map_init();

	return Napi::Number::New(env, 0);
}

Napi::Object scs::GetData(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	Napi::Object ret = Napi::Object::New(env);
    if (!map_exists()) {
        return ret;
    }

	ret.Set("gear", Napi::Number::New(env, map_buffer->truck_i.gear));
    ret.Set("engine_rpm", Napi::Number::New(env, map_buffer->truck_f.engineRpm));
    ret.Set("max_engine_rpm", Napi::Number::New(env, map_buffer->config_f.engineRpmMax));

    ret.Set("gearDashboard", Napi::Number::New(env, map_buffer->truck_i.gearDashboard));

    ret.Set("speed", Napi::Number::New(env, map_buffer->truck_f.speed));
    ret.Set("fuel", Napi::Number::New(env, map_buffer->truck_f.fuel));
    ret.Set("airPressure", Napi::Number::New(env, map_buffer->truck_f.airPressure));
    ret.Set("brakeTemperature", Napi::Number::New(env, map_buffer->truck_f.brakeTemperature));
    ret.Set("oilPressure", Napi::Number::New(env, map_buffer->truck_f.oilPressure));
    ret.Set("oilTemperature", Napi::Number::New(env, map_buffer->truck_f.oilTemperature));
    ret.Set("waterTemperature", Napi::Number::New(env, map_buffer->truck_f.waterTemperature));

    ret.Set("cruiseControl", Napi::Boolean::New(env, map_buffer->truck_b.cruiseControl));
    ret.Set("lightsBeamHigh", Napi::Boolean::New(env, map_buffer->truck_b.lightsBeamHigh));
    ret.Set("blinkerLeftOn", Napi::Boolean::New(env, map_buffer->truck_b.blinkerLeftOn));   
    ret.Set("blinkerRightOn", Napi::Boolean::New(env, map_buffer->truck_b.blinkerRightOn));     
    ret.Set("airPressureWarning", Napi::Boolean::New(env, map_buffer->truck_b.airPressureWarning));  
    ret.Set("airPressureEmergency", Napi::Boolean::New(env, map_buffer->truck_b.airPressureEmergency));  
    ret.Set("fuelWarning", Napi::Boolean::New(env, map_buffer->truck_b.fuelWarning));  
    ret.Set("adblueWarning", Napi::Boolean::New(env, map_buffer->truck_b.adblueWarning));  
    ret.Set("oilPressureWarning", Napi::Boolean::New(env, map_buffer->truck_b.oilPressureWarning));
    ret.Set("waterTemperatureWarning", Napi::Boolean::New(env, map_buffer->truck_b.waterTemperatureWarning)); 
    ret.Set("batteryVoltageWarning", Napi::Boolean::New(env, map_buffer->truck_b.batteryVoltageWarning)); 

       

    ret.Set("fuelAvgConsumption", Napi::Number::New(env, map_buffer->truck_f.fuelAvgConsumption));
    ret.Set("fuelRange", Napi::Number::New(env, map_buffer->truck_f.fuelRange));
    ret.Set("cruiseControlSpeed", Napi::Number::New(env, map_buffer->truck_f.cruiseControlSpeed));

    ret.Set("routeDistance", Napi::Number::New(env, map_buffer->truck_f.routeDistance));      
    ret.Set("routeTime", Napi::Number::New(env, map_buffer->truck_f.routeTime));
    ret.Set("speedLimit", Napi::Number::New(env, map_buffer->truck_f.speedLimit));    



    /*ret.Set("pit_limiter", Napi::Number::New(env, map_buffer->pit_limiter));

    ret.Set("yellowFlag", Napi::Number::New(env, map_buffer->flags.yellow));
    ret.Set("blueFlag", Napi::Number::New(env, map_buffer->flags.blue));
    ret.Set("blackFlag", Napi::Number::New(env, map_buffer->flags.black));
    ret.Set("blackWhiteFlag", Napi::Number::New(env, map_buffer->flags.black_and_white));
    


    ret.Set("car_speed", Napi::Number::New(env, map_buffer->car_speed * MPS_TO_KPH));
    ret.Set("fuel_left", Napi::Number::New(env, map_buffer->fuel_left));
    
*/
/*
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
    ret.Set("number_of_laps", Napi::Number::New(env, map_buffer->number_of_laps));*/

	return ret;
}

Napi::Number scs::Cleanup(const Napi::CallbackInfo& info)
{
	Napi::Env env = info.Env();

	map_close();

	return Napi::Number::New(env, 0);
}
