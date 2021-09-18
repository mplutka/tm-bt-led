   {
    "targets": [
      {
        "target_name": "ets2",
        "sources": [ 
          "./src/ets2.cpp"
        ],
        'include_dirs': [
            "./scs_sdk_1_4/include",
            "./inc",
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
