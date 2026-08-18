const p=(r="")=>{const e=String(r||"").trim().replace(/\s+/g," ");return e?e.toLowerCase().replace(new RegExp("(^|[\\s'-])(\\p{L})","gu"),(c,t,a)=>t+a.toUpperCase()):""};export{p as c};
