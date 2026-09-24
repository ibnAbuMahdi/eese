import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:         '#080F1C',
  surface:    '#0D1A2D',
  surfaceAlt: '#132033',
  border:     '#1C2E47',
  amber:      '#F59E0B',
  amberGlow:  'rgba(245,158,11,0.12)',
  teal:       '#14B8A6',
  tealGlow:   'rgba(20,184,166,0.12)',
  red:        '#F87171',
  text:       '#F1F5F9',
  muted:      '#94A3B8',
  faint:      '#2E4060',
};

// ─── Scenario data ──────────────────────────────────────────────────────────────
const BASE = {
  cash: 185000, weeklyRevenue: 68000, weeklyExpenses: 82000,
  riderSatisfaction: 72, fulfillmentRate: 87,
  customerBase: 38, customerSatisfaction: 74,
  supplierTrust: 65, competitorThreat: 42,
  familyPressure: 48, brandRecognition: 45,
};

const CASH_HIST  = [{ w:'Wk 1',v:212 },{ w:'Wk 2',v:198 },{ w:'Wk 3',v:185 }];
const FILL_HIST  = [{ w:'W1',v:94 },{ w:'W2',v:90 },{ w:'W3',v:87 }];

const S_OPTS = [
  { id:'A', text:'Focus only on loyal customers — premium reliable service during the disruption',
    d:{ customerSatisfaction:12, brandRecognition:6, familyPressure:-3 } },
  { id:'B', text:'Offer a rain discount — maintain order volume at a lower margin this week',
    d:{ weeklyRevenue:-9000, customerBase:2, competitorThreat:-4 } },
  { id:'C', text:'Use the disruption to register the business formally with CAC',
    d:{ cash:-6500, supplierTrust:8, brandRecognition:4 } },
  { id:'D', text:'Push through all orders regardless — riders work in the rain',
    d:{ riderSatisfaction:-14, fulfillmentRate:-12, customerSatisfaction:-8 } },
];

const O_OPTS = [
  { id:'A', text:'Give riders a small rain allowance from cash reserves',
    d:{ cash:-5000, riderSatisfaction:10 } },
  { id:'B', text:'No additional pay — they accepted commission terms',
    d:{ riderSatisfaction:-8 } },
];

const CONF = ['Very confident','Fairly confident','Uncertain but committed','Guessing'];

const INTEL_ROWS = [
  ['Est. orders / week','37','51'],
  ['Delivery zones','2','4'],
  ['Price per delivery','₦800','₦650'],
  ['Customer rating','4.1 / 5','3.8 / 5'],
  ['Rider count','2','6 (est.)'],
];

// ─── API & Scenario Fallbacks ───────────────────────────────────────────────────
const DEFAULT_BRIEF = `Three days of relentless downpours have turned Ibrahim Taiwo Road into a muddy canal and left residential stretches of Nassarawa GRA and Bompai waterlogged. In Sabon Gari market, traders huddle under dripping tarpaulins, anxious to dispatch dry goods before damp sets in. Your riders, Ibrahim and Yusuf, are sheltering under a filling station canopy with soaked boots, while six customer WhatsApp pings light up your screen demanding midday delivery updates. With ₦185,000 in the bank and Hassan's loan repayment ticking closer at month six, every cancelled order opens the door wider for Kwik. The rain is falling hard, and you must decide whether to protect your margins, your customers, or your exhausted riders.`;

function getConsequenceFallback(stratId, opId, nextState) {
  const stratMap = {
    A: "You made the calculated decision to protect Zumunta's service reputation, focusing exclusively on your 38 loyal customers across Nassarawa GRA and Bompai.",
    B: "You rolled out an emergency rain discount to defend your order volume against Kwik, accepting shaved delivery margins to keep Sabon Gari merchants moving goods.",
    C: "You directed Aminu's focus toward filing for formal CAC business registration, laying the operational groundwork for institutional bank accounts and contracts.",
    D: "You ordered Ibrahim and Yusuf to brave the flooded avenues and fulfill every pending ticket, refusing to surrender a single delivery to Kwik.",
  };

  const opMap = {
    A: "Paying riders a ₦5,000 weather allowance helped maintain morale despite water-splashed engines and soaked uniforms.",
    B: "Enforcing commission-only compensation conserved precious cash, though Yusuf arrived back at Sabon Gari visibly discontented.",
  };

  return `${stratMap[stratId] || ''} ${opMap[opId] || ''} By Friday evening, your cash reserves stand at ₦${nextState.cash.toLocaleString()} with fulfillment at ${nextState.fulfillmentRate}%. Customer satisfaction is ${nextState.customerSatisfaction}/100, while rider satisfaction registers ${nextState.riderSatisfaction}/100. As Sunday approaches, your brother Hassan sends a voice note asking for a brief progress review on the loan runway.`;
}

async function gemini(prompt) {
  const apiKey = typeof window !== 'undefined'
    ? (localStorage.getItem('GEMINI_API_KEY') || localStorage.getItem('GOOGLE_API_KEY') || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY))
    : null;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      })
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (err) {
    console.warn('Gemini API call failed, using simulation fallback:', err);
    return null;
  }
}


// ─── Shared sub-components ──────────────────────────────────────────────────────
function Gauge({ label, value, invert }) {
  const danger = invert ? value > 70 : value < 40;
  const warn   = invert ? value > 45 : value < 60;
  const color  = danger ? T.red : warn ? T.amber : T.teal;
  return (
    <div style={{ marginBottom:9 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:T.muted }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:600, color:T.text }}>{value}/100</span>
      </div>
      <div style={{ background:T.faint, borderRadius:3, height:5 }}>
        <div style={{ width:`${value}%`, background:color, height:'100%', borderRadius:3, transition:'width 0.9s ease' }} />
      </div>
    </div>
  );
}

function Opt({ opt, selected, onSelect }) {
  const on = selected === opt.id;
  return (
    <button onClick={() => onSelect(opt.id)} style={{
      display:'flex', alignItems:'flex-start', gap:10, width:'100%',
      textAlign:'left', padding:'11px 14px', marginBottom:7,
      background: on ? T.amberGlow : T.surfaceAlt,
      border:`1px solid ${on ? T.amber : T.border}`,
      borderRadius:8, cursor:'pointer', transition:'all 0.2s',
    }}>
      <span style={{
        flexShrink:0, width:18, height:18, borderRadius:'50%', marginTop:1,
        border:`2px solid ${on ? T.amber : T.faint}`,
        background: on ? T.amber : 'transparent', display:'inline-block',
      }} />
      <span style={{ fontSize:13, color: on ? T.text : T.muted, lineHeight:1.5 }}>
        <strong style={{ color: on ? T.amber : T.faint }}>{opt.id}. </strong>
        {opt.text}
      </span>
    </button>
  );
}

function Spinner({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, color:T.muted, fontSize:13, padding:'8px 0' }}>
      <div style={{
        width:18, height:18, border:`2px solid ${T.border}`,
        borderTop:`2px solid ${T.amber}`, borderRadius:'50%',
        animation:'spin 0.9s linear infinite', flexShrink:0,
      }} />
      {label}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Tag({ text, color }) {
  return (
    <div style={{
      display:'inline-block', background:`${color}18`,
      border:`1px solid ${color}`, borderRadius:12,
      padding:'3px 12px', fontSize:10, color, letterSpacing:'0.06em', fontWeight:600,
    }}>{text}</div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────
export default function ProjecteDemo() {
  const [phase, setPhase]           = useState('hero');
  const [brief, setBrief]           = useState('');
  const [consequence, setConsequence] = useState('');
  const [intelOpen, setIntelOpen]   = useState(false);
  const [strat, setStrat]           = useState(null);
  const [op, setOp]                 = useState(null);
  const [conf, setConf]             = useState(null);
  const [ws, setWs]                 = useState(BASE);
  const [updated, setUpdated]       = useState(null);
  const [cashData, setCashData]     = useState(CASH_HIST);
  const [fillData, setFillData]     = useState(FILL_HIST);
  const [err, setErr]               = useState('');
  const [storyOpen, setStoryOpen]   = useState(false);
  const [bioOpen, setBioOpen]       = useState(false);

  const startDemo = async () => {
    setPhase('briefing'); setErr('');
    try {
      const text = await gemini(
`You are the narrator of Zumunta Logistics — an entrepreneurship simulation set in Kano, Nigeria.
The student plays Aminu, 24, a BUK Business Administration graduate running a last-mile delivery business between Sabon Gari market and Nassarawa GRA.

Business state — Week 3 of 8:
- Cash: ₦185,000 (burning ₦14,000/week — about 13 weeks of runway)
- Fulfillment rate: 87%, declining from 94% in week one
- 38 regular customers, satisfaction 74/100
- Rider satisfaction: 72/100 (two okada riders on commission)
- Kwik (funded competitor): threat level 42/100 and rising

This week's event: Three days of heavy rainfall across Kano. Roads in Nassarawa GRA and parts of Bompai are waterlogged. Riders are struggling. Several customers have already sent WhatsApp messages asking where their orders are.

Write a situation brief of exactly 130 words in second person. Ground it specifically in Kano — name a road, reference the market, the neighbourhood. End with exactly one sentence framing this week's decision pressure. No bullet points.`
      );
      setBrief(text || DEFAULT_BRIEF);
      setPhase('ready');
    } catch {
      setBrief(DEFAULT_BRIEF);
      setPhase('ready');
    }
  };

  const submit = async () => {
    if (!strat || !op || !conf) return;
    setPhase('submitting'); setErr('');

    const sOpt = S_OPTS.find(o => o.id === strat);
    const oOpt = O_OPTS.find(o => o.id === op);
    const next = { ...ws };

    for (const [k,v] of Object.entries(sOpt.d)) { if (k in next) next[k] += v; }
    for (const [k,v] of Object.entries(oOpt.d)) { if (k in next) next[k] += v; }

    // Cascade
    if (next.fulfillmentRate < 75) next.customerSatisfaction = Math.max(0, next.customerSatisfaction - 5);
    next.cash += (next.weeklyRevenue - next.weeklyExpenses);

    // Clamp 0–100 scores
    ['riderSatisfaction','fulfillmentRate','customerSatisfaction','supplierTrust',
     'competitorThreat','familyPressure','brandRecognition'].forEach(k => {
      next[k] = Math.max(0, Math.min(100, next[k]));
    });

    setUpdated(next);
    setCashData([...CASH_HIST, { w:'Wk 4', v: Math.round(next.cash/1000) }]);
    setFillData([...FILL_HIST, { w:'W4',   v: next.fulfillmentRate }]);

    try {
      const text = await gemini(
`You are the narrator of Zumunta Logistics — a business simulation in Kano, Nigeria.
Aminu made these decisions during the Kano rainfall disruption:
Strategic: "${sOpt.text}"
Rider management: "${oOpt.text}"

Resulting business state:
- Cash: ₦${next.cash.toLocaleString()}
- Fulfillment rate: ${next.fulfillmentRate}%
- Customer satisfaction: ${next.customerSatisfaction}/100
- Rider satisfaction: ${next.riderSatisfaction}/100

Write a 110-word consequence narrative in second person. Be specific — name numbers, places, names. Show what happened this week as a direct result of this choice. End with exactly one sentence that introduces an unresolved tension heading into next week. No bullet points.`
      );
      setConsequence(text || getConsequenceFallback(strat, op, next));
      setPhase('result');
    } catch {
      setConsequence(getConsequenceFallback(strat, op, next));
      setPhase('result');
    }
  };

  const canSubmit = strat && op && conf;
  const live = updated || ws;
  const isResult = phase === 'result';

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background:T.bg, color:T.text, fontFamily:'system-ui,-apple-system,sans-serif', minHeight:'100vh' }}>
      {/* ── CREATOR BIO (Collapsible Top Bar) ── */}
      <header style={{
        background: bioOpen ? T.surface : T.surfaceAlt,
        borderBottom: `1px solid ${bioOpen ? T.amber : T.border}`,
        transition: 'all 0.25s ease',
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto', padding: '10px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%',
              background: T.amberGlow, border: `1px solid ${T.amber}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: T.amber, fontWeight: 800, flexShrink: 0,
            }}>
              RM
            </span>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.4 }}>
              <span style={{ fontWeight: 700 }}>Ruhullahi Muhammad</span>
              <span style={{ color: T.muted, marginLeft: 8, fontSize: 12 }}>
                PhD Student in Electronics, BUK · Creator of EESE
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag text="AI: GEMINI 2.0 FLASH" color={T.teal} />
            <button
              onClick={() => {
                const existing = localStorage.getItem('GEMINI_API_KEY') || '';
                const key = prompt('Enter your Google Gemini API Key (stored in browser localStorage):', existing);
                if (key !== null) {
                  localStorage.setItem('GEMINI_API_KEY', key.trim());
                  alert(key.trim() ? 'Gemini API Key saved!' : 'Gemini API Key cleared.');
                }
              }}
              style={{
                background: 'transparent',
                border: `1px solid ${T.border}`,
                borderRadius: 6, padding: '5px 10px',
                color: T.muted, fontSize: 11, cursor: 'pointer',
              }}
              title="Click to set or update Gemini API Key"
            >
              🔑 Set Gemini Key
            </button>
            <button
              onClick={() => setBioOpen(o => !o)}
              style={{
                background: bioOpen ? T.amberGlow : 'transparent',
                border: `1px solid ${bioOpen ? T.amber : T.border}`,
                borderRadius: 6, padding: '5px 12px',
                color: bioOpen ? T.amber : T.muted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <span>{bioOpen ? 'Hide Creator Bio' : 'About Creator'}</span>
              <span style={{
                fontSize: 10,
                transform: bioOpen ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s ease',
                display: 'inline-block',
              }}>▼</span>
            </button>
          </div>
        </div>

        {bioOpen && (
          <div style={{
            maxWidth: 1120, margin: '0 auto', padding: '16px 24px 20px',
            borderTop: `1px solid ${T.border}`,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16, alignItems: 'center',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Ruhullahi Muhammad</span>
                  <Tag text="CREATOR" color={T.amber} />
                </div>
                <div style={{ fontSize: 13, color: T.teal, fontWeight: 600, marginBottom: 8 }}>
                  PhD Student in Electronics, Bayero University Kano (BUK)
                </div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                  Creator & researcher behind EESE (Projecte). Leading applied simulations and contextualized entrepreneurship education design tailored to Nigerian university ecosystems.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Tag text="Cofounder atenda.ng" color={T.amber} />
                  <Tag text="Cofounder stika.ng" color={T.amber} />
                  <Tag text="Author EEP Summary" color={T.teal} />
                </div>
                <div style={{ fontSize: 12, color: T.muted }}>
                  Contact:{' '}
                  <a
                    href="mailto:ruhullah@atenda.ng"
                    style={{ color: T.amber, textDecoration: 'none', fontWeight: 600 }}
                  >
                    ruhullah@atenda.ng
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section style={{ padding:'80px 24px 64px', textAlign:'center', borderBottom:`1px solid ${T.border}`, position:'relative', overflow:'hidden' }}>
        <div style={{
          position:'absolute', inset:0,
          backgroundImage:`linear-gradient(${T.faint}55 1px,transparent 1px),linear-gradient(90deg,${T.faint}55 1px,transparent 1px)`,
          backgroundSize:'44px 44px', opacity:0.35, pointerEvents:'none',
        }} />
        <div style={{ position:'relative', zIndex:1, maxWidth:700, margin:'0 auto' }}>
          <Tag text="BETA — BUK PILOT 2026" color={T.amber} />
          <h1 style={{
            fontSize:'clamp(52px,9vw,88px)', fontWeight:900,
            letterSpacing:'-0.04em', lineHeight:1, margin:'20px 0 14px',
            background:`linear-gradient(140deg,${T.text} 55%,${T.amber})`,
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text',
          }}>
            Projecte
          </h1>
          <p style={{ fontSize:18, color:T.muted, lineHeight:1.65, marginBottom:44, maxWidth:540, margin:'0 auto 40px' }}>
            AI-enhanced entrepreneurship simulations for Nigerian universities.
            Students run real businesses, make real decisions, and learn from real consequences.
          </p>

          <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap', marginBottom:48 }}>
            {[['4','Scenarios'],['8','Rounds per sim'],['12+','Behavioural signals']].map(([n,l]) => (
              <div key={l} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:'16px 22px', minWidth:110 }}>
                <div style={{ fontSize:34, fontWeight:800, color:T.amber }}>{n}</div>
                <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>

          {phase === 'hero' && (
            <button onClick={startDemo} style={{
              background:T.amber, color:'#06090F', border:'none',
              borderRadius:10, padding:'14px 34px', fontSize:16,
              fontWeight:800, cursor:'pointer', letterSpacing:'-0.01em',
            }}>
              Launch live simulation demo →
            </button>
          )}
          {phase === 'briefing' && <Spinner label="AI narrator generating situation brief…" />}
          {err && <p style={{ color:T.red, marginTop:14, fontSize:13 }}>{err}</p>}
        </div>
      </section>

      {/* ── SIMULATION SECTION ── */}
      {phase !== 'hero' && phase !== 'briefing' && (
        <section style={{ padding:'48px 24px', maxWidth:1120, margin:'0 auto' }}>

          {/* ── SCENARIO BACKGROUND (collapsible) ── */}
          <div style={{ marginBottom:28 }}>
            <button
              onClick={() => setStoryOpen(s => !s)}
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                width:'100%', padding:'14px 20px',
                background: storyOpen ? T.surface : T.surfaceAlt,
                border:`1px solid ${storyOpen ? T.amber : T.border}`,
                borderRadius: storyOpen ? '12px 12px 0 0' : 12,
                cursor:'pointer', transition:'all 0.2s',
              }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:16 }}>📖</span>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:13, fontWeight:700, color: storyOpen ? T.amber : T.text }}>
                    Scenario Background
                  </div>
                  <div style={{ fontSize:11, color:T.muted, marginTop:1 }}>
                    Who is Aminu? How did Zumunta start? What happened before this round?
                  </div>
                </div>
              </div>
              <span style={{
                color:T.muted, fontSize:12, fontWeight:700,
                transform: storyOpen ? 'rotate(180deg)' : 'rotate(0)',
                transition:'transform 0.3s', display:'inline-block',
              }}>▼</span>
            </button>

            {storyOpen && (
              <div style={{
                background:T.surface,
                border:`1px solid ${T.amber}`,
                borderTop:'none',
                borderRadius:'0 0 12px 12px',
                padding:24,
              }}>

                {/* Row 1 — Protagonist + Business */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16, marginBottom:20 }}>

                  {/* Protagonist */}
                  <div style={{ background:T.surfaceAlt, borderRadius:10, padding:18 }}>
                    <div style={{ fontSize:10, color:T.amber, letterSpacing:'0.09em', marginBottom:10 }}>
                      THE PROTAGONIST
                    </div>
                    <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>Aminu, 24 — Kano</div>
                    <div style={{ fontSize:12, color:T.muted, lineHeight:1.7 }}>
                      BUK Business Administration graduate (2024). Youngest of three brothers. Could not find formal employment after graduation and decided to create his own path rather than wait.
                    </div>
                    <div style={{ marginTop:12, padding:'10px 12px', background:T.amberGlow, borderRadius:8, fontSize:12, color:T.amber, lineHeight:1.6 }}>
                      💡 His older brother Hassan gave him a <strong>₦300,000 family loan</strong> with a <strong>12-month deadline</strong>. Aminu is now at month 6. Hassan calls every two weeks.
                    </div>
                  </div>

                  {/* Business */}
                  <div style={{ background:T.surfaceAlt, borderRadius:10, padding:18 }}>
                    <div style={{ fontSize:10, color:T.amber, letterSpacing:'0.09em', marginBottom:10 }}>
                      THE BUSINESS
                    </div>
                    <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>Zumunta Logistics</div>
                    <div style={{ fontSize:12, color:T.muted, lineHeight:1.7 }}>
                      Last-mile delivery between Sabon Gari market and residential areas in Nassarawa GRA and Bompai. Orders come in via WhatsApp and phone calls. Two okada riders — Ibrahim (experienced, 3 years on the road) and Yusuf (younger, eager but less reliable) — both on commission.
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:12 }}>
                      {[
                        ['Started','6 months ago'],
                        ['Starting cash','₦300,000'],
                        ['Current cash','₦185,000'],
                        ['Spent so far','₦115,000'],
                      ].map(([k,v]) => (
                        <div key={k} style={{ background:T.bg, borderRadius:6, padding:'7px 10px' }}>
                          <div style={{ fontSize:10, color:T.muted }}>{k}</div>
                          <div style={{ fontSize:12, fontWeight:700, color:T.text }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 2 — Story so far */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:10, color:T.amber, letterSpacing:'0.09em', marginBottom:12 }}>
                    THE STORY SO FAR — WEEKS 1 &amp; 2
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:12 }}>
                    {[
                      {
                        week:'Week 1',
                        title:'Fuel shock',
                        body:`NNPC announced a fuel price adjustment. Aminu's weekly expenses jumped ₦8,000 overnight — a cost he hadn't budgeted for. His first real decision: absorb it, raise delivery prices, or cut unprofitable routes? The choice he made is already baked into the current cash position you see on the dashboard.`,
                        impact:'Weekly expenses: ₦74k → ₦82k',
                      },
                      {
                        week:'Week 2',
                        title:'Kwik arrives',
                        body:`A Lagos-backed tech startup called Kwik formally launched in Nassarawa GRA with promotional pricing of ₦650 per delivery — ₦150 cheaper than Zumunta's rate. Three of Aminu's most loyal customers tried their app. Malam Sule (his main Sabon Gari supplier) heard rumours and started asking questions about cash position.`,
                        impact:'Competitor threat: 20 → 42/100',
                      },
                    ].map(e => (
                      <div key={e.week} style={{
                        background:T.bg, borderRadius:10, padding:16,
                        borderLeft:`3px solid ${T.amber}`,
                      }}>
                        <div style={{ display:'flex', gap:10, alignItems:'baseline', marginBottom:8 }}>
                          <Tag text={e.week} color={T.amber} />
                          <span style={{ fontSize:13, fontWeight:700 }}>{e.title}</span>
                        </div>
                        <p style={{ fontSize:12, color:T.muted, lineHeight:1.7, margin:'0 0 10px' }}>
                          {e.body}
                        </p>
                        <div style={{ fontSize:11, color:T.amber }}>
                          📊 Result → {e.impact}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 3 — Key characters */}
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:10, color:T.amber, letterSpacing:'0.09em', marginBottom:12 }}>
                    KEY CHARACTERS — WHO YOU WILL ENCOUNTER
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:10 }}>
                    {[
                      {
                        name:'Malam Sule',
                        role:'Sabon Gari market trader',
                        round:'Encounter: Round 2',
                        desc:'Aminu\'s primary supplier. Pragmatic and experienced. Has another buyer asking for the same stock. He is not hostile — he just needs to know if Aminu is stable before he prioritises his orders.',
                      },
                      {
                        name:'Fatima Usman',
                        role:'Angel investor / BUK alumna',
                        round:'Encounter: Round 4',
                        desc:'Runs a small Kano business portfolio. Has ₦500,000 to deploy. Genuinely interested in Zumunta but commercially rigorous. Her key question: what happens if Kwik goes to ₦500?',
                      },
                      {
                        name:'Councillor Bello',
                        role:'KGAVAMA representative',
                        round:'Encounter: Round 6',
                        desc:'Road traffic authority official. Not corrupt, not naive. Okadas operate in a regulatory grey area in Kano. He is not threatening Aminu — he is signalling that things may change.',
                      },
                    ].map(c => (
                      <div key={c.name} style={{ background:T.surfaceAlt, borderRadius:10, padding:16 }}>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{c.name}</div>
                        <div style={{ fontSize:11, color:T.teal, marginBottom:4 }}>{c.role}</div>
                        <div style={{ fontSize:10, color:T.amber, marginBottom:8 }}>{c.round}</div>
                        <div style={{ fontSize:11, color:T.muted, lineHeight:1.6 }}>{c.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 4 — The stakes */}
                <div style={{
                  background:T.amberGlow, border:`1px solid ${T.amber}`,
                  borderRadius:10, padding:16,
                  display:'flex', gap:24, flexWrap:'wrap', alignItems:'center',
                }}>
                  <div style={{ fontSize:22 }}>⚖️</div>
                  <div style={{ flex:1, minWidth:220 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:T.amber, marginBottom:4 }}>The stakes</div>
                    <div style={{ fontSize:12, color:T.muted, lineHeight:1.65 }}>
                      ₦185,000 cash. Burning ₦14,000/week. <strong style={{ color:T.text }}>13 weeks of runway</strong> if nothing changes.
                      Hassan's deadline is 6 months away. Fulfillment rate has declined three weeks in a row.
                      Kwik has more riders, lower prices, and a tech-enabled app.
                      Aminu has reliability, local knowledge, and a supplier relationship — for now.
                    </div>
                  </div>
                  <div style={{ fontSize:12, color:T.amber, fontWeight:700, textAlign:'center', minWidth:120 }}>
                    <div style={{ fontSize:28, fontWeight:900 }}>Wk 3</div>
                    <div>of 8 in this simulation</div>
                    <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>= Month 6 of 12</div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Round badge + title */}
          <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:28 }}>
            <Tag text="ROUND 3 OF 8" color={T.amber} />
            <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>
              The Rains Come — Zumunta Logistics, Kano
            </h2>
          </div>

          <div style={{
            display:'grid',
            gridTemplateColumns:'minmax(270px,320px) 1fr',
            gap:20, alignItems:'start',
          }}>

            {/* LEFT: Dashboard */}
            <div>
              {/* Financials */}
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:18, marginBottom:14 }}>
                <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.09em', marginBottom:14 }}>BUSINESS DASHBOARD</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                  {[
                    { l:'CASH',      v:`₦${Math.round((isResult?live.cash:ws.cash)/1000)}k`, c:T.text },
                    { l:'BURN/WK',   v:'−₦14k', c:T.red },
                    { l:'CUSTOMERS', v: isResult?live.customerBase:ws.customerBase, c:T.text },
                    { l:'FULFIL.',   v:`${isResult?live.fulfillmentRate:ws.fulfillmentRate}%`, c:T.amber },
                  ].map(m => (
                    <div key={m.l} style={{ background:T.surfaceAlt, borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:9, color:T.muted, marginBottom:3 }}>{m.l}</div>
                      <div style={{ fontSize:20, fontWeight:800, color:m.c }}>{m.v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize:10, color:T.muted, marginBottom:6 }}>Cash trend (₦ '000)</div>
                <ResponsiveContainer width="100%" height={75}>
                  <LineChart data={cashData}>
                    <Line type="monotone" dataKey="v" stroke={T.amber} strokeWidth={2} dot={{ fill:T.amber, r:3 }} />
                    <XAxis dataKey="w" tick={{ fontSize:9, fill:T.muted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:6, fontSize:11 }} formatter={v=>[`₦${v}k`,'Cash']} />
                  </LineChart>
                </ResponsiveContainer>

                <div style={{ fontSize:10, color:T.muted, margin:'14px 0 6px' }}>Fulfillment rate (%)</div>
                <ResponsiveContainer width="100%" height={65}>
                  <BarChart data={fillData}>
                    <Bar dataKey="v" fill={T.teal} radius={[3,3,0,0]} />
                    <XAxis dataKey="w" tick={{ fontSize:9, fill:T.muted }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:6, fontSize:11 }} formatter={v=>[`${v}%`,'Fulfillment']} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Relationship gauges */}
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:18 }}>
                <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.09em', marginBottom:14 }}>RELATIONSHIP HEALTH</div>
                {[
                  { label:'Supplier trust',         key:'supplierTrust',        invert:false },
                  { label:'Rider satisfaction',      key:'riderSatisfaction',    invert:false },
                  { label:'Customer satisfaction',   key:'customerSatisfaction', invert:false },
                  { label:'Competitor threat (Kwik)',key:'competitorThreat',     invert:true  },
                  { label:'Family pressure',         key:'familyPressure',       invert:true  },
                ].map(g => (
                  <Gauge key={g.key} label={g.label} value={isResult?live[g.key]:ws[g.key]} invert={g.invert} />
                ))}
              </div>
            </div>

            {/* RIGHT: Simulation panel */}
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:24 }}>

              {/* Situation Brief */}
              <div style={{ fontSize:10, color:T.amber, letterSpacing:'0.09em', marginBottom:10 }}>
                SITUATION BRIEF — AI GENERATED
              </div>
              <p style={{
                fontSize:14, lineHeight:1.75, color:T.text, margin:'0 0 22px',
                padding:16, background:T.amberGlow, borderRadius:8,
                borderLeft:`3px solid ${T.amber}`,
              }}>
                {brief}
              </p>

              {/* Intel */}
              {(phase==='ready'||phase==='result') && (
                <div style={{ marginBottom:22 }}>
                  <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.09em', marginBottom:8 }}>
                    OPTIONAL — INTELLIGENCE GATHERING
                  </div>
                  {!intelOpen ? (
                    <button onClick={()=>setIntelOpen(true)} style={{
                      background:T.tealGlow, border:`1px solid ${T.teal}`,
                      borderRadius:8, padding:'9px 16px',
                      color:T.teal, fontSize:13, cursor:'pointer',
                    }}>
                      📊 Request competitive market intelligence (free this round)
                    </button>
                  ) : (
                    <div style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:16 }}>
                      <div style={{ color:T.teal, fontWeight:600, fontSize:12, marginBottom:6 }}>
                        Market Intelligence Report — Week 3
                      </div>
                      <div style={{ color:T.muted, fontSize:10, marginBottom:12 }}>
                        Source: Informal trader network (reliability: medium)
                      </div>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign:'left', color:T.muted, padding:'3px 8px', fontWeight:400 }}></th>
                            <th style={{ textAlign:'right', color:T.amber, padding:'3px 8px' }}>Zumunta</th>
                            <th style={{ textAlign:'right', color:T.red, padding:'3px 8px' }}>Kwik</th>
                          </tr>
                        </thead>
                        <tbody>
                          {INTEL_ROWS.map(([l,z,k])=>(
                            <tr key={l} style={{ borderTop:`1px solid ${T.faint}` }}>
                              <td style={{ color:T.muted, padding:'5px 8px' }}>{l}</td>
                              <td style={{ color:T.amber, padding:'5px 8px', textAlign:'right', fontWeight:600 }}>{z}</td>
                              <td style={{ color:T.red,   padding:'5px 8px', textAlign:'right' }}>{k}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop:10, padding:'8px 10px', background:T.amberGlow, borderRadius:6, color:T.amber, fontSize:11 }}>
                        ⚠ Kwik is cheaper and larger but rated lower on reliability. Your advantage is service quality, not price.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Decisions — only when not in result state */}
              {phase !== 'result' && (
                <div>
                  <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.09em', marginBottom:6 }}>
                    STRATEGIC DECISION — choose one
                  </div>
                  <p style={{ fontSize:13, color:T.muted, marginBottom:10 }}>
                    The rainfall has cut your delivery capacity this week. What is your primary response?
                  </p>
                  {S_OPTS.map(o => <Opt key={o.id} opt={o} selected={strat} onSelect={setStrat} />)}

                  <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.09em', margin:'18px 0 6px' }}>
                    OPERATIONAL DECISION — choose one
                  </div>
                  <p style={{ fontSize:13, color:T.muted, marginBottom:10 }}>
                    How do you manage your riders during the disruption?
                  </p>
                  {O_OPTS.map(o => <Opt key={o.id} opt={o} selected={op} onSelect={setOp} />)}

                  <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.09em', margin:'18px 0 8px' }}>
                    CONFIDENCE RATING — required
                  </div>
                  <div style={{ display:'flex', gap:7, flexWrap:'wrap', marginBottom:22 }}>
                    {CONF.map(c => (
                      <button key={c} onClick={()=>setConf(c)} style={{
                        padding:'6px 14px', borderRadius:20, fontSize:11,
                        border:`1px solid ${conf===c ? T.amber : T.border}`,
                        background: conf===c ? T.amberGlow : 'transparent',
                        color: conf===c ? T.amber : T.muted, cursor:'pointer',
                      }}>{c}</button>
                    ))}
                  </div>

                  {phase === 'submitting'
                    ? <Spinner label="AI processing consequences…" />
                    : (
                      <button onClick={submit} disabled={!canSubmit} style={{
                        background: canSubmit ? T.amber : T.faint,
                        color: canSubmit ? '#06090F' : T.muted,
                        border:'none', borderRadius:8, padding:'12px 28px',
                        fontSize:14, fontWeight:800, cursor: canSubmit ? 'pointer' : 'not-allowed',
                      }}>
                        Submit decisions →
                      </button>
                    )
                  }
                  {err && <p style={{ color:T.red, fontSize:12, marginTop:10 }}>{err}</p>}
                </div>
              )}

              {/* Consequence */}
              {phase === 'result' && (
                <div>
                  <div style={{ fontSize:10, color:T.teal, letterSpacing:'0.09em', marginBottom:10 }}>
                    CONSEQUENCE — AI GENERATED
                  </div>
                  <p style={{
                    fontSize:14, lineHeight:1.75, color:T.text, margin:'0 0 22px',
                    padding:16, background:T.tealGlow, borderRadius:8,
                    borderLeft:`3px solid ${T.teal}`,
                  }}>
                    {consequence}
                  </p>

                  <div style={{ fontSize:10, color:T.muted, letterSpacing:'0.09em', marginBottom:10 }}>
                    STATE CHANGES THIS ROUND
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:18 }}>
                    {[
                      { label:'Cash',             bk:'cash',                fmt: v=>`₦${Math.round(v/1000)}k` },
                      { label:'Fulfillment rate', bk:'fulfillmentRate',     fmt: v=>`${v}%` },
                      { label:'Customer sat.',    bk:'customerSatisfaction',fmt: v=>`${v}/100` },
                      { label:'Rider sat.',       bk:'riderSatisfaction',   fmt: v=>`${v}/100` },
                    ].map(m => {
                      const before = ws[m.bk], after = live[m.bk];
                      const up = after > before;
                      return (
                        <div key={m.label} style={{ background:T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:8, padding:'10px 12px' }}>
                          <div style={{ fontSize:10, color:T.muted, marginBottom:4 }}>{m.label}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:12, color:T.muted }}>{m.fmt(before)}</span>
                            <span style={{ fontSize:10, color:T.faint }}>→</span>
                            <span style={{ fontSize:16, fontWeight:700, color: up ? T.teal : T.red }}>{m.fmt(after)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{
                    padding:'12px 16px',
                    background:T.amberGlow, border:`1px solid ${T.amber}`,
                    borderRadius:8, fontSize:12, color:T.amber,
                  }}>
                    📋 In the full platform, 4 post-round reflection MCQs would appear here — measuring metacognitive quality automatically.
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding:'64px 24px', borderTop:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:1120, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <Tag text="PEDAGOGY" color={T.teal} />
            <h2 style={{ fontSize:28, fontWeight:800, margin:'14px 0 10px' }}>How a semester works</h2>
            <p style={{ color:T.muted }}>Projecte integrates into an existing entrepreneurship course — no curriculum overhaul required</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:0, position:'relative' }}>
            {[
              { n:'01', label:'Pre-survey', desc:'Students complete validated ESE and EIQ instruments. 10 minutes. Baseline set.' },
              { n:'02', label:'6-week cohort', desc:'One simulation round per week. 90 minutes each. AI-mediated briefing, decisions, consequences.' },
              { n:'03', label:'Debrief sessions', desc:'Cohort discusses the shared scenario. Different outcomes create richer conversation than identical cases.' },
              { n:'04', label:'Post-survey', desc:'Same instruments, 4-week follow-up. Pre/post delta is your measurable learning outcome.' },
              { n:'05', label:"Founder's Profile", desc:'Each student receives a personalised PDF summarising their 8-week behavioural patterns.' },
            ].map((s,i) => (
              <div key={s.n} style={{
                padding:'24px 20px',
                borderLeft: i>0 ? `1px solid ${T.border}` : 'none',
                position:'relative',
              }}>
                <div style={{ fontSize:32, fontWeight:900, color:T.faint, marginBottom:8, lineHeight:1 }}>{s.n}</div>
                <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:12, color:T.muted, lineHeight:1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ASSESSMENT ── */}
      <section style={{ padding:'64px 24px', background:T.surface, borderTop:`1px solid ${T.border}` }}>
        <div style={{ maxWidth:1120, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <Tag text="THE RESEARCH LAYER" color={T.amber} />
            <h2 style={{ fontSize:28, fontWeight:800, margin:'14px 0 10px' }}>Every decision is a data point</h2>
            <p style={{ color:T.muted, maxWidth:560, margin:'0 auto' }}>
              The assessment pipeline runs silently in the background — no additional burden on students or lecturers
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:14, marginBottom:28 }}>
            {[
              { icon:'⏱', label:'Decision latency', desc:'Time from briefing to submission reveals urgency calibration and risk appetite' },
              { icon:'🔍', label:'Information seeking', desc:'Which intel options were chosen reveals what the student thinks matters most' },
              { icon:'🔄', label:'Pivot threshold', desc:'Signals before a strategy changes — measures entrepreneurial resilience' },
              { icon:'🧠', label:'Reasoning mode', desc:'AI classifies effectual vs. causal decision patterns across all 8 rounds' },
              { icon:'💰', label:'Resource allocation', desc:'Budget distribution across people, operations, market, and cash reserves' },
              { icon:'💬', label:'Adversarial response', desc:'Quality across 3 AI character encounters — pressure, negotiation, regulation' },
            ].map(s => (
              <div key={s.label} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:18 }}>
                <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>{s.label}</div>
                <div style={{ fontSize:12, color:T.muted, lineHeight:1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* ESE outcome example */}
          <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:12, padding:'22px 28px', display:'flex', gap:32, flexWrap:'wrap', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:10, color:T.muted, marginBottom:8 }}>ENTREPRENEURIAL SELF-EFFICACY (ESE) — Validated 7-point scale</div>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div>
                  <div style={{ fontSize:10, color:T.muted }}>Pre-pilot avg.</div>
                  <div style={{ fontSize:28, fontWeight:800, color:T.text }}>3.8 <span style={{ fontSize:14, color:T.muted }}>/ 7</span></div>
                </div>
                <div style={{ fontSize:28, color:T.faint }}>→</div>
                <div>
                  <div style={{ fontSize:10, color:T.teal }}>Post-pilot avg. (target)</div>
                  <div style={{ fontSize:28, fontWeight:800, color:T.teal }}>5.1 <span style={{ fontSize:14, color:T.teal }}>/ 7</span></div>
                </div>
                <div style={{ background:T.tealGlow, border:`1px solid ${T.teal}`, borderRadius:8, padding:'6px 14px', fontSize:13, color:T.teal, fontWeight:700 }}>
                  +34% improvement target
                </div>
              </div>
            </div>
            <div style={{ fontSize:12, color:T.muted, maxWidth:340, lineHeight:1.65 }}>
              Measured using the Chen, Greene & Crick (1998) ESE scale, adapted for Northern Nigerian business context.
              Pre / post / 4-week follow-up. Control group included for academic publication validity.
            </div>
          </div>
        </div>
      </section>

      {/* ── SCENARIO LIBRARY ── */}
      <section style={{ padding:'64px 24px', maxWidth:1120, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:40 }}>
          <Tag text="SCENARIO LIBRARY" color={T.amber} />
          <h2 style={{ fontSize:28, fontWeight:800, margin:'14px 0 10px' }}>Built for Nigeria's real business context</h2>
          <p style={{ color:T.muted }}>Not Western MBA case studies. Kano roads, Sabon Gari suppliers, CBN policy shocks.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:14 }}>
          {[
            { name:'Zumunta Logistics', badge:'PILOT — ACTIVE', bcolor:T.amber,
              loc:'Last-mile delivery · Kano',
              desc:'Navigate a funded tech competitor, supply chain pressure, KGAVAMA regulatory exposure, and a family loan deadline.' },
            { name:'Voltage', badge:'PHASE 2', bcolor:T.teal,
              loc:'Solar installation · Kano',
              desc:'Scale a solar inverter business against cheap Chinese imports while maintaining installation quality and KEPA compliance.' },
            { name:"Aunty Bisi's Kitchen", badge:'PHASE 2', bcolor:T.teal,
              loc:'Food & catering · GRA Kano',
              desc:'A hotel contract could triple your volume — but you lack the kitchen capacity. Scale up or hold your quality?' },
            { name:'Campus Connect', badge:'PHASE 3', bcolor:T.muted,
              loc:'Student platform · BUK',
              desc:'Build a two-sided student services marketplace against free WhatsApp group competition and NANS politics.' },
          ].map(s => (
            <div key={s.name} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:20 }}>
              <div style={{ marginBottom:12 }}><Tag text={s.badge} color={s.bcolor} /></div>
              <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>{s.name}</div>
              <div style={{ fontSize:11, color:T.amber, marginBottom:10 }}>{s.loc}</div>
              <div style={{ fontSize:13, color:T.muted, lineHeight:1.55, marginBottom:14 }}>{s.desc}</div>
              <div style={{ fontSize:11, color:T.faint }}>8 rounds · MCQ decisions · 3 AI character encounters</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── INSTITUTION CTA ── */}
      <section style={{ padding:'64px 24px', background:T.surface, borderTop:`1px solid ${T.border}`, textAlign:'center' }}>
        <div style={{ maxWidth:640, margin:'0 auto' }}>
          <h2 style={{ fontSize:32, fontWeight:900, margin:'0 0 14px' }}>
            Bring Projecte to your department
          </h2>
          <p style={{ color:T.muted, fontSize:16, lineHeight:1.65, marginBottom:36 }}>
            Pilot with a single course this semester. We supply the platform, the scenario, and the outcome data you need for institutional reporting.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:10, marginBottom:36 }}>
            {[
              '✓  One full scenario at no cost for the pilot semester',
              '✓  Behavioural profile report for every enrolled student',
              '✓  Research dataset ready for academic publication',
              '✓  Offline-capable — built for BUK campus connectivity',
            ].map(f => (
              <div key={f} style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:'11px 16px', fontSize:13, color:T.muted, textAlign:'left' }}>
                {f}
              </div>
            ))}
          </div>
          <div style={{ fontSize:12, color:T.faint }}>
            Projecte is built at Federal University Birnin Kebbi and conducting its pilot at Bayero University Kano, 2026.
          </div>
        </div>
      </section>

    </div>
  );
}
