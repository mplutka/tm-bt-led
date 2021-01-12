import TmBTLed from './tm_bt_led.mjs';

import irsdk from 'node-irsdk';

class iRacing {
    client;

    static leftModes = {
      'curFuel': {
        label: "FUEL"
      },
      'speed': {
        label: "SPD"
      },
      'rpm': {
        label: "RPM"
      },
      'watT': {
        label: "WTRT"
      },
      'oilT': {
        label: "OILT"
      },
      'tyrT': {
        label: "TYRT"
      }
    }

    static rightModes = {
      'curLapTime': {
        label: "CLAP"
      },      
      'delta': {
        label: "DELTA"
      },
      'bestLapTime': {
        label: "BLAP"
      }, 
      'lastLapTime': {
        label: "LLAP"
      },    
      'pos': {
        label: "POS"
      },
      'curLap': {
        label: "LAP"
      },
      'lapsLeft': {
        label: "LEFT"
      }
    }

    currentLeftMode;
    currentRightMode;

    constructor() {
        this.tmBtLed = new TmBTLed({
          onConnect: this.onDeviceConnected,
          onLeftPreviousMode: this.leftPreviousMode,
          onLeftNextMode: this.leftNextMode,
          onRightPreviousMode: this.rightPreviousMode,
          onRightNextMode: this.rightNextMode,
        });

        irsdk.init({
          telemetryUpdateInterval: 1000 / 60,
          sessionInfoUpdateInterval: 10
        })
        
        this.client = irsdk.getInstance();

        this.currentLeftMode = Object.keys(iRacing.leftModes)[0];
        this.currentRightMode = Object.keys(iRacing.rightModes)[0];
    }

    onDeviceConnected = () =>  {
        // to start listening:
        this.initCLient();
        

      this.tmBtLed.setLeftDisplay(" IRAC");
      this.tmBtLed.setRightDisplay("ING");

    }

      leftPreviousMode = () => {
          const modeKeys = Object.keys(iRacing.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) > 0 ? modeKeys.findIndex(c => c === this.currentLeftMode) - 1 : modeKeys.length - 1;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(iRacing.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;
      }

      leftNextMode = () => {
          const modeKeys = Object.keys(iRacing.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentLeftMode) + 1 : 0;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(iRacing.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;        
      }

      rightPreviousMode = () => {
          const modeKeys = Object.keys(iRacing.rightModes);
          if (modeKeys.length === 0) {
            console.error("No right modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) > 0 ? modeKeys.findIndex(c => c === this.currentRightMode) - 1 : modeKeys.length - 1;
          this.currentRightMode = modeKeys[newModeIndex];
          this.tmBtLed.flashRightDisplay(iRacing.rightModes[this.currentRightMode].label);
          return this.currentRightMode;
    }

    rightNextMode = () => {
        const modeKeys = Object.keys(iRacing.rightModes);
        if (modeKeys.length === 0) {
          console.error("No right modes")
          return;
        }
        const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentRightMode) + 1 : 0;
        this.currentRightMode = modeKeys[newModeIndex];
        this.tmBtLed.flashRightDisplay(iRacing.rightModes[this.currentRightMode].label);
        return this.currentRightMode;        
    } 

    initCLient = () => {
        
        console.log("5. Listening for game data... GO!");

        /*this.client.on('Connected', function () {
          console.log('connected to iRacing..')
        })
        
        this.client.on('Disconnected', function () {
          console.log('iRacing shut down, exiting.\n')
          process.exit()
        }) */

        let maxRpm = 7500;
        
        this.client.on('Telemetry', data => {

          const telemetry = data.values;

          this.tmBtLed.setGear(telemetry.Gear);

          if (telemetry.EngineWarnings.includes('PitSpeedLimiter')) {
            this.tmBtLed.setRevLightsFlashing(1);
          } else {
            this.tmBtLed.setRevLightsFlashing(0);
          }
          if (this.tmBtLed.revLightsFlashing !== 1) { // No override because of pit limiter
            this.tmBtLed.setRevLights(Math.ceil(telemetry.RPM / maxRpm * 100));
          }
          
          if(telemetry.SessionFlags.includes('Yellow')) {
            this.tmBtLed.setFlashingYellow(true);
          } else {
            this.tmBtLed.setFlashingYellow(false);
          }

          if(telemetry.SessionFlags.includes('Red')) {
            this.tmBtLed.setFlashingRed(true);
          } else {
            this.tmBtLed.setFlashingRed(false);
          }
          
          if(telemetry.SessionFlags.includes('Blue')) {
            this.tmBtLed.setFlashingBlue(true);
          } else {
            this.tmBtLed.setFlashingBlue(false);
          }

          switch (this.currentLeftMode) {
            default:
            case "curFuel":
              this.tmBtLed.setWeight(telemetry.FuelLevel, false);
              break;
            case "speed":
              this.tmBtLed.setSpeed(telemetry.Speed * 3.6, false);
              break;
            case "rpm":
              this.tmBtLed.setRpm(telemetry.RPM, false);
              break;  
            case "oilT":
              this.tmBtLed.setTemperature(telemetry.OilTemp, false);
              break;               
            case "watT":
              this.tmBtLed.setTemperature(telemetry.WaterTemp, false);
              break;  
            case "tyrT":
              if (!telemetry.RFtempCM) {
                this.tmBtLed.setTemperature(0, false);  
              } else {
                let temps = telemetry.LFtempCM + telemetry.RFtempCM + telemetry.LRtempCM + telemetry.RRtempCM;
                let temp = temps / 4;
                this.tmBtLed.setTemperature(temp, false);
              }
              break;                                                                                                            
          }

          switch (this.currentRightMode) {              
            case "delta":
              this.tmBtLed.setDiffTime(telemetry.LapDeltaToBestLap * 1000, true);
              break;      
            case "bestLapTime":
              this.tmBtLed.setTime(telemetry.LapBestLapTime * 1000, true);
              break;   
            case "lastLapTime":
              this.tmBtLed.setTime(telemetry.LapLastLapTime < 0 ? 0 : telemetry.LapLastLapTime * 1000, true);
              break;                          
            case "pos":
              this.tmBtLed.setInt(telemetry.PlayerCarPosition, true);
              break;
            case "curLap":
              this.tmBtLed.setInt(telemetry.Lap, true);
              break;
            case "lapsLeft":
              this.tmBtLed.setInt(telemetry.SessionLapsRemain, true);
              break;          
            default:
            case "curLapTime":
              this.tmBtLed.setTime(telemetry.LapCurrentLapTime * 1000, true);
              break;
          }     

        });
        
        this.client.on('SessionInfo', function (data) {
          const session = data.data;
          if (session.DriverInfo.DriverCarSLBlinkRPM > 0) {
            maxRpm = session.DriverInfo.DriverCarSLBlinkRPM;
          }
        })

    }
}

const iRac = new iRacing();