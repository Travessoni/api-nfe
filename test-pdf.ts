import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);

    const supabase = app.get('FiscalSupabaseService') as any;
    const { data } = await supabase.supabase
        .from('fiscal_invoices')
        .select('*')
        .eq('status', 'AUTORIZADO')
        .not('focus_id', 'is', null)
        .limit(1);

    if (!data || data.length === 0) {
        console.log('No AUTHORIZED invoice found.');
        process.exit(1);
    }

    const invoice = data[0];
    console.log('Testing with invoice:', invoice.id, invoice.focus_id);

    try {
        const focusClient = app.get('FocusNFeClientService') as any;

        // Test the download to file
        const { body } = await focusClient.download(invoice.focus_id, 'pdf');

        const chunks = [];
        const reader = body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
        }
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const pdfBuffer = Buffer.alloc(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            pdfBuffer.set(chunk, offset);
            offset += chunk.length;
        }

        console.log('Buffer length:', pdfBuffer.length);
        console.log('First 50 bytes:', pdfBuffer.subarray(0, 50).toString('utf-8'));
        console.log('First 50 bytes hex:', pdfBuffer.subarray(0, 50).toString('hex'));
    } catch (e) {
        console.error(e);
    }

    await app.close();
    process.exit(0);
}

bootstrap();
