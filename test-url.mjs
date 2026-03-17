import * as fs from 'fs';

async function test() {
    const url = 'https://api.focusnfe.com.br/arquivos/33651585000169_189961/202603/DANFEs/31260333651585000169550010000000201344949760.pdf';
    console.log('Fetching', url);
    try {
        const res = await fetch(url);
        console.log('Status:', res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        console.log('Length:', buf.length);
        console.log('First bytes:', buf.subarray(0, 50).toString('utf-8'));
        fs.writeFileSync('/tmp/test-danfe.pdf', buf);
        console.log('Saved to /tmp/test-danfe.pdf');
    } catch (e) {
        console.error(e);
    }
}
test();
