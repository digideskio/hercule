import _ from 'lodash';
import duplexer from 'duplexer2';
import get from 'through2-get';
import regexpTokenizer from 'regexp-stream-tokenizer';

import ResolveStream from './resolve-stream';
import IndentStream from './indent-stream';
import SourceMapStream from './source-map-stream';
import { defaultTokenRegExp, defaultToken, defaultSeparator, WHITESPACE_GROUP } from './config';

/**
* Input stream: string
*
* Output stream: string
*/

const DEFAULT_OPTIONS = {
  input: 'link',
  output: 'content',
  source: 'input',
};

// The sourceFile should be relative to the sourcePath
export default function Transcluder(sourceFile, opt) {
  const options = _.merge({}, DEFAULT_OPTIONS, opt);
  const source = _.get(options, 'source');
  const linkMatch = _.get(options, 'linkMatch');
  const generatedFile = _.get(options, 'generatedFile');

  const sourcePaths = [];
  let sourceMap;

  function token(match) {
    return defaultToken(match, options);
  }

  function separator(match) {
    return defaultSeparator(match, options);
  }

  const tokenizerOptions = { leaveBehind: `${WHITESPACE_GROUP}`, token, separator };
  const linkRegExp = _.get(options, 'linkRegExp') || defaultTokenRegExp;
  const tokenizer = regexpTokenizer(tokenizerOptions, linkRegExp);
  const resolver = new ResolveStream({ linkRegExp: options.linkRegExp, linkMatch: options.linkMatch });
  const inflater = new InflateStream({ linkRegExp, linkMatch, source });
  const indenter = new IndentStream();
  const sourcemap = new SourceMapStream(generatedFile);
  const stringify = get('content');

  tokenizer
  .pipe(resolver)
  .pipe(indenter)
  .pipe(sourcemap)
  .pipe(stringify);

  const transcluder = duplexer(tokenizer, stringify);

  resolver.on('error', (err) => {
    transcluder.emit('error', err);
    resolver.end();
  });

  // TODO: can source be extracted from the sourcemap?
  resolver.on('source', (filepath) => {
    sourcePaths.push(filepath);
  });

  sourcemap.on('sourcemap', (generatedSourceMap) => {
    sourceMap = generatedSourceMap;
  });

  transcluder.on('end', () => {
    transcluder.emit('sources', sourcePaths);
    transcluder.emit('sourcemap', sourceMap);
  });

  return transcluder;
}
