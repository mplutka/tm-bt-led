import ACRemoteTelemetryClient from 'ac-remote-telemetry-client';
import TmBTLed from './tm_bt_led.mjs';

class AC {
    static ip = "192.168.2.200"

    client;

    maxRpm = 0;
    idleRpm = 0;
    static leftModes = {
      /*'curFuel': {
        label: "FUEL"
      },*/
      'speed': {
        label: "VEL"
      },
      'rpm': {
        label: "RPM"
      },
      /*'eng': {
        label: "ENG"
      }  */  
    }

    static rightModes = {
      /*'pos': {
        label: "POS"
      },*/      
      'lapCount': {
        label: "LAP"
      },
      /*'lapsLeft': {
        label: "LEFT"
      },*/
      'curLapTime': {
        label: "TIME"
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
        this.client = new ACRemoteTelemetryClient(this.ip);

        this.currentLeftMode = Object.keys(AC.leftModes)[0];
        this.currentRightMode = Object.keys(AC.leftModes)[0];
    }

    onDeviceConnected = () =>  {
        // to start listening:
        this.initCLient();
        

      this.tmBtLed.setLeftDisplay("ASSE");
      this.tmBtLed.setRightDisplay("CORS");

    }

      leftPreviousMode = () => {
          const modeKeys = Object.keys(AC.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) > 0 ? modeKeys.findIndex(c => c === this.currentLeftMode) - 1 : modeKeys.length - 1;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(AC.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;
      }

      leftNextMode = () => {
          const modeKeys = Object.keys(AC.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentLeftMode) + 1 : 0;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(AC.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;        
      }

      rightPreviousMode = () => {
          const modeKeys = Object.keys(AC.rightModes);
          if (modeKeys.length === 0) {
            console.error("No right modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) > 0 ? modeKeys.findIndex(c => c === this.currentRightMode) - 1 : modeKeys.length - 1;
          this.currentRightMode = modeKeys[newModeIndex];
          this.tmBtLed.flashRightDisplay(AC.rightModes[this.currentRightMode].label);
          return this.currentRightMode;
    }

    rightNextMode = () => {
        const modeKeys = Object.keys(AC.rightModes);
        if (modeKeys.length === 0) {
          console.error("No right modes")
          return;
        }
        const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentRightMode) + 1 : 0;
        this.currentRightMode = modeKeys[newModeIndex];
        this.tmBtLed.flashRightDisplay(AC.rightModes[this.currentRightMode].label);
        return this.currentRightMode;        
    } 

    initCLient = () => {
        
        let totalLaps = 0;
        this.client.on('RT_CAR_INFO', (carTelemetry) => {

          this.tmBtLed.setGear(carTelemetry.gear);

          if (carTelemetry.engineRPM == 0) {
            this.maxRpm = 0;
          }

          if (this.maxRpm == 0 && carTelemetry.engineRPM > 0) {
            this.maxRpm = carTelemetry.engineRPM + 1000;
          }
          if (carTelemetry.engineRPM > this.maxRpm) {
            this.maxRpm = carTelemetry.engineRPM;
          }
          let rpmPercent = carTelemetry.engineRPM / this.maxRpm * 100;
          if (rpmPercent < 30) {
            rpmPercent = 0;
          } else if (rpmPercent > 90) {
            rpmPercent = 100;
          }

          this.tmBtLed.setRevLights(rpmPercent);
          
          switch (this.currentLeftMode) {
            case "speed":
              this.tmBtLed.setInt(carTelemetry.speedKmh, false);
              break;
            case "rpm":
              this.tmBtLed.setRpm(carTelemetry.engineRPM, false);
              break;  
            /*case "eng":
              this.tmBtLed.setTemperature(carTelemetry.m_engineTemperature, false);
              break; */
          }

          switch (this.currentRightMode) {
            /*case "pos":
              this.tmBtLed.setInt(lapData.m_carPosition, true);
              break;        */       
            case "lapCount":
              this.tmBtLed.setInt(carTelemetry.lapCount, true);
              break;
            default:
            /*case "lapsLeft":
              this.tmBtLed.setInt(totalLaps - lapData.m_currentLapNum, true);
              break;                */
            case "curLapTime":
              this.tmBtLed.setTime(carTelemetry.lapTime / 1000, true);
              break;                    
          }       
        });
        // this.client.on('RT_LAP', (data) => console.log(data));

        this.client.start();

        this.client.handshake();
  
        this.client.subscribeUpdate();
        this.client.subscribeSpot();



        // https://github.com/flamescape/acsp
        /*this.client.on(PACKETS.session, d => {
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
            default:
            case "lapsLeft":
              this.tmBtLed.setInt(totalLaps - lapData.m_currentLapNum, true);
              break;                
            case "curLapTime":
              this.tmBtLed.setTime(lapData.m_currentLapTime, true);
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
              this.tmBtLed.setFloat(carStatus.m_fuelInTank, false);
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
          

          if (this.tmBtLed.revLightsFlashing !== 1) { // No override because of pit or rev limiter
      
      
            this.tmBtLed.setRevLights(carTelemetry.m_revLightsPercent);
          }
  
          switch (this.currentLeftMode) {
              case "speed":
                this.tmBtLed.setInt(carTelemetry.m_speed, false);
                break;
              case "rpm":
                this.tmBtLed.setRpm(carTelemetry.m_engineRPM, false);
                break;  
              case "eng":
                this.tmBtLed.setTemperature(carTelemetry.m_engineTemperature, false);
                break;                                                                              
          }
      });*/
    }
}

const ac = new AC();