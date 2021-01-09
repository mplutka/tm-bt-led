import { F1TelemetryClient, constants } from 'f1-telemetry-client';
import TmBTLed from './tm_bt_led.mjs';
const { PACKETS } = constants;

class F12019 {
    static port = 20777

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
      'engTemp': {
        label: "ENGT"
      },
      'tyrTemp': {
        label: "TYRT"
      }           
    }

    static rightModes = {
      'curLapTime': {
        label: "CLAP"
      },
      'lastLapTime': {
        label: "LLAP"
      },      
      'bestLapTime': {
        label: "BLAP"
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
        this.client = new F1TelemetryClient({ port: F12019.port, bigintEnabled: true });

        this.currentLeftMode = Object.keys(F12019.leftModes)[0];
        this.currentRightMode = Object.keys(F12019.rightModes)[0];
    }

    onDeviceConnected = () =>  {
        // to start listening:
        this.initCLient();
        

      this.tmBtLed.setLeftDisplay("F1");
      this.tmBtLed.setRightDisplay("2019");

    }

      leftPreviousMode = () => {
          const modeKeys = Object.keys(F12019.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) > 0 ? modeKeys.findIndex(c => c === this.currentLeftMode) - 1 : modeKeys.length - 1;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(F12019.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;
      }

      leftNextMode = () => {
          const modeKeys = Object.keys(F12019.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentLeftMode) + 1 : 0;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(F12019.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;        
      }

      rightPreviousMode = () => {
          const modeKeys = Object.keys(F12019.rightModes);
          if (modeKeys.length === 0) {
            console.error("No right modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) > 0 ? modeKeys.findIndex(c => c === this.currentRightMode) - 1 : modeKeys.length - 1;
          this.currentRightMode = modeKeys[newModeIndex];
          this.tmBtLed.flashRightDisplay(F12019.rightModes[this.currentRightMode].label);
          return this.currentRightMode;
    }

    rightNextMode = () => {
        const modeKeys = Object.keys(F12019.rightModes);
        if (modeKeys.length === 0) {
          console.error("No right modes")
          return;
        }
        const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentRightMode) + 1 : 0;
        this.currentRightMode = modeKeys[newModeIndex];
        this.tmBtLed.flashRightDisplay(F12019.rightModes[this.currentRightMode].label);
        return this.currentRightMode;        
    } 

    initCLient = () => {
        
        console.log("5. Listening for game data... GO!");

        let totalLaps = 60;
      // https://f1-2019-telemetry.readthedocs.io/en/latest/telemetry-specification.html
        /*client.on(PACKETS.event, console.log);
        client.on(PACKETS.motion, console.log);
        client.on(PACKETS.carSetups, console.log);
        client.on(PACKETS.participants, console.log);*/

        this.client.on(PACKETS.session, d => {
          totalLaps = d.m_totalLaps;
        });

        this.client.on(PACKETS.lapData, d => {
          this.tmBtLed.setRightTimeSpacer(false);
          const myIndex = d.m_header.m_playerCarIndex;
          const lapData = d.m_lapData[myIndex];
          switch (this.currentRightMode) {
            case "pos":
              this.tmBtLed.setInt(lapData.m_carPosition, true);
              break;               
            case "lapCount":
              this.tmBtLed.setInt(lapData.m_currentLapNum, true);
              break;
            case "lapsLeft":
              this.tmBtLed.setInt(totalLaps - lapData.m_currentLapNum, true);
              break; 
            case "lastLapTime":
              this.tmBtLed.setTime(lapData.m_lastLapTime * 1000 , true);
              break;   
            case "bestLapTime":
              this.tmBtLed.setTime(lapData.m_bestLapTime * 1000, true);
              break;                               
            default:                             
            case "curLapTime":
              this.tmBtLed.setTime(lapData.m_currentLapTime * 1000, true);
              break;
          }
        });
        let drsOn = false;
        this.client.on(PACKETS.carStatus, d => {
          const myIndex = d.m_header.m_playerCarIndex;
          const carStatus = d.m_carStatusData[myIndex];

          if (!drsOn && !this.tmBtLed.isFlashingYellow) { // Yellow flag and drs on overrides drs allowed
            if (carStatus.m_drsAllowed === 1) {
              this.tmBtLed.setFlashingRightYellow(true);
            } else if (!drsOn) {
                this.tmBtLed.setFlashingRightYellow(false);
            }
          }
          

          switch(carStatus.m_vehicleFiaFlags) {
            case 2:
              this.tmBtLed.setFlashingBlue(true);
              break      
            case 3:
              this.tmBtLed.setFlashingYellow(true);
              break         
            case 4:
              this.tmBtLed.setFlashingRed(true);
              break                      
            case -1:
            case 0:
            default:
              if (this.tmBtLed.isFlashingYellow) {
                this.tmBtLed.setFlashingYellow(false);
              }
              if (this.tmBtLed.isFlashingRed) {
                this.tmBtLed.setFlashingRed(false);
              }
              if (this.tmBtLed.isFlashingBlue) {
                this.tmBtLed.setFlashingBlue(false);
              }
              break
          }
      
      
          if (carStatus.m_pitLimiterStatus === 1) {
            this.tmBtLed.setRevLightsFlashing(1);
          } else {
            this.tmBtLed.setRevLightsFlashing(0);
          }

          switch (this.currentLeftMode) {
            case "curFuel":
              this.tmBtLed.setWeight(carStatus.m_fuelInTank, false);
              break;                                          
          }
      });
      this.client.on(PACKETS.carTelemetry, d => {
          const myIndex = d.m_header.m_playerCarIndex;
          const carTelemetry = d.m_carTelemetryData[myIndex];
          this.tmBtLed.setGear(carTelemetry.m_gear);
      

          if (!this.tmBtLed.isFlashingYellow) { // Yellow flag overrides drs
            if (carTelemetry.m_drs === 1) {
              drsOn = true;
              this.tmBtLed.setFlashingRightYellow(false);
              this.tmBtLed.setRightYellow(true);
            } else if (!this.tmBtLed.isFlashingRightYellow) {
              drsOn = false;
              this.tmBtLed.setRightYellow(false);
            }
          }
          

          if (this.tmBtLed.revLightsFlashing !== 1) { // No override because of pit limiter
            this.tmBtLed.setRevLights(carTelemetry.m_revLightsPercent);
          }
          switch (this.currentLeftMode) {
              case "speed":
                this.tmBtLed.setSpeed(carTelemetry.m_speed, false);
                break;
              case "rpm":
                this.tmBtLed.setRpm(carTelemetry.m_engineRPM, false);
                break;  
              case "engTemp":
                this.tmBtLed.setTemperature(carTelemetry.m_engineTemperature, false);
                break; 
              case "tyrTemp":
                const tempSum = carTelemetry.m_tyresSurfaceTemperature.reduce((a, b) => a + b, 0);
                const tempAvg = (tempSum / carTelemetry.m_tyresSurfaceTemperature.length) || 0;
                this.tmBtLed.setTemperature(tempAvg, false);
                break;                                                                                                
          }
      });
      this.client.start();
    }
}

const f12019 = new F12019();