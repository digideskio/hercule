import _ from 'lodash';
import through2 from 'through2';
import duplexer from 'duplexer2';
import regexpTokenizer from 'regexp-stream-tokenizer';

import { parseTransclude, resolveReferences, resolveLink } from './resolve';
import TrimStream from './trim-stream';

import { defaultTokenRegExp, defaultToken, defaultSeparator, WHITESPACE_GROUP } from './config';

/**
* Input stream: object
* - link (string, required)
* - relativePath (string, required)
* - parents (array, required)
* - references (array, required)
*
* Output stream: object
* - chunk (string, required)
*
* Input and output properties can be altered by providing options
*/

export default function ResolveStream(sourceFile, opt) {
  const options = _.merge({}, opt);

  // Create nested duplex stream
  // TODO: rename this function for improved clarity
  function inflate(source, relativePath, references, parents, indent) {
    const resolverStream = new ResolveStream(source);
    const trimmerStream = new TrimStream();

    function token(match) {
      return _.merge(
        defaultToken(match, options, indent),
        {
          source,
          relativePath,
          references: [...references],
          parents: [source, ...parents],
        }
      );
    }

    function separator(match) {
      return defaultSeparator(match, { indent, source });
    }

    const tokenizerOptions = { leaveBehind: `${WHITESPACE_GROUP}`, token, separator };
    const linkRegExp = _.get(options, 'linkRegExp') || defaultTokenRegExp;
    const tokenizerStream = regexpTokenizer(tokenizerOptions, linkRegExp);

    trimmerStream.pipe(tokenizerStream).pipe(resolverStream);

    return duplexer({ objectMode: true }, trimmerStream, resolverStream);
  }

  /* eslint-disable consistent-return */
  function transform(chunk, encoding, cb) {
    const transclusionLink = _.get(chunk, 'link');
    const transclusionRelativePath = _.get(chunk, 'relativePath') || '';
    const parentRefs = _.get(chunk, 'references') || [];
    const parents = _.get(chunk, 'parents') || [];
    const indent = _.get(chunk, 'indent') || '';

    const self = this;

    function handleError(message, path, error) {
      self.push(chunk);
      if (!_.isUndefined(message)) self.emit('error', { message, path, error });
      return cb();
    }

    if (!transclusionLink) return handleError();

    //  Sourcemap
    const cursor = {
      line: _.get(chunk, 'line'),
      column: _.get(chunk, 'column') + chunk.content.indexOf(transclusionLink),
    };

    // Parses raw transclusion link: primary.link || fallback.link reference.placeholder:reference.link ...
    parseTransclude(transclusionLink, transclusionRelativePath, sourceFile, cursor, (parseErr, primary, fallback, parsedReferences) => {
      if (parseErr) return handleError('Link could not be parsed', transclusionLink, parseErr);

      // console.log('PRIMARY:');
      // console.log(primary);
      // console.log('FALLBACK:');
      // console.log(fallback);

      const references = _.uniq([...parsedReferences, ...parentRefs]);

      // References from parent files override primary links, then to fallback if provided and no matching references
      // const { link, relativePath } = resolveReferences(primary, fallback, parentRefs);
      const link = resolveReferences(primary, fallback, parentRefs);

      // console.log(link);
      // TODO: push extra chunk to document the whole way down?
      // Resolve link to readable stream
      resolveLink(link, (resolveErr, input, resolvedLink, resolvedRelativePath) => {
        // console.log('----');
        // console.log(resolvedSource);

        if (resolveErr) return handleError('Link could not be inflated', resolvedLink, resolveErr);
        if (_.includes(parents, resolvedLink)) return handleError('Circular dependency detected', resolvedLink);

        // TODO: need to consider source so that string can have source information.
        const inflater = inflate(resolvedLink, resolvedRelativePath, references, parents, indent);

        input.on('error', (inputErr) => {
          this.emit('error', _.merge({ message: 'Could not read file' }, inputErr));
          cb();
        });

        inflater.on('readable', function inputReadable() {
          let content;
          while ((content = this.read()) !== null) {
            self.push(content);
          }
        });

        inflater.on('error', (inflateErr) => {
          this.emit('error', inflateErr);
          cb();
        });

        inflater.on('end', () => cb());

        input.pipe(inflater);
      });
    });
  }

  return through2.obj(transform);
}
