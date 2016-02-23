var express = require('express');
var ss = require('serve-static');
var swig = require('swig');
var Cert = require('ineedatestcert');
var Promise = require('promise');
var Cache = require('node-cache');
var uuid = require('uuid');

var app = express();

// we keep stuff in mem
var specificCache = new Cache({stdTTL: 60*10, checkperiod: 60*5, useClones: false});
var randomCache = new Cache({stdTTL: 60*2, useClones: false});

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
    var wrapper = getRandomCert();
    res.render('index', {id: wrapper.id, b64: wrapper.cert.getBase64(), name: wrapper.cert.opts.name});
});
app.get('/new/:name/:org/:keysize', function (req, res) {
    var opts = {};
    if (typeof(req.params.name) === "string") {
        opts.name = req.params.name;
    }
    if (typeof(req.params.org) === "string") {
        opts.org = req.params.org;
    }
    if (typeof(req.params.keysize) === "string") {
        opts.b = new Number(req.params.keysize).valueOf();
    }
    makeCert(opts).then(function (wrapper) {
        res.render('index', {id: wrapper.id, b64: wrapper.cert.getBase64(), name: wrapper.cert.opts.name});
    }, function (err) {
        console.error("/new error: ",err);
        res.status(500).end();
    });
});


app.get("/raw/public/:id.cer", function (req, res) {
    var wrapper = getSpecificCert(req.params.id);
    if (wrapper.cert) {
        sendCertPublic(res, wrapper.cert);
    } else {
        res.status(500).end();
    }
});
app.get("/raw/:id.pfx", function (req, res) {
    var wrapper = getSpecificCert(req.params.id);
    if (wrapper.cert) {
        sendCertPfx(res, wrapper.cert);
    } else {
        res.status(500).end();
    }
});

// setup inital certs
console.log("generating certs");
var proms = [];
for (var i = 0 ; i < 20 ; i++) {
    proms.push(makeCert());
}

Promise.all(proms).then(function () {
    console.log("initial certs generated");
    
    // this makes a new cert every 10 minutes
    setInterval(function cycle() {
        makeCert();
    },1000*60*10);
    
    app.listen(process.env.PORT || 3000, function () {
        console.log("up on "+(process.env.PORT || 3000));
    });
    
    // every minute we log an update of counts
    setInterval(function logUpdate() {
        console.log("specific certs:"+specificCache.keys().length+" - random certs:"+randomCache.keys().length);
    }, 1000*60);
}, function (err) {
    console.error("error: ", err);
});

function getSpecificCert(id) {
    if (id[0] === "S") {
        return {id: id, cert: specificCache.get(id)};
    } else {
        return {id: id, cert: randomCache.get(id)};
    }
}

function getRandomCert() {
    var rKeys = randomCache.keys();
    var id = rKeys[Math.floor(Math.random()*rKeys.length)];
    return {id: id, cert: randomCache.get(id)};
}

function makeCert(opts) {
    opts = opts || {};
    return new Promise(function (res, rej) {
        new Cert(opts).crunch(function (cert) {
            var id = uuid.v4();
            if (opts.name) id = "S"+id;
            else id = "R"+id;
            if (id[0] === "S") {
                specificCache.set(id, cert);
            } else {
                randomCache.set(id, cert);
            }
            return res({
                id: id,
                cert: cert
            });
        });
    });
}

function sendCertPfx(res, cert) {
    var bits = cert.getRaw();
    res.setHeader('Content-Type', 'application/x-pkcs12');
    res.setHeader('Content-Length', Buffer.byteLength(bits));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).end(bits);
}

function sendCertPublic(res, cert) {
    var bits = cert.getRawPublicOnly();
    res.setHeader('Content-Type', 'application/pkix-cert');
    res.setHeader('Content-Length', Buffer.byteLength(bits));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).end(bits);
}

// TODO: if we had support for the pem keys, we'd use this
// function sendCertPem(res, cert) {
//     var bits = cert.getRawPublicOnly();
//     res.setHeader('Content-Type', 'application/x-pem-file');
//     res.setHeader('Content-Length', Buffer.byteLength(bits));
//     res.setHeader('X-Content-Type-Options', 'nosniff');
//     res.status(200).end(bits);
// }