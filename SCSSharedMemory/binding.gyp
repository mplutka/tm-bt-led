   {
    "targets": [
      {
        "target_name": "scs",
        "sources": [ 
          "./src/scs.cpp"
        ],
        'include_dirs': [
            "./scs_sdk/include",
            "./scs-telemetry/inc",
            "<!@(node -p \"require('node-addon-api').include\")",
        ],
        'libraries': [],
        'dependencies': [
            "<!(node -p \"require('node-addon-api').gyp\")"
        ],
        'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ]
      }
    ]
  }
