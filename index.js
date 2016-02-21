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
    new Cert({}).crunch(function (cert) {
        fs.writeFileSync("tmp/"+cert.opts.name+".pfx", cert.getRaw(), {encoding: "binary"});
        fs.writeFileSync("tmp/"+cert.opts.name+".cer", cert.getRawPublicOnly());
        res.render('index', {
            cert: cert.getRaw(),
            cn: cert.opts.name,
            ca: cert.getRawPublicOnly(),
            b64: cert.getBase64()
        });
    });
});

app.get('/dl/:cn', function (req, res) {
    res.sendFile(req.params.cn, {
        root: "tmp/",
        dotfiles: 'deny'
    }, function (err) {
        if (err) {
            res.status(err.status).end();
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
    proms.push(new Promise(function (res) {   
        new Cert({}).crunch(function (cert) {
            mgr.add(cert);
            console.log("adding "+cert.opts.name);
            fs.writeFileSync("tmp/"+cert.opts.name+".pfx", cert.getRaw(), {encoding: "binary"});
            fs.writeFileSync("tmp/"+cert.opts.name+".cer", cert.getRawPublicOnly());
            res();
        });
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
        new Cert({}).crunch(function (cert) {
            var old = mgr.add(cert);
            if (old) {
                console.log("cleaning up "+old.opts.name);
                del.sync("tmp/"+old.opts.name+".pfx");
                del.sync("tmp/"+old.opts.name+".cer");
            }
            console.log("adding "+cert.opts.name);
            fs.writeFileSync("tmp/"+cert.opts.name+".pfx", cert.getRaw(), {encoding: "binary"});
            fs.writeFileSync("tmp/"+cert.opts.name+".cer", cert.getRawPublicOnly());
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