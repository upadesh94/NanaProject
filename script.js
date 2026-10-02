/* Pana Calculator - shared-data frontend */
const MASTER_DATA = {"sp_table": [["128", "129", "120", "130", "140", "123", "124", "125", "126", "127"], ["137", "138", "139", "149", "159", "150", "160", "134", "135", "136"], ["146", "147", "346", "158", "168", "169", "179", "170", "180", "145"], ["236", "156", "157", "167", "230", "178", "250", "189", "234", "190"], ["245", "237", "238", "239", "249", "240", "269", "260", "270", "235"], ["290", "246", "247", "248", "258", "259", "278", "279", "289", "280"], ["380", "345", "256", "257", "267", "268", "340", "350", "360", "370"], ["470", "390", "346", "347", "348", "349", "359", "369", "379", "389"], ["489", "480", "490", "356", "357", "358", "368", "378", "450", "460"], ["560", "570", "580", "590", "456", "367", "458", "459", "469", "479"], ["579", "589", "670", "680", "690", "457", "467", "468", "478", "569"], ["678", "679", "689", "789", "780", "790", "890", "567", "568", "578"]], "dp_table": [["100", "110", "166", "112", "113", "114", "115", "116", "117", "118"], ["119", "200", "229", "220", "122", "277", "133", "224", "144", "226"], ["155", "228", "300", "266", "177", "330", "188", "233", "199", "244"], ["227", "255", "337", "338", "339", "448", "223", "288", "225", "299"], ["335", "336", "355", "400", "366", "466", "377", "440", "388", "334"], ["344", "499", "445", "446", "447", "556", "449", "477", "559", "488"], ["399", "660", "599", "455", "500", "600", "557", "558", "577", "550"], ["588", "688", "779", "699", "799", "880", "566", "800", "667", "668"], ["669", "778", "788", "770", "889", "899", "700", "990", "900", "677"], ["777", "444", "111", "888", "555", "222", "999", "666", "333", "000"]], "families": {"Group 1": ["128", "137", "236", "678", "123", "178", "268", "267"], "Group 2": ["245", "290", "470", "579", "240", "259", "457", "790"], "Group 3": ["129", "147", "246", "679", "124", "179", "269", "467"], "Group 4": ["345", "390", "480", "589", "340", "359", "458", "890"], "Group 5": ["120", "157", "256", "670", "125", "170", "260", "567"], "Group 6": ["139", "148", "346", "689", "134", "189", "369", "468"], "Group 7": ["130", "158", "356", "680", "135", "180", "360", "568"], "Group 8": ["239", "248", "347", "789", "234", "289", "379", "478"], "Group 9": ["140", "159", "456", "690", "145", "190", "460", "569"], "Group 10": ["230", "258", "357", "780", "235", "280", "370", "578"], "Group 11": ["227", "277", "222", "777"], "Group 12": ["449", "499", "444", "999"], "Group 13": ["146", "119", "669", "169", "114", "466"], "Group 14": ["330", "335", "588", "358", "380", "880"], "Group 15": ["138", "336", "688", "368", "133", "188"], "Group 16": ["156", "110", "660", "160", "115", "566"], "Group 17": ["238", "337", "788", "378", "233", "288"], "Group 18": ["247", "229", "779", "279", "224", "477"], "Group 19": ["167", "112", "266", "126", "117", "667"], "Group 20": ["257", "220", "770", "270", "225", "577"], "Group 21": ["168", "113", "366", "136", "118", "668"], "Group 22": ["249", "447", "799", "479", "244", "299"], "Group 23": ["166", "116", "111", "666"], "Group 24": ["338", "388", "333", "888"], "Group 25": ["489", "344", "399", "349", "448", "899"], "Group 26": ["560", "100", "155", "150", "556", "600"], "Group 27": ["237", "228", "778", "278", "223", "377"], "Group 28": ["570", "200", "255", "250", "557", "700"], "Group 29": ["490", "445", "599", "459", "440", "990"], "Group 30": ["580", "300", "355", "350", "558", "800"], "Group 31": ["149", "446", "699", "469", "144", "199"], "Group 32": ["590", "400", "455", "450", "559", "900"], "Group 33": ["267", "122", "177", "127", "226", "677"], "Group 34": ["348", "339", "889", "389", "334", "488"], "Group 35": ["500", "550", "555", "000"]}};
const COLS = ['1','2','3','4','5','6','7','8','9','0'];
const OPEN_NUMBERS = ['1','2','3','4','5','6','7','8','9','0'];
const API_BASE = window.API_BASE || '';
let numberAmounts = {};
let openAmounts = {};
let historyLog = [];
let authToken = '';
let currentUser = '';
let firebaseUid = '';
let sharedStateVersion = null;
let sharedStatePollTimer = null;

function setAuth(token, username) {
  authToken = token || '';
  currentUser = username || '';
  const userEl = document.getElementById('header-user-email');
  if (userEl && username) {
    userEl.textContent = username;
  }
}

function startLiveClock() {
  function tick() {
    const now = new Date();
    const dtEl = document.getElementById('header-live-datetime');
    if (dtEl) {
      const datePart = now.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const timePart = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      dtEl.textContent = `${datePart} • ${timePart}`;
    }
  }
  tick();
  setInterval(tick, 1000);
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startLiveClock);
  } else {
    startLiveClock();
  }
}
async function apiRequest(path, options={}) {
  const headers = {'Content-Type':'application/json', ...(options.headers||{})};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(API_BASE + path, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if (res.status === 401) { setAuth('',''); throw new Error('LOGIN_REQUIRED'); }
  if (!res.ok) throw new Error(data.error || 'Server request failed');
  return data;
}
async function loadSharedState() {
  const data = await apiRequest('/api/state');
  numberAmounts = data.numberAmounts || {};
  openAmounts = data.openAmounts || {};
  historyLog = data.historyLog || [];
  updateAllTotalsAndUI();
}
async function pollSharedStateVersion() {
  const result = await apiRequest('/api/state/version');
  if (sharedStateVersion === null) {
    sharedStateVersion = result.version;
    return;
  }
  if (result.version !== sharedStateVersion) {
    sharedStateVersion = result.version;
    await loadSharedState();
  }
}
async function applySharedTransaction(payload) {
  // Save directly to Firestore if available
  if (typeof window.firebaseSaveTransaction === 'function') {
    try {
      window.firebaseSaveTransaction({
        mode: payload.modeDesc || payload.mode,
        inputNum: payload.num,
        amount: payload.amount,
        targets: payload.targets,
        totalAdd: payload.totalAdd,
        user: currentUser || firebaseUid,
        user_email: currentUser,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      }).catch(err => console.warn('Firestore direct save warning:', err.message));
    } catch (e) {
      console.warn('Firestore call error:', e);
    }
  }

  const data = await apiRequest('/api/transactions/apply',{method:'POST',body:JSON.stringify(payload)});
  numberAmounts = data.numberAmounts || {};
  openAmounts = data.openAmounts || {};
  historyLog = data.historyLog || [];
  updateAllTotalsAndUI();
  return data;
}
async function login(email,password) {
  const user = await window.firebaseSignIn(email.trim(), password);
  firebaseUid = user.uid;
  setAuth(await user.getIdToken(true), user.email);
  await loadSharedState();
  return user;
}
function logout(){ return window.firebaseSignOut().finally(() => location.reload()); }

function init(){
  startLiveClock();
  renderOpenTable(); renderSPTable(); renderDPTable(); renderFamilyTable(); updateAllTotalsAndUI();
  
  if (window.firebaseOnAuthStateChanged) {
    window.firebaseOnAuthStateChanged(async user => {
      if (!user) {
        firebaseUid = '';
        setAuth('', '');
        if (sharedStatePollTimer) clearInterval(sharedStatePollTimer);
        sharedStatePollTimer = null;
        sharedStateVersion = null;
        return;
      }
      
      firebaseUid = user.uid;
      // After login, we fetch the token and let backend handle the rest.
      setAuth(await user.getIdToken(), user.email);
      
      try {
        await apiRequest('/api/me');
      } catch (e) {
        showStatus(e.message, true);
        return;
      }
      
      try { await loadSharedState(); }
      catch (e) { showStatus(e.message, true); return; }
      
      try { await pollSharedStateVersion(); }
      catch (e) { showStatus(e.message, true); return; }
      
      if (sharedStatePollTimer) clearInterval(sharedStatePollTimer);
      sharedStatePollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') pollSharedStateVersion().catch(e=>showStatus(e.message,true));
      }, 1200);
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && authToken) pollSharedStateVersion().catch(e=>showStatus(e.message,true));
  });
}
function switchPage(pageId,btn){
  document.querySelectorAll('.page-section').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(pageId).classList.add('active'); btn.classList.add('active');
}
function showStatus(msg,isError=false){const sb=document.getElementById('search-status'); sb.className='status-box '+(isError?'status-error':'status-info'); sb.innerHTML=msg;}
function locateNumber(val){
  const tokens=val.trim().split(',').map(s=>s.trim()).filter(Boolean);
  if(!tokens.length){document.getElementById('search-status').style.display='none';return;}
  if(tokens.length>1){showStatus(`Multiple numbers entered: [${tokens.join(', ')}]`);return;}
  const num=tokens[0],spLocs=[],dpLocs=[],fams=[];
  MASTER_DATA.sp_table.forEach(r=>r.forEach((v,c)=>{if(v===num)spLocs.push(`Col ${COLS[c]}`);}));
  MASTER_DATA.dp_table.forEach(r=>r.forEach((v,c)=>{if(v===num)dpLocs.push(`Col ${COLS[c]}`);}));
  Object.entries(MASTER_DATA.families).forEach(([g,m])=>{if(m.includes(num))fams.push(g);});
  const isOpen=OPEN_NUMBERS.includes(num);
  if(!spLocs.length&&!dpLocs.length&&!fams.length&&!isOpen) return showStatus(`Number <strong>${num}</strong> NOT found in master data or Open numbers.`,true);
  let text=`Found <strong>${num}</strong> in: `;
  if(isOpen)text+='[Open Number] ';
  if(spLocs.length)text+=`[SP: ${spLocs.join(', ')}] `;
  if(dpLocs.length)text+=`[DP: ${dpLocs.join(', ')}] `;
  if(fams.length)text+=`[Family: ${fams.join(', ')}]`;
  showStatus(text);
}
function existsInTable(table,num){return table.some(row=>row.includes(num));}
function existsInFamily(num){return Object.values(MASTER_DATA.families).some(m=>m.includes(num));}
function existsInExcel(num){return existsInTable(MASTER_DATA.sp_table,num)||existsInTable(MASTER_DATA.dp_table,num)||existsInFamily(num);}
function findNumberColInTable(table,num){for(const row of table){const i=row.indexOf(num);if(i!==-1)return i;}return -1;}

async function applyMode(mode){
  const rawInput=document.getElementById('input-number').value.trim(), amt=parseFloat(document.getElementById('input-amount').value.trim());
  if(!rawInput)return showStatus('Please enter a number.',true);
  if(!Number.isFinite(amt)||amt<=0)return showStatus('Please enter a valid positive amount (> 0).',true);
  let targets=[],desc='';
  if(mode==='SINGLE'){
    const toks=rawInput.split(',').map(s=>s.trim()).filter(Boolean); targets=toks.filter(existsInExcel);
    if(!targets.length)return showStatus('None of the entered numbers exist in master data!',true);
    desc=`Single (${targets.join(', ')})`;
  }else if(mode==='OPEN'){
    targets=rawInput.split(/[\s,]+/).filter(x=>OPEN_NUMBERS.includes(x));
    if(!targets.length)return showStatus('Invalid Open numbers. Please enter digits from 1 to 0.',true);
    desc=`Open (${targets.join(', ')})`;
  }else if(mode==='SP_COLUMN'||mode==='DP_COLUMN'){
    const table=mode==='SP_COLUMN'?MASTER_DATA.sp_table:MASTER_DATA.dp_table, idx=findNumberColInTable(table,rawInput);
    if(idx<0)return showStatus(`Number ${rawInput} not found to determine column!`,true);
    targets=table.map(r=>r[idx]).filter(Boolean); desc=`${mode==='SP_COLUMN'?'SP':'DP'} Column (${COLS[idx]})`;
  }else if(mode==='FAMILY'){
    const groups=Object.entries(MASTER_DATA.families).filter(([,m])=>m.includes(rawInput));
    if(!groups.length)return showStatus(`Number ${rawInput} does not belong to any Family group!`,true);
    targets=[...new Set(groups.flatMap(([,m])=>m))]; desc=`Family (${groups.map(([g])=>g).join(', ')})`;
  }
  try{await applySharedTransaction({mode,num:rawInput,amount:amt,targets,modeDesc:desc,totalAdd:amt*targets.length});showStatus(`Successfully added ₹${amt} via ${desc}. Total additions = ₹${amt*targets.length}`);}catch(e){showStatus(e.message==='LOGIN_REQUIRED'?'Please login first.':e.message,true);}
}
async function applyDirectCol(type,col,amtVal){
  const amt=parseFloat(amtVal); if(!Number.isFinite(amt)||amt<=0)return;
  const idx=COLS.indexOf(col), table=type==='SP'?MASTER_DATA.sp_table:MASTER_DATA.dp_table, targets=table.map(r=>r[idx]).filter(Boolean);
  try{await applySharedTransaction({mode:`${type}_COLUMN`,num:`Col ${col}`,amount:amt,targets,modeDesc:`${type} Column ${col} Direct`,totalAdd:amt*targets.length});}catch(e){showStatus(e.message,true);}
}
async function applyCommonCol(col,amtVal){
  const amt=parseFloat(amtVal); if(!Number.isFinite(amt)||amt<=0)return;
  const idx=COLS.indexOf(col),targets=[...MASTER_DATA.sp_table.map(r=>r[idx]),...MASTER_DATA.dp_table.map(r=>r[idx])].filter(Boolean);
  try{await applySharedTransaction({mode:'COMMON_COLUMN',num:`Col ${col}`,amount:amt,targets,modeDesc:`Common SP + DP Column ${col}`,totalAdd:amt*targets.length});}catch(e){showStatus(e.message,true);}
}
function clearAllInputs() {
  const numInput = document.getElementById('input-number');
  if (numInput) numInput.value = '';

  const amtInput = document.getElementById('input-amount');
  if (amtInput) amtInput.value = '';

  document.querySelectorAll('.col-input').forEach(input => {
    input.value = '';
  });

  document.querySelectorAll('input').forEach(input => {
    if (input.type === 'text' || input.type === 'number' || input.type === 'search') {
      input.value = '';
    }
  });

  const sb = document.getElementById('search-status');
  if (sb) {
    sb.className = 'status-box';
    sb.style.display = 'none';
    sb.innerHTML = '';
  }
}

async function resetCalculator() {
  const confirmed = await confirmAction(
    'Are you sure you want to reset all account data? All amounts and inputs will be cleared.',
    'Reset All Amounts',
    {
      title: 'Confirm Reset All Amounts',
      icon: '🔄',
      showExcel: true
    }
  );
  if (!confirmed) return;

  clearAllInputs();

  try {
    const d = await apiRequest('/api/reset', { method: 'POST' });
    numberAmounts = d.numberAmounts || {};
    openAmounts = d.openAmounts || {};
    historyLog = d.historyLog || [];
    updateAllTotalsAndUI();
    showStatus('Shared calculator state and all inputs have been reset.');
  } catch (e) {
    showStatus(e.message, true);
  }
}

async function deleteTransaction(transactionId) {
  const confirmed = await confirmAction(
    'Are you sure you want to delete this transaction from history? You can download an Excel backup below before deleting.',
    'Delete Record',
    {
      title: 'Confirm Delete Transaction',
      icon: '🗑️',
      showExcel: true
    }
  );
  if (!confirmed) return;

  try {
    const d = await apiRequest(`/api/history/${encodeURIComponent(transactionId)}`, { method: 'DELETE' });
    numberAmounts = d.numberAmounts || {};
    openAmounts = d.openAmounts || {};
    historyLog = d.historyLog || [];
    updateAllTotalsAndUI();
    showStatus('Transaction deleted successfully.');
  } catch (e) {
    showStatus(e.message, true);
  }
}

function confirmAction(message, confirmLabel = 'Confirm', options = {}) {
  const dialog = document.getElementById('action-confirm-dialog');
  if (!dialog) return Promise.resolve(confirm(message));

  const prompt = document.getElementById('action-confirm-message');
  const titleEl = document.getElementById('action-confirm-title');
  const iconEl = document.getElementById('action-confirm-icon');
  const confirmBtn = document.getElementById('action-confirm-submit');
  const cancelBtn = document.getElementById('action-confirm-cancel');
  const excelBox = document.getElementById('dialog-excel-box');

  if (prompt) prompt.textContent = message;
  if (confirmBtn) confirmBtn.textContent = confirmLabel;
  if (titleEl) titleEl.textContent = options.title || 'Confirm Action';
  if (iconEl) iconEl.textContent = options.icon || (confirmLabel.toLowerCase().includes('delete') ? '🗑️' : '⚠️');

  if (excelBox) {
    excelBox.style.display = options.showExcel !== false ? 'flex' : 'none';
  }

  return new Promise(resolve => {
    let resolved = false;

    const handleConfirm = (e) => {
      if (e) e.preventDefault();
      if (resolved) return;
      resolved = true;
      cleanup();
      dialog.close('confirm');
      resolve(true);
    };

    const handleCancel = (e) => {
      if (e) e.preventDefault();
      if (resolved) return;
      resolved = true;
      cleanup();
      dialog.close('cancel');
      resolve(false);
    };

    const handleClose = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(dialog.returnValue === 'confirm');
    };

    function cleanup() {
      if (confirmBtn) confirmBtn.removeEventListener('click', handleConfirm);
      if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
      dialog.removeEventListener('close', handleClose);
    }

    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    dialog.addEventListener('close', handleClose);

    dialog.showModal();
  });
}
function renderOpenTable(){const tb=document.getElementById('open-tbody');if(!tb)return;tb.innerHTML=OPEN_NUMBERS.map(n=>`<tr><td><span class="cell-num">${n}</span></td><td><span class="cell-amt" id="open-amt-${n}"></span></td></tr>`).join('');}
function renderSPTable(){const tb=document.getElementById('sp-tbody');if(!tb)return;tb.innerHTML=MASTER_DATA.sp_table.map((row,r)=>`<tr><td></td>${row.map((v,c)=>`<td id="sp-cell-${r}-${c}"><span class="cell-num">${v}</span><span class="cell-amt" id="sp-amt-${r}-${c}"></span></td>`).join('')}<td class="row-total-col" id="sp-row-tot-${r}">0</td></tr>`).join('');}
function renderDPTable(){const tb=document.getElementById('dp-tbody');if(!tb)return;tb.innerHTML=MASTER_DATA.dp_table.map((row,r)=>`<tr><td></td>${row.map((v,c)=>`<td id="dp-cell-${r}-${c}"><span class="cell-num">${v}</span><span class="cell-amt" id="dp-amt-${r}-${c}"></span></td>`).join('')}<td class="row-total-col" id="dp-row-tot-${r}">0</td></tr>`).join('');}
function renderFamilyTable(){const box=document.getElementById('family-container');if(!box)return;box.innerHTML=Object.entries(MASTER_DATA.families).map(([g,members])=>`<div class="family-card"><div class="family-header"><span>${g.toUpperCase()}</span><span>Group Total: <span id="fam-tot-${g}">0</span></span></div><div class="family-members">${members.map((m,i)=>`<div class="family-chip"><span>${m}</span><span class="cell-amt" id="fam-amt-${g}-${i}"></span></div>`).join('')}</div></div>`).join('');}
function updateAllTotalsAndUI(){
  let openTotal=0;OPEN_NUMBERS.forEach(n=>{const a=Number(openAmounts[n]||0),e=document.getElementById(`open-amt-${n}`);if(e)e.innerText=a>0?a:'';openTotal+=a;});
  const oe=document.getElementById('open-grand-total');if(oe)oe.innerText=openTotal;
  const spCols=new Array(10).fill(0),dpCols=new Array(10).fill(0);let spTotal=0,dpTotal=0;
  MASTER_DATA.sp_table.forEach((row,r)=>{let rs=0;row.forEach((n,c)=>{const a=Number(numberAmounts[n]||0),e=document.getElementById(`sp-amt-${r}-${c}`);if(e)e.innerText=a>0?a:'';rs+=a;spCols[c]+=a;});const re=document.getElementById(`sp-row-tot-${r}`);if(re)re.innerText=rs;spTotal+=rs;});
  spCols.forEach((a,c)=>{const e=document.getElementById(`sp-col-tot-${COLS[c]}`);if(e)e.innerText=a;});
  const se=document.getElementById('sp-grand-total');if(se)se.innerText=spTotal;const sm=document.getElementById('sp-matrix-total');if(sm)sm.innerText=spTotal;
  MASTER_DATA.dp_table.forEach((row,r)=>{let rs=0;row.forEach((n,c)=>{const a=Number(numberAmounts[n]||0),e=document.getElementById(`dp-amt-${r}-${c}`);if(e)e.innerText=a>0?a:'';rs+=a;dpCols[c]+=a;});const re=document.getElementById(`dp-row-tot-${r}`);if(re)re.innerText=rs;dpTotal+=rs;});
  dpCols.forEach((a,c)=>{const e=document.getElementById(`dp-col-tot-${COLS[c]}`);if(e)e.innerText='₹'+a;});
  const de=document.getElementById('dp-grand-total');if(de)de.innerText=dpTotal;const dm=document.getElementById('dp-matrix-total');if(dm)dm.innerText='₹'+dpTotal;
  Object.entries(MASTER_DATA.families).forEach(([g,members])=>{let sum=0;members.forEach((n,i)=>{const a=Number(numberAmounts[n]||0),e=document.getElementById(`fam-amt-${g}-${i}`);if(e)e.innerText=a>0?a:'';sum+=a;});const e=document.getElementById(`fam-tot-${g}`);if(e)e.innerText=sum;});
  const overall=Object.values(numberAmounts).reduce((a,b)=>a+Number(b||0),0)+openTotal;const ov=document.getElementById('overall-total');if(ov)ov.innerText=overall;
  const hl=document.getElementById('history-list');if(hl)hl.innerHTML=historyLog.length?historyLog.map(h=>`<div class="history-item"><span><strong>[${h.time||''}]</strong> Mode: <strong>${h.mode||''}</strong> | Input: ${h.num||''} | Amt: ${h.amt||''}</span><span>Total Added: <strong>${h.totalAdd||0}</strong></span><button class="delete-btn" type="button" onclick="deleteTransaction('${h.id}')">DELETE</button></div>`).join(''):'<div style="color:#94a3b8;">No transactions performed yet.</div>';
}
function exportToExcel(){
  if(typeof XLSX==='undefined')return alert('Excel library is loading. Please check your internet connection.');
  const all=[...MASTER_DATA.sp_table.flat(),...MASTER_DATA.dp_table.flat()], unique=[...new Set(all)];let minNum=unique[0],maxNum=unique[0],minAmt=Number(numberAmounts[minNum]||0),maxAmt=minAmt;
  unique.forEach(n=>{const a=Number(numberAmounts[n]||0);if(a<minAmt){minAmt=a;minNum=n;}if(a>maxAmt){maxAmt=a;maxNum=n;}});
  const now=new Date(),dateStr=now.toLocaleDateString('en-GB').split('/').join('-'),timeStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
  const rows=[[`Date: ${dateStr}`],[`Time: ${timeStr}`],[''],['Minimum Amount:'],[`Number: ${minNum}`],[`Amount: ${minAmt}`],[''],['Maximum Amount:'],[`Number: ${maxNum}`],[`Amount: ${maxAmt}`],[''],['OPEN TABLE'],['Index','Amount']];let openTotal=0;OPEN_NUMBERS.forEach(n=>{const a=Number(openAmounts[n]||0);openTotal+=a;rows.push([n,a>0?String(a):'']);});rows.push(['Total',String(openTotal)],[''],['COMBINED SP + DP PANA CHART'],['','1','2','3','4','5','6','7','8','9','0']);const sums=new Array(10).fill(0);let spdp=0;for(const row of [...MASTER_DATA.sp_table,...MASTER_DATA.dp_table]){const out=[''];row.forEach((n,c)=>{const a=Number(numberAmounts[n]||0);spdp+=a;sums[c]+=a;out.push(a>0?`${n} (${a})`:n);});rows.push(out);}rows.push(['Col Total',...sums.map(String)]);rows.push([`Overall Total: ${openTotal+spdp}`]);
  const ws=XLSX.utils.aoa_to_sheet(rows),range=XLSX.utils.decode_range(ws['!ref']),border={top:{style:'thin',color:{rgb:'CBD5E1'}},bottom:{style:'thin',color:{rgb:'CBD5E1'}},left:{style:'thin',color:{rgb:'CBD5E1'}},right:{style:'thin',color:{rgb:'CBD5E1'}}};
  for(let r=range.s.r;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++){
    const a=XLSX.utils.encode_cell({r,c});
    if(ws[a]){
      ws[a].s=ws[a].s||{};
      ws[a].s.border=border;
      let fontColor = '0F172A';
      if (ws[a].v && typeof ws[a].v === 'string' && ws[a].v.includes('(')) fontColor = 'FF0000';
      // For open table amounts (second column, rows 13 to 22 roughly, we can just check if it's a number string in col B)
      if (c === 1 && ws[a].v && !isNaN(ws[a].v) && String(ws[a].v).trim() !== '' && r > 11 && r < 23) fontColor = 'FF0000';
      ws[a].s.font={name:'Arial',color:{rgb:fontColor}, bold: fontColor === 'FF0000'};
    }
  }
  ws['!cols']=[{wch:18},...Array(10).fill({wch:14})];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Pana & Open Chart');XLSX.writeFile(wb,`Complete_Pana_Open_Chart_${dateStr}.xlsx`);
}
window.login=login;window.logout=logout;window.setAuth=setAuth;window.loadSharedState=loadSharedState;window.onload=init;
window.exportToExcel=exportToExcel;window.resetCalculator=resetCalculator;window.deleteTransaction=deleteTransaction;
window.clearAllInputs=clearAllInputs;window.confirmAction=confirmAction;window.applyMode=applyMode;
window.applyDirectCol=applyDirectCol;window.applyCommonCol=applyCommonCol;window.switchPage=switchPage;
window.locateNumber=locateNumber;window.startLiveClock=startLiveClock;
