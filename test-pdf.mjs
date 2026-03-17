import { createClient } from '@supabase/supabase-js';

async function test() {
    const sb = createClient(
        'https://hjfevtxygjalxkryyeor.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqZmV2dHh5Z2phbHhrcnl5ZW9yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI0ODYzOCwiZXhwIjoyMDU5ODI0NjM4fQ.R9odqNwJNNyedJGdej7K0BTM0a2akLutrclHi2mV4Eo'
    );

    const { data } = await sb.from('fiscal_invoices').select('focus_id, status, empresa_id').eq('status', 'AUTORIZADO').neq('focus_id', null).limit(1);
    if (!data || data.length === 0) return console.log('No nfe');
    const invoice = data[0];
    console.log('Using focus_id:', invoice.focus_id);

    const { data: empData } = await sb.from('empresas').select('tokenProducao').eq('id', invoice.empresa_id).single();
    const TOKEN = empData ? empData.tokenProducao : '5q2IsfkLrHzBTkGoAGYZnPr06dBNa5FH';
    console.log('Token len:', TOKEN.length);

    const auth = Buffer.from(TOKEN + ':').toString('base64');
    let res = await fetch('https://api.focusnfe.com.br/v2/nfe/' + encodeURIComponent(invoice.focus_id) + '.pdf', {
        method: 'GET',
        headers: { Authorization: `Basic ${auth}` },
        redirect: 'manual'
    });

    console.log('Focus resp status:', res.status, res.headers.get('location'));

    if (res.status >= 300 && res.status < 400 && res.headers.has('location')) {
        const redirectUrl = res.headers.get('location');
        console.log('Redirecting to:', redirectUrl);
        res = await fetch(redirectUrl, { method: 'GET' });
        console.log('S3 resp status:', res.status);

        // Test the arrayBuffer reading explicitly
        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        console.log('Buffer result length:', buf.length);
        console.log('Preview string (first 100):', buf.subarray(0, 100).toString('utf-8'));
        console.log('Preview hex (first 100):', buf.subarray(0, 100).toString('hex'));
    }
}

test();
