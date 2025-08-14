
// Firebase app bootstrap
// Replace the config below with your project's values.
var firebaseConfig = {
  apiKey: "AIzaSyD6pmxNPsvDuowvy52U0ZBsonfMkUnTJQU",
  authDomain: "npta-game.firebaseapp.com",
  databaseURL: "https://npta-game-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "npta-game",
  storageBucket: "npta-game.firebasestorage.app",
  messagingSenderId: "G-J931W4ZG0V",
  appId: "1:354694156670:web:b9121f5ff57d47f766232f"
};

firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.database();

function $(sel){return document.querySelector(sel);}
function el(tag, props, children){var node = document.createElement(tag); props=props||{}; for(var k in props){ if(k==='class') node.className=props[k]; else node.setAttribute(k, props[k]); } (children||[]).forEach(function(c){ if(c && c.nodeType) node.appendChild(c); else node.appendChild(document.createTextNode(c||'')); }); return node;}

var state = { uid:null, displayName:null, roomCode:null, isHost:false, phase:'idle', letter:'-', rounds:5, roundIndex:0, timer:60, answersSubmitted:false, unsubscribers:[] };

function cleanupSubs(){ state.unsubscribers.forEach(function(fn){ try{ fn(); }catch(e){} }); state.unsubscribers = []; }

auth.onAuthStateChanged(function(user){ if(user){ state.uid = user.uid; } else { auth.signInAnonymously().catch(console.error); } });

function code(n){ n = n||6; var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; var s=''; for(var i=0;i<n;i++) s += chars.charAt(Math.floor(Math.random()*chars.length)); return s; }
function AtoZ(){ return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''); }
function genLetters(mode, count, customCsv){ if(mode==='sequential') return AtoZ().slice(0,count); if(mode==='custom'){ var cleaned = (customCsv||'').split(',').map(function(s){return s.trim().toUpperCase();}).filter(function(s){return /^[A-Z]$/.test(s);}); var unique = []; cleaned.forEach(function(c){ if(unique.indexOf(c)===-1) unique.push(c); }); if(unique.length !== count) throw new Error('Provide exactly ' + count + ' unique letters (A–Z).'); return unique; } var pool = 'ABCDEFGHIKLMNOPRSTUVWXY'.split(''); for(var i=pool.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var tmp=pool[i]; pool[i]=pool[j]; pool[j]=tmp; } return pool.slice(0,count); }

function now(){ return Date.now(); }

function gameRef(code){ return db.ref('/games/' + code); }
function playersRef(code){ return db.ref('/games/' + code + '/players'); }
function stateRef(code){ return db.ref('/games/' + code + '/state'); }
function answersRef(code, round){ return db.ref('/games/' + code + '/answers/' + round); }
function validationRef(code, round){ return db.ref('/games/' + code + '/validation/' + round); }
function statsRef(code){ return db.ref('/games/' + code + '/stats'); }

// UI elements
var hostBtn = $('#hostBtn');
var joinBtn = $('#joinBtn');
var hostSettings = $('#hostSettings');
var joinSettings = $('#joinSettings');
var roundsInput = $('#roundsInput');
var letterMode = $('#letterMode');
var customLettersWrap = $('#customLettersWrap');
var customLetters = $('#customLetters');
var createGameBtn = $('#createGameBtn');
var doJoinBtn = $('#doJoinBtn');
var joinCode = $('#joinCode');
var displayNameInput = $('#displayName');
var waitingRoom = $('#waitingRoom');
var roomCodeEl = $('#roomCode');
var playersList = $('#playersList');
var startGameBtn = $('#startGameBtn');
var leaveRoomBtn = $('#leaveRoomBtn');
var copyCodeBtn = $('#copyCodeBtn');

var gameScreen = $('#gameScreen');
var leaderboardScreen = $('#leaderboardScreen');
var answersForm = $('#answersForm');
var ansName = $('#ansName');
var ansPlace = $('#ansPlace');
var ansThing = $('#ansThing');
var ansAnimal = $('#ansAnimal');
var submitAnswersBtn = $('#submitAnswersBtn');
var currentLetterEl = $('#currentLetter');
var timerEl = $('#timer');
var phaseBadge = $('#phaseBadge');
var roundPlayers = $('#roundPlayers');

var hostValidation = $('#hostValidation');
var validationTableWrap = $('#validationTableWrap');
var finalizeRoundBtn = $('#finalizeRoundBtn');
var nextRoundBtn = $('#nextRoundBtn');
var playAgainBtn = $('#playAgainBtn');

letterMode.addEventListener('change', function(){ customLettersWrap.hidden = letterMode.value !== 'custom'; });
hostBtn.addEventListener('click', function(){ hostSettings.hidden = false; joinSettings.hidden = true; });
joinBtn.addEventListener('click', function(){ joinSettings.hidden = false; hostSettings.hidden = true; });
createGameBtn.addEventListener('click', onCreateGame);
doJoinBtn.addEventListener('click', onJoinGame);
copyCodeBtn.addEventListener('click', function(){ try{ navigator.clipboard.writeText(state.roomCode || ''); copyCodeBtn.textContent = 'Copied!'; setTimeout(function(){ copyCodeBtn.textContent = 'Copy'; }, 1200); }catch(e){} });
leaveRoomBtn.addEventListener('click', leaveRoom);
startGameBtn.addEventListener('click', hostStartGame);
answersForm.addEventListener('submit', onSubmitAnswers);
finalizeRoundBtn.addEventListener('click', hostFinalizeRound);
nextRoundBtn.addEventListener('click', hostNextRound);
if(playAgainBtn) playAgainBtn.addEventListener('click', function(){ location.reload(); });

document.addEventListener('keydown', function(e){ if(e.key === 'Enter' && !submitAnswersBtn.disabled && !answersForm.hasAttribute('hidden')) answersForm.requestSubmit(); });

async function onCreateGame(){ try{ if(!state.uid){ alert('Auth not ready yet. Try again.'); return; } var rounds = parseInt(roundsInput.value || '5'); var mode = letterMode.value; var letters = genLetters(mode, rounds, customLetters.value); var room = code(6); state.roomCode = room; state.isHost = true; state.rounds = rounds; state.roundIndex = 0; state.phase = 'waiting'; var init = { createdAt: now(), host: state.uid, phase: 'waiting', roundIndex: 0, rounds: rounds, letter: '-', letters: letters, timer: 60 }; await gameRef(room).set({ state: init }); await playersRef(room).child(state.uid).set({ name: 'Host', score: 0, online: true, uid: state.uid, lastSeen: now() }); showWaitingRoom(); subscribeRoom(room); }catch(e){ alert(e.message); console.error(e); } }

async function onJoinGame(){ try{ if(!state.uid){ alert('Auth not ready yet. Try again.'); return; } var room = joinCode.value.trim().toUpperCase(); var name = (displayNameInput.value || '').trim(); if(!room || !name){ alert('Enter a game code and your display name.'); return; } var snapshot = await gameRef(room).child('state').get(); if(!snapshot.exists()){ alert('Game not found.'); return; } state.roomCode = room; state.isHost = false; state.displayName = name; await playersRef(room).child(state.uid).set({ name: name, score: 0, online: true, uid: state.uid, lastSeen: now() }); showWaitingRoom(); subscribeRoom(room); }catch(e){ alert(e.message); console.error(e); } }

function subscribeRoom(room){
  cleanupSubs();
  var pr = playersRef(room);
  var offPlayers = pr.on('value', function(snap){ var players = snap.val() || {}; renderPlayers(players); try{ startGameBtn.disabled = !state.isHost || Object.keys(players).length < 2; }catch(e){} });
  state.unsubscribers.push(function(){ pr.off('value', offPlayers); });

  var sr = stateRef(room);
  var offState = sr.on('value', function(snap){ var s = snap.val() || {}; state.phase = s.phase || 'waiting'; state.roundIndex = s.roundIndex || 0; state.timer = (s.timer === undefined) ? 60 : s.timer; state.letter = s.letter || '-'; currentLetterEl.textContent = state.letter; timerEl.textContent = String(state.timer); phaseBadge.textContent = state.phase.toUpperCase(); if(state.phase === 'playing'){ showGame(); } else if(state.phase === 'reviewing'){ if(state.isHost) renderValidation(); } else if(state.phase === 'finished'){ renderLeaderboard(); } });
  state.unsubscribers.push(function(){ sr.off('value', offState); });

  window.addEventListener('beforeunload', function(){ if(state.roomCode && state.uid){ playersRef(state.roomCode).child(state.uid).update({ online: false, lastSeen: now() }); } });
  setInterval(function(){ if(state.roomCode && state.uid){ playersRef(state.roomCode).child(state.uid).update({ online: true, lastSeen: now() }); } }, 8000);
}

function showWaitingRoom(){ $('#hostSettings').hidden = true; $('#joinSettings').hidden = true; waitingRoom.hidden = false; gameScreen.hidden = true; leaderboardScreen.hidden = true; roomCodeEl.textContent = state.roomCode || '—'; }
function showGame(){ waitingRoom.hidden = true; gameScreen.hidden = false; leaderboardScreen.hidden = false; }

async function leaveRoom(){ if(!state.roomCode || !state.uid) return location.reload(); try{ await playersRef(state.roomCode).child(state.uid).remove(); }finally{ location.reload(); } }

function renderPlayers(players){ playersList.innerHTML = ''; roundPlayers.innerHTML = ''; Object.values(players).forEach(function(p){ var playerNode = el('div',{class:'player'}, [ el('span',{class:'dot'},[]), el('span',{class:'name'},[p.name || 'Player']), el('span',{class:'score'},[' • ' + (p.score || 0)]) ]); playersList.appendChild(playerNode); var rp = el('div',{class:'player'}, [ el('span',{class:'dot'},[]), el('span',{class:'name'},[p.name || 'Player']) ]); roundPlayers.appendChild(rp); }); }

async function hostStartGame(){ if(!state.isHost || !state.roomCode) return; var sSnap = await stateRef(state.roomCode).get(); var s = sSnap.val(); var letter = (s && s.letters && s.letters[s.roundIndex]) ? s.letters[s.roundIndex] : 'A'; await stateRef(state.roomCode).update({ phase: 'playing', letter: letter, timer: 60 }); tickTimer(); }

var timerHandle = null;
function tickTimer(){ if(!state.isHost) return; clearInterval(timerHandle); timerHandle = setInterval(async function(){ var sSnap = await stateRef(state.roomCode).get(); var s = sSnap.val(); if(!s || s.phase !== 'playing') return clearInterval(timerHandle); var next = Math.max(0, (s.timer === undefined ? 60 : s.timer) - 1); await stateRef(state.roomCode).update({ timer: next }); if(next === 0){ clearInterval(timerHandle); await stateRef(state.roomCode).update({ phase: 'reviewing' }); if(state.isHost) renderValidation(); } }, 1000); }

async function onSubmitAnswers(e){ e.preventDefault(); if(!state.roomCode || state.phase !== 'playing') return; if(state.answersSubmitted) return; var data = { name: ansName.value.trim(), place: ansPlace.value.trim(), thing: ansThing.value.trim(), animal: ansAnimal.value.trim() }; await answersRef(state.roomCode, state.roundIndex).child(state.uid).set(data); state.answersSubmitted = true; submitAnswersBtn.disabled = true; answersForm.querySelectorAll('input').forEach(function(i){ i.disabled = true; }); }

async function renderValidation(){ if(!state.isHost || !state.roomCode) return; var ansSnap = await answersRef(state.roomCode, state.roundIndex).get(); var answers = ansSnap.val() || {}; var playersSnap = await playersRef(state.roomCode).get(); var players = playersSnap.val() || {}; var cats = ['name','place','thing','animal']; var table = el('table',{class:'table'},[]); var thead = el('thead',{}, [ el('tr',{}, [ el('th',{},['Player']) ].concat(cats.map(function(c){ return el('th',{},[c.toUpperCase()]); })).concat([ el('th',{},['Actions']) ]) ) ]); var tbody = el('tbody',{},[]); table.appendChild(thead); table.appendChild(tbody); Object.keys(players).forEach(function(uid){ var row = el('tr',{},[]); row.appendChild(el('td',{},[ players[uid].name || 'Player' ])); cats.forEach(function(cat){ var val = (answers[uid] && answers[uid][cat]) ? answers[uid][cat] : ''; var cell = el('td',{},[]); var group = el('div',{}, [ el('div',{},[ val || '—' ]), el('div',{},[ el('label',{class:'badge accept', onclick:'setValidation("'+uid+'","'+cat+'","accept")'},['Accept']), ' ', el('label',{class:'badge duplicate', onclick:'setValidation("'+uid+'","'+cat+'","duplicate")'},['Duplicate']), ' ', el('label',{class:'badge reject', onclick:'setValidation("'+uid+'","'+cat+'","reject")'},['Reject']) ]) ]); cell.appendChild(group); row.appendChild(cell); }); row.appendChild(el('td',{},[ el('button',{class:'btn small', onclick:'autoMarkDuplicates()'},['Auto Duplicates']) ])); tbody.appendChild(row); }); validationTableWrap.innerHTML = ''; validationTableWrap.appendChild(table); hostValidation.hidden = false; }

async function setValidation(uid, cat, status){ // using string-based onclick bridge
  try{
    // convert uid, cat, status to proper types if necessary
    await validationRef(state.roomCode, state.roundIndex).child(uid).update((function(){ var o = {}; o[cat] = status; return o; })());
  }catch(e){ console.error(e); }
}

async function autoMarkDuplicates(){ var ansSnap = await answersRef(state.roomCode, state.roundIndex).get(); var answers = ansSnap.val() || {}; var cats = ['name','place','thing','animal']; for(var i=0;i<cats.length;i++){ var cat = cats[i]; var map = {}; for(var uid in answers){ var obj = answers[uid]; var v = (obj[cat]||'').trim().toLowerCase(); if(!v) continue; map[v] = (map[v]||0)+1; } for(var uid in answers){ var obj = answers[uid]; var v = (obj[cat]||'').trim().toLowerCase(); if(map[v] >= 2){ await setValidation(uid, cat, 'duplicate'); } } } renderValidation(); }

async function hostFinalizeRound(){ var ansSnap = await answersRef(state.roomCode, state.roundIndex).get(); var answers = ansSnap.val() || {}; var valSnap = await validationRef(state.roomCode, state.roundIndex).get(); var validation = valSnap.val() || {}; var cats = ['name','place','thing','animal']; for(var uid in answers){ for(var i=0;i<cats.length;i++){ var cat = cats[i]; var v = validation[uid] && validation[uid][cat]; if(answers[uid] && answers[uid][cat] && (!v || v === 'pending')){ alert('Please validate ' + uid + '\'s ' + cat + '.'); return; } } } var playersSnap = await playersRef(state.roomCode).get(); var players = playersSnap.val() || {}; var scores = {}; for(var uid in players) scores[uid] = players[uid].score || 0; var totals = { total:0, valid:0, dup:0 }; for(var uid in answers){ var a = answers[uid]; for(var i=0;i<cats.length;i++){ var cat = cats[i]; var word = (a[cat]||'').trim(); if(word) totals.total++; var status = validation[uid] && validation[uid][cat]; if(status === 'accept'){ totals.valid++; scores[uid] += 10; } else if(status === 'duplicate'){ totals.dup++; scores[uid] += 5; } } } var updates = {}; for(var uid in scores){ updates[uid] = Object.assign({}, players[uid]); updates[uid].score = scores[uid]; } await playersRef(state.roomCode).set(updates); await statsRef(state.roomCode).transaction(function(prev){ var s = prev || { totalWords:0, validWords:0, duplicates:0 }; s.totalWords += totals.total; s.validWords += totals.valid; s.duplicates += totals.dup; return s; }); await stateRef(state.roomCode).update({ phase: 'reviewing' }); alert('Round scored. Click Next Round when ready.'); }

async function hostNextRound(){ var sSnap = await stateRef(state.roomCode).get(); var s = sSnap.val(); var nextIndex = (s.roundIndex||0) + 1; if(nextIndex >= s.rounds){ await stateRef(state.roomCode).update({ phase: 'finished' }); renderLeaderboard(); return; } var nextLetter = s.letters[nextIndex] || 'A'; await stateRef(state.roomCode).update({ roundIndex: nextIndex, letter: nextLetter, phase: 'playing', timer: 60 }); state.answersSubmitted = false; submitAnswersBtn.disabled = false; answersForm.querySelectorAll('input').forEach(function(i){ i.disabled = false; i.value = ''; }); tickTimer(); }

async function renderLeaderboard(){ var playersSnap = await playersRef(state.roomCode).get(); var playersObj = playersSnap.val() || {}; var players = []; for(var uid in playersObj) players.push(playersObj[uid]); players.sort(function(a,b){ return (b.score||0) - (a.score||0); }); var wrap = $('#leaderboardWrap'); wrap.innerHTML = ''; for(var i=0;i<players.length;i++){ var p = players[i]; var leader = el('div',{class:'leader'}, [ el('div',{}, [ el('span',{class:'place'}, '#'+String(i+1)+' '), el('strong',{}, p.name || 'Player') ]), el('div',{class:'score'}, String(p.score||0)) ]); wrap.appendChild(leader); } leaderboardScreen.hidden = false; gameScreen.hidden = true; }

answersForm.addEventListener('input', function(){ var L = (state.letter || '').toLowerCase(); [ansName,ansPlace,ansThing,ansAnimal].forEach(function(inp){ var v = inp.value; if(v && v[0] && v[0].toLowerCase() !== L) inp.setCustomValidity('Must start with ' + state.letter); else inp.setCustomValidity(''); }); });
