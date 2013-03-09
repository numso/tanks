var jadify = require('./render');

$('body').css('background-color', randomColor());

var socket = io.connect();

var TANK_SIZE  = 53
  , SPEED      = 5 / 20
  , PLAYERS    = {}
  , BULLETS    = []
  ;

socket.emit('newGame', {}, function (data) {
  var url = window.location + 'c';
  // var url = 'goo.gl/s5w4N';
  $('.url').text(url);
  $('.code').text(data);
});

socket.on('playerConnected', function (data) {
  PLAYERS[data.player] = getRandomPlayer();
  data.top  = PLAYERS[data.player].x;
  data.left = PLAYERS[data.player].y;
  $('.game').append(jadify('tank', data));
});

function getRandomPlayer() {
  return {
    x:    Math.floor(Math.random() * (window.innerWidth - TANK_SIZE)),
    y:    Math.floor(Math.random() * (window.innerHeight - TANK_SIZE)),
    rot:  Math.floor(Math.random() * 360),
    dx:   0,
    dy:   0,
    dead: false
  };
};

socket.on('playerDisconnected', function (data) {
  $('#' + data.player).remove();
  delete PLAYERS[data.player];
});

socket.on('pressedButton', function (data) {
  if (PLAYERS[data.player].dead) return;

  if (data.val === 'shoot') {
    BULLETS.push(bullet(PLAYERS[data.player]));
  } else if (data.val === 'stop') {
    PLAYERS[data.player].dx = 0;
    PLAYERS[data.player].dy = 0;
  } else {
    PLAYERS[data.player].dx = -data.x;
    PLAYERS[data.player].dy = -data.y;
  }
});

function bullet(player) {
  var dx = Math.sin((270 - player.rot) * Math.PI / 180)
    , dy = Math.cos((270 - player.rot) * Math.PI / 180)
    , x  = player.x + TANK_SIZE / 2 + dx * 40
    , y  = player.y + TANK_SIZE / 2 + dy * 40;

  var myBullet = $(jadify('bullet', { top: y, left: x }));
  $('.game').append(myBullet);

  return {
    update: function (dTime) {
      x += dx * SPEED * dTime * 2;
      y += dy * SPEED * dTime * 2;

      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        myBullet.remove();
        return false;
      }

      if (this.hitsPlayer()) {
        myBullet.remove();
        return false;
      }

      myBullet.css({ top: y, left: x });
      return true;
    },
    hitsPlayer: function () {
      for (var key in PLAYERS) {
        var p = PLAYERS[key];
        if (p.dead)
          continue;

        var cx = p.x + TANK_SIZE / 2
          , cy = p.y + TANK_SIZE / 2
          , distance = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2))
          ;

        if (distance <= TANK_SIZE - 7) {
          blowUpPlayer(key);
          return true;
        }
      }
      return false;
    }
  };
};

function updateBullets(dTime) {
  var newBullets = [];
  for (var i = 0; i < BULLETS.length; ++i) {
    if (BULLETS[i].update(dTime)) {
      newBullets.push(BULLETS[i]);
    }
  }
  BULLETS = newBullets;
};

function blowUpPlayer(key) {
    PLAYERS[key].dead = true;
    PLAYERS[key].explodeTime = 0;
    $('#' + key).find('img').hide();
    $('#' + key).find('.explode').show();
};

function updatePlayers(dTime) {
  for (var key in PLAYERS) {
    if (PLAYERS[key].dead) {
      PLAYERS[key].explodeTime += 10;
      var theTime = Math.floor(PLAYERS[key].explodeTime / 20);
      if (theTime >= 25) {
        PLAYERS[key] = getRandomPlayer();
        $('#' + key).css({ top: PLAYERS[key].y, left: PLAYERS[key].x });
        $('#' + key).find('img').show();
        $('#' + key).find('.explode').hide();
      } else {
        var newX = theTime % 5
          , newY = Math.floor(theTime / 5);
        $('#' + key).find('.explode').css({
          'background-position-x': (newX * -64),
          'background-position-y': (newY * -64)
        });
      }
      continue;
    }
    PLAYERS[key].x += SPEED * PLAYERS[key].dx * dTime;
    PLAYERS[key].y += SPEED * PLAYERS[key].dy * dTime;

    if (PLAYERS[key].x < 0) PLAYERS[key].x = 0;
    if (PLAYERS[key].y < 0) PLAYERS[key].y = 0;

    if (PLAYERS[key].x > window.innerWidth - TANK_SIZE) PLAYERS[key].x = window.innerWidth - TANK_SIZE;
    if (PLAYERS[key].y > window.innerHeight - TANK_SIZE) PLAYERS[key].y = window.innerHeight - TANK_SIZE;

    if (PLAYERS[key].dx !== 0) {
      PLAYERS[key].rot = Math.atan2(PLAYERS[key].dy, PLAYERS[key].dx) * 180 / Math.PI + 180;
    } else if (PLAYERS[key].dy > 0) {
      PLAYERS[key].rot = 270;
    } else if (PLAYERS[key].dy < 0) {
      PLAYERS[key].rot = 90;
    }

    $('#' + key).css({
      top: PLAYERS[key].y,
      left: PLAYERS[key].x
    });

    $('#' + key).find('img').css({
      '-webkit-transform': 'rotateZ(' + PLAYERS[key].rot + 'deg)'
    });
  }
};

var time;
function gameLoop() {
  requestAnimationFrame(gameLoop);

  var newTime = Date.now()
    , dTime   = newTime - time;
  if (dTime > 20) dTime = 20;
  time = newTime;

  updateBullets(dTime);
  updatePlayers(dTime);
};

function init() {
  window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (cb) { window.setTimeout(cb, 1000 / 60); };
  time = Date.now();
  requestAnimationFrame(gameLoop);
};

init();

function randomColor() {
  return '#'+Math.floor(Math.random()*16777215).toString(16);
};
