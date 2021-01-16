#include "AssettoCorsaSharedMemory.h"


Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
  return AssettoCorsaSharedMemory::Init(env, exports);
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll)

#include "stdafx.h"
#include <windows.h>
#include <tchar.h>
#include <iostream>
#include "SharedFileOut.h"
#pragma optimize("",off)
using namespace std;


template <typename T, unsigned S>
inline unsigned arraysize(const T(&v)[S])
{
	return S;
}


struct SMElement
{
	HANDLE hMapFile;
	unsigned char* mapFileBuffer;
};

SMElement m_graphics;
SMElement m_physics;
SMElement m_static;

void initPhysics()
{
	TCHAR szName[] = TEXT("Local\\acpmf_physics");
	m_physics.hMapFile = CreateFileMapping(INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE, 0, sizeof(SPageFilePhysics), szName);
	if (!m_physics.hMapFile)
	{
		MessageBoxA(GetActiveWindow(), "CreateFileMapping failed", "ACCS", MB_OK);
	}
	m_physics.mapFileBuffer = (unsigned char*)MapViewOfFile(m_physics.hMapFile, FILE_MAP_READ, 0, 0, sizeof(SPageFilePhysics));
	if (!m_physics.mapFileBuffer)
	{
		MessageBoxA(GetActiveWindow(), "MapViewOfFile failed", "ACCS", MB_OK);
	}
}

void initGraphics()
{
	TCHAR szName[] = TEXT("Local\\acpmf_graphics");
	m_graphics.hMapFile = CreateFileMapping(INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE, 0, sizeof(SPageFileGraphic), szName);
	if (!m_graphics.hMapFile)
	{
		MessageBoxA(GetActiveWindow(), "CreateFileMapping failed", "ACCS", MB_OK);
	}
	m_graphics.mapFileBuffer = (unsigned char*)MapViewOfFile(m_graphics.hMapFile, FILE_MAP_READ, 0, 0, sizeof(SPageFileGraphic));
	if (!m_graphics.mapFileBuffer)
	{
		MessageBoxA(GetActiveWindow(), "MapViewOfFile failed", "ACCS", MB_OK);
	}
}

void initStatic()
{
	TCHAR szName[] = TEXT("Local\\acpmf_static");
	m_static.hMapFile = CreateFileMapping(INVALID_HANDLE_VALUE, NULL, PAGE_READWRITE, 0, sizeof(SPageFileStatic), szName);
	if (!m_static.hMapFile)
	{
		MessageBoxA(GetActiveWindow(), "CreateFileMapping failed", "ACCS", MB_OK);
	}
	m_static.mapFileBuffer = (unsigned char*)MapViewOfFile(m_static.hMapFile, FILE_MAP_READ, 0, 0, sizeof(SPageFileStatic));
	if (!m_static.mapFileBuffer)
	{
		MessageBoxA(GetActiveWindow(), "MapViewOfFile failed", "ACCS", MB_OK);
	}
}

void dismiss(SMElement element)
{
	UnmapViewOfFile(element.mapFileBuffer);
	CloseHandle(element.hMapFile);
}

Napi::Object AssettoCorsaSharedMemory::Init(Napi::Env env, Napi::Object exports)
{
	initPhysics();
	initGraphics();
	initStatic();

	exports.Set("getPhysics", Napi::Function::New(env, AssettoCorsaSharedMemory::GetPhysics));
	exports.Set("getGraphics", Napi::Function::New(env, AssettoCorsaSharedMemory::GetGraphics));
	exports.Set("getStatics", Napi::Function::New(env, AssettoCorsaSharedMemory::GetStatics));
	exports.Set("cleanup", Napi::Function::New(env, AssettoCorsaSharedMemory::Cleanup));
	return exports;
}

Napi::Number AssettoCorsaSharedMemory::Cleanup(const Napi::CallbackInfo& info)
{

	Napi::Env env = info.Env();

	dismiss(m_graphics);
	dismiss(m_physics);
	dismiss(m_static);

	return Napi::Number::New(env, 0);
}

Napi::Object AssettoCorsaSharedMemory::GetPhysics(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();

	Napi::Object ret = Napi::Object::New(env);

	SPageFilePhysics* physics = (SPageFilePhysics*)m_physics.mapFileBuffer;
	ret.Set("accG", Napi::Number::New(env, *physics->accG));
	ret.Set("brake", Napi::Number::New(env, physics->brake));
	ret.Set("camberRAD", Napi::Number::New(env, *physics->camberRAD));
	ret.Set("carDamage", Napi::Number::New(env, *physics->carDamage));
	ret.Set("cgHeight", Napi::Number::New(env, physics->cgHeight));
	ret.Set("drs", Napi::Number::New(env, physics->drs));
	ret.Set("tc", Napi::Number::New(env, physics->tc));
	ret.Set("fuel", Napi::Number::New(env, physics->fuel));
	ret.Set("gas", Napi::Number::New(env, physics->gas));
	ret.Set("gear", Napi::Number::New(env, physics->gear));
	ret.Set("numberOfTyresOut", Napi::Number::New(env, physics->numberOfTyresOut));
	ret.Set("pitLimiterOn", Napi::Number::New(env, physics->pitLimiterOn));
	ret.Set("packetId", Napi::Number::New(env, physics->packetId));
	ret.Set("heading", Napi::Number::New(env, physics->heading));
	ret.Set("pitch", Napi::Number::New(env, physics->pitch));
	ret.Set("roll", Napi::Number::New(env, physics->roll));
	ret.Set("rpms", Napi::Number::New(env, physics->rpms));
	ret.Set("speedKmh", Napi::Number::New(env, physics->speedKmh));
	ret.Set("tyreContactPoint", Napi::Number::New(env, **physics->tyreContactPoint));
	ret.Set("tyreContactNormal", Napi::Number::New(env, **physics->tyreContactNormal));
	ret.Set("tyreContactHeading", Napi::Number::New(env, **physics->tyreContactHeading));
	ret.Set("steerAngle", Napi::Number::New(env, physics->steerAngle));
	ret.Set("suspensionTravel", Napi::Number::New(env, *physics->suspensionTravel));
	ret.Set("tyreCoreTemperature", Napi::Number::New(env, *physics->tyreCoreTemperature));
	ret.Set("tyreDirtyLevel", Napi::Number::New(env, *physics->tyreDirtyLevel));
	ret.Set("tyreWear", Napi::Number::New(env, *physics->tyreWear));
	ret.Set("velocity", Napi::Number::New(env, *physics->velocity));
	ret.Set("wheelAngularSpeed", Napi::Number::New(env, *physics->wheelAngularSpeed));
	ret.Set("wheelLoad", Napi::Number::New(env, *physics->wheelLoad));
	ret.Set("wheelSlip", Napi::Number::New(env, *physics->wheelSlip));
	ret.Set("wheelsPressure", Napi::Number::New(env, *physics->wheelsPressure));
	ret.Set("waterTemp", Napi::Number::New(env, physics->waterTemp));
	ret.Set("isEngineRunning", Napi::Number::New(env, physics->isEngineRunning));
	

	return ret;
}

Napi::Object AssettoCorsaSharedMemory::GetGraphics(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();

	Napi::Object ret = Napi::Object::New(env);

	SPageFileGraphic* graphics = (SPageFileGraphic*)m_graphics.mapFileBuffer;
	ret.Set("status", Napi::Number::New(env, graphics->status));
	ret.Set("session", Napi::Number::New(env, graphics->session));
	ret.Set("completedLaps", Napi::Number::New(env, graphics->completedLaps));
	ret.Set("position", Napi::Number::New(env, graphics->position));
	ret.Set("currentTime", Napi::Number::New(env, *graphics->currentTime));
	ret.Set("iCurrentTime", Napi::Number::New(env, graphics->iCurrentTime));
	ret.Set("iDeltaLapTime", Napi::Number::New(env, graphics->iDeltaLapTime));
	ret.Set("isDeltaPositive", Napi::Number::New(env, graphics->isDeltaPositive));
	ret.Set("flag", Napi::Number::New(env, graphics->flag));
	ret.Set("lastTime", Napi::Number::New(env, *graphics->lastTime));
	ret.Set("iLastTime", Napi::Number::New(env, graphics->iLastTime));
	ret.Set("bestTime", Napi::Number::New(env, *graphics->bestTime));
	ret.Set("iBestTime", Napi::Number::New(env, graphics->iBestTime));
	ret.Set("iEstimatedLapTime", Napi::Number::New(env, graphics->iEstimatedLapTime));	
	ret.Set("sessionTimeLeft", Napi::Number::New(env, graphics->sessionTimeLeft));
	ret.Set("distanceTraveled", Napi::Number::New(env, graphics->distanceTraveled));
	ret.Set("isInPit", Napi::Number::New(env, graphics->isInPit));
	ret.Set("isInPitLane", Napi::Number::New(env, graphics->isInPitLane));
	ret.Set("currentSectorIndex", Napi::Number::New(env, graphics->currentSectorIndex));
	ret.Set("lastSectorTime", Napi::Number::New(env, graphics->lastSectorTime));
	ret.Set("numberOfLaps", Napi::Number::New(env, graphics->numberOfLaps));
	ret.Set("replayTimeMultiplier", Napi::Number::New(env, graphics->replayTimeMultiplier));
	ret.Set("normalizedCarPosition", Napi::Number::New(env, graphics->normalizedCarPosition));
	ret.Set("carCoordinates", Napi::Number::New(env, **graphics->carCoordinates));

	return ret;
}

Napi::Object AssettoCorsaSharedMemory::GetStatics(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();

	Napi::Object ret = Napi::Object::New(env);

	SPageFileStatic* statics = (SPageFileStatic*)m_static.mapFileBuffer;
	//ret.Set("->smVersion", Napi::String::New(env, statics->smVersion;
	//ret.Set("acVersion", Napi::Number::New(env, statics->acVersion));
	ret.Set("numberOfSessions", Napi::Number::New(env, statics->numberOfSessions));
	ret.Set("numCars", Napi::Number::New(env, statics->numCars));
	//ret.Set("carModel", Napi::String::New(env, statics->carModel));
	//ret.Set("track", Napi::String::New(env, statics->track));
	//ret.Set("playerName", Napi::String::New(env, statics->playerName));
	ret.Set("sectorCount", Napi::Number::New(env, statics->sectorCount));
	ret.Set("maxTorque", Napi::Number::New(env, statics->maxTorque));
	ret.Set("maxPower", Napi::Number::New(env, statics->maxPower));
	ret.Set("maxRpm", Napi::Number::New(env, statics->maxRpm));
	ret.Set("maxFuel", Napi::Number::New(env, statics->maxFuel));
	ret.Set("suspensionMaxTravel", Napi::Number::New(env, *statics->suspensionMaxTravel));
	ret.Set("tyreRadius", Napi::Number::New(env, *statics->tyreRadius));

	return ret;
}

