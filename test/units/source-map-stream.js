import test from 'ava';
import SourceMapStream from '../../src/source-map-stream';


test.cb('should handle no input', (t) => {
  const testStream = new SourceMapStream();

  testStream.on('readable', function read() {
    if (this.read() !== null) t.fail();
  });

  testStream.on('end', () => {
    t.pass();
    t.end();
  });

  testStream.end();
});

// test.cb('should not modify input', (t) => {
//   const input = 'The quick brown fox jumps over the lazy dog.';
//   const testStream = new SourceMapStream();
//   let output = '';
//
//   testStream.on('readable', function read() {
//     let chunk = null;
//     while ((chunk = this.read()) !== null) {
//       output += chunk;
//     }
//   });
//
//   testStream.on('end', () => {
//     t.deepEqual(output, input);
//     t.end();
//   });
//
//   testStream.write(input);
//   testStream.end();
// });
