ineedatestcert.com
==================

> I generate test certificates as pfx/cer files.

because [ineedatestcert](https://github.com/bengreenier/ineedatestcert) needed a website.

# How

You can head over to [ineedatestcert.com](http://ineedatestcert.com) and see what's up.

# API

## /

renders a page with a random certificate, and provides download links.

## /new/:name/:org/:keysize

renders a page with a random certificate, generated with the given values.
that is, the cert `subject name` will be __name__, the `OU` will be __org__,
and the `sha2 keysize` used to create it will be __keysize__.

## /raw/:id.pfx

this is more of an internal endpoint..if you know a certs `id` this will serve
it as a pfx file that you can download.

## /raw/public/:id.cer

this is more of an internal endpoint..if you know a certs `id` this will serve
it's public bits as a cer file that you can download.

# License

MIT