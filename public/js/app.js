(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json",".jade"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("bullet.jade",function(require,module,exports,__dirname,__filename,process,global){module.exports = function anonymous(locals, attrs, escape, rethrow, merge) {
attrs = attrs || jade.attrs; escape = escape || jade.escape; rethrow = rethrow || jade.rethrow; merge = merge || jade.merge;
var buf = [];
with (locals || {}) {
var interp;
buf.push('<div');
buf.push(attrs({ 'style':('top:'+top+'px; left:'+left+'px;'), "class": ('bullet') }, {"style":true}));
buf.push('></div>');
}
return buf.join("");
}
});

require.define("tank.jade",function(require,module,exports,__dirname,__filename,process,global){module.exports = function anonymous(locals, attrs, escape, rethrow, merge) {
attrs = attrs || jade.attrs; escape = escape || jade.escape; rethrow = rethrow || jade.rethrow; merge = merge || jade.merge;
var buf = [];
with (locals || {}) {
var interp;
buf.push('<div');
buf.push(attrs({ 'id':(player), 'style':('top:'+top+'px; left:'+left+'px;'), "class": ('soldier') }, {"id":true,"style":true}));
buf.push('><div class="nick">');
var __val__ = nick
buf.push(escape(null == __val__ ? "" : __val__));
buf.push('<div class="nick-arrow"></div></div><div class="explode"></div><img src="/img/tank.png"/></div>');
}
return buf.join("");
}
});

require.define("/client/requires/controller.js",function(require,module,exports,__dirname,__filename,process,global){var socket = io.connect()
  , ANALOG = {}
  , PLAYER = { moving: false, startX: 0, startY: 0, curX: 0, curY: 0, touch: {} }
  , t
  ;

$('.lastGame').click(joinLastGame);
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

  $(document).unbind('orientationchange');
  $(document).unbind('touchstart');
  $(document).unbind('touchmove');
  $(document).unbind('touchend');
  $(document).unbind('keydown');
  $(document).unbind('keyup');
});

function joinLastGame(e) {
  var val  = $(this).data('id');
  _joinGame(val);
};

function joinGame(e) {
  var val  = $('.gameCode').val();
  if (!val) return showErr('You must enter a code.');
  _joinGame(val);
};

function _joinGame(val) {
  var nick = $('.nickname').val() || 'Player';
  $('.setup').hide();
  $('.loading').show();
  $.post('/saveUser', { name: nick });
  socket.emit('newController', { gameCode: val, nick: nick }, function (data) {
    if (data === 'success') {
      $.post('/saveLastGame', { lastGame: val });
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
  var ANALOG  = {
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

  setupKeys();

  ANALOG = getConstraints();

  $(document).on('orientationchange', function (e) {
    ANALOG = getConstraints();
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

function setupKeys() {
  var keys = {};

  $(document).keydown(function (e) {
    if (!keys[e.keyCode]) {
      keys[e.keyCode] = true;
      processKey(e.keyCode, true);
    }
  });

  $(document).keyup(function (e) {
    keys[e.keyCode] = false;
    processKey(e.keyCode, false);
  });

  function processKey(code, pressed) {
    if (code === 32) {
      if (pressed)
        socket.emit('input', { val: 'shoot'});
    } else {
      PLAYER.moving = true;
      PLAYER.startX = 0;
      PLAYER.startY = 0;
      PLAYER.curX   = 0;
      PLAYER.curY   = 0;
      if (keys[37]) PLAYER.curX -= CAP;
      if (keys[38]) PLAYER.curY -= CAP;
      if (keys[39]) PLAYER.curX += CAP;
      if (keys[40]) PLAYER.curY += CAP;

      if (PLAYER.curX === 0 && PLAYER.curY === 0)
        PLAYER.moving = false;

      sendMovementData();
    }
  };
};

});

require.define("/client/requires/game.js",function(require,module,exports,__dirname,__filename,process,global){var jadify = require('./render');

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

});

require.define("/client/requires/render.js",function(require,module,exports,__dirname,__filename,process,global){var render = require('browserijade');

module.exports = function (view, locals) {
  return render(view, locals);
};

// test
});

require.define("/node_modules/browserijade/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./lib/middleware","browserify":"./lib/browserijade"}
});

require.define("/node_modules/browserijade/lib/browserijade.js",function(require,module,exports,__dirname,__filename,process,global){// Browserijade
// (c) 2011 David Ed Mellum
// Browserijade may be freely distributed under the MIT license.

jade = require('jade/lib/runtime');

// Render a jade file from an included folder in the Browserify
// bundle by a path local to the included templates folder.
var renderFile = function(path, locals) {
	locals = locals || {};
	path = path + '.jade';
	template = require(path);
	return template(locals);
}

// Render a pre-compiled Jade template in a self-executing closure.
var renderString = function(template) {
	return eval(template);
}

module.exports = renderFile;
module.exports.renderString = renderString;
});

require.define("/node_modules/browserijade/node_modules/jade/lib/runtime.js",function(require,module,exports,__dirname,__filename,process,global){
/*!
 * Jade - runtime
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Lame Array.isArray() polyfill for now.
 */

if (!Array.isArray) {
  Array.isArray = function(arr){
    return '[object Array]' == Object.prototype.toString.call(arr);
  };
}

/**
 * Lame Object.keys() polyfill for now.
 */

if (!Object.keys) {
  Object.keys = function(obj){
    var arr = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        arr.push(key);
      }
    }
    return arr;
  }
}

/**
 * Merge two attribute objects giving precedence
 * to values in object `b`. Classes are special-cased
 * allowing for arrays and merging/joining appropriately
 * resulting in a string.
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Object} a
 * @api private
 */

exports.merge = function merge(a, b) {
  var ac = a['class'];
  var bc = b['class'];

  if (ac || bc) {
    ac = ac || [];
    bc = bc || [];
    if (!Array.isArray(ac)) ac = [ac];
    if (!Array.isArray(bc)) bc = [bc];
    ac = ac.filter(nulls);
    bc = bc.filter(nulls);
    a['class'] = ac.concat(bc).join(' ');
  }

  for (var key in b) {
    if (key != 'class') {
      a[key] = b[key];
    }
  }

  return a;
};

/**
 * Filter null `val`s.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function nulls(val) {
  return val != null;
}

/**
 * Render the given attributes object.
 *
 * @param {Object} obj
 * @param {Object} escaped
 * @return {String}
 * @api private
 */

exports.attrs = function attrs(obj, escaped){
  var buf = []
    , terse = obj.terse;

  delete obj.terse;
  var keys = Object.keys(obj)
    , len = keys.length;

  if (len) {
    buf.push('');
    for (var i = 0; i < len; ++i) {
      var key = keys[i]
        , val = obj[key];

      if ('boolean' == typeof val || null == val) {
        if (val) {
          terse
            ? buf.push(key)
            : buf.push(key + '="' + key + '"');
        }
      } else if (0 == key.indexOf('data') && 'string' != typeof val) {
        buf.push(key + "='" + JSON.stringify(val) + "'");
      } else if ('class' == key && Array.isArray(val)) {
        buf.push(key + '="' + exports.escape(val.join(' ')) + '"');
      } else if (escaped && escaped[key]) {
        buf.push(key + '="' + exports.escape(val) + '"');
      } else {
        buf.push(key + '="' + val + '"');
      }
    }
  }

  return buf.join(' ');
};

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

exports.escape = function escape(html){
  return String(html)
    .replace(/&(?!(\w+|\#\d+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Re-throw the given `err` in context to the
 * the jade in `filename` at the given `lineno`.
 *
 * @param {Error} err
 * @param {String} filename
 * @param {String} lineno
 * @api private
 */

exports.rethrow = function rethrow(err, filename, lineno){
  if (!filename) throw err;

  var context = 3
    , str = require('fs').readFileSync(filename, 'utf8')
    , lines = str.split('\n')
    , start = Math.max(lineno - context, 0)
    , end = Math.min(lines.length, lineno + context);

  // Error context
  var context = lines.slice(start, end).map(function(line, i){
    var curr = i + start + 1;
    return (curr == lineno ? '  > ' : '    ')
      + curr
      + '| '
      + line;
  }).join('\n');

  // Alter exception message
  err.path = filename;
  err.message = (filename || 'Jade') + ':' + lineno
    + '\n' + context + '\n\n' + err.message;
  throw err;
};

});

require.define("fs",function(require,module,exports,__dirname,__filename,process,global){// nothing to see here... no file methods for the browser

});

require.define("/client/main.js",function(require,module,exports,__dirname,__filename,process,global){window.require = require;

});
require("/client/main.js");
})();
