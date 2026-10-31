const V="cf-v1",CORE=["./","index.html","manifest.webmanifest","icon-192.png"];
const filling=new Set();
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).catch(()=>{}))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith("cf-")&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function rangeFrom(full,range){
  const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)return full;
  const buf=await full.clone().arrayBuffer(),a=+m[1],b=m[2]?Math.min(+m[2],buf.byteLength-1):buf.byteLength-1;
  return new Response(buf.slice(a,b+1),{status:206,headers:{"Content-Type":"audio/mpeg","Content-Range":"bytes "+a+"-"+b+"/"+buf.byteLength,"Content-Length":String(b-a+1)}});
}
self.addEventListener("fetch",e=>{
  const req=e.request,url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==location.origin)return;
  const isPack=/\/audio\/(pack\d+|xtra-[0-9a-f]+)\.mp3$/.test(url.pathname);
  if(isPack){
    e.respondWith((async()=>{
      const cache=await caches.open(V),hit=await cache.match(url.pathname);
      const range=req.headers.get("range");
      if(hit)return range?rangeFrom(hit,range):hit;
      if(range){
        if(!filling.has(url.pathname)){
          filling.add(url.pathname);
          e.waitUntil(fetch(url.pathname).then(r=>{if(r.ok)return cache.put(url.pathname,r)}).catch(()=>{}).finally(()=>filling.delete(url.pathname)));
        }
        return fetch(req);
      }
      const r=await fetch(req);
      if(r.ok)cache.put(url.pathname,r.clone());
      return r;
    })());
    return;
  }
  const isPage=req.mode==="navigate"||/\/(index\.html)?$/.test(url.pathname);
  if(isPage){
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put("index.html",c));return r}).catch(()=>caches.match("index.html").then(r=>r||caches.match("./"))));
    return;
  }
  e.respondWith(caches.match(req).then(hit=>{
    const net=fetch(req).then(r=>{if(r.ok)caches.open(V).then(c=>c.put(req,r.clone()));return r}).catch(()=>hit);
    return hit||net;
  }));
});
