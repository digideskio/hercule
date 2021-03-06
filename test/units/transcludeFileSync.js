import ava from 'ava'; // eslint-disable-line ava/use-test
import sinon from 'sinon';
global.childProcess = require('child_process');

import { transcludeFileSync } from '../../src/hercule';

const [major, minor] = process.versions.node.split('.');
const test = (major < 1 && minor < 12) ? ava.skip : ava;

test.before(() => {
  const stub = sinon.stub(global.childProcess, 'spawnSync');
  stub.withArgs('../bin/hercule', ['/index.md', '--reporter', 'json-err'])
    .returns({ stdout: 'The quick brown fox jumps over the lazy dog.\n', stderr: '' });

  stub.withArgs('../bin/hercule', ['/index.md', '--reporter', 'json-err', '--relativePath', 'test'])
    .returns({ stdout: 'Jackdaws love my big sphinx of quartz.\n', stderr: '' });

  stub.withArgs('../bin/hercule', ['/error.md', '--reporter', 'json-err'])
    .returns({ stdout: '', stderr: 'ERROR' });
});

test.after(() => {
  global.childProcess.spawnSync.restore();
});

test('should transclude with only required arguments', (t) => {
  const expected = 'The quick brown fox jumps over the lazy dog.\n';
  const output = transcludeFileSync('/index.md');
  t.deepEqual(output, expected);
});

test('should transclude with optional relativePath argument', (t) => {
  const expected = 'Jackdaws love my big sphinx of quartz.\n';
  const output = transcludeFileSync('/index.md', { relativePath: 'test' });
  t.deepEqual(output, expected);
});

test('should throw error with invalid link', (t) => {
  try {
    transcludeFileSync('/error.md');
    t.fail();
  } catch (ex) {
    t.deepEqual(ex.message, 'Could not transclude file');
  }
});
