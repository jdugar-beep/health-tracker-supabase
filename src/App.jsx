import React, { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Droplets, Scale, Utensils, Plus, Trash2 } from 'lucide-react'
import { supabase } from './utils/supabase'

const todayISO = () => new Date().toISOString().slice(0, 10)
const nowLocalInput = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,16)
}
const toISO = (localValue) => new Date(localValue).toISOString()
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month:'short', day:'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' })
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA')
const num = (v) => Number.parseFloat(v || 0)

const nav = [
  { id:'weight', label:'Weight', icon: Scale },
  { id:'activity', label:'Activity', icon: Activity },
  { id:'calendar', label:'Calendar', icon: CalendarDays },
  { id:'water', label:'Water', icon: Droplets },
  { id:'food', label:'Food', icon: Utensils },
]

function AuthGate({ session, setSession }) {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  async function signIn(e){
    e.preventDefault(); setMsg('')
    if(!supabase) return setMsg('Add your Supabase env vars first.')
    const { error } = await supabase.auth.signInWithOtp({ email, options:{ emailRedirectTo: window.location.origin }})
    setMsg(error ? error.message : 'Check your email for the login link.')
  }
  return <main className="auth"><div className="card hero"><h1>Health Tracker</h1><p>Private weight, water, food, and activity tracking — backed by Supabase.</p><form onSubmit={signIn} className="stack"><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@email.com" type="email" required/><button>Send magic link</button></form>{msg && <p className="muted">{msg}</p>}</div></main>
}

function Stat({ label, value, sub }){ return <div className="stat"><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div> }

function LineChart({ rows, goal }){
  const data = rows.slice().sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at)).slice(-40)
  if(data.length < 2) return <div className="empty">Add at least 2 weight entries to see a trend graph.</div>
  const vals = data.map(r=>r.weight_lbs), min = Math.min(...vals, goal || Infinity) - 2, max = Math.max(...vals, goal || -Infinity) + 2
  const pts = data.map((r,i)=> `${(i/(data.length-1))*100},${100-((r.weight_lbs-min)/(max-min))*100}`).join(' ')
  const goalY = goal ? 100-((goal-min)/(max-min))*100 : null
  return <svg viewBox="0 0 100 100" className="chart" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />{goalY!==null && <line x1="0" x2="100" y1={goalY} y2={goalY} stroke="currentColor" strokeDasharray="4 4" opacity=".35" vectorEffect="non-scaling-stroke" />}</svg>
}

function WeightPage({ user, weights, profile, reload }){
  const [weight, setWeight] = useState(''), [start, setStart] = useState(profile?.starting_weight_lbs || ''), [goal, setGoal] = useState(profile?.goal_weight_lbs || ''), [goalDate, setGoalDate] = useState(profile?.goal_date || '')
  useEffect(()=>{ setStart(profile?.starting_weight_lbs || ''); setGoal(profile?.goal_weight_lbs || ''); setGoalDate(profile?.goal_date || '') },[profile])
  const latest = weights[0]
  const stats = useMemo(()=>{
    const current = latest?.weight_lbs || null, g = num(goal), s = num(start)
    const lost = current && s ? s-current : 0, left = current && g ? current-g : 0
    const days = goalDate ? Math.max(0, Math.ceil((new Date(goalDate)-new Date())/86400000)) : null
    return { current, lost, left, days, perDay: days && left>0 ? left/days : null }
  },[latest,start,goal,goalDate])
  async function addWeight(e){ e.preventDefault(); if(!weight) return; await supabase.from('weight_entries').insert({ user_id:user.id, weight_lbs:num(weight) }); setWeight(''); reload() }
  async function saveGoal(){ await supabase.from('health_profiles').upsert({ user_id:user.id, starting_weight_lbs:num(start)||null, goal_weight_lbs:num(goal)||null, goal_date: goalDate || null }); reload() }
  async function del(id){ await supabase.from('weight_entries').delete().eq('id',id); reload() }
  return <section className="page"><h1>Weight</h1><div className="grid3"><Stat label="Current" value={stats.current ? `${stats.current} lb` : '—'} /><Stat label="Progress" value={stats.lost ? `${stats.lost.toFixed(1)} lb` : '—'} sub="from start"/><Stat label="Left" value={stats.left ? `${stats.left.toFixed(1)} lb` : '—'} sub={stats.perDay ? `${stats.perDay.toFixed(2)} lb/day needed` : 'to goal'}/></div><div className="card"><LineChart rows={weights} goal={num(goal)||null}/></div><div className="card"><h2>Add weight</h2><form onSubmit={addWeight} className="row"><input value={weight} onChange={e=>setWeight(e.target.value)} type="number" step="0.1" placeholder="166.4"/><button><Plus size={18}/> Save</button></form></div><div className="card"><h2>Goal settings</h2><div className="grid3"><label>Starting weight<input value={start} onChange={e=>setStart(e.target.value)} type="number" step="0.1"/></label><label>Goal weight<input value={goal} onChange={e=>setGoal(e.target.value)} type="number" step="0.1"/></label><label>Goal date<input value={goalDate || ''} onChange={e=>setGoalDate(e.target.value)} type="date"/></label></div><button onClick={saveGoal}>Save goal</button></div><EntryList rows={weights} type="weight" onDelete={del}/></section>
}

function ActivityPage({ user, activities, reload }){
  const [title,setTitle]=useState(''), [kind,setKind]=useState('Walk'), [mins,setMins]=useState(''), [when,setWhen]=useState(nowLocalInput())
  async function save(e){ e.preventDefault(); if(!title) return; await supabase.from('activity_entries').insert({user_id:user.id,title,activity_type:kind,duration_minutes:num(mins)||null,logged_at:toISO(when)}); setTitle(''); setMins(''); setWhen(nowLocalInput()); reload() }
  return <section className="page"><h1>Activity</h1><div className="grid3"><Stat label="This week" value={`${activities.filter(a=>new Date(a.logged_at)>new Date(Date.now()-7*864e5)).length}`} sub="workouts"/><Stat label="Minutes" value={activities.reduce((s,a)=>s+(a.duration_minutes||0),0)} sub="all-time logged"/><Stat label="Latest" value={activities[0]?.activity_type || '—'} /></div><div className="card"><h2>Log activity</h2><form onSubmit={save} className="stack"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="2 mile walk, plank, gym..."/><div className="row"><select value={kind} onChange={e=>setKind(e.target.value)}><option>Walk</option><option>Run</option><option>Strength</option><option>Core</option><option>Other</option></select><input value={mins} onChange={e=>setMins(e.target.value)} type="number" placeholder="minutes"/><input value={when} onChange={e=>setWhen(e.target.value)} type="datetime-local"/></div><button><Plus size={18}/> Save activity</button></form></div><EntryList rows={activities} type="activity" onDelete={async id=>{await supabase.from('activity_entries').delete().eq('id',id); reload()}}/></section>
}

function WaterPage({ user, waters, reload }){
  const glassesToday = waters.filter(w=>dayKey(w.logged_at)===todayISO()).reduce((s,w)=>s+w.glasses,0)
  async function add(glasses){ await supabase.from('water_entries').insert({user_id:user.id, glasses}); reload() }
  return <section className="page"><h1>Water</h1><div className="grid3"><Stat label="Today" value={`${glassesToday}/9`} sub="glasses"/><Stat label="Bottles equiv." value={(glassesToday/3).toFixed(1)} /><Stat label="Status" value={glassesToday>=9 ? 'Hit goal' : `${9-glassesToday} left`} /></div><div className="card"><h2>Quick add</h2><div className="actions"><button onClick={()=>add(1)}>+ 1 glass</button><button onClick={()=>add(3)}>+ 1 bottle</button></div><div className="meter"><i style={{width:`${Math.min(100,glassesToday/9*100)}%`}} /></div></div><EntryList rows={waters} type="water" onDelete={async id=>{await supabase.from('water_entries').delete().eq('id',id); reload()}}/></section>
}

function FoodPage({ user, foods, reload }){
  const [food,setFood]=useState(''), [notes,setNotes]=useState(''), [when,setWhen]=useState(nowLocalInput())
  async function save(e){ e.preventDefault(); if(!food) return; await supabase.from('junk_food_entries').insert({user_id:user.id, food_name:food, notes, logged_at:toISO(when)}); setFood(''); setNotes(''); setWhen(nowLocalInput()); reload() }
  return <section className="page"><h1>Food</h1><div className="grid3"><Stat label="Today" value={foods.filter(f=>dayKey(f.logged_at)===todayISO()).length}/><Stat label="This week" value={foods.filter(f=>new Date(f.logged_at)>new Date(Date.now()-7*864e5)).length}/><Stat label="Last logged" value={foods[0]?.food_name || '—'}/></div><div className="card"><h2>Log junk food</h2><form onSubmit={save} className="stack"><input value={food} onChange={e=>setFood(e.target.value)} placeholder="chips, dessert, soda..."/><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="optional notes"/><input value={when} onChange={e=>setWhen(e.target.value)} type="datetime-local"/><button><Plus size={18}/> Save food</button></form></div><EntryList rows={foods} type="food" onDelete={async id=>{await supabase.from('junk_food_entries').delete().eq('id',id); reload()}}/></section>
}

function CalendarPage({ weights, activities, waters, foods }){
  const days = Array.from({length:35},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-34+i); return d.toLocaleDateString('en-CA') })
  const byDay = days.map(d=>({ date:d, weight:weights.find(w=>dayKey(w.logged_at)===d), water:waters.filter(w=>dayKey(w.logged_at)===d).reduce((s,w)=>s+w.glasses,0), act:activities.filter(a=>dayKey(a.logged_at)===d).length, food:foods.filter(f=>dayKey(f.logged_at)===d).length }))
  return <section className="page"><h1>Calendar</h1><div className="calendar">{byDay.map(d=><div key={d.date} className="day"><b>{new Date(d.date+'T12:00:00').getDate()}</b><span>{d.weight ? `${d.weight.weight_lbs} lb` : '—'}</span><small className={d.water>=9?'good':''}>💧 {d.water}/9</small><small>🏃 {d.act}</small><small className={d.food ? 'warn':''}>🍟 {d.food}</small></div>)}</div></section>
}

function EntryList({ rows, type, onDelete }){
  if(!rows.length) return <div className="card empty">No entries yet.</div>
  return <div className="card"><h2>Recent entries</h2>{rows.slice(0,25).map(r=><div className="entry" key={r.id}><div><b>{type==='weight'?`${r.weight_lbs} lb`:type==='water'?`${r.glasses} glass${r.glasses>1?'es':''}`:type==='activity'?r.title:r.food_name}</b><span>{fmtDate(r.logged_at)} · {fmtTime(r.logged_at)} {r.activity_type?`· ${r.activity_type}`:''}</span></div><button className="icon" onClick={()=>onDelete(r.id)}><Trash2 size={16}/></button></div>)}</div>
}

export default function App(){
  const [session,setSession]=useState(null), [active,setActive]=useState('weight'), [profile,setProfile]=useState(null), [weights,setWeights]=useState([]), [activities,setActivities]=useState([]), [waters,setWaters]=useState([]), [foods,setFoods]=useState([]), [loading,setLoading]=useState(true)
  useEffect(()=>{ if(!supabase){setLoading(false); return} supabase.auth.getSession().then(({data})=>{setSession(data.session); setLoading(false)}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s)); return ()=>subscription.unsubscribe() },[])
  async function reload(){
    if(!session?.user) return
    const uid=session.user.id
    const [p,w,a,wa,f]=await Promise.all([
      supabase.from('health_profiles').select('*').eq('user_id',uid).maybeSingle(),
      supabase.from('weight_entries').select('*').eq('user_id',uid).order('logged_at',{ascending:false}),
      supabase.from('activity_entries').select('*').eq('user_id',uid).order('logged_at',{ascending:false}),
      supabase.from('water_entries').select('*').eq('user_id',uid).order('logged_at',{ascending:false}),
      supabase.from('junk_food_entries').select('*').eq('user_id',uid).order('logged_at',{ascending:false}),
    ])
    setProfile(p.data); setWeights(w.data||[]); setActivities(a.data||[]); setWaters(wa.data||[]); setFoods(f.data||[])
  }
  useEffect(()=>{ reload() },[session?.user?.id])
  if(loading) return <div className="loading">Loading...</div>
  if(!session) return <AuthGate session={session} setSession={setSession}/>
  const props={user:session.user, profile, weights, activities, waters, foods, reload}
  return <div className="app"><header><div><p className="eyebrow">Private health dashboard</p><h1>Health Tracker</h1></div><button className="ghost" onClick={()=>supabase.auth.signOut()}>Sign out</button></header><main>{active==='weight'&&<WeightPage {...props}/>} {active==='activity'&&<ActivityPage {...props}/>} {active==='calendar'&&<CalendarPage {...props}/>} {active==='water'&&<WaterPage {...props}/>} {active==='food'&&<FoodPage {...props}/>}</main><nav>{nav.map(n=>{const Icon=n.icon; return <button key={n.id} onClick={()=>setActive(n.id)} className={active===n.id?'active':''}><Icon size={22}/><span>{n.label}</span></button>})}</nav></div>
}
