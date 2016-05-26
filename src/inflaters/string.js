import { Readable } from 'stream';

/*
* String transclusion is trigered by strings inside the transclusion link.
* Therefore, the source and cursor should reflect the location of the original string.
*
* Examples:
*   :[fallback example](foo.md || "bar")
*   :[reference example](foo.md bar:"bar")
*
**/
export default function inflate(content, source, line, column) {
  const stringStream = new Readable({ objectMode: true });

  console.log({ source, line, column });

  stringStream.push({ content, source, line, column });
  stringStream.push(null);
  return stringStream;
}
