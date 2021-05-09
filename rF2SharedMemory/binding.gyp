   {
    "targets": [
      {
        "target_name": "rF2SharedMemory",
        "sources": [ 
          "./Source/DirectMemoryReader.cpp",
          "./Source/rFactor2SharedMemoryMap.cpp",
          "./Source/Utils.cpp",
          "./Source/ISIInternalsDump.cpp" 
        ],
        'include_dirs': [
            "<!@(node -p \"require('node-addon-api').include\")",
            "./Include"
        ],
        'libraries': [],
        'dependencies': [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ]
      }
    ]
  }