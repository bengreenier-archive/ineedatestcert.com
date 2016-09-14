var express = require('express');
var ss = require('serve-static');
var swig = require('swig');
var Cert = require('ineedatestcert');
var Cache = require('node-cache');
var uuid = require('uuid');
var specificCache = new Cache({stdTTL: 100});
var app = express();

// This is where all the magic happens!
app.engine('html', swig.renderFile);

app.set('view engine', 'html');
app.set('views', __dirname + '/views');

// Swig will cache templates for you, but you can disable
// that and use Express's caching instead, if you like:
// To disable Swig's cache, do the following:
swig.setDefaults({ cache: false });

app.use(ss('public/', {
    setHeaders: function(res, path) {
        if (path.endsWith(".svg")) {
            res.setHeader('Content-Type', 'image/svg+xml');
        }
    }
}));

// used random cached data - fast
app.get('/', function (req, res) {
    new Cert({}).crunch(function (err, cert) {
        if (err) {
            console.error(err);
            res.status(500).end("Failed to generate cert");
        }
        
        var id = uuid.v4();
        specificCache.set(id, cert);
        res.render('index', {id: id, b64: cert.getBase64(), name: cert.opts.name});
    });
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
    try {
        new Cert(opts).crunch(function (err, cert) {
            if (err) {
                console.error(err);
                res.status(500).end("Failed to generate cert");
            }
            
            var id = uuid.v4();
            specificCache.set(id, cert);
            res.render('index', {id: id, b64: cert.getBase64(), name: cert.opts.name});
        });
    } catch (err) {
        if (err) {
            console.error(err);
            res.status(500).end("Failed to generate cert");
        }
    }
});

app.get("/raw/public/:id.cer", function (req, res) {
    var wrapper = getSpecificCert(req.params.id);
    if (wrapper.cert) {
        sendCertPublic(res, wrapper.cert);
    } else {
        res.status(404).end("no such cert");
    }
});
app.get("/raw/:id.pfx", function (req, res) {
    var wrapper = getSpecificCert(req.params.id);
    if (wrapper.cert) {
        sendCertPfx(res, wrapper.cert);
    } else {
        res.status(404).end("No such cert");
    }
});

var port = process.env.PORT || 3000;
app.listen(port, function () {
    console.log("listening on "+port);
});

function getSpecificCert(id) {
    return {id: id, cert: specificCache.get(id)};
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
