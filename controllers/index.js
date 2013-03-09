exports.init = function (app) {
  app.get('/',
    app.middleware.render('index/index')
  );

  app.get('/c',
    setUser,
    app.middleware.render('index/controller')
  );

  app.post('/saveUser',
    saveUser
  );
};

function setUser(req, res, next) {
  res.locals({
    user: req.session.user
  });
  next();
};

function saveUser(req, res, next) {
  req.session.user.name = req.body.name;
  res.send('ok');
};
