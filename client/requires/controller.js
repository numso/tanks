var socket = io.connect()
  , ANALOG = {}
  , PLAYER = { moving: false, startX: 0, startY: 0, curX: 0, curY: 0, touch: {} }
  , t
  ;

$('.enterGame').click(joinGame);
$('.gameCode').keypress(function (e) {
  if (e.keyCode === 13)
    joinGame(e);
});

socket.on('gameClosed', function () {
  clearInterval(t);
  $('.setup').hide();
  $('.loading').hide();
  $('.controls').hide();
  $('.error').show();

  $(document).unbind('touchstart');
  $(document).unbind('touchmove');
  $(document).unbind('touchend');
  $(document).unbind('orientationchange');
});

function joinGame(e) {
  var val  = $('.gameCode').val()
    , nick = $('.nickname').val() || 'Player';
  if (!val) {
    showErr('You must enter a code.');
    return
  }

  $('.setup').hide();
  $('.loading').show();

  $.post('/saveUser', { name: nick });
  socket.emit('newController', { gameCode: val, nick: nick }, function (data) {
    if (data === 'success') {
      $('.loading').hide();
      $('.controls').show();
      startGame();
    } else {
      $('.loading').hide();
      $('.setup').show();
      showErr('Game Not Found, try again.');
    }
  });
};

function showErr(msg) {
  $('.msg').text(msg);
};

function getConstraints() {
  var analog1 = $('.analog1');
  var analog2 = $('.analog2');
  var ANALOG = {
    width: analog1.width(),
    height: analog1.height(),
    width2: analog2.width(),
    height2: analog2.height()
  };
  $('.analog2').css({
    left: (ANALOG.width - ANALOG.width2) / 2,
    top: (ANALOG.height - ANALOG.height2) / 2
  });
  return ANALOG;
};

function getWidth() {
  xWidth = null;
  if (window.screen != null)
    xWidth = window.screen.width;
  if (window.innerWidth != null)
    xWidth = window.innerWidth;
  if (document.body != null)
    xWidth = document.body.clientWidth;
  return xWidth;
};

function getHeight() {
  xHeight = null;
  if (window.screen != null)
    xHeight = window.screen.height;
  if (window.innerHeight != null)
    xHeight =   window.innerHeight;
  if (document.body != null)
    xHeight = document.body.clientHeight;
  return xHeight;
};

function startGame() {
  ANALOG = getConstraints();


  $(document).on('orientationchange', function (e) {
    ANALOG = getConstraints();
  });

  $(document).keypress(function (e) {
    console.log(e.keyCode);
    // if (e.keyCode === 13)
  });

  $(document).on('touchstart', function (e) {
    e.preventDefault();
    var touch = e.originalEvent.changedTouches[0]
      , x     = touch.pageX
      , y     = touch.pageY
      , w     = getWidth()
      ;

    if (x < w / 2) {
      if (!PLAYER.touch.identifier) {
        PLAYER.touch  = touch;
        PLAYER.startX = x;
        PLAYER.startY = y;
        PLAYER.curX = x;
        PLAYER.curY = y;
        PLAYER.moving = true;
        $('.analog1').css({
          left: x - ANALOG.width / 2,
          top: y - ANALOG.height / 2
        });

        ANALOG.curX = x - ANALOG.width2 / 2;
        ANALOG.curY = y - ANALOG.height2 / 2;
        $('.analog2').css({
          left: ANALOG.curX,
          top:  ANALOG.curY
        });
      }
    } else {
      socket.emit('input', { val: 'shoot' });
    }
  });

  $(document).on('touchmove', function (e) {
    e.preventDefault();
    var touch = e.originalEvent.changedTouches[0];

    if (touch.identifier === PLAYER.touch.identifier) {
      PLAYER.curX = touch.pageX;
      PLAYER.curY = touch.pageY;

      var newX = PLAYER.curX - ANALOG.width2 / 2;
      var newY = PLAYER.curY - ANALOG.height2 / 2;

      if (newX < ANALOG.curX - CAP) newX = ANALOG.curX - CAP;
      if (newX > ANALOG.curX + CAP) newX = ANALOG.curX + CAP;
      if (newY < ANALOG.curY - CAP) newY = ANALOG.curY - CAP;
      if (newY > ANALOG.curY + CAP) newY = ANALOG.curY + CAP;

      $('.analog2').css({
        left: newX,
        top:  newY
      });

      sendMovementData();
    }
  });

  $(document).on('touchend', function (e) {
    e.preventDefault();
    var id = e.originalEvent.changedTouches[0].identifier;
    if (PLAYER.touch.identifier === id) {
      PLAYER.touch = {};
      PLAYER.moving = false;
      $('.analog2').css({
        left: ANALOG.curX,
        top:  ANALOG.curY
      });

      sendMovementData();
    }
  });

  t = setInterval(function () {
    sendMovementData();
  }, 500);
};

var CAP = 50;
function sendMovementData() {
  if (!PLAYER.moving) {
    socket.emit('input', { val: 'stop' });
    return;
  }

  var changedX = PLAYER.startX - PLAYER.curX;
  if (changedX > CAP) changedX = CAP;
  if (changedX < -CAP) changedX = -CAP;
  changedX = changedX / CAP;

  var changedY = PLAYER.startY - PLAYER.curY;
  if (changedY > CAP) changedY = CAP;
  if (changedY < -CAP) changedY = -CAP;
  changedY = changedY / CAP;

  // do stuff with PLAYER x, PLAYER y
  socket.emit('input', { val: 'move', x: changedX, y: changedY });
};
