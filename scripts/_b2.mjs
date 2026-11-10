import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const P = doc.getRoot().listMeshes()[0].listPrimitives()[0].getAttribute('POSITION').getArray();
const box = (name, f) => { let n=0; const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]; for (let i=0;i<P.length;i+=3){ const v=[P[i],P[i+1],P[i+2]]; if(!f(...v)) continue; n++; for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],v[k]);mx[k]=Math.max(mx[k],v[k]);} } console.log(name.padEnd(28), n, mn.map(v=>v.toFixed(3)).join(','), '|', mx.map(v=>v.toFixed(3)).join(',')); };
for (const [n,f] of JSON.parse(process.argv[3])) box(n, new Function('x','y','z','return '+f));
