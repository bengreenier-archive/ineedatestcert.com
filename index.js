var app = require('express')();
var ss = require('serve-static');
var swig = require('swig');
var Cert = require('ineedatestcert');
var Promise = require('promise');
var CertMgr = require('./cert-mgr');
var b64 = require('base64-js');
var fs = require('fs');
var del = require('del');

// This is where all the magic happens!
app.engine('html', swig.renderFile);

app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Swig will cache templates for you, but you can disable
// that and use Express's caching instead, if you like:
// To disable Swig's cache, do the following:
swig.setDefaults({ cache: false });

app.use(ss('public/'));

// used random cached data - fast
app.get('/', function (req, res) {
  res.render('index', getRandomCert());
});

// actually news up a cert - slower
app.get('/unique', function (req, res) {
    makeCert().then(function (cert) {
        res.render('index', {
            cn: cert.opts.name,
            b64: cert.getBase64()
        });
    }, function (err) {
        res.status(500).end();
    });
});

// TODO: obviously there's a collision bug with fs names
// with anything generated via this endpoint - going to ship
// with the bug for now, and fix later - this is an undocumented
// "api" anyway.
app.get('/new/:cn/:ou/:keysize', function (req, res) {
    var opts = {};
    if (typeof(req.params.cn) === "string") {
        opts.name = req.params.cn;
    }
    if (typeof(req.params.ou) === "string") {
        opts.org = req.params.ou;
    }
    if (typeof(req.params.keysize) === "string") {
        opts.b = new Number(req.params.keysize).valueOf();
    }
    
    makeCert(opts).then(function (cert) {
        res.render('index', {
            cn: cert.opts.name,
            b64: cert.getBase64()
        });
    }, function (err) {
        res.status(500).end();
    });
});

app.get('/dl/:cn', function (req, res) {
    res.sendFile(req.params.cn, {
        root: "tmp/",
        dotfiles: 'deny'
    }, function (err) {
        if (err) {
            res.status(500).end();
        }
    });
});

// generate the cert mgr
var mgr = new CertMgr({
    max: 20
});

// burn cpu as we startup to fill mgr
console.log("startup takes a bit - we're generating certs");
del.sync("tmp");
fs.mkdirSync("tmp/");

var proms = [];
for (var i = 0; i < mgr.max; i++) {
    proms.push(makeCert().then(function(cert) {
        mgr.add(cert);
        console.log("startup - generated "+cert.opts.name);
    }, function (err) {
        // for debug only - we don't care
        console.error("startup - ",err);
    }));
}

Promise.all(proms).then(function () {
    console.log("manager "+(mgr.full() ? "is": "is not")+" full with "+mgr.length+" certs");
    
    // start up
    app.listen(process.env.PORT || 3000, function () {
        console.log('Application Started on '+(process.env.PORT || 3000));
    });

    setInterval(function addNewCert() {
        // every 5 minutes we swap out the oldest cert
        makeCert().then(function (cert) {
            var nuking = mgr.shift();
            del.sync("tmp/"+nuking.opts.name+".pfx");
            del.sync("tmp/"+nuking.opts.name+".cer");
            console.log("removed "+nuking.opts.name);
            mgr.add(cert);
            console.log("added "+cert.opts.name);
        }, function (err) {
            // for debug - we don't actually care
            console.error(err);
        });
    }, 1000*60);
});

// helper to get data for the / endpoint
function getRandomCert() {
    var index = Math.floor(Math.random() * mgr.length);  
    return {
        cert: mgr.at(index).getRaw(),
        cn: mgr.at(index).opts.name,
        ca: mgr.at(index).getRawPublicOnly(),
        b64: mgr.at(index).getBase64()
    };
}

function makeCert(opts) {
    opts = opts || {};
    return new Promise(function (res, rej) {
        new Cert(opts).crunch(function (cert) {
            if (fs.existsSync(cert.opts.name+".pfx") || fs.existsSync(cert.opts.name+".cer")) {
                return rej(new Error("already exists on disk"));
            }
            try {
                fs.writeFileSync("tmp/"+cert.opts.name+".pfx", cert.getRaw(), {encoding: "binary"});
                fs.writeFileSync("tmp/"+cert.opts.name+".cer", cert.getRawPublicOnly());
                res(cert);
            } catch (ex) {
                return rej(ex);
            }
        });
    });
}