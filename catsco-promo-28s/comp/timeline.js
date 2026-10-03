// Single source of truth for picture and sound: comp.html loads it, tools/*.py parse it.
window.TL = {
 "_": "Single source of truth for picture and sound. comp.html and tools/*.py all read it, so a retimed cue takes its sound with it. Seconds; 120 BPM, one bar = 2 s, cues sit on the 8th-note grid.",
 "dur": 28,
 "bpm": 120,
 "sections": [
  {
   "name": "intro",
   "start": 0,
   "end": 4,
   "music": "pad + a pluck under each hook line, no drums"
  },
  {
   "name": "build",
   "start": 4,
   "end": 8,
   "music": "soft kick + shaker enter, typing on top"
  },
  {
   "name": "groove",
   "start": 8,
   "end": 19.5,
   "music": "full groove: kick, clap, bass, arp; ducked under hits"
  },
  {
   "name": "breakdown",
   "start": 19.5,
   "end": 21,
   "music": "drums out, pad only (the hold)"
  },
  {
   "name": "hits",
   "start": 21,
   "end": 23,
   "music": "sub hit per word, riser into the logo"
  },
  {
   "name": "lockup",
   "start": 23,
   "end": 28,
   "music": "final chord at 23, light groove, long tail"
  }
 ],
 "cues": {
  "line1": 0.5,
  "line2": 1.5,
  "line3": 2.5,
  "collapse": 3.25,
  "phone": 3.5,
  "greet": 4.5,
  "typeStart": 5.0,
  "typeEnd": 6.35,
  "send": 6.5,
  "ack": 7.0,
  "token": 7.3,
  "toPC": 7.5,
  "pcLand": 8.4,
  "cmd": 9.0,
  "log": 9.3,
  "error": 10.0,
  "read": 10.5,
  "diff": 11.0,
  "rebuild": 11.5,
  "pass": 12.0,
  "chip": 12.5,
  "toCloud": 12.75,
  "cloud": 13.3,
  "homeLand": 13.85,
  "tests": 14.3,
  "fail": 15.4,
  "branch": 15.6,
  "found": 16.4,
  "merge": 16.8,
  "rerun": 17.0,
  "allPass": 17.5,
  "deliver": 18.0,
  "toPhone": 18.1,
  "phoneLand": 19.0,
  "reply": 19.2,
  "hit1": 21.0,
  "hit2": 21.5,
  "hit3": 22.0,
  "logo": 23.0,
  "word": 23.4,
  "tag": 23.9,
  "url": 24.5
 },
 "events": [
  {
   "t": 0.5,
   "kind": "key",
   "pan": 0
  },
  {
   "t": 1.5,
   "kind": "key",
   "pan": 0
  },
  {
   "t": 2.5,
   "kind": "key",
   "pan": 0
  },
  {
   "t": 3.25,
   "kind": "suck",
   "pan": 0
  },
  {
   "t": 3.5,
   "kind": "open",
   "pan": 0
  },
  {
   "t": 4.5,
   "kind": "pop",
   "pan": -0.1
  },
  {
   "t": 5.0,
   "kind": "typing",
   "pan": 0,
   "until": 6.35
  },
  {
   "t": 6.5,
   "kind": "tap",
   "pan": 0.2
  },
  {
   "t": 6.55,
   "kind": "send",
   "pan": 0.1
  },
  {
   "t": 7.0,
   "kind": "glass",
   "pan": -0.1,
   "f": 1760
  },
  {
   "t": 7.3,
   "kind": "token",
   "pan": 0
  },
  {
   "t": 7.5,
   "kind": "whoosh",
   "pan": -0.2,
   "dur": 0.95,
   "pan_to": -0.5
  },
  {
   "t": 8.4,
   "kind": "land",
   "pan": -0.4
  },
  {
   "t": 9.0,
   "kind": "tap",
   "pan": -0.3
  },
  {
   "t": 9.3,
   "kind": "lines",
   "pan": -0.3,
   "until": 9.95
  },
  {
   "t": 10.0,
   "kind": "error",
   "pan": -0.3
  },
  {
   "t": 10.5,
   "kind": "glass",
   "pan": -0.3,
   "f": 1320
  },
  {
   "t": 11.0,
   "kind": "glass",
   "pan": -0.3,
   "f": 1568
  },
  {
   "t": 11.5,
   "kind": "tap",
   "pan": -0.3
  },
  {
   "t": 12.0,
   "kind": "pass",
   "pan": -0.3
  },
  {
   "t": 12.5,
   "kind": "pop",
   "pan": -0.3
  },
  {
   "t": 12.75,
   "kind": "whoosh",
   "pan": -0.6,
   "dur": 1.1,
   "pan_to": 0.6
  },
  {
   "t": 13.3,
   "kind": "node",
   "pan": 0
  },
  {
   "t": 13.85,
   "kind": "land",
   "pan": 0.4
  },
  {
   "t": 14.3,
   "kind": "ticks",
   "pan": 0.3,
   "until": 15.35
  },
  {
   "t": 15.4,
   "kind": "error",
   "pan": 0.3
  },
  {
   "t": 15.6,
   "kind": "split",
   "pan": 0.5
  },
  {
   "t": 16.4,
   "kind": "found",
   "pan": 0.6
  },
  {
   "t": 16.8,
   "kind": "merge",
   "pan": 0.4
  },
  {
   "t": 17.0,
   "kind": "ticks",
   "pan": 0.3,
   "until": 17.45
  },
  {
   "t": 17.5,
   "kind": "pass",
   "pan": 0.3
  },
  {
   "t": 18.0,
   "kind": "pop",
   "pan": 0.4
  },
  {
   "t": 18.1,
   "kind": "whoosh",
   "pan": 0.5,
   "dur": 1.0,
   "pan_to": -0.1
  },
  {
   "t": 19.0,
   "kind": "land",
   "pan": 0
  },
  {
   "t": 19.2,
   "kind": "pop",
   "pan": 0
  },
  {
   "t": 21.0,
   "kind": "hit",
   "pan": 0
  },
  {
   "t": 21.5,
   "kind": "hit",
   "pan": 0
  },
  {
   "t": 22.0,
   "kind": "hit",
   "pan": 0
  },
  {
   "t": 21.0,
   "kind": "whoosh",
   "pan": 0,
   "dur": 2.0,
   "pan_to": 0
  },
  {
   "t": 23.0,
   "kind": "logo",
   "pan": 0
  },
  {
   "t": 23.4,
   "kind": "key",
   "pan": 0
  },
  {
   "t": 24.5,
   "kind": "glass",
   "pan": 0,
   "f": 2093
  }
 ]
};
