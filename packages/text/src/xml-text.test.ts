import { expect, test } from 'vitest';

import { extractText } from './extract.ts';
import { xmlText } from './xml-text.ts';

const SDN = `<?xml version="1.0" standalone="yes"?>
<sdnList xmlns="https://example.org/XML">
  <publshInformation>
    <Publish_Date>10/09/2026</Publish_Date>
  </publshInformation>
  <!-- a comment gives no text -->
  <sdnEntry>
    <uid>36</uid>
    <lastName>AEROCARIBBEAN AIRLINES</lastName>
    <programList><program>CUBA</program></programList>
  </sdnEntry>
  <sdnEntry>
    <uid>173</uid>
    <lastName>ANGLO-CARIBBEAN CO., LTD. &amp; SONS</lastName>
    <remarks><![CDATA[a <raw> remark]]></remarks>
    <empty/>
  </sdnEntry>
</sdnList>`;

test('each element that holds a value is one line, and each record starts with its name', () => {
  expect(xmlText(SDN)).toBe(
    [
      'sdnList',
      '  publshInformation',
      '    Publish_Date: 10/09/2026',
      '  sdnEntry',
      '    uid: 36',
      '    lastName: AEROCARIBBEAN AIRLINES',
      '    programList',
      '      program: CUBA',
      '  sdnEntry',
      '    uid: 173',
      '    lastName: ANGLO-CARIBBEAN CO., LTD. & SONS',
      '    remarks: a <raw> remark',
    ].join('\n'),
  );
});

test('a prefix of a name is dropped, and an attribute gives no text', () => {
  expect(xmlText('<a:root x="1"><a:item kind="b">One &#x41;&#66;</a:item></a:root>')).toBe(
    'root\n  item: One AB',
  );
});

test.each(['application/xml', 'text/xml', 'text/xml; charset=utf-8'])(
  'an answer of type %s gives its text as one page',
  async (mime) => {
    const { pages } = await extractText(new TextEncoder().encode(SDN), mime);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toContain('    uid: 36\n    lastName: AEROCARIBBEAN AIRLINES');
  },
);

test('the encoding that the declaration names decodes the bytes', async () => {
  const latin = Uint8Array.from(
    '<?xml version="1.0" encoding="ISO-8859-1"?><r><n>Café</n></r>',
    (c) => c.charCodeAt(0),
  );
  const { pages } = await extractText(latin, 'application/xml');
  expect(pages[0]).toBe('r\n  n: Café');
});
