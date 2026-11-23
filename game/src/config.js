// Ember Bay — shared configuration and game state.
// Everything the other modules need lives here: world size, palettes,
// mission list, weapons, radio stations, respect ranks and the live state.
(function () {
  var EB = window.EB || (window.EB = {});

  EB.CONFIG = {
    title: 'EMBER BAY',
    cityHalf: 140,          // city grid extends x,z in [-140, 140]
    streetGap: 28,          // distance between street centrelines
    roadHalf: 4,            // half width of a road
    beachZ: 96,             // sand starts here (south edge of the city)
    seaZ: 128,              // water starts here
    volcano: { x: 0, z: -195, height: 95, radius: 70 },
    sun: { x: -260, y: 90, z: 120 },
    startMoney: 1500,
    maxWanted: 5,
    palette: [0x2fae6e, 0xff5f8f, 0xff8c42, 0x3fa7d6, 0xf2e3c6, 0x12b5a5, 0xffd23f, 0x9b5de5],
    paletteNames: ['green', 'pink', 'orange', 'blue', 'cream', 'teal', 'yellow', 'purple'],
    ranks: [
      { at: 0, name: 'STREET RAT' },
      { at: 150, name: 'HUSTLER' },
      { at: 400, name: 'NEON RUNNER' },
      { at: 800, name: 'CREW LEADER' },
      { at: 1400, name: 'EMBER KING' }
    ],
    weapons: [
      { name: 'Fists', damage: 12, rate: 0.35, range: 3, auto: false },
      { name: 'Pistol', damage: 22, rate: 0.28, range: 60, auto: false },
      { name: 'SMG', damage: 12, rate: 0.09, range: 45, auto: true },
      { name: 'Shotgun', damage: 16, rate: 0.8, range: 25, auto: false, pellets: 6 },
      { name: 'Rifle', damage: 34, rate: 0.16, range: 90, auto: true },
      { name: 'Sniper', damage: 90, rate: 1.1, range: 160, auto: false },
      { name: 'Rocket', damage: 120, rate: 1.4, range: 110, auto: false, blast: 8 }
    ],
    radio: [
      { name: 'EMBER FM 88.1', style: 'synthwave' },
      { name: 'SUNSET 92.4', style: 'chill' },
      { name: 'VOLCANO ROCK 101.7', style: 'rock' },
      { name: 'NEON TALK 106.3', style: 'talk' }
    ],
    missions: [
      { id: 1, name: 'Neon Welcome', brief: 'Drive to the Neon Row billboard and meet Sable.', reward: 200, respect: 60 },
      { id: 2, name: 'Pizza Run', brief: 'Deliver hot boxes to 3 drop-offs before they go cold.', reward: 350, respect: 90 },
      { id: 3, name: 'Street Kings', brief: 'Beat 3 rival racers through the checkpoints.', reward: 600, respect: 150 },
      { id: 4, name: 'Getaway', brief: 'Lose the cops and reach the safehouse. Wanted level 2.', reward: 500, respect: 140 },
      { id: 5, name: 'Harbor Heist', brief: 'Grab the package at the harbor. Guards are armed.', reward: 800, respect: 200 },
      { id: 6, name: 'Roadblock Run', brief: 'Smash through the police roadblocks to the volcano road.', reward: 700, respect: 180 },
      { id: 7, name: 'Volcano Run', brief: 'Timed climb: reach the volcano overlook in 90 seconds.', reward: 900, respect: 220 },
      { id: 8, name: 'Ember King', brief: 'Final job: stop the rival boss car, then return to Neon Row.', reward: 2000, respect: 500 }
    ]
  };

  EB.state = {
    started: false,
    money: EB.CONFIG.startMoney,
    respect: 0,
    hp: 100,
    wanted: 0,
    weaponIndex: 1,
    ammo: [Infinity, 120, 240, 48, 120, 24, 8],
    missionIndex: 1,          // current mission is #2 of 8 at a fresh start
    missionStep: 0,
    missionDone: [true, false, false, false, false, false, false, false],
    inCar: true,
    speedMph: 0,
    radioIndex: 0,
    radioOn: true,
    upgrades: { engine: 0, armor: 0, nitro: 0 },
    kills: 0,
    carsStolen: 0,
    time: 0,
    paused: false,
    objective: 'Meet Sable at Neon Row',
    message: ''
  };

  EB.rankName = function () {
    var name = EB.CONFIG.ranks[0].name;
    for (var i = 0; i < EB.CONFIG.ranks.length; i++) {
      if (EB.state.respect >= EB.CONFIG.ranks[i].at) name = EB.CONFIG.ranks[i].name;
    }
    return name;
  };

  EB.addRespect = function (n) { EB.state.respect += n; };
  EB.addMoney = function (n) { EB.state.money += n; };
  EB.setMessage = function (t) { EB.state.message = t; EB.state.messageAt = EB.state.time; };
})();
