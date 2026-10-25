/* टेस्ट के लिए नकली Firebase (असली नेटवर्क नहीं) */
(()=>{const D=window.__MOCK__||{};window.__MOCK__=D;const subs=[];
const clone=x=>JSON.parse(JSON.stringify(x));
function coll(p){D[p]=D[p]||{};return D[p]}
const notify=()=>setTimeout(()=>subs.forEach(s=>s()),0);
function snapDoc(p,id){const c=D[p]||{};const ex=id in c;return {exists:ex,id,ref:docRef(p+"/"+id),data:()=>ex?clone(c[id]):undefined}}
function applyInc(old,d){const o={...(old||{})};for(const [k,v] of Object.entries(d)){if(v&&v.__inc!=null)o[k]=(+o[k]||0)+v.__inc;else o[k]=v}return o}
function docRef(full){const p=full.split("/");const id=p.pop();const cp=p.join("/");return {id,
 get:async()=>snapDoc(cp,id),
 set:async(d,opt)=>{const c=coll(cp);c[id]=clone(applyInc(opt&&opt.merge?c[id]:{},d));notify()},
 update:async d=>{if(!(id in coll(cp)))throw {code:"not-found"};coll(cp)[id]=clone(applyInc(coll(cp)[id],d));notify()},
 delete:async()=>{delete coll(cp)[id];notify()},
 onSnapshot:(fn)=>{const s=()=>fn(snapDoc(cp,id));subs.push(s);setTimeout(s,5);return ()=>{}}}}
function q(path,filt){const o={where:(f,op,v)=>q(path,[f,v]),orderBy:()=>o,limit:()=>o,doc:id=>docRef(path+"/"+id),
 get:async()=>({docs:Object.keys(D[path]||{}).filter(id=>!filt||D[path][id][filt[0]]===filt[1]).map(id=>snapDoc(path,id))}),
 onSnapshot:(fn)=>{const s=()=>fn({docs:Object.keys(D[path]||{}).map(id=>snapDoc(path,id))});subs.push(s);setTimeout(s,5);return ()=>{}}};return o}
const db={collection:q,doc:docRef,settings(){},enablePersistence:async()=>{}};
const U=window.__USERS__||{};window.__USERS__=U;
function mkAuth(){const ls=[];const a={currentUser:null,
 onAuthStateChanged(cb){ls.push(cb);setTimeout(()=>cb(a.currentUser),5);return ()=>{const i=ls.indexOf(cb);if(i>-1)ls.splice(i,1)}},
 _fire(){ls.slice().forEach(cb=>cb(a.currentUser))},
 async signInWithEmailAndPassword(e,p){const u=U[e];if(!u||u.pw!==p)throw {code:"auth/invalid-credential"};a.currentUser={uid:u.uid,email:e,emailVerified:u.v!==false,reload:async()=>{},getIdToken:async()=>"t",sendEmailVerification:async()=>{}};a._fire();return {user:a.currentUser}},
 async createUserWithEmailAndPassword(e,p){if(U[e])throw {code:"auth/email-already-in-use"};const uid="u"+Object.keys(U).length+Date.now()%1000;U[e]={uid,pw:p,v:true};a.currentUser={uid,email:e,emailVerified:true,sendEmailVerification:async()=>{},reload:async()=>{},getIdToken:async()=>"t"};a._fire();return {user:a.currentUser}},
 async signOut(){a.currentUser=null;a._fire()},async sendPasswordResetEmail(){}};return a}
const main=mkAuth();
const fb={apps:[],initializeApp(cfg,name){const app={name:name||"[DEFAULT]",auth:name?(()=>{const x=mkAuth();return ()=>x})():()=>main};fb.apps.push(app);return app},
 firestore:Object.assign(()=>db,{FieldValue:{increment:n=>({__inc:n})}}),auth:()=>main};
window.firebase=fb;window.SENative={isNative:false};})();
