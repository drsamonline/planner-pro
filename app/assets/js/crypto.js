/* Planner Pro — encrypted backups.
   AES-GCM 256 with a PBKDF2-derived key, all in the browser via WebCrypto.
   The envelope is plain JSON so a human can see what the file is, but the
   payload is unreadable without the passphrase. There is no recovery: lose the
   passphrase, lose the file. That is the point. */
(function (global) {
  'use strict';

  var FORMAT = 'planner-pro-encrypted';
  var ITERATIONS = 150000;

  function b64(buf) {
    var bytes = new Uint8Array(buf);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return global.btoa(out);
  }

  function unb64(text) {
    var raw = global.atob(text);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function supported() {
    return !!(global.crypto && global.crypto.subtle && global.crypto.getRandomValues);
  }

  async function deriveKey(passphrase, salt) {
    var material = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: ITERATIONS, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /** Encrypt any JSON-able value into a portable envelope object. */
  async function encrypt(value, passphrase) {
    if (!supported()) throw new Error('This browser has no WebCrypto.');
    if (!passphrase || passphrase.length < 6) throw new Error('Use a passphrase of at least 6 characters.');

    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var key = await deriveKey(passphrase, salt);
    var plain = new TextEncoder().encode(JSON.stringify(value));
    var cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, plain);

    return {
      format: FORMAT,
      version: 1,
      createdAt: new Date().toISOString(),
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: b64(salt) },
      cipher: { name: 'AES-GCM', iv: b64(iv) },
      data: b64(cipher)
    };
  }

  /** Returns the decrypted value, or throws with a human message. */
  async function decrypt(envelope, passphrase) {
    if (!supported()) throw new Error('This browser has no WebCrypto.');
    if (!isEnvelope(envelope)) throw new Error('That is not a Planner Pro encrypted backup.');
    if (!passphrase) throw new Error('Enter the passphrase for this backup.');

    var key = await deriveKey(passphrase, unb64(envelope.kdf.salt));
    try {
      var plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: unb64(envelope.cipher.iv) }, key, unb64(envelope.data)
      );
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
      throw new Error('Wrong passphrase, or the file is damaged.');
    }
  }

  function isEnvelope(value) {
    var obj = value;
    if (typeof value === 'string') {
      try { obj = JSON.parse(value); } catch (e) { return false; }
    }
    return !!(obj && obj.format === FORMAT && obj.kdf && obj.cipher && obj.data);
  }

  global.PlannerCrypto = {
    supported: supported, encrypt: encrypt, decrypt: decrypt,
    isEnvelope: isEnvelope, FORMAT: FORMAT, ITERATIONS: ITERATIONS
  };
})(window);
