import React, { useEffect, useMemo, useState } from 'react'
import { Activity, CalendarDays, Droplets, Scale, Utensils, Plus, Trash2, Download, Upload, RotateCcw } from 'lucide-react'

const STORAGE_KEY = 'jay-health-tracker-local-v1'
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const todayISO = () => new Date().toISOString().slice(0, 10)
const nowLocalInput = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
const toISO = (localValue) => new Date(localValue).toISOString()
const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour:'numeric', minute:'2-digit' })
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA')
const num = (v) => Number.parseFloat(v || 0)

const emptyData = {
  profile: { starting_weight_lbs: '', goal_weight_lbs: '', goal_date: '' },
  weights: [],
  activities: [],
  waters: [],
  foods: []
}

const nav = [
  { id:'weight', label:'Weight', icon: Scale },
  { id:'activity', label:'Activity', icon: Activity },
  { id:'calendar', label:'Calendar', icon: CalendarDays },
  { id:'water', label:'Water', icon: Droplets },
  { id:'food', label:'Food', icon: Utensils },
]

function loadData(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return saved ? { ...emptyData, ...saved, profile: { ...emptyData.profile, ...(saved.profile || {}) } } : emptyData
  } catch {
    return emptyData
  }
}

function Stat({ label, value, sub }){
  return <div className="stat"><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}</div>
}

function LineChart({ rows, goal }){
  const data = rows.slice().sort((a,b)=>new Date(a.logged_at)-new Date(b.logged_at)).slice(-50)
  if(data.length < 2) return <div className="empty chart-empty">Add at least 2 weight entries to see a trend graph.</div>
  const vals = data.map(r=>r.weight_lbs)
  const min = Math.min(...vals, goal || Infinity) - 2
  const max = Math.max(...vals, goal || -Infinity) + 2
  const range = max - min || 1
  const pts = data.map((r,i)=> `${(i/(data.length-1))*100},${100-((r.weight_lbs-min)/range)*100}`).join(' ')
  const goalY = goal ? 100-((goal-min)/range)*100 : null
  return <svg viewBox="0 0 100 100" className="chart" preserveAspectRatio="none">
    <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    {goalY!==null && <line x1="0" x2="100" y1={goalY} y2={goalY} stroke="currentColor" strokeDasharray="4 4" opacity=".35" vectorEffect="non-scaling-stroke" />}
  </svg>
}

function WeightPage({ data, setData }){
  const { weights, profile } = data
  const [weight, setWeight] = useState('')
  const [when, setWhen] = useState(nowLocalInput())
  const [start, setStart] = useState(profile?.starting_weight_lbs || '')
  const [goal, setGoal] = useState(profile?.goal_weight_lbs || '')
  const [goalDate, setGoalDate] = useState(profile?.goal_date || '')

  useEffect(()=>{
    setStart(profile?.starting_weight_lbs || '')
    setGoal(profile?.goal_weight_lbs || '')
    setGoalDate(profile?.goal_date || '')
  },[profile])

  const sortedWeights = weights.slice().sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at))
  const latest = sortedWeights[0]
  const stats = useMemo(()=>{
    const current = latest?.weight_lbs || null
    const g = num(goal)
    const s = num(start)
    const lost = current && s ? s-current : 0
    const left = current && g ? current-g : 0
    const days = goalDate ? Math.max(0, Math.ceil((new Date(goalDate+'T23:59:59')-new Date())/86400000)) : null
    return { current, lost, left, days, perDay: days && left>0 ? left/days : null }
  },[latest,start,goal,goalDate])

  function addWeight(e){
    e.preventDefault()
    if(!weight) return
    const entry = { id: makeId(), weight_lbs: num(weight), logged_at: toISO(when) }
    setData(d => ({ ...d, weights: [entry, ...d.weights] }))
    setWeight('')
    setWhen(nowLocalInput())
  }

  function saveGoal(){
    setData(d => ({ ...d, profile: { starting_weight_lbs: start, goal_weight_lbs: goal, goal_date: goalDate } }))
  }

  function del(id){ setData(d => ({ ...d, weights: d.weights.filter(r=>r.id!==id) })) }

  return <section className="page">
    <h1>Weight</h1>
    <div className="grid3">
      <Stat label="Current" value={stats.current ? `${stats.current} lb` : '—'} />
      <Stat label="Progress" value={stats.lost ? `${stats.lost.toFixed(1)} lb` : '—'} sub="from start"/>
      <Stat label="Left" value={stats.left ? `${stats.left.toFixed(1)} lb` : '—'} sub={stats.perDay ? `${stats.perDay.toFixed(2)} lb/day needed` : 'to goal'}/>
    </div>
    <div className="card"><LineChart rows={weights} goal={num(goal)||null}/></div>
    <div className="card"><h2>Add weight</h2><form onSubmit={addWeight} className="stack"><div className="row"><input value={weight} onChange={e=>setWeight(e.target.value)} type="number" step="0.1" placeholder="166.4"/><input value={when} onChange={e=>setWhen(e.target.value)} type="datetime-local"/></div><button><Plus size={18}/> Save weight</button></form></div>
    <div className="card"><h2>Goal settings</h2><div className="grid3"><label>Starting weight<input value={start} onChange={e=>setStart(e.target.value)} type="number" step="0.1"/></label><label>Goal weight<input value={goal} onChange={e=>setGoal(e.target.value)} type="number" step="0.1"/></label><label>Goal date<input value={goalDate || ''} onChange={e=>setGoalDate(e.target.value)} type="date"/></label></div><button onClick={saveGoal}>Save goal</button></div>
    <EntryList rows={sortedWeights} type="weight" onDelete={del}/>
  </section>
}

function ActivityPage({ data, setData }){
  const { activities } = data
  const [title,setTitle]=useState('')
  const [kind,setKind]=useState('Walk')
  const [mins,setMins]=useState('')
  const [when,setWhen]=useState(nowLocalInput())
  const sorted = activities.slice().sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at))
  function save(e){
    e.preventDefault()
    if(!title) return
    const entry = { id: makeId(), title, activity_type: kind, duration_minutes: num(mins)||null, logged_at: toISO(when) }
    setData(d => ({ ...d, activities: [entry, ...d.activities] }))
    setTitle(''); setMins(''); setWhen(nowLocalInput())
  }
  return <section className="page"><h1>Activity</h1><div className="grid3"><Stat label="This week" value={`${activities.filter(a=>new Date(a.logged_at)>new Date(Date.now()-7*864e5)).length}`} sub="workouts"/><Stat label="Minutes" value={activities.reduce((s,a)=>s+(a.duration_minutes||0),0)} sub="all-time logged"/><Stat label="Latest" value={sorted[0]?.activity_type || '—'} /></div><div className="card"><h2>Log activity</h2><form onSubmit={save} className="stack"><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="2 mile walk, plank, gym..."/><div className="row"><select value={kind} onChange={e=>setKind(e.target.value)}><option>Walk</option><option>Run</option><option>Strength</option><option>Core</option><option>Stretch</option><option>Other</option></select><input value={mins} onChange={e=>setMins(e.target.value)} type="number" placeholder="minutes"/><input value={when} onChange={e=>setWhen(e.target.value)} type="datetime-local"/></div><button><Plus size={18}/> Save activity</button></form></div><EntryList rows={sorted} type="activity" onDelete={id=>setData(d=>({...d, activities:d.activities.filter(r=>r.id!==id)}))}/></section>
}

function WaterPage({ data, setData }){
  const { waters } = data
  const sorted = waters.slice().sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at))
  const glassesToday = waters.filter(w=>dayKey(w.logged_at)===todayISO()).reduce((s,w)=>s+w.glasses,0)
  function add(glasses){ setData(d => ({ ...d, waters: [{ id:makeId(), glasses, logged_at:new Date().toISOString() }, ...d.waters] })) }
  return <section className="page"><h1>Water</h1><div className="grid3"><Stat label="Today" value={`${glassesToday}/9`} sub="glasses"/><Stat label="Bottles equiv." value={(glassesToday/3).toFixed(1)} /><Stat label="Status" value={glassesToday>=9 ? 'Hit goal' : `${9-glassesToday} left`} /></div><div className="card"><h2>Quick add</h2><div className="actions"><button onClick={()=>add(1)}>+ 1 glass</button><button onClick={()=>add(3)}>+ 1 bottle</button></div><div className="meter"><i style={{width:`${Math.min(100,glassesToday/9*100)}%`}} /></div></div><EntryList rows={sorted} type="water" onDelete={id=>setData(d=>({...d, waters:d.waters.filter(r=>r.id!==id)}))}/></section>
}

function FoodPage({ data, setData }){
  const { foods } = data
  const [food,setFood]=useState('')
  const [notes,setNotes]=useState('')
  const [when,setWhen]=useState(nowLocalInput())
  const sorted = foods.slice().sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at))
  function save(e){
    e.preventDefault()
    if(!food) return
    const entry = { id: makeId(), food_name: food, notes, logged_at: toISO(when) }
    setData(d => ({ ...d, foods: [entry, ...d.foods] }))
    setFood(''); setNotes(''); setWhen(nowLocalInput())
  }
  return <section className="page"><h1>Food</h1><div className="grid3"><Stat label="Today" value={foods.filter(f=>dayKey(f.logged_at)===todayISO()).length}/><Stat label="This week" value={foods.filter(f=>new Date(f.logged_at)>new Date(Date.now()-7*864e5)).length}/><Stat label="Last logged" value={sorted[0]?.food_name || '—'}/></div><div className="card"><h2>Log junk food</h2><form onSubmit={save} className="stack"><input value={food} onChange={e=>setFood(e.target.value)} placeholder="chips, dessert, soda..."/><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="optional notes"/><input value={when} onChange={e=>setWhen(e.target.value)} type="datetime-local"/><button><Plus size={18}/> Save food</button></form></div><EntryList rows={sorted} type="food" onDelete={id=>setData(d=>({...d, foods:d.foods.filter(r=>r.id!==id)}))}/></section>
}

function CalendarPage({ data }){
  const { weights, activities, waters, foods } = data
  const days = Array.from({length:35},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-34+i); return d.toLocaleDateString('en-CA') })
  const byDay = days.map(d=>({
    date:d,
    weight:weights.slice().sort((a,b)=>new Date(b.logged_at)-new Date(a.logged_at)).find(w=>dayKey(w.logged_at)===d),
    water:waters.filter(w=>dayKey(w.logged_at)===d).reduce((s,w)=>s+w.glasses,0),
    act:activities.filter(a=>dayKey(a.logged_at)===d).length,
    food:foods.filter(f=>dayKey(f.logged_at)===d).length
  }))
  return <section className="page"><h1>Calendar</h1><p className="muted calendar-note">Each day shows latest weight, water progress, activities, and junk food logs.</p><div className="calendar">{byDay.map(d=><div key={d.date} className="day"><b>{new Date(d.date+'T12:00:00').getDate()}</b><span>{d.weight ? `${d.weight.weight_lbs} lb` : '—'}</span><small className={d.water>=9?'good':''}>💧 {d.water}/9</small><small>🏃 {d.act}</small><small className={d.food ? 'warn':''}>🍟 {d.food}</small></div>)}</div></section>
}

function EntryList({ rows, type, onDelete }){
  if(!rows.length) return <div className="card empty">No entries yet.</div>
  return <div className="card"><h2>Recent entries</h2>{rows.slice(0,30).map(r=><div className="entry" key={r.id}><div><b>{type==='weight'?`${r.weight_lbs} lb`:type==='water'?`${r.glasses} glass${r.glasses>1?'es':''}`:type==='activity'?r.title:r.food_name}</b><span>{fmtDate(r.logged_at)} · {fmtTime(r.logged_at)} {r.activity_type?`· ${r.activity_type}`:''}{r.notes?` · ${r.notes}`:''}</span></div><button className="icon" onClick={()=>onDelete(r.id)}><Trash2 size={16}/></button></div>)}</div>
}

function DataTools({ data, setData }){
  function exportData(){
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `health-tracker-backup-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  function importData(e){
    const file = e.target.files?.[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try { setData({ ...emptyData, ...JSON.parse(reader.result) }) }
      catch { alert('That backup file could not be imported.') }
    }
    reader.readAsText(file)
  }
  function resetData(){
    if(confirm('Delete all local health tracker data on this device?')) setData(emptyData)
  }
  return <details className="data-tools"><summary>Local backup/settings</summary><div className="actions tools"><button onClick={exportData}><Download size={16}/> Export backup</button><label className="upload"><Upload size={16}/> Import backup<input type="file" accept="application/json" onChange={importData}/></label><button className="danger" onClick={resetData}><RotateCcw size={16}/> Reset</button></div><p className="muted">Data is saved locally on this browser/device. Export a backup before clearing browser data or changing phones.</p></details>
}

export default function App(){
  const [active,setActive]=useState('weight')
  const [data,setData]=useState(loadData)

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) },[data])

  return <div className="app">
    <header><div><p className="eyebrow">Private local dashboard</p><h1>Health Tracker</h1></div></header>
    <main>
      <DataTools data={data} setData={setData}/>
      {active==='weight'&&<WeightPage data={data} setData={setData}/>} 
      {active==='activity'&&<ActivityPage data={data} setData={setData}/>} 
      {active==='calendar'&&<CalendarPage data={data}/>} 
      {active==='water'&&<WaterPage data={data} setData={setData}/>} 
      {active==='food'&&<FoodPage data={data} setData={setData}/>} 
    </main>
    <nav>{nav.map(n=>{const Icon=n.icon; return <button key={n.id} onClick={()=>setActive(n.id)} className={active===n.id?'active':''}><Icon size={22}/><span>{n.label}</span></button>})}</nav>
  </div>
}
