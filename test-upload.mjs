import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

async function test() {
    const sb = createClient(
        'https://hjfevtxygjalxkryyeor.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhqZmV2dHh5Z2phbHhrcnl5ZW9yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDI0ODYzOCwiZXhwIjoyMDU5ODI0NjM4fQ.R9odqNwJNNyedJGdej7K0BTM0a2akLutrclHi2mV4Eo'
    );

    const url = 'https://api.focusnfe.com.br/arquivos/33651585000169_189961/202603/DANFEs/31260333651585000169550010000000201344949760.pdf';
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();

    console.log('ArrayBuffer byteLength:', arrayBuffer.byteLength);

    // Upload as ArrayBuffer
    const { data, error } = await sb.storage
        .from('notasFiscais')
        .upload('test_arraybuffer.pdf', arrayBuffer, { upsert: true, contentType: 'application/pdf' });

    console.log('Upload ArrayBuffer error:', error?.message);

    // Upload as Buffer
    const buffer = Buffer.from(arrayBuffer);
    const { data: d2, error: e2 } = await sb.storage
        .from('notasFiscais')
        .upload('test_buffer.pdf', buffer, { upsert: true, contentType: 'application/pdf' });

    console.log('Upload Buffer error:', e2?.message);

    console.log('Urls:');
    console.log(sb.storage.from('notasFiscais').getPublicUrl('test_arraybuffer.pdf').data.publicUrl);
    console.log(sb.storage.from('notasFiscais').getPublicUrl('test_buffer.pdf').data.publicUrl);
}

test();
