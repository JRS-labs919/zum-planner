"use strict";

// Each row is an illustrative room sequence. Scene percentages follow zone order.
function populateWiredDemo() {
  const dim = "0-10 V dimming", phase = "Phase control", sw = "Switching";
  const rooms = [
    ["Conference 101","Conference", [["Downlights",dim],["Pendants",phase]], "Presentation",[25,60]],
    ["Training 102","Classroom", [["Front",dim],["Center",dim],["Rear",dim]], "Projector",[10,45,65]],
    ["Office 103","Office", [["Task",dim]], "Work",[85]],
    ["Office 104","Office", [["Task",dim]], "Work",[80]],
    ["Open office 105","Open office", [["Perimeter",dim],["Interior",dim]], "Work",[55,85]],
    ["Lobby 106","Lobby", [["General",dim],["Accent",phase]], "Welcome",[70,90]],
    ["Huddle 107","Conference", [["General",dim],["Display wall",dim]], "Video call",[75,35]],
    ["Break room 108","Other", [["General",dim],["Counter",sw]], "Break",[70,100]],
    ["Corridor 109","Corridor", [["Circulation",dim]], "Day",[80]],
    ["Copy room 110","Other", [["General",dim]], "Occupied",[100]]
  ];
  const row = data => ({id:newRecordId(), ...data});
  Object.assign(state.project, {name:"Ten-space wired demo",number:"DEMO-10",location:"Example office floor",
    workflow:"Custom programming · SIMPL Windows",architecture:"Zūm Wired",voltage:"120 VAC",
    notes:"Illustrative design with one licensed ZUM-HUB4. Verify addresses and wiring during commissioning."});
  const r = state.records;
  r.network.push(row({name:"Lighting processor",area:"Electrical closet",model:"ZUM-HUB4",equipmentType:"Zūm Hub",quantity:"1",voltage:"24 VDC"}),
    row({name:"Lighting switch",area:"Electrical closet",model:"CEN-SWPOE-5AC",equipmentType:"PoE network switch",quantity:"1",connection:"Ethernet / PoE"}));
  r.lineItems.push(row({name:"Hub custom program slot",category:"Software license",model:"SW-HUB4-PROG",quantity:"1"}));
  for (const [name,roomType,zones,sceneName,percentages] of rooms) {
    const space = row({name});
    state.spaces.push(space);
    const base = {area:name, spaceId:space.id};
    const programLevels = {};
    for (const [index,[label,controlType]] of zones.entries()) {
      const load = row({...base,name:label,controlType,fixtureType:"LED lighting",quantity:"4",voltage:"120 VAC",watts:"18",emergency:"Normal"});
      r.loads.push(load);
      programLevels[load.id] = percentages[index];
    }
    r.scenes.push(row({...base,name:sceneName,trigger:"ZUMLINK-KP",lights:zones.map(([label],i) => label + " " + percentages[i] + "%").join(", "),programLevels}));
    r.scenes.push(row({...base,name:"All off",trigger:"ZUMLINK-KP",lights:"All space lights off",
      programLevels:Object.fromEntries(Object.keys(programLevels).map(id => [id,0]))}));
    r.roomDevices.push(row({...base,name:name+" entry keypad",model:"ZUMLINK-KP",quantity:"1",deviceType:"Keypad",connection:"Zūm Link",function:"Button 1 recalls "+sceneName+". Button 2 turns space lights off."}),
      row({...base,name:name+" ceiling sensor",model:"ZUMLINK-DT-QUATTRO-DLS",quantity:"1",deviceType:"Presence detector",connection:"Zūm Link",function:"Vacancy timing"}));
    r.spaceBehavior.push(row({...base,roomType,autoOn:"Manual on",autoOff:"Vacancy timeout - 20 min",manualControl:"Entry keypad",daylighting:"Not required",notes:"Implement the vacancy timer and button bindings in the processor program."}));
  }
  syncConfiguredSpaces();
  const primaries = r.controllers.filter(c => c.assignmentRole === "primary");
  for (const primary of primaries) {
    const downstream = [...r.controllers.filter(c => c.spaceId === primary.spaceId && c.assignmentRole === "secondary"), ...r.roomDevices.filter(d => d.spaceId === primary.spaceId)];
    r.links.push(row({name:primary.area+" Zūm Link",linkType:"Zūm Link",source:primary.name,destination:downstream.map(d => d.name).join(" → "),capacity:String(downstream.length),status:"Planned"}));
  }
  r.links.push(row({name:"Processor subnet to lighting switch",source:"Lighting processor",destination:"Lighting switch",linkType:"Ethernet / PoE",status:"Planned"}));
  for (let i=0;i<primaries.length;i+=5) {
    r.links.push(row({name:"Zūm Net run "+(1+i/5),source:"Lighting switch",destination:primaries.slice(i,i+5).map(c=>c.name).join(" → "),linkType:"Zūm Net",capacity:"5",length:"200",maxSpan:"50",status:"Planned"}));
  }
  saveState("Demo loaded");
}

function switchDemo() {
  const url = new URL(location.href);
  if (isWiredDemo) url.searchParams.delete("demo");
  else url.searchParams.set("demo","wired10");
  location.assign(url.href);
}
