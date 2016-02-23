function CertMgr(opts) {
    this.opts = opts;
    
    if (typeof(this.opts.max) !== "number") {
        throw new Error("max should be a number");
    }
    
    this._store = [];
    this.length = 0;
    this.max = this.opts.max;
}

CertMgr.prototype.add = function (certInstance) {
    var ret = null;
    if (this._storeCount > this.max) {
        ret = this._store.shift();
        this.length--;
    }
    this._store.push(certInstance);
    this.length++;
    return ret;
}

CertMgr.prototype.shift = function () {
    return this._store.shift();
}

CertMgr.prototype.full = function () {
    return this.length >= this.max;
}

CertMgr.prototype.at = function (index) {
    return this._store[index];
}

module.exports = CertMgr;