import test from 'node:test';
import assert from 'node:assert/strict';
import {safeGoogleAvatar} from '../../src/features/auth/services/googleAvatar.js';

test('Google avatar accepts only HTTPS images on googleusercontent.com',()=>{
  assert.equal(safeGoogleAvatar('https://lh3.googleusercontent.com/a/photo.jpg'), 'https://lh3.googleusercontent.com/a/photo.jpg');
  assert.equal(safeGoogleAvatar('http://lh3.googleusercontent.com/a/photo.jpg'), '');
  assert.equal(safeGoogleAvatar('https://googleusercontent.com.evil.test/img.png'), '');
  assert.equal(safeGoogleAvatar('https://user:pass@lh3.googleusercontent.com/img.png'), '');
  assert.equal(safeGoogleAvatar('javascript:alert(1)'), '');
  assert.equal(safeGoogleAvatar(undefined), '');
  assert.equal(safeGoogleAvatar('https://lh3.googleusercontent.com/'+'x'.repeat(2050)), '');
});
