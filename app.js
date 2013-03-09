var express = require('express')
  , http    = require('http')
  , path    = require('path')
  , fs      = require('fs')
  , io      = require('socket.io')
  ;

var app = express();

var sessOptions = {
  key: 'myApp.sid',
  secret: "secret-key-goes-here"
};

app.configure(function () {
  app.set('port', process.env.VCAP_APP_PORT || process.env.PORT || 4000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session(sessOptions));
  app.use(setUser);
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

function setUser(req, res, next) {
  if (!req.session.user) {
    req.session.user = { name: '' };
  }
  next();
};

app.configure('development', function () {
  app.use(express.errorHandler());
});

function initMiddlewares(path) {
  app.middleware = {};
  initFiles(path, 'middlewares');
};

function initControllers(path) {
  initFiles(path, 'controllers');
};

function initFiles(path, type) {
  path = path || __dirname + '/' + type;
  var files = fs.readdirSync(path);
  console.info('Loading ' + type + ' for path ' + path);

  files.forEach(function(file) {
    var fullPath = path + '/' + file;
    var stats = fs.statSync(fullPath);

    if (stats.isFile()) {
      initFile(app, fullPath, type);
    } else if (stats.isDirectory()) {
      initFiles(fullPath, type);
    }
  });
};

function initFile(app, file, type) {
  var match = /^(.*?\/([A-Za-z_]*))\.js$/.exec(file);
  if (!match) return;
  var asset = require(file);
  if (asset && typeof asset.init === 'function') {
    console.info('    Loading ' + type + ' ' + match[2] + ' (' + file + ')');
    asset.init(app);
  }
};

initMiddlewares();
initControllers();

var server = http.createServer(app).listen(app.get('port'), function () {
  console.log("Express server listening on port " + app.get('port'));
});





function generateUniqueID() {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (var i = 0; i < 5; ++i)
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
};

io = io.listen(server);

var GAMES = {};
// setInterval(function () {
//   console.log(GAMES);
// }, 5000);

io.sockets.on('connection', function (socket) {

  socket.on('log', function (data) {
    console.log(data);
  });

  // a new game screen connected
  socket.on('newGame', function (data, cb) {
    var id = generateUniqueID();
    socket.set('gameID', id);
    GAMES[id] = { socket: socket, controllers: {} };
    cb(id);
  });

  // a new controller connected
  socket.on('newController', function (data, cb) {
    var pid = data.gameCode.toUpperCase();
    if (!GAMES[pid]) {
      return cb('fail');
    }

    var id = generateUniqueID();
    socket.set('parentID', pid);
    socket.set('controllerID', id);
    GAMES[pid].controllers[id] = socket;
    GAMES[pid].socket.emit('playerConnected', { player: id, nick: data.nick });
    cb('success');
  });

  socket.on('input', function (data) {
    socket.get('parentID', function (err, pid) {
      if (GAMES[pid]) {
        socket.get('controllerID', function (err, id) {
          data.player = id;
          GAMES[pid].socket.volatile.emit('pressedButton', data);
        });
      } else {
        socket.emit('gameClosed', {});
      }
    });
  });

  socket.on('disconnect', function (data) {

    // if its a game, disconnect it
    socket.get('gameID', function (err, id) {
      if (id) {
        for (var cntrl in GAMES[id].controllers) {
          GAMES[id].controllers[cntrl].emit('gameClosed', {});
        }
        delete GAMES[id];
      }
    });

    // if its a controller, disconnect it
    socket.get('controllerID', function (err, id) {
      if (id) {
        socket.get('parentID', function (err, pid) {
          if (GAMES[pid]) {
            GAMES[pid].socket.emit('playerDisconnected', { player: id });
            delete GAMES[pid].controllers[id];
          }
        });
      }
    });
  });
});

