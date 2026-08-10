import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const SYSTEM = `You are the Fuel Governance analyst for e& Delivery & Operations (UAE).
You answer questions about employee mileage reimbursement using ONLY the dataset given in the user message.
Facts you must apply:
- Fleet mileage is 11 km per litre. Litres = km / 11. Payable AED = litres x 3.49 (Super 98, Aug 2026). Special 95 is AED 3.29/L.
- Jaseem is a back-office resource; he does not visit sites much, so low kilometres for him is expected and NOT a red flag.
- Duplicate km = the same employee logging the identical km value repeatedly (especially same day or many times).
- Sudden surge = a day or week where an employee's km is far above their own usual pattern (roughly 2x their average or more).
- Entries marked "review" have unreadable/implausible readings and should be flagged.
Answer in short, concrete sentences with numbers. Use markdown bullets and bold names. Never invent employees or trips.
If the data does not support an answer, say so plainly.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) throw new Error('Missing LOVABLE_API_KEY');
    const { messages, dataset } = await req.json();
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': key,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.6-flash',
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'system', content: `FUEL DATASET (JSON):\n${JSON.stringify(dataset).slice(0, 120_000)}` },
          ...messages.slice(-12).map((m: { role: string; content: string }) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content ?? '').slice(0, 4000),
          })),
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: text.slice(0, 500) }), {
        status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const json = await res.json();
    const reply = json?.choices?.[0]?.message?.content ?? '';
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
