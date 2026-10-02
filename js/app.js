const canvas=document.getElementById("globe");
const gl=canvas.getContext("webgl",{antialias:true,alpha:true,depth:true});
if(!gl) throw new Error("WebGL não disponível.");

const orbitCanvas=document.createElement("canvas");
orbitCanvas.className="orbit-canvas";
document.body.appendChild(orbitCanvas);
const octx=orbitCanvas.getContext("2d");

const marker=document.createElement("div");
marker.className="iss-marker";
marker.innerHTML='<div class="iss-dot"></div><div class="iss-label">ISS • NORAD 25544</div>';
document.body.appendChild(marker);

let rx=-0.12, ry=0.45, zoom=1;
let dragging=false,lx=0,ly=0;
let layers={earth:true,clouds:true,stars:true,iss:true,orbit:true};

canvas.onmousedown=e=>{dragging=true;lx=e.clientX;ly=e.clientY};
window.onmouseup=()=>dragging=false;
window.onmousemove=e=>{
  if(!dragging)return;
  ry+=(e.clientX-lx)*.008;
  rx+=(e.clientY-ly)*.008;
  rx=Math.max(-1.45,Math.min(1.45,rx));
  lx=e.clientX;ly=e.clientY;
};
canvas.onwheel=e=>{
  e.preventDefault();
  zoom*=e.deltaY>0?.92:1.08;
  zoom=Math.max(.55,Math.min(2.2,zoom));
},{passive:false};

document.getElementById("zoomIn").onclick=()=>zoom=Math.min(2.2,zoom*1.15);
document.getElementById("zoomOut").onclick=()=>zoom=Math.max(.55,zoom*.87);
document.getElementById("reset").onclick=()=>{rx=-.12;ry=.45;zoom=1};

document.querySelectorAll(".layer").forEach(b=>{
  b.onclick=()=>{
    const k=b.dataset.layer;
    layers[k]=!layers[k];
    b.classList.toggle("active",layers[k]);
    if(k==="stars") document.getElementById("space").style.opacity=layers.stars?1:0;
    if(k==="iss") marker.style.display=layers.iss?"block":"none";
  };
});

const vs=`attribute vec3 aPosition;attribute vec2 aUV;attribute vec3 aNormal;uniform mat4 uMatrix;uniform mat4 uModel;varying vec2 vUV;varying vec3 vNormal;void main(){vUV=aUV;vNormal=mat3(uModel)*aNormal;gl_Position=uMatrix*uModel*vec4(aPosition,1.0);}`;
const fs=`precision mediump float;uniform sampler2D uTexture;uniform vec3 uSun;varying vec2 vUV;varying vec3 vNormal;void main(){vec3 t=texture2D(uTexture,vUV).rgb;float l=max(dot(normalize(vNormal),normalize(uSun)),0.0);float day=.14+.86*l;gl_FragColor=vec4(t*day,1.0);}`;

function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);gl.useProgram(p);

const pos=[],norm=[],uv=[],ind=[];
const A=128,B=192;
for(let i=0;i<=A;i++){let v=i/A,t=v*Math.PI;for(let j=0;j<=B;j++){let u=j/B,q=u*Math.PI*2,x=Math.sin(t)*Math.cos(q),y=Math.cos(t),z=Math.sin(t)*Math.sin(q);pos.push(x,y,z);norm.push(x,y,z);uv.push(u,1-v)}}
for(let i=0;i<A;i++)for(let j=0;j<B;j++){let a=i*(B+1)+j,b=a+B+1;ind.push(a,b,a+1,b,b+1,a+1)}

function buf(type,data){let b=gl.createBuffer();gl.bindBuffer(type,b);gl.bufferData(type,data,gl.STATIC_DRAW);return b}
const pb=buf(gl.ARRAY_BUFFER,new Float32Array(pos)),nb=buf(gl.ARRAY_BUFFER,new Float32Array(norm)),ub=buf(gl.ARRAY_BUFFER,new Float32Array(uv)),ib=buf(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(ind));
function attr(name,size,b){let a=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(a);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.vertexAttribPointer(a,size,gl.FLOAT,false,0,0)}
attr("aPosition",3,pb);attr("aNormal",3,nb);attr("aUV",2,ub);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);

function mul(a,b){let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function persp(f,a,n,fa){let q=1/Math.tan(f/2),nf=1/(n-fa);return new Float32Array([q/a,0,0,0,0,q,0,0,0,0,(fa+n)*nf,-1,0,0,2*fa*n*nf,0])}
function rot(x,y){let cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y);return new Float32Array([cy,sx*sy,-cx*sy,0,0,cx,sx,0,sy,-sx*cy,cx*cy,0,0,0,0,1])}
function scale(s){return new Float32Array([s,0,0,0,0,s,0,0,0,0,s,0,0,0,0,1])}
function transform(v,m){return{x:m[0]*v.x+m[4]*v.y+m[8]*v.z+m[12],y:m[1]*v.x+m[5]*v.y+m[9]*v.z+m[13],z:m[2]*v.x+m[6]*v.y+m[10]*v.z+m[14],w:m[3]*v.x+m[7]*v.y+m[11]*v.z+m[15]}}

const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([30,80,130,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);

const img=new Image();img.crossOrigin="anonymous";img.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);document.getElementById("loading").style.opacity=0;setTimeout(()=>document.getElementById("loading").remove(),700)};img.onerror=()=>{document.getElementById("loading").innerHTML="❌ NASA não liberou a textura. Recarregue a página.";};img.src="https://svs.gsfc.nasa.gov/vis/a000000/a002900/a002915/bluemarble-2048.png";

const uMatrix=gl.getUniformLocation(p,"uMatrix"),uModel=gl.getUniformLocation(p,"uModel"),uTexture=gl.getUniformLocation(p,"uTexture"),uSun=gl.getUniformLocation(p,"uSun");

function resize(){const d=devicePixelRatio||1;canvas.width=innerWidth*d;canvas.height=innerHeight*d;orbitCanvas.width=innerWidth*d;orbitCanvas.height=innerHeight*d;gl.viewport(0,0,canvas.width,canvas.height)}addEventListener("resize",resize);resize();

let issSatrec=null;
async function loadISS(){
  const status=document.getElementById("issStatus");
  try{
    const r=await fetch("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE",{cache:"no-store"});
    if(!r.ok)throw Error("HTTP "+r.status);
    const lines=(await r.text()).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const l1=lines.find(x=>x.startsWith("1 25544"));
    const l2=lines.find(x=>x.startsWith("2 25544"));
    if(!l1||!l2)throw Error("TLE não encontrado");
    issSatrec=satellite.twoline2satrec(l1,l2);
    status.textContent="● CELESTRAK • TLE ATUAL";
  }catch(e){
    status.textContent="● CelesTrak indisponível";
    console.warn(e);
  }
}
loadISS();

let iss={x:0,y:0,z:0};
function updateISS(){
  if(issSatrec){
    try{
      const now=new Date(),pv=satellite.propagate(issSatrec,now),gmst=satellite.gstime(now),g=satellite.eciToGeodetic(pv.position,gmst);
      const alt=g.height,lat=satellite.degreesLat(g.latitude),lon=satellite.degreesLong(g.longitude),v=Math.hypot(pv.velocity.x,pv.velocity.y,pv.velocity.z);
      document.getElementById("altitude").textContent=alt.toFixed(1)+" km";
      document.getElementById("lat").textContent=lat.toFixed(2)+"°";
      document.getElementById("lon").textContent=lon.toFixed(2)+"°";
      document.getElementById("velocity").textContent=v.toFixed(2)+" km/s";
      const r=(6371+alt)/6371;
      iss={x:r*Math.cos(g.latitude)*Math.cos(g.longitude),y:r*Math.sin(g.latitude),z:r*Math.cos(g.latitude)*Math.sin(g.longitude)};
    }catch(e){}
  }
  requestAnimationFrame(updateISS);
}
updateISS();

function drawOrbit(){
  octx.clearRect(0,0,orbitCanvas.width,orbitCanvas.height);
  if(!layers.orbit){requestAnimationFrame(drawOrbit);return}
  const cx=innerWidth/2,cy=innerHeight/2,base=Math.min(innerWidth,innerHeight)*.29*zoom;
  octx.beginPath();
  for(let i=0;i<=360;i++){
    const t=i*Math.PI*2/360,lat=Math.sin(t)*51.63*Math.PI/180,lon=t;
    let x=Math.cos(lat)*Math.cos(lon),y=Math.sin(lat),z=Math.cos(lat)*Math.sin(lon);
    const c=Math.cos(ry),s=Math.sin(ry),x1=x*c+z*s,z1=-x*s+z*c;
    const cr=Math.cos(rx),sr=Math.sin(rx),y1=y*cr-z1*sr,z2=y*sr+z1*cr;
    if(z2<-.05)continue;
    const px=cx+x1*base,py=cy-y1*base;
    if(i===0)octx.moveTo(px,py);else octx.lineTo(px,py);
  }
  octx.strokeStyle="rgba(255,225,0,.42)";octx.lineWidth=1.5;octx.stroke();
  requestAnimationFrame(drawOrbit);
}
drawOrbit();

function markerUpdate(){
  if(!layers.iss||!issSatrec){marker.style.display="none";requestAnimationFrame(markerUpdate);return}
  const aspect=innerWidth/innerHeight,proj=persp(Math.PI/3,aspect,.01,100),view=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.2/zoom,1]),model=rot(rx,ry),m=mul(mul(proj,view),model),q=transform(iss,m);
  const cameraZ=iss.x*Math.sin(ry)+iss.z*Math.cos(ry);
  if(q.w<=0||cameraZ<-.05){marker.style.display="none";requestAnimationFrame(markerUpdate);return}
  marker.style.left=((q.x/q.w*.5+.5)*innerWidth)+"px";marker.style.top=((-q.y/q.w*.5+.5)*innerHeight)+"px";marker.style.display="block";
  requestAnimationFrame(markerUpdate);
}
markerUpdate();

function render(){
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);
  const aspect=canvas.width/canvas.height,projection=persp(Math.PI/3,aspect,.01,100),view=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,-4.2/zoom,1]),model=rot(rx,ry);
  gl.uniformMatrix4fv(uMatrix,false,mul(projection,view));gl.uniformMatrix4fv(uModel,false,model);gl.uniform1i(uTexture,0);gl.uniform3f(uSun,-3,.8,2.5);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.drawElements(gl.TRIANGLES,ind.length,gl.UNSIGNED_SHORT,0);
  requestAnimationFrame(render);
}
render();
