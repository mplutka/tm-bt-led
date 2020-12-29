const noble = require('..');

noble.stopScanning();

noble.on('stateChange', async (state) => {
  if (state === 'poweredOn') {
    await noble.startScanningAsync(['1812'], false);
  }
});



noble.on('discover', async (peripheral) => {
  await noble.stopScanningAsync();
  await peripheral.connectAsync();

	console.log("connected");



setTimeout(() => {
  let buffer = new Uint8Array(20);

  buffer[0] = 0x4;
  for(i = 1; i < buffer.length - 1; i++) {
    buffer[i] = 0xff;
  }


  const setRevLights = (percent) => {

    if (percent > 100) {
      return;
    }
    
    if (percent >= 50) {
      buffer[2] = 255;
      buffer[3] = (1 << Math.floor((7/50) * (percent - 50))) - 1;
    } else {
      buffer[2] = (1 << Math.floor((8/50) * percent)) - 1;
      buffer[3] = 0;
    }
    
    }

    const setGear = (gear) => {
	
      let gearCode = 0;
      switch(gear) {
        case -1:
          gearCode = 204;
          break;		
        case 0:
          gearCode = 192;
          break;
        case 1:
          gearCode = 249;
          break;
        case 2:
          gearCode = 164;
          break;
        case 3:
          gearCode = 176;
          break;
        case 4:
          gearCode = 153;
          break;
        case 5:
          gearCode = 146;
          break;
        case 6:
          gearCode = 131;
          break;
        case 7:
          gearCode = 248;
          break;
        case 8:
          gearCode = 128;
          break;
        case 9:
          gearCode = 152;
          break;
      }
      buffer[12] = gearCode;
    }; 

  //setTimeout(() => {
    //peripheral.writeHandle("51", Buffer("01ffffffff", "hex"), console.log);
    //peripheral.writeHandle("55", Buffer("02ffffffff", "hex"), console.log);
    //peripheral.writeHandle("61", Buffer("01ffffffff", "hex"), console.log);
  //}, 3000);


  peripheral.once('handleRead<51>', console.warn); // data is a Buffer
  //peripheral.once('handleRead<61>', console.info); // data is a Buffer



  setInterval(() => {
   peripheral.writeHandle("58", Buffer.from(buffer), false, console.info);
  }, 500);
  
setInterval(() => setGear(Math.floor(Math.random() * 10) - 1), 100);
setInterval(() => setRevLights(Math.floor(Math.random() * 101)), 100);


}, 3000);


 /*
  const {characteristics} = await peripheral.discoverSomeServicesAndCharacteristicsAsync(['1812'], ['2a4d']);
// console.log(characteristics);
setTimeout(() => {
  console.log("writing");
  const buf = Buffer("0201ffffff", "hex");
  //characteristics[0].write(buf, false, console.log);
  peripheral.writeHandle("55", buf, console.log);
  //characteristics[3].write(buf, false, console.log);




  characteristics[0].subscribe(console.warn);
  //characteristics[1].subscribe(console.warn);
  //characteristics[2].subscribe(console.warn);
  characteristics[3].subscribe(console.warn);
  
  characteristics[0].on('data', console.warn);
  characteristics[1].on('data', console.warn);
  characteristics[2].on('data', console.warn);
  characteristics[3].on('data', console.warn);
  
  characteristics[0].once('notify', console.log);
  characteristics[1].once('notify', console.log);
  characteristics[2].once('notify', console.log);
  characteristics[3].once('notify', console.log);
  
    console.log(characteristics[1].read());

    console.log("h", peripheral.readHandle("30"));


}, 3000);


*/
//   
});