var socket = io.connect();

var TANKWIDTH  = 122
  , TANKHEIGHT = 53
  , SPEED      = 5
  , PLAYERS    = {}
  , BULLETS    = []
  ;

$('body').css('background-color', randomColor());

socket.emit('newGame', {}, function (data) {
  var url = window.location + 'c';
  // var url = 'goo.gl/s5w4N';
  $('.url').text(url);
  $('.code').text(data);
});

socket.on('playerConnected', function (data) {
  var newX   = Math.floor(Math.random() * (window.innerWidth - TANKWIDTH))
    , newY   = Math.floor(Math.random() * (window.innerHeight - TANKHEIGHT))
    , newRot = Math.floor(Math.random() * 360);
  PLAYERS[data.player] = { x: newX, y: newY, rot: newRot, dx: 0, dy: 0, isExploding: false };

  $('.game').append('<div class="soldier"><div class="nick"><div class="nick-arrow"></div>' + data.nick + '</div><div class="explode"></div><img src="/img/tank.png" id="' + data.player + '"></div>');
});

socket.on('playerDisconnected', function (data) {
  $('#' + data.player).closest('.soldier').remove();
  delete PLAYERS[data.player];
});

socket.on('pressedButton', function (data) {
  if (PLAYERS[data.player].isExploding) return;

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

var B = 0;
function bullet(player) {
  var dx = Math.sin((270 - player.rot) * Math.PI / 180)
    , dy = Math.cos((270 - player.rot) * Math.PI / 180)
    , x  = player.x + TANKWIDTH / 2 + dx * 40
    , y  = player.y + TANKHEIGHT / 2 + dy * 40;

  var myBullet = $('<img>').addClass('bullet').css({ top: y, left: x });
  $('.game').append(myBullet);

  return {
    update: function () {
      x += dx * SPEED * 2;
      y += dy * SPEED * 2;

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
        if (p.isExploding)
          continue;
        if (x > p.x + B && x < p.x + TANKHEIGHT - B && y > p.y + B && y < p.y + TANKHEIGHT - B) {
          blowUpPlayer(key);
          return true;
        }
      }
      return false;
    }
  };
};

function updateBullets() {
  var newBullets = [];
  for (var i = 0; i < BULLETS.length; ++i) {
    if (BULLETS[i].update()) {
      newBullets.push(BULLETS[i]);
    }
  }
  BULLETS = newBullets;
};

function blowUpPlayer(key) {
    PLAYERS[key].isExploding = true;
    PLAYERS[key].explodeTime = 0;
    $('#' + key).closest('.soldier').find('img').hide();
    $('#' + key).closest('.soldier').find('.explode').show();
};

function updatePlayers() {
  for (var key in PLAYERS) {
    if (PLAYERS[key].isExploding) {
      PLAYERS[key].explodeTime += 10;
      var theTime = Math.floor(PLAYERS[key].explodeTime / 40);
      if (theTime >= 25) {
        PLAYERS[key].isExploding = false;
        $('#' + key).closest('.soldier').find('img').show();
        $('#' + key).closest('.soldier').find('.explode').hide();
      } else {
        var newX = theTime % 5
          , newY = Math.floor(theTime / 5);
        $('#' + key).closest('.soldier').find('.explode').css({
          'background-position-x': (newX * -64) + 'px',
          'background-position-y': (newY * -64) + 'px'
        });
      }
      continue;
    }
    PLAYERS[key].x += SPEED * PLAYERS[key].dx;
    PLAYERS[key].y += SPEED * PLAYERS[key].dy;

    if (PLAYERS[key].x < 0) PLAYERS[key].x = 0;
    if (PLAYERS[key].y < 0) PLAYERS[key].y = 0;

    if (PLAYERS[key].x > window.innerWidth - TANKWIDTH) PLAYERS[key].x = window.innerWidth - TANKWIDTH;
    if (PLAYERS[key].y > window.innerHeight - TANKHEIGHT) PLAYERS[key].y = window.innerHeight - TANKHEIGHT;

    if (PLAYERS[key].dx !== 0)
      PLAYERS[key].rot = Math.atan2(PLAYERS[key].dy, PLAYERS[key].dx) * 180 / Math.PI + 180;

    // $('#' + key).css('transform', 'translate(PLAYERS[key].x, PLAYERS[key].y)');

    $('#' + key).closest('.soldier').css({
      top: PLAYERS[key].y,
      left: PLAYERS[key].x
    });

    $('#' + key).css({
      '-webkit-transform': 'rotateZ(' + PLAYERS[key].rot + 'deg)'
    });
  }
};

setInterval(function () {
  updateBullets();
  updatePlayers();
}, 10);

function randomColor() {
  return '#'+Math.floor(Math.random()*16777215).toString(16);
};
