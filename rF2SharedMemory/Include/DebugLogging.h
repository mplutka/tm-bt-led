/*
  Debug enums and helpers that must be visible before MappedBuffer.h is parsed.
  (MappedBuffer<> template methods use DebugLevel / DEBUG_MSG at definition time.)
*/
#pragma once

enum class DebugLevel : long
{
  Off = 0,
  Errors = 1,
  CriticalInfo = 2,
  DevInfo = 4,
  Warnings = 8,
  Synchronization = 16,
  Perf = 32,
  Timing = 64,
  Verbose = 128,
  All = 255,
};

enum DebugSource : long
{
  General = 1,
  DMR = 2,
  MappedBufferSource = 4,
  Telemetry = 4,
  Scoring = 8,
  Rules = 16,
  MultiRules = 32,
  ForceFeedback = 64,
  Graphics = 128,
  Weather = 256,
  Extended = 512,
  HWControlInput = 1024,
  WeatherControlInput = 2048,
  RulesControlInput = 4096,
  PluginControlInput = 8192,
  PitInfo = 16384,
  All = 32767,
};

void RF2WriteDebugMsg(DebugLevel lvl, long src, char const* functionName, int line, char const* msg, ...);
bool RF2IsDebugOutputLevelOn(DebugLevel flag);
void RF2TraceLastWin32Error();

#define DEBUG_MSG(lvl, src, msg, ...) RF2WriteDebugMsg(lvl, src, __FUNCTION__, __LINE__, msg, __VA_ARGS__)
#define RETURN_IF_FALSE(expression) if (!(expression)) { DEBUG_MSG(DebugLevel::Errors, DebugSource::General, "Operation failed"); return; }
