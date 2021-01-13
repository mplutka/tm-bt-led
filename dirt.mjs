import { DirtRallyTelemetryClient } from './lib/dirt-rally-telemetry-client.js';
import TmBTLed from './tm_bt_led.mjs';

class DirtRally {
    static port = 20777

    client;

    static leftModes = {
      'speed': {
        label: "SPD"
      },
      'rpm': {
        label: "RPM"
      },
      'brkTemp': {
        label: "BRKT"
      }       
    }

    static rightModes = {
      'curLapTime': {
        label: "CLAP"
      },
      'lastLapTime': {
        label: "LLAP"
      },                 
      'pos': {
        label: "POS"
      },      
      'lapCount': {
        label: "LAP"
      },
      'lapsLeft': {
        label: "LEFT"
      },

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
        this.client = new DirtRallyTelemetryClient({ port: DirtRally.port, bigintEnabled: true });

        this.currentLeftMode = Object.keys(DirtRally.leftModes)[0];
        this.currentRightMode = Object.keys(DirtRally.rightModes)[0];
    }

    onDeviceConnected = () =>  {
        // to start listening:
        this.initCLient();
        

      this.tmBtLed.setLeftDisplay("DIRT");
      this.tmBtLed.setRightDisplay("RALY");

    }

      leftPreviousMode = () => {
          const modeKeys = Object.keys(DirtRally.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) > 0 ? modeKeys.findIndex(c => c === this.currentLeftMode) - 1 : modeKeys.length - 1;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(DirtRally.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;
      }

      leftNextMode = () => {
          const modeKeys = Object.keys(DirtRally.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentLeftMode) + 1 : 0;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(DirtRally.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;        
      }

      rightPreviousMode = () => {
          const modeKeys = Object.keys(DirtRally.rightModes);
          if (modeKeys.length === 0) {
            console.error("No right modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) > 0 ? modeKeys.findIndex(c => c === this.currentRightMode) - 1 : modeKeys.length - 1;
          this.currentRightMode = modeKeys[newModeIndex];
          this.tmBtLed.flashRightDisplay(DirtRally.rightModes[this.currentRightMode].label);
          return this.currentRightMode;
    }

    rightNextMode = () => {
        const modeKeys = Object.keys(DirtRally.rightModes);
        if (modeKeys.length === 0) {
          console.error("No right modes")
          return;
        }
        const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentRightMode) + 1 : 0;
        this.currentRightMode = modeKeys[newModeIndex];
        this.tmBtLed.flashRightDisplay(DirtRally.rightModes[this.currentRightMode].label);
        return this.currentRightMode;        
    } 

    initCLient = () => {
        
        console.log("5. Listening for game data... GO!");

        this.client.on("data", data => {
         
          this.tmBtLed.setGear(data["gear"] == 10 ? -1 : data["gear"]);
          this.tmBtLed.setRevLights(Math.ceil((data["engine_rate"] * 10) / (data["max_rpm"] * 10) * 100));

          switch (this.currentLeftMode) {
            default:       
            case "speed":
              this.tmBtLed.setSpeed(data["speed"] * 3.6);
              break;
            case "rpm":
              this.tmBtLed.setRpm(data["engine_rate"] * 10);
              break;  
            case "brkTemp":
              const brakeTemps = data["brake_temp_bl"] + data["brake_temp_br"] + data["brake_temp_fl"] + data["brake_temp_fr"];
              this.tmBtLed.setTemperature(brakeTemps / 4);
              break;                                                                                             
          }

          switch (this.currentRightMode) {
            case "pos":
              this.tmBtLed.setInt(data["race_position"], true);
              break;               
            case "lapCount":
              this.tmBtLed.setInt(data["lap"], true);
              break;
            case "lapsLeft":
              this.tmBtLed.setInt(data["total_laps"] - data["laps_completed"], true);
              break; 
            case "lastLapTime":
              this.tmBtLed.setTime(data["last_lap_time"] * 1000, true);
              break;      
            default:                    
            case "curLapTime":
              this.tmBtLed.setTime(data["lap_time"] * 1000, true);
              break;
          }


        });
        this.client.start();
    }
}

const dirtRally = new DirtRally();