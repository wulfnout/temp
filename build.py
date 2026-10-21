"""Builds the live Temp website (web/index.html) from the prototype (temp.html),
swapping the in-browser demo data for the real Supabase backend."""
import re
SRC='/home/claude/temp.html'; OUT='/home/claude/web/index.html'
SB_URL='https://izrtdycmvgqpitohdeog.supabase.co'
SB_KEY='sb_publishable_zm6EuiQhiR7qQYVIFA2Nhg_TxpdUnSd'
s=open(SRC).read()

def rep(a,b,cnt=1):
    global s
    assert a in s, 'missing: '+a[:90]
    s=s.replace(a,b,cnt)
def block(name,new):
    global s
    st=s.index('function '+name+'(')
    m=re.compile(r'\n(?=function |const |/\*|let |ReactDOM|async function )').search(s,st+10)
    s=s[:st]+new.strip('\n')+'\n'+s[m.start():]
def cut(start_marker,end_marker,new=''):
    global s
    a=s.index(start_marker); b=s.index(end_marker,a)
    s=s[:a]+new+s[b:]

# ---------- libraries ----------
rep('<script src="https://unpkg.com/htm@3.1.1/dist/htm.umd.js"></script>',
    '<script src="https://unpkg.com/htm@3.1.1/dist/htm.umd.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"></script>')
rep("const {useState,useEffect,useReducer,useRef,useLayoutEffect} = React;",
    "const {useState,useEffect,useReducer,useRef,useLayoutEffect,useCallback} = React;")

# ---------- backend client + helpers ----------
rep("let uid=1000; const nid=()=>++uid;", "let uid=0; const nid=()=>--uid;   /* local placeholder ids are negative; real ids come from the database */")
LIVE=r'''
/* ================= live backend ================= */
const sb=supabase.createClient('%s','%s');
let myId=null, liveCh=null; const typingT={};
const L=u=>u===myId?'me':u, R=id=>id==='me'?myId:id;
const PALETTE=['#ff5500','#0a0a0a','#c2410c','#2b2b2b','#ff7a33','#9a3412','#1a1a1a','#ea580c'];
const colorFor=id=>PALETTE[Math.abs(hashStr(id||'x'))%%PALETTE.length];
const posterCache={};const posterFor=seed=>posterCache[seed]||(posterCache[seed]=art(seed,540,960));
const blobFiles={};function blobUrl(f){const u=URL.createObjectURL(f);blobFiles[u]=f;return u}
function nextWeekStart(){const d=new Date();const day=(d.getUTCDay()+6)%%7;return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day+7)}
function nextDayStart(){const d=new Date();return Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)}
function friendly(e){const m=(e&&e.message)||String(e||'');
  if(/profiles_handle_key|duplicate key.*handle/i.test(m))return 'That username is taken.';
  if(/row-level security/i.test(m)&&/comments/i.test(m))return 'Comments are off for this post.';
  if(/row-level security/i.test(m)&&/messages/i.test(m))return 'You can’t message this person.';
  if(/row-level security/i.test(m))return 'You can’t do that.';
  if(/Failed to fetch|NetworkError/i.test(m))return 'You’re offline. Check your connection.';
  return m||'Something went wrong. Try again.'}
const ok=async q=>{const {error}=await q;if(error)throw new Error(friendly(error))};
async function upload(file){
  if(!file)throw new Error('That file couldn’t be read. Try choosing it again.');
  const ext=((file.name||'').split('.').pop()||(file.type.split('/')[1]||'bin')).toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';
  const path=myId+'/'+(crypto.randomUUID?crypto.randomUUID():Date.now()+''+Math.random()).replace(/\./g,'')+'.'+ext;
  const {error}=await sb.storage.from('media').upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw new Error(/exceeded|too large|size/i.test(error.message)?'That file is too big. Keep it under 50 MB.':friendly(error));
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}
const stick=async v=>v&&v.startsWith('I|blob:')?'I|'+await upload(blobFiles[v.slice(2)]):v;

async function loadAll(){
  const q=async p=>{const {data,error}=await p;if(error)throw error;return data||[]};
  const [profiles,follows,blocks,posts,reacts,saves,stories,sviews,msgs,notifs,privRows,week,deals]=await Promise.all([
    q(sb.from('profiles').select('*').limit(5000)),
    q(sb.from('follows').select('follower,followee').limit(20000)),
    q(sb.from('blocks').select('blocked')),
    q(sb.from('posts').select('*').order('created_at',{ascending:false}).limit(300)),
    q(sb.from('reactions').select('post_id,kind').eq('user_id',myId).limit(5000)),
    q(sb.from('saves').select('post_id')),
    q(sb.from('stories').select('*').order('created_at')),
    q(sb.from('story_views').select('story_id')),
    q(sb.from('messages').select('*').order('created_at').limit(3000)),
    q(sb.from('notifications').select('*').order('created_at',{ascending:false}).limit(150)),
    q(sb.from('profile_private').select('*').eq('id',myId)),
    q(sb.rpc('week_stats')),
    q(sb.rpc('deals_today')),
  ]);
  const ids=posts.map(p=>p.id);
  const comments=ids.length?await q(sb.from('comments').select('*').in('post_id',ids).order('created_at').limit(5000)):[];
  const cids=comments.map(c=>c.id);
  const myLikes=cids.length?await q(sb.from('comment_likes').select('comment_id').eq('user_id',myId).in('comment_id',cids)):[];
  const priv=privRows[0]||{settings:{},points:0,owned:{stickers:{basic:1},themes:{ember:1},rings:{},headers:{}},theme:'ember',custom:[]};
  const users={};
  profiles.forEach(p=>{users[L(p.id)]={id:L(p.id),uid:p.id,name:p.name,handle:p.handle,bio:p.bio||'',color:colorFor(p.id),avatar:p.avatar_url,header:p.header_url,
    headerFx:p.header_fx,ring:p.ring,stickers:p.stickers||[],plus:false,verified:false,followers:0,following:false,followsMe:false,online:false,private:p.is_private}});
  if(!users.me)users.me={id:'me',uid:myId,name:'',handle:'',bio:'',color:colorFor(myId),stickers:[],followers:0};
  users.me.birth=priv.birth;
  follows.forEach(f=>{const a=users[L(f.followee)],b=users[L(f.follower)];if(a)a.followers++;if(f.follower===myId&&a)a.following=true;if(f.followee===myId&&b)b.followsMe=true});
  const blocked={};blocks.forEach(b=>blocked[L(b.blocked)]=true);
  const mh=new Set(reacts.filter(r=>r.kind==='heat').map(r=>r.post_id)),mf=new Set(reacts.filter(r=>r.kind==='freeze').map(r=>r.post_id));
  const sv=new Set(saves.map(x=>x.post_id)),liked=new Set(myLikes.map(x=>x.comment_id));
  const cm={};comments.forEach(c=>{if(!users[L(c.user_id)])return;(cm[c.post_id]=cm[c.post_id]||[]).push({id:c.id,userId:L(c.user_id),text:c.text||'',sticker:c.sticker,at:+new Date(c.created_at),likes:c.likes,myLike:liked.has(c.id),flags:MOD.classify(c.text||'')})});
  const P=posts.filter(p=>users[L(p.user_id)]).map(p=>({id:p.id,userId:L(p.user_id),text:p.text||'',
    media:p.media_url&&!p.reel?{type:p.media_type,url:p.media_url,gif:p.is_gif}:null,reel:p.reel,
    clip:p.reel?(p.media_url?{kind:'video',url:p.media_url}:{kind:'art',seed:p.clip_seed||1}):null,poster:p.reel&&!p.media_url?posterFor(p.clip_seed||1):null,
    createdAt:+new Date(p.created_at),status:p.status,burnEnds:p.burn_ends?+new Date(p.burn_ends):null,heat:p.heat,freeze:p.freezes,views:p.views,
    myHeat:mh.has(p.id),myFreeze:mf.has(p.id),saved:sv.has(p.id),nsfw:false,flags:MOD.classify(p.text||''),comments:cm[p.id]||[],goneAt:0}));
  const st={};stories.forEach(x=>{if(!users[L(x.user_id)])return;const k=L(x.user_id);(st[k]=st[k]||{userId:k,items:[]}).items.push({id:x.id,type:x.media_type,url:x.media_url,at:+new Date(x.created_at)})});
  const seen={};sviews.forEach(v=>seen[v.story_id]=true);
  const threads={},unread={},seenBy={};
  msgs.forEach(m=>{const other=L(m.sender===myId?m.recipient:m.sender);if(!users[other])return;
    const snap=m.snap?{...m.snap,userId:L(m.snap.userId)}:null;
    (threads[other]=threads[other]||[]).push({id:m.id,from:L(m.sender),text:m.text||'',sticker:m.sticker,postId:m.post_id,snap,note:m.note,react:m.react,at:+new Date(m.created_at)});
    if(m.recipient===myId&&!m.read_at)unread[other]=true;
    if(m.sender===myId&&m.read_at)seenBy[other]=Math.max(seenBy[other]||0,+new Date(m.read_at))});
  const N=notifs.filter(n=>users[L(n.actor_id||n.user_id)]).map(n=>({id:n.id,type:n.type,userId:L(n.actor_id||n.user_id),text:n.text||'',at:+new Date(n.created_at),read:n.read,postId:n.post_id}));
  const ps=priv.settings||{};
  const settings={...DEFAULT_SETTINGS,...ps,notif:{...DEFAULT_SETTINGS.notif,...(ps.notif||{})},muted:ps.muted||[]};
  const temps={};let mine={heat:0,viral:0,earned:0};
  week.forEach(w=>{if(w.user_id===myId)mine={heat:w.heat,viral:w.viral,earned:w.earned};else temps[w.user_id]={heat:w.heat,viral:w.viral}});
  return {now:Date.now(),users,posts:P,stories:Object.values(st),seen,threads,unread,seenBy,notifs:N,blocked,settings,
    points:priv.points,owned:priv.owned,theme:priv.theme||'ember',custom:priv.custom||[],week:mine,temps,deals};
}

async function remote(a,b){
  const P=id=>b.posts.find(p=>p.id===id);
  if(typeof a.id==='number'&&a.id<0)return;           /* tutorial or not-yet-saved item */
  switch(a.type){
    case 'heat': case 'freeze':{const p=P(a.id);if(!p||(a.type==='heat'?p.myHeat:p.myFreeze)||p.status==='gone')return;
      await ok(sb.from('reactions').insert({post_id:a.id,kind:a.type}));return 'reload'}
    case 'view': await sb.rpc('add_view',{pid:a.id});return;
    case 'save':{const p=P(a.id);if(!p)return;
      if(p.saved)await ok(sb.from('saves').delete().eq('user_id',myId).eq('post_id',a.id));else await ok(sb.from('saves').insert({post_id:a.id}));return}
    case 'post':{const row={text:a.text||'',reel:!!a.reel};
      if(a.media){const url=await upload(a.media.file);
        if(a.reel){row.media_url=url;row.media_type='video'}else{row.media_url=url;row.media_type=a.media.type;row.is_gif=!!a.media.gif}}
      else if(a.reel)row.clip_seed=Math.floor(Math.random()*9999)+1;
      await ok(sb.from('posts').insert(row));return 'reload'}
    case 'comment': await ok(sb.from('comments').insert({post_id:a.id,text:a.text||'',sticker:await stick(a.sticker)}));return 'reload';
    case 'likeComment':{const p=P(a.id);const c=p&&p.comments.find(x=>x.id===a.cid);if(!c||c.id<0)return;
      if(c.myLike)await ok(sb.from('comment_likes').delete().eq('comment_id',a.cid).eq('user_id',myId));else await ok(sb.from('comment_likes').insert({comment_id:a.cid}));return}
    case 'follow':{const u=b.users[a.id];if(!u||a.id==='temp')return;
      if(u.following)await ok(sb.from('follows').delete().eq('follower',myId).eq('followee',R(a.id)));else await ok(sb.from('follows').insert({followee:R(a.id)}));return}
    case 'story':{const url=await upload(a.file);await ok(sb.from('stories').insert({media_url:url,media_type:a.mtype}));return 'reload'}
    case 'seen': if(a.id>0)await sb.from('story_views').upsert({story_id:a.id},{onConflict:'story_id,user_id',ignoreDuplicates:true});return;
    case 'dm':{if(a.to==='temp')return;const p=a.postId?P(a.postId):null;
      const snap=p?{userId:R(p.userId),text:p.text,media:p.media&&!String(p.media.url).startsWith('blob:')?p.media:(p.clip&&p.clip.kind==='video'?{type:'video',url:p.clip.url}:null)}:null;
      await ok(sb.from('messages').insert({recipient:R(a.to),text:a.text||'',sticker:await stick(a.sticker),post_id:p&&p.id>0?p.id:null,snap,note:a.note||null}));return 'reload'}
    case 'reactMsg':{const m=(b.threads[a.to]||[]).find(x=>x.id===a.mid);if(!m||m.id<0)return;await ok(sb.from('messages').update({react:m.react?null:'❤️'}).eq('id',a.mid));return}
    case 'read': if(a.id==='temp')return;await ok(sb.from('messages').update({read_at:new Date().toISOString()}).eq('sender',R(a.id)).eq('recipient',myId).is('read_at',null));return;
    case 'readNotifs':{let q=sb.from('notifications').update({read:true}).eq('user_id',myId).eq('read',false);if(a.types)q=q.in('type',a.types);await ok(q);return}
    case 'block': await ok(sb.from('blocks').insert({blocked:R(a.id)}));return 'reload';
    case 'unblock': await ok(sb.from('blocks').delete().eq('blocker',myId).eq('blocked',R(a.id)));return 'reload';
    case 'profile':{const pt={...a.patch},up={};
      for(const k of ['avatar','header'])if(k in pt){let v=pt[k];if(v&&v.startsWith('blob:'))v=await upload(blobFiles[v]);up[k==='avatar'?'avatar_url':'header_url']=v||null}
      if('name' in pt)up.name=pt.name;if('bio' in pt)up.bio=pt.bio;if('headerFx' in pt)up.header_fx=pt.headerFx||null;
      if('handle' in pt&&String(pt.handle).toLowerCase()!==String(b.users.me.handle||'').toLowerCase())up.handle=String(pt.handle).toLowerCase();
      if(Object.keys(up).length)await ok(sb.from('profiles').update(up).eq('id',myId));
      if('birth' in pt)await ok(sb.from('profile_private').update({birth:pt.birth}).eq('id',myId));
      return 'reload'}
    case 'set': case 'setNotif': case 'mute':{const n=reducer(b,a);await ok(sb.from('profile_private').update({settings:n.settings}).eq('id',myId));
      if(a.key==='activity'&&liveCh){try{a.value?await liveCh.track({at:Date.now()}):await liveCh.untrack()}catch(e){}}return}
    case 'buy':{const {error}=await sb.rpc('buy',{k:a.kind,item:a.id});if(error)throw new Error(friendly(error));
      if(a.kind!=='stickers'&&a.id!=='gif')await remote({type:'equip',kind:a.kind,id:a.id},b);return 'reload'}
    case 'equip':
      if(a.kind==='themes')await ok(sb.from('profile_private').update({theme:a.id||'ember'}).eq('id',myId));
      if(a.kind==='rings')await ok(sb.from('profiles').update({ring:a.id}).eq('id',myId));
      if(a.kind==='headers')await ok(sb.from('profiles').update({header_fx:a.id}).eq('id',myId));
      return;
    case 'profileSticker':{const n=reducer(b,a);await ok(sb.from('profiles').update({stickers:await Promise.all((n.users.me.stickers||[]).map(stick))}).eq('id',myId));return}
    case 'makeSticker':{const v=await stick(a.v);await ok(sb.from('profile_private').update({custom:[v,...(b.custom||[])].slice(0,24)}).eq('id',myId));return 'reload'}
    default: return;
  }
}
function emptyState(){return {now:Date.now(),rate:'real',users:{me:{id:'me',name:'',handle:'',bio:'',color:'#ff5500',stickers:[],followers:0}},posts:[],stories:[],seen:{},threads:{},typing:{},seenBy:{},unread:{},
  blocked:{},notifs:[],toast:null,settings:DEFAULT_SETTINGS,points:0,owned:{stickers:{basic:1},themes:{ember:1},rings:{},headers:{}},theme:'ember',week:{heat:0,viral:0,earned:0},temps:{},viewed:{},deals:[],custom:[]}}
''' % (SB_URL, SB_KEY)
rep("function seedState(){", LIVE.strip()+"\n\nfunction seedState(){")

# ---------- reducer: server owns points and weeks; add hydrate / tour / presence ----------
rep("      if(weekOf(now)!==week.idx){week={idx:weekOf(now),heat:0,viral:0,earned:0};toast=T('New week. Thermometers reset.')}\n","")
s=re.sub(r"          if\(p\.userId==='me'\)\{const pts=.*?\n", "          if(p.userId==='me')toast=T('Your take went viral');\n", s, count=1)
rep("    case 'toast': return {...s,toast:T(a.msg)};",
"""    case 'toast': return {...s,toast:T(a.msg)};
    case 'hydrate':{const keep=s.posts.filter(p=>p.tutorial);const st=a.st;
      const users={...st.users};if(s.users.temp)users.temp=s.users.temp;
      Object.values(users).forEach(u=>{const o=s.users[u.id];if(o)u.online=o.online});
      return {...s,...st,users,posts:[...keep,...st.posts],viewed:s.viewed,typing:s.typing,toast:s.toast,now:Date.now()}}
    case 'online':{const users={};Object.entries(s.users).forEach(([k,u])=>users[k]={...u,online:a.ids.includes(u.uid||k)});return {...s,users}}
    case 'tourPosts':{
      if(!a.on){const u={...s.users};delete u.temp;return {...s,users:u,posts:s.posts.filter(p=>!p.tutorial)}}
      const mk=(id,text)=>({id,tutorial:true,userId:'temp',text,media:null,createdAt:s.now-5*60e3,status:'normal',burnEnds:null,heat:0,freeze:0,views:0,myHeat:false,myFreeze:false,saved:false,nsfw:false,flags:{},comments:[],goneAt:0});
      return {...s,users:{...s.users,temp:{id:'temp',name:'Temp',handle:'temp',bio:'',color:'#ff5500',stickers:[],followers:0}},
        posts:[mk(-901,'Pineapple belongs on pizza. Fight me.'),mk(-902,'Cereal is a soup.'),...s.posts.filter(p=>!p.tutorial)]}}""")

# ---------- files keep a handle for uploading ----------
rep("function readFile(file){return {url:URL.createObjectURL(file),type:file.type.startsWith('video')?'video':'image',gif:file.type==='image/gif'}}",
    "function readFile(file){return {url:blobUrl(file),file,type:file.type.startsWith('video')?'video':'image',gif:file.type==='image/gif'}}")
s=s.replace("URL.createObjectURL(f)","blobUrl(f)")

# ---------- live thermometers, deals, coming-soon paid features ----------
block('tempOf', r'''
function tempOf(s,u){
  const w=u.id==='me'?s.week:(s.temps[u.uid||u.id]||{heat:0,viral:0});
  return Math.min(240,32+(w.heat||0)*6+(w.viral||0)*20);
}''')
rep("const deg=tempOf(s,u);const left=(s.week.idx+1)*7*DAY-s.now;","const deg=tempOf(s,u);const left=nextWeekStart()-s.now;")
block('dealsFor', r'''
function dealsFor(s){
  return {ends:nextDayStart()-s.now,list:(s.deals||[]).map(d=>({kind:d.kind,it:(SHOP[d.kind]||[]).find(x=>x.id===d.id),off:d.off,price:d.price})).filter(d=>d.it)};
}''')
rep("<button className=\"pack\" key=${p.n} onClick=${()=>setPack(p)}>","<button className=\"pack\" key=${p.n} disabled style=${{opacity:.6,cursor:'default'}}>")
rep('<b><span style=${{color:\'var(--orange)\',display:\'inline-flex\'}}><${Icon} n="flame" s=${18} w=${2.4} fill="currentColor"/></span>${p.n.toLocaleString()}</b><span className="usd">${p.usd}</span></button>`)}</div>',
    '<b><span style=${{color:\'var(--orange)\',display:\'inline-flex\'}}><${Icon} n="flame" s=${18} w=${2.4} fill="currentColor"/></span>${p.n.toLocaleString()}</b><span className="usd">${p.usd} · Coming soon</span></button>`)}</div>')
rep("""    <div style=${{marginTop:14}}>${plus?html`<button className="btn ghost wide" onClick=${()=>setConfirm(true)}>Cancel Temp+</button>`
      :html`<button className="btn orange wide" onClick=${()=>setConfirm(true)}>Get Temp+ · $8/month</button>`}</div>""",
    """    <div style=${{marginTop:14}}><button className="btn orange wide" disabled>Coming soon</button></div>""")
rep('<${SItem} icon="crown" label="Temp+" val=${me.plus?\'Active\':\'$8/mo\'} onClick=${open.plus}/>','<${SItem} icon="crown" label="Temp+" val="Coming soon" onClick=${open.plus}/>')
s=re.sub(r"      <\$\{SItem\} icon=\"bolt\" label=\"Demo speed\".*?\n","",s,count=1)
rep("${adult&&html`<button className=${nsfw?'tool-on':''}","${adult&&s.users.me.plus&&html`<button className=${nsfw?'tool-on':''}")

# activity: viral payouts
rep("const GROUPS={social:['follow','heat','freeze'],","const GROUPS={social:['follow','heat','freeze','viral'],")
rep("heat:`heated your post: ${n.text}`,","heat:`heated your post: ${n.text}`,viral:`Your take went viral: ${n.text}`,")
rep("const icon={follow:'user',","const icon={viral:'flame',follow:'user',")

# DMs: real typing indicator instead of fake replies
rep("function Thread({s,id,dispatch,simulateReply,open}){","function Thread({s,id,dispatch,simulateReply,onTyping,open}){")
rep("""      <input id="dm-in" placeholder="Message…" value=${t} onChange=${e=>{setT(e.target.value);setErr(null)}} onKeyDown=${e=>e.key==='Enter'&&send()}/>""",
    """      <input id="dm-in" placeholder="Message…" value=${t} onChange=${e=>{setT(e.target.value);setErr(null);onTyping&&onTyping(id)}} onKeyDown=${e=>e.key==='Enter'&&send()}/>""")
# stories upload the real file
s=s.replace("const r=readFile(f);dispatch({type:'story',url:r.url,mtype:r.type})","const r=readFile(f);dispatch({type:'story',url:r.url,mtype:r.type,file:f})")

# ---------- real sign up / sign in ----------
cut("/* ---------- sign up / sign in","/* the tutorial is the only place",r'''/* ---------- sign up / sign in ---------- */
function PwField({id,label,value,onChange,auto}){
  const [show,setShow]=useState(false);
  return html`<div className="field"><label htmlFor=${id}>${label}</label>
    <div className="pw"><input id=${id} type=${show?'text':'password'} autoComplete=${auto} value=${value} onChange=${e=>onChange(e.target.value)}/>
    <button type="button" onClick=${()=>setShow(!show)} aria-label=${show?'Hide password':'Show password'}>${show?'Hide':'Show'}</button></div></div>`;
}
function Splash(){return html`<div className="welcome"><div className="welcome-in" style=${{justifyContent:'center'}}><div className="w-hero" style=${{paddingTop:0}}><h1 className="w-mark">temp<i></i></h1><div className="w-orbs"><span></span><span></span><span></span></div></div></div></div>`}
function Auth(){
  const [mode,setMode]=useState('signup');
  const [f,setF]=useState({name:'',handle:'',email:'',pw:'',birth:''});
  const [err,setErr]=useState('');const [note,setNote]=useState('');const [busy,setBusy]=useState(false);
  const up=(k,v)=>{setF({...f,[k]:v});setErr('')};
  const go=m=>{setMode(m);setErr('');setNote('')};
  const emailOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  async function submit(e){
    e.preventDefault();if(busy)return;setErr('');setNote('');
    const email=f.email.trim().toLowerCase();
    try{
      setBusy(true);
      if(mode==='signup'){
        const handle=f.handle.trim().toLowerCase().replace(/^@/,'');
        if(!f.name.trim())return setErr('Enter your name.');
        if(!/^[a-z0-9._]{3,20}$/.test(handle))return setErr('Usernames are 3–20 letters, numbers, dots or underscores.');
        if(!emailOk(email))return setErr('Enter a valid email.');
        if(!f.birth)return setErr('Enter your birthday.');
        const age=(Date.now()-new Date(f.birth))/31557600000;if(!(age>=13))return setErr('You need to be 13 or older to use Temp.');
        if(f.pw.length<8)return setErr('Passwords need at least 8 characters.');
        const {data:free,error:e1}=await sb.rpc('handle_available',{h:handle});if(e1)throw e1;
        if(!free)return setErr(`@${handle} is taken. Try another.`);
        const {data,error}=await sb.auth.signUp({email,password:f.pw,options:{data:{name:f.name.trim(),handle,birth:f.birth},emailRedirectTo:location.origin+location.pathname}});
        if(error){if(/registered|exists/i.test(error.message))return setErr('That email already has an account. Sign in instead.');if(/database error/i.test(error.message))return setErr('Couldn’t create that account. Try a different username.');throw error}
        if(!data.session){setMode('signin');setNote(`Check ${email} for a link to confirm your account, then sign in.`)}
      } else if(mode==='signin'){
        if(!emailOk(email)||!f.pw)return setErr('Enter your email and password.');
        const {error}=await sb.auth.signInWithPassword({email,password:f.pw});
        if(error)return setErr(/confirm/i.test(error.message)?'Confirm your email first. Check your inbox for the link.':'That email and password don’t match.');
      } else {
        if(!emailOk(email))return setErr('Enter a valid email.');
        const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;
        setNote(`If ${email} has an account, a reset link is on its way.`);
      }
    }catch(x){setErr(friendly(x))}finally{setBusy(false)}
  }
  return html`<div className="welcome"><div className="welcome-in">
    <div className="w-hero"><h1 className="w-mark">temp<i></i></h1><div className="w-orbs"><span></span><span></span><span></span></div></div>
    <form className="w-form" onSubmit=${submit} noValidate>
      ${mode!=='forgot'?html`<div className="seg" role="group" aria-label="Account" style=${{marginBottom:6}}>
          <button type="button" aria-pressed=${mode==='signup'} onClick=${()=>go('signup')}>Sign up</button>
          <button type="button" aria-pressed=${mode==='signin'} onClick=${()=>go('signin')}>Sign in</button></div>`
        :html`<h2 className="top-title" style=${{fontSize:22,margin:'0 0 4px'}}>Reset password</h2>`}
      ${mode==='signup'&&html`
        <div className="field"><label htmlFor="a-name">Name</label><input id="a-name" autoComplete="name" value=${f.name} onChange=${e=>up('name',e.target.value)} maxLength=${40}/></div>
        <div className="field"><label htmlFor="a-handle">Username</label><input id="a-handle" autoComplete="username" autoCapitalize="none" value=${f.handle} onChange=${e=>up('handle',e.target.value.replace(/\s/g,''))} maxLength=${21}/></div>`}
      <div className="field"><label htmlFor="a-email">Email</label><input id="a-email" type="email" autoComplete="email" autoCapitalize="none" value=${f.email} onChange=${e=>up('email',e.target.value)}/></div>
      ${mode==='signup'&&html`<div className="field"><label htmlFor="a-birth">Birthday</label><input id="a-birth" type="date" autoComplete="bday" value=${f.birth} onChange=${e=>up('birth',e.target.value)}/></div>`}
      ${mode!=='forgot'&&html`<${PwField} id="a-pw" label="Password" auto=${mode==='signup'?'new-password':'current-password'} value=${f.pw} onChange=${v=>up('pw',v)}/>`}
      ${mode==='signin'&&html`<button type="button" className="a-link" onClick=${()=>go('forgot')}>Forgot password?</button>`}
      ${err&&html`<p className="a-err" role="alert">${err}</p>`}
      ${note&&html`<p className="a-note" role="status">${note}</p>`}
      <button type="submit" className="btn orange wide" disabled=${busy} style=${{marginTop:18}}>${busy?'One sec…':mode==='signup'?'Create account':mode==='signin'?'Sign in':'Send reset link'}</button>
      ${mode==='forgot'&&html`<button type="button" className="a-link" style=${{justifySelf:'center',marginTop:10}} onClick=${()=>go('signin')}>Back to sign in</button>`}
    </form>
  </div></div>`;
}
function NewPassword({onDone}){
  const [pw,setPw]=useState('');const [err,setErr]=useState('');const [busy,setBusy]=useState(false);
  async function submit(e){e.preventDefault();if(pw.length<8)return setErr('Passwords need at least 8 characters.');setBusy(true);
    const {error}=await sb.auth.updateUser({password:pw});setBusy(false);if(error)return setErr(friendly(error));onDone()}
  return html`<div className="welcome"><div className="welcome-in">
    <div className="w-hero"><h1 className="w-mark">temp<i></i></h1></div>
    <form className="w-form" onSubmit=${submit} noValidate><h2 className="top-title" style=${{fontSize:22,margin:'0 0 4px'}}>New password</h2>
      <${PwField} id="np-pw" label="New password" auto="new-password" value=${pw} onChange=${v=>{setPw(v);setErr('')}}/>
      ${err&&html`<p className="a-err" role="alert">${err}</p>`}
      <button type="submit" className="btn orange wide" disabled=${busy} style=${{marginTop:18}}>Save password</button></form>
  </div></div>`;
}

''')

# ---------- App: real session, realtime, presence ----------
a=s.index('function App(){'); b=s.index('  const open={',a)
s=s[:a]+r'''function App(){
  const [s,raw]=useReducer(reducer,null,emptyState);
  const [view,setView]=useState({tab:'home'});
  const [sheet,setSheet]=useState(null);
  const [storyUser,setStoryUser]=useState(null);
  const [session,setSession]=useState(undefined);
  const [recovery,setRecovery]=useState(false);
  const [ready,setReady]=useState(false);
  const [tour,setTour]=useState(null);
  const [tourIds,setTourIds]=useState({});
  const [query,setQuery]=useState('');
  const [setSub,setSetSub]=useState(null);
  const [breakOpen,setBreakOpen]=useState(false);
  const tourRef=useRef(null);tourRef.current=tour;
  const sRef=useRef(s);sRef.current=s;const viewRef=useRef(view);viewRef.current=view;
  const storyFile=useRef();const reloadT=useRef();const lastTyping=useRef(0);const startTourRef=useRef();

  const reload=useCallback(()=>{clearTimeout(reloadT.current);reloadT.current=setTimeout(async()=>{
    try{const st=await loadAll();raw({type:'hydrate',st})}catch(e){console.error(e)}},350)},[]);
  const dispatch=useCallback(a=>{const before=sRef.current;raw(a);if(!myId)return;
    remote(a,before).then(r=>{if(r==='reload')reload()}).catch(e=>{raw({type:'toast',msg:e.message||'Something went wrong. Try again.'});reload()})},[]);

  useEffect(()=>{
    sb.auth.getSession().then(({data})=>setSession(data.session||null));
    const {data:sub}=sb.auth.onAuthStateChange((ev,ses)=>{if(ev==='PASSWORD_RECOVERY')setRecovery(true);setSession(ses||null)});
    return()=>sub.subscription.unsubscribe();
  },[]);
  const uidKey=session&&session.user.id;
  useEffect(()=>{
    if(!uidKey){myId=null;setReady(false);raw({type:'hydrate',st:emptyState()});return}
    myId=uidKey;let alive=true;
    loadAll().then(st=>{if(!alive)return;raw({type:'hydrate',st});setReady(true);
      if(!store.get('temp-tour-'+myId)){store.set('temp-tour-'+myId,'1');setTimeout(()=>startTourRef.current&&startTourRef.current(),600)}})
      .catch(e=>{console.error(e);raw({type:'toast',msg:'Couldn’t load Temp. Check your connection and refresh.'});setReady(true)});
    const db=sb.channel('db-'+myId).on('postgres_changes',{event:'*',schema:'public'},()=>reload()).subscribe();
    const live=sb.channel('live',{config:{presence:{key:myId}}});
    live.on('broadcast',{event:'typing'},({payload})=>{if(!payload||payload.to!==myId)return;const from=payload.from;
        raw({type:'typing',id:from,on:true});clearTimeout(typingT[from]);typingT[from]=setTimeout(()=>raw({type:'typing',id:from,on:false}),3500)})
      .on('presence',{event:'sync'},()=>raw({type:'online',ids:Object.keys(live.presenceState())}))
      .subscribe(async st=>{if(st==='SUBSCRIBED'&&sRef.current.settings.activity!==false){try{await live.track({at:Date.now()})}catch(e){}}});
    liveCh=live;
    const poll=setInterval(reload,60000);
    return()=>{alive=false;clearInterval(poll);sb.removeChannel(db);sb.removeChannel(live);liveCh=null};
  },[uidKey]);

  useEffect(()=>{let last=performance.now();const i=setInterval(()=>{const t=performance.now();raw({type:'tick',dt:t-last,paused:tourRef.current!==null});last=t},250);return()=>clearInterval(i)},[]);
  useEffect(()=>{if(tour===null&&view.tab!=='replay')scrollTo(0,0)},[view.tab,view.profileId,view.threadId,setSub]);
  useEffect(()=>{const r=document.documentElement;if(s.settings.theme==='system')delete r.dataset.theme;else r.dataset.theme=s.settings.theme},[s.settings.theme]);
  useEffect(()=>{const t=SHOP.themes.find(x=>x.id===s.theme);const r=document.documentElement.style;
    if(!t||t.id==='ember'){r.removeProperty('--orange');r.removeProperty('--orange-2')}else{r.setProperty('--orange',t.c[0]);r.setProperty('--orange-2',t.c[1])}},[s.theme]);
  useEffect(()=>{if(!s.settings.breakMins)return;const t=setTimeout(()=>setBreakOpen(true),s.settings.breakMins*60e3);return()=>clearTimeout(t)},[s.settings.breakMins,breakOpen]);

  const onTyping=useCallback(id=>{const now=Date.now();if(now-lastTyping.current<1500||!liveCh||id==='temp')return;lastTyping.current=now;
    liveCh.send({type:'broadcast',event:'typing',payload:{from:myId,to:R(id)}}).catch(()=>{})},[]);
  function simulateReply(){}
  function startTour(){
    raw({type:'tourPosts',on:true});setTourIds({a:-901,b:-902});
    setView({tab:'home'});setSheet(null);setStoryUser(null);setSetSub(null);scrollTo(0,0);setTimeout(()=>setTour(0),60);
  }
  startTourRef.current=startTour;
  function endTour(){setTour(null);setTourIds({});raw({type:'tourPosts',on:false});scrollTo({top:0,behavior:'smooth'})}
  async function logout(kind){
    try{if(kind==='delete'){const {error}=await sb.rpc('delete_me');if(error)throw error}}catch(e){raw({type:'toast',msg:friendly(e)});return}
    await sb.auth.signOut();setView({tab:'home'});setSetSub(null);setTour(null);
  }

'''+s[b:]
rep("""  if(!session){
    const enter=(a,isNew)=>{dispatch({type:'profile',patch:{name:a.name,handle:a.handle,bio:a.bio||'',birth:a.birth||null},silent:true});store.set('temp-session',a.handle);setSession(a.handle);setView({tab:'home'});if(isNew)setTimeout(startTour,350)};
    return html`<${Auth} startMode=${authMode} onSignUp=${a=>enter(a,true)} onSignIn=${a=>enter(a,false)}/>`;
  }""","""  if(session===undefined)return html`<${Splash}/>`;
  if(recovery)return html`<${NewPassword} onDone=${()=>setRecovery(false)}/>`;
  if(!session)return html`<${Auth}/>`;
  if(!ready)return html`<${Splash}/>`;""")
rep("body=html`<${Thread} s=${s} id=${view.threadId} dispatch=${dispatch} simulateReply=${simulateReply} open=${open}/>`;",
    "body=html`<${Thread} s=${s} id=${view.threadId} dispatch=${dispatch} simulateReply=${simulateReply} onTyping=${onTyping} open=${open}/>`;")
rep("    const u=s.users[view.threadId];\n","    const u=s.users[view.threadId]||{id:view.threadId,name:'Unknown',handle:'unknown',color:'#888'};\n")
# remove the old browser-only account code
s=re.sub(r"\n/\* ---------- sign up / sign in \(prototype.*?(?=\n/\* the tutorial)","\n",s,flags=re.S) if '(prototype' in s else s
# remove tutorial copy about demo speed and the welcome tour copy that references settings
s=s.replace("{title:'You’re in.',body:'Replay this anytime from Settings.',last:true}","{title:'You’re in.',body:'Replay this anytime from Settings. Now go post a take.',last:true}")

# ---------- page shell ----------
title=s[:s.index('\n')]
body=s[s.index('\n')+1:]
head='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>html{-webkit-text-size-adjust:100%}body{overflow-x:clip;overscroll-behavior-x:none;max-width:100%}input,textarea,select{font-size:16px!important}.stories,.deals,.picker{touch-action:pan-x pan-y;overscroll-behavior-x:contain}</style>
<meta name="theme-color" content="#ff5500">
<meta name="description" content="Temp: hot takes with a shelf life.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%230a0a0a'/%3E%3Ctext x='12' y='46' font-family='Arial Black,Arial' font-weight='900' font-size='38' fill='%23ffffff'%3Et%3C/text%3E%3Crect x='42' y='36' width='10' height='10' rx='2' fill='%23ff5500'/%3E%3C/svg%3E">
'''+title+'''
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font-size:14px;font-family:system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
'''
out=head+body.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')+'\n</body>\n</html>\n'
open(OUT,'w').write(out)
js=re.findall(r'<script>(.*?)</script>',out,re.S)[-1];open('/tmp/claude-0/web.js','w').write(js)
print('built',len(out))
