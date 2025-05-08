(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))r(i);new MutationObserver(i=>{for(const o of i)if(o.type==="childList")for(const l of o.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&r(l)}).observe(document,{childList:!0,subtree:!0});function a(i){const o={};return i.integrity&&(o.integrity=i.integrity),i.referrerPolicy&&(o.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?o.credentials="include":i.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function r(i){if(i.ep)return;i.ep=!0;const o=a(i);fetch(i.href,o)}})();var Le=Object.defineProperty,Re=(e,t,a)=>t in e?Le(e,t,{enumerable:!0,configurable:!0,writable:!0,value:a}):e[t]=a,j=(e,t,a)=>Re(e,typeof t!="symbol"?t+"":t,a);(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))a(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function t(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(r){if(r.ep)return;r.ep=!0;const i=t(r);fetch(r.href,i)}})();const E={};E.blurKernelSize=8;const te=.5;E.wOffset=(te+1)/(te-1);Math.abs(E.wOffset+2)<.01&&console.warn("The specified projection is too close to the projection plane and may result in visual artifacts.");E.borderFrag=`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;
uniform float frameSpecularWeight;

uniform vec4 specularColor1;
uniform vec4 specularColor2;
uniform vec4 specularColor3;
uniform vec4 specularColor4;
uniform vec4 specularDirection1;
uniform vec4 specularDirection2;
uniform vec4 specularDirection3;
uniform vec4 specularDirection4;

#define wMid ${E.wOffset.toFixed(9)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

uniform vec4 nearFrameColor;
uniform vec4 farFrameColor;

void main (void) {
  // Use negatives since edge0 must be < edge1 per the spec:
  float t = smoothstep(-wNear, -wFar, -w);

  vec4 reflected = reflect(vWorld4d, vNormal);
  float specular1 = clamp(
    dot(reflected, specularDirection1),
    0., 1.);
  float specular2 = clamp(
    dot(reflected, specularDirection2),
    0., 1.);
  float specular3 = clamp(
    dot(reflected, specularDirection3),
    0., 1.);
  float specular4 = clamp(
    dot(reflected, specularDirection4),
    0., 1.);

  // This part is specific to the border rendering:
  vec4 frameColor =  mix(nearFrameColor, farFrameColor,
    clamp(t, 0., 1.));

  vec4 shine =
      pow(specular1, 26.) * specularColor1
    + pow(specular2, 26.) * specularColor2
    + pow(specular3, 26.) * specularColor3
    + pow(specular4, 80.) * specularColor4;
  gl_FragColor = shine * frameSpecularWeight + frameColor;
}
`;E.glitterFrag=`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
uniform float opacity;

uniform vec4 specularColor1;
uniform vec4 specularColor2;
uniform vec4 specularColor3;
uniform vec4 specularColor4;
uniform vec4 specularDirection1;
uniform vec4 specularDirection2;
uniform vec4 specularDirection3;
uniform vec4 specularDirection4;

#define wMid ${E.wOffset.toFixed(9)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

void main (void) {
  // Use world position vector as the view direction:
  vec4 reflected = reflect(vWorld4d, vNormal);

  float specular1 = clamp(
    dot(reflected, specularDirection1),
    0., 1.);
  float specular2 = clamp(
    dot(reflected, specularDirection2),
    0., 1.);
  float specular3 = clamp(
    dot(reflected, specularDirection3),
    0., 1.);
  float specular4 = clamp(
    dot(reflected, specularDirection4),
    0., 1.);

  vec4 shine =
      pow(specular1, 26.) * specularColor1
    + pow(specular2, 26.) * specularColor2
    + pow(specular3, 26.) * specularColor3
    + pow(specular4, 80.) * specularColor4;
  gl_FragColor = shine * opacity;
}
`;E.diffuseFrag=`
precision mediump float;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;
uniform float opacity;

uniform vec4 glowColor;
uniform vec4 membraneColor;
uniform vec4 diffuseColor1;
uniform vec4 diffuseColor2;
uniform vec4 diffuseColor3;
uniform vec4 diffuseDirection1;
uniform vec4 diffuseDirection2;
uniform vec4 diffuseDirection3;

#define wMid ${E.wOffset.toFixed(9)}
#define wFar (wMid - 2.)
#define wNear (wMid + 2.)

float diminish (float x) {
  return -1. / (x + 1.) + 1.;
}

void main (void) {
  // Use w-depth to compute a "glow fog" effect:
  float a = clamp(w / wFar, 0., 1.);

  // Calculate a color contribution based on path length
  // through a supposed pane of semitranslucent material
  float dp = dot(vWorld4d, vNormal);
  dp = abs(dp);
  dp = clamp(dp, 0.000001, 1.);

  float thickness = pow((diminish(0.8 / dp) - 0.444)*1.79856, 2.);

  vec4 membranePart = membraneColor * thickness;

  // Diffuse light pane contributions:
  float s1 = dot(vNormal, diffuseDirection1);
  float s2 = dot(vNormal, diffuseDirection2);
  float s3 = dot(vNormal, diffuseDirection3);
  s1 = clamp(s1, 0., 1.);
  s2 = clamp(s2, 0., 1.);
  s3 = clamp(s3, 0., 1.);

  gl_FragColor = opacity * (
    s1 * diffuseColor1 + s2 * diffuseColor2 + s3 * diffuseColor3
    + glowColor * pow(a, 3.)
    + membranePart
  );
}
`;E.textureVert=`
precision mediump float;
attribute vec3 pos;
attribute vec2 aTexel;
varying vec2 vTexel;

void main (void) {
  gl_Position = vec4(pos, 1.);
  vTexel = vec2(aTexel);
}
`;E.alphaCompositorFrag=`
precision mediump float;
uniform sampler2D blurTex;
uniform sampler2D clearTex;
uniform float clarityScale;
varying vec2 vTexel;

void main (void) {
  vec4 clear = texture2D(clearTex, vTexel);
  vec4 blurry = texture2D(blurTex, vTexel);

  gl_FragColor = mix(blurry, clear, clear.a * clarityScale);
}
`;E.texturedCompositorFrag=`
precision highp float;
uniform sampler2D blurTex;
uniform sampler2D clearTex;
uniform sampler2D lensTex;
uniform float clarityScale;
uniform vec2 cloudShiftSmall;
uniform vec2 cloudShiftMedium;
uniform vec2 cloudShiftLarge;
varying vec2 vTexel;

float diminish (float x) {
  return -1. / (x + 1.) + 1.;
}

// Variable extra-smooth downward step:
// https://www.desmos.com/calculator/mxoykritdy
float smoothDrop (float bound, float exponent, float x) {
  float w = x / bound;
  float smoothed = clamp(w*w*w* (6.*w*w - 15.*w + 10.), 0., 1.);
  return clamp(
      1. - pow(smoothed, exponent),
    0., 1.);
}

void main (void) {
  vec4 clear = texture2D(clearTex, vTexel);
  vec4 blurry = texture2D(blurTex, vTexel);

  vec4 lens =
    + 0.35*texture2D(lensTex, vTexel / 3. + cloudShiftSmall)
    + 0.9*texture2D(lensTex, -vTexel / 4. - cloudShiftMedium)
    + 2.05*texture2D(lensTex, vTexel / 7. + cloudShiftLarge)
    ;

  vec4 mixed = mix(blurry, clear, clear.a * clarityScale);
  float luminance =
      0.2126 * blurry.r
    + 0.7152 * blurry.g
    + 0.0722 * blurry.b;

  float signal = pow(smoothDrop(1., 1., luminance), 1.35);
  float boost = 5. * smoothDrop(1., 0.2, luminance);

  // Soft cloud effect:
  float soft = pow(1.5*diminish(lens.a), 3.);
  float cloud = pow(smoothDrop(1., 0.8, 1.-soft), 1.3);

  const mat4 colorTransform = mat4(
  //  Output
  //  R       G       B       α
      0.30,   0.15,   0.20,   0.00, // R  Input
      0.40,   0.05,   0.20,   0.00, // G
      0.10,   0.25,   0.30,   0.00, // B
      0.00,   0.00,   0.00,   0.00  // α
  );

  // Weight the cloud color components to favor red light:
  gl_FragColor =
    mixed
    + colorTransform * mixed * signal * boost * cloud;
}
`;E.blur1dFrag=`
precision mediump float;
varying vec2 vTexel;

uniform sampler2D uTex;
#define kernelSize ${E.blurKernelSize}
uniform float kernel[kernelSize];
uniform vec2 blurStep;

void main (void) {
  vec2 dv = blurStep;

  // double-weight on 0 element:
  vec4 color = texture2D(uTex, vTexel) * kernel[0];
  for (int i = 1; i < kernelSize; i++) {
    color += texture2D(uTex, vTexel - float(i)*dv) * kernel[i]
            +texture2D(uTex, vTexel + float(i)*dv) * kernel[i];
  }

  gl_FragColor = color;
}
`;E.projectorVert=`
precision mediump float;

attribute vec4 pos;
attribute vec4 normal;
varying vec4 vNormal;
varying vec4 vWorld4d;
varying float w;

uniform mat4 M3;
uniform mat4 projection;
uniform vec4 qModelL;
uniform vec4 qModelR;
uniform vec4 qViewL;
uniform vec4 qViewR;

// Quaternion product q*p, in xi+yj+zk+w form
vec4 qmul (vec4 q, vec4 p) {
  return vec4(
    q[3]*p[0] + q[0]*p[3] + q[1]*p[2] - q[2]*p[1],
    q[3]*p[1] - q[0]*p[2] + q[1]*p[3] + q[2]*p[0],
    q[3]*p[2] + q[0]*p[1] - q[1]*p[0] + q[2]*p[3],
    q[3]*p[3] - q[0]*p[0] - q[1]*p[1] - q[2]*p[2]
  );
}

// Quaternion product q*v*p
vec4 qvp (vec4 q, vec4 v, vec4 p) {
  return qmul(q, qmul(v,p));
}

void main (void) {
  const float wOffset = ${E.wOffset.toFixed(9)};
  const float wNear = 1.0;
  vec4 v = pos;

  // This projection pipeline for normals assumes no nonuniform scaling,
  // avoiding the inverse transpose:
  // Apply qvp (model)
  // Apply qvp (view)
  // Apply just the non-translational part of M3
  // Restore the w-component
  vec4 n = qvp(qModelL, normal, qModelR);
  n = qvp(qViewL, n, qViewR);
  vec3 n3 = mat3(M3) * vec3(n);
  vNormal = normalize(vec4(n3, n.w));

  // Transform the position vector:
  v = qvp(qModelL, v, qModelR);
  v = qvp(qViewL, v, qViewR);
  v.w += wOffset;

  w = v.w; // pass transformed w-value to fragment shader

  vec3 unprojected = vec3(v); // Transformed x, y, z, sans projection.

  float s = wNear / (-v.w);
  mat4 Scale4Dto3D = mat4(
    s,  0., 0., 0.,
    0., s,  0., 0.,
    0., 0., s,  0.,
    0., 0., 0., 0.
  );

  v = Scale4Dto3D * v;
  v.w = 1.;

  // Normalizing vWorld4d in the vertex shader rather than fragment shader
  // is slightly inaccurate, but unnoticeably so.
  vWorld4d = normalize(vec4(
    vec3(M3 * vec4(unprojected, 1.)), w
  ));

  // Apply 3D model matrix, then 3D -> 2D perspective projection:
  gl_Position = projection * M3 * v;
}
`;const q=Math.PI;function ce(e,t,a){return typeof a>"u"&&(a=e),typeof t>"u"&&(t=e),[e,0,0,0,0,t,0,0,0,0,a,0,0,0,0,1]}function ue(e,t,a){return[1,0,0,0,0,1,0,0,0,0,1,0,e,t,a,1]}function G(e,t,a){e===a&&(a=[...a]),e===t&&(t=[...t]);for(let r=0;r<4;r++)e[r]=t[r]*a[0]+t[4+r]*a[1]+t[8+r]*a[2]+t[12+r]*a[3],e[4+r]=t[r]*a[4]+t[4+r]*a[5]+t[8+r]*a[6]+t[12+r]*a[7],e[8+r]=t[r]*a[8]+t[4+r]*a[9]+t[8+r]*a[10]+t[12+r]*a[11],e[12+r]=t[r]*a[12]+t[4+r]*a[13]+t[8+r]*a[14]+t[12+r]*a[15];return e}function H(e){e[0]=1,e[1]=0,e[2]=0,e[3]=0,e[4]=0,e[5]=1,e[6]=0,e[7]=0,e[8]=0,e[9]=0,e[10]=1,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1}function fe(e){return[Math.cos(e),Math.sin(e),0,0,-Math.sin(e),Math.cos(e),0,0,0,0,1,0,0,0,0,1]}function Ae(e){let{near:t,far:a,left:r,right:i,top:o,bottom:l}=e;{const c=Math.tan(e.fov/2*Math.PI/180)*t,d=c/e.aspect;r=-c,i=c,o=d,l=-d}return[2*t/(i-r),0,0,0,0,2*t/(o-l),0,0,(i+r)/(i-r),(o+l)/(o-l),(t+a)/(t-a),-1,0,0,2*t*a/(t-a),0]}function Se(e,t){return[e[3]*t[0]+e[0]*t[3]+e[1]*t[2]-e[2]*t[1],e[3]*t[1]-e[0]*t[2]+e[1]*t[3]+e[2]*t[0],e[3]*t[2]+e[0]*t[1]-e[1]*t[0]+e[2]*t[3],e[3]*t[3]-e[0]*t[0]-e[1]*t[1]-e[2]*t[2]]}class p extends Array{static product(t,a){return p.from(Se(t,a))}static slerpUnit(t,a,r){let i=Math.acos(t.inner(a));if(Number.isNaN(i)||Math.abs(i)<1e-6)return a;const o=new p,l=Math.sin(i),c=Math.sin((1-r)*i)/l,d=Math.sin(r*i)/l;return o[0]=t[0]*c+a[0]*d,o[1]=t[1]*c+a[1]*d,o[2]=t[2]*c+a[2]*d,o[3]=t[3]*c+a[3]*d,o}static parse(t){try{t=t.replaceAll(" ","");const a=t.match(/(-?\d*\.?\d+)i/),r=t.match(/(-?\d*\.?\d+)j/),i=t.match(/(-?\d*\.?\d+)k/),o=t.match(/(-?\d*\.?\d+)(?![ijk\.])\b/);let l=0,c=0,d=0,u=0;return a?l=parseFloat(a[1]):t.match(/-i/)?l=-1:t.match(/i/)&&(l=1),r?c=parseFloat(r[1]):t.match(/-j/)?c=-1:t.match(/j/)&&(c=1),i?d=parseFloat(i[1]):t.match(/-k/)?d=-1:t.match(/k/)&&(d=1),o&&(u=parseFloat(o[1])),p.from([l,c,d,u])}catch{return p.from([0,0,0,0])}}constructor(){super(),this[0]=0,this[1]=0,this[2]=0,this[3]=1}toString(){return`${this[0].toFixed(16)}i + ${this[1].toFixed(16)}j + ${this[2].toFixed(16)}k + ${this[3].toFixed(16)}`}toFixedString(t=2){return`${this[0].toFixed(t).padStart(t+3)}i + ${this[1].toFixed(t).padStart(t+3)}j + ${this[2].toFixed(t).padStart(t+3)}k + ${this[3].toFixed(t).padStart(t+3)}`}log(t){const a="color:#fd0",r="color:#0a8";console.log(`${String(t||"").padEnd(10)}%c${i(this[0])}%ci + %c${i(this[1])}%cj + %c${i(this[2])}%ck + %c${i(this[3])}`,a,r,a,r,a,r,a);function i(o){return String(o.toFixed(2)).replace("0.00","0").replace("0.",".").replace("1.00","1").padStart(3)}}conjugate(){return p.from([-this[0],-this[1],-this[2],this[3]])}negative(){return p.from([-this[0],-this[1],-this[2],-this[3]])}inner(t){return this[0]*t[0]+this[1]*t[1]+this[2]*t[2]+this[3]*t[3]}geodesicDistance(t){return Math.acos(2*this.inner(t)**2-1)}magnitudeSquared(){return this[0]*this[0]+this[1]*this[1]+this[2]*this[2]+this[3]*this[3]}atAngle(t){const a=Math.sin(t),r=Math.cos(t);if(this[3]!==1||Math.abs(this[0])!==1&&Math.abs(this[1])!==1&&Math.abs(this[2])!==1)throw new Error("Quaternion not in correct format for atAngle (expecting 1 ± i, j, or k.)");return p.from([this[0]*a,this[1]*a,this[2]*a,this[3]*r])}invert(){const t=this.magnitudeSquared();return t<1e-6?this:(this[0]/=-t,this[1]/=-t,this[2]/=-t,this[3]/=t,this)}premultiply(t){const a=this[0],r=this[1],i=this[2],o=this[3];return this[0]=t[3]*a+t[0]*o+t[1]*i-t[2]*r,this[1]=t[3]*r-t[0]*i+t[1]*o+t[2]*a,this[2]=t[3]*i+t[0]*r-t[1]*a+t[2]*o,this[3]=t[3]*o-t[0]*a-t[1]*r-t[2]*i,this}postmultiply(t){const a=this[0],r=this[1],i=this[2],o=this[3];return this[0]=o*t[0]+a*t[3]+r*t[2]-i*t[1],this[1]=o*t[1]-a*t[2]+r*t[3]+i*t[0],this[2]=o*t[2]+a*t[1]-r*t[0]+i*t[3],this[3]=o*t[3]-a*t[0]-r*t[1]-i*t[2],this}apply(t,a){return this.premultiply(t),this.postmultiply(a),this}normalize(){const t=Math.sqrt(this[0]*this[0]+this[1]*this[1]+this[2]*this[2]+this[3]*this[3]);return t===0?this:(this[0]/=t,this[1]/=t,this[2]/=t,this[3]/=t,this)}}const x={};x.commonTesseractAnimation=function(){H(this.M3),H(this.M4),this.shared.animator&&this.shared.animator.call(this),G(this.M3,ce(2),this.M3),G(this.M3,ue(0,0,-20),this.M3)};x.initBlur=function(){const e=this.gl;this.uTex=e.getUniformLocation(this.program,"uTex"),this.aTexel=e.getAttribLocation(this.program,"aTexel"),this.kernel=e.getUniformLocation(this.program,"kernel"),this.blurStep=e.getUniformLocation(this.program,"blurStep"),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.enableVertexAttribArray(this.aTexel),e.vertexAttribPointer(this.aTexel,2,e.FLOAT,!1,this.mesh.byteStride,2*Float32Array.BYTES_PER_ELEMENT),e.bindBuffer(e.ARRAY_BUFFER,null),e.uniform1fv(this.kernel,me(.1,E.blurKernelSize));const t=[e.createFramebuffer(),e.createFramebuffer()],a=[$(e,e.TEXTURE0+3,()=>Math.floor(e.canvas.clientWidth/2)),$(e,e.TEXTURE0+4,()=>Math.floor(e.canvas.clientWidth/2))];for(let r=0;r<t.length;r++)e.bindFramebuffer(e.FRAMEBUFFER,t[r]),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,a[r],0),K(e);e.bindFramebuffer(e.FRAMEBUFFER,null),this.shared.blurRes||console.warn("Warning: initial blurRes unavailable."),this.shared.clearTexture||console.warn("Warning: initial clearTexture unavailable."),this.fboAlternates=t,this.texAlternates=a};x.drawBlur=function(){const e=this.gl;let t=1/this.shared.blurRes,a=0;e.viewport(0,0,this.shared.blurRes,this.shared.blurRes),e.disable(e.BLEND);const r=[!0,!0],i=n.blurPassCount;this.shared.readTexture=1,e.uniform1i(this.uTex,this.shared.readTexture);for(let o=0;o<i;o++)e.bindFramebuffer(e.FRAMEBUFFER,this.fboAlternates[o%2]),r[o%2]&&(e.clear(e.COLOR_BUFFER_BIT),r[o%2]=!1),e.uniform2fv(this.blurStep,[t,a]),[t,a]=[a,t],e.drawArrays(e.TRIANGLE_FAN,0,this.mesh.blocks),this.shared.readTexture=3+o%2,e.uniform1i(this.uTex,this.shared.readTexture);e.enable(e.BLEND)};x.prepareBlurSurfaces=function(){const e=this.gl,t=e.canvas.clientWidth;let a=null;if(e instanceof WebGLRenderingContext)P("✔ Bypassing MSAA.");else{let o=function(u,y){const T=e.canvas.clientWidth;if(a===T)return;const L=e.getParameter(e.RENDERBUFFER_BINDING);e.bindRenderbuffer(e.RENDERBUFFER,u),e.renderbufferStorageMultisample(e.RENDERBUFFER,c,y,T,T),e.bindFramebuffer(e.FRAMEBUFFER,d),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,l),e.bindRenderbuffer(e.RENDERBUFFER,L),a=T};const l=e.createRenderbuffer(),c=Math.min(16,e.getParameter(e.MAX_SAMPLES)),d=e.createFramebuffer();ee("Applying "+c+"x MSAA"),P("Applying "+c+`x MSAA
`),o(l,e.RGBA8),window.addEventListener("resize",u=>{o(l,e.RGBA8)}),K(e),this.shared.fboAA=d}const r=$(e,e.TEXTURE0+1,()=>e.canvas.clientWidth,e.RGBA),i=e.createFramebuffer();e.bindFramebuffer(e.FRAMEBUFFER,i),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,r,0),K(e),this.shared.res=t,this.shared.blurRes=Math.floor(t/2),this.shared.fboClear=i,this.shared.clearTexture=r,window.addEventListener("resize",o=>{this.shared.res=e.canvas.clientWidth,this.shared.blurRes=Math.floor(e.canvas.clientWidth/2)})};x.initTesseractBorder=function(){const e=this.gl;this.M3=[],this.M4=[],this.uM3=e.getUniformLocation(this.program,"M3"),this.uM4=e.getUniformLocation(this.program,"M4"),this.qModelL=e.getUniformLocation(this.program,"qModelL"),this.qModelR=e.getUniformLocation(this.program,"qModelR"),this.qViewL=e.getUniformLocation(this.program,"qViewL"),this.qViewR=e.getUniformLocation(this.program,"qViewR"),this.nearFrameColor=e.getUniformLocation(this.program,"nearFrameColor"),this.farFrameColor=e.getUniformLocation(this.program,"farFrameColor"),this.mesh.stride===8&&(this.normal=e.getAttribLocation(this.program,"normal"),e.enableVertexAttribArray(this.normal),e.vertexAttribPointer(this.normal,this.components,e.FLOAT,!1,this.mesh.byteStride,Float32Array.BYTES_PER_ELEMENT*4),this.specularColor1=e.getUniformLocation(this.program,"specularColor1"),this.specularColor2=e.getUniformLocation(this.program,"specularColor2"),this.specularColor3=e.getUniformLocation(this.program,"specularColor3"),this.specularColor4=e.getUniformLocation(this.program,"specularColor4"),this.specularDirection1=e.getUniformLocation(this.program,"specularDirection1"),this.specularDirection2=e.getUniformLocation(this.program,"specularDirection2"),this.specularDirection3=e.getUniformLocation(this.program,"specularDirection3"),this.specularDirection4=e.getUniformLocation(this.program,"specularDirection4"),this.frameSpecularWeight=e.getUniformLocation(this.program,"frameSpecularWeight"))};x.drawTesseractBorder=function(){const e=this.gl;x.commonTesseractAnimation.call(this),e.uniformMatrix4fv(this.uM3,!1,this.M3),e.uniformMatrix4fv(this.uM4,!1,this.M4),e.uniform4fv(this.nearFrameColor,n.lighting.nearFrameColor),e.uniform4fv(this.farFrameColor,n.lighting.farFrameColor),this.frameSpecularWeight&&e.uniform1f(this.frameSpecularWeight,n.lighting.borderSpecularity),this.mesh.stride===8&&(e.uniform4fv(this.specularColor1,n.lighting.specularLights[0].rgba),e.uniform4fv(this.specularColor2,n.lighting.specularLights[1].rgba),e.uniform4fv(this.specularColor3,n.lighting.specularLights[2].rgba),e.uniform4fv(this.specularColor4,n.lighting.specularLights[3].rgba),e.uniform4fv(this.specularDirection1,n.lighting.specularLights[0].xyzw),e.uniform4fv(this.specularDirection2,n.lighting.specularLights[1].xyzw),e.uniform4fv(this.specularDirection3,n.lighting.specularLights[2].xyzw),e.uniform4fv(this.specularDirection4,n.lighting.specularLights[3].xyzw)),e.drawArrays(e.TRIANGLES,0,this.mesh.blocks)};x.initGlassTesseract=function(){var e;const t=this.gl;this.M3=[],this.M4=[],this.uM3=t.getUniformLocation(this.program,"M3"),this.uM4=t.getUniformLocation(this.program,"M4"),this.normal=t.getAttribLocation(this.program,"normal"),this.qModelL=t.getUniformLocation(this.program,"qModelL"),this.qModelR=t.getUniformLocation(this.program,"qModelR"),this.qViewL=t.getUniformLocation(this.program,"qViewL"),this.qViewR=t.getUniformLocation(this.program,"qViewR"),this.opacity=t.getUniformLocation(this.program,"opacity"),this.glowColor=t.getUniformLocation(this.program,"glowColor"),this.membraneColor=t.getUniformLocation(this.program,"membraneColor"),this.diffuseColor1=t.getUniformLocation(this.program,"diffuseColor1"),this.diffuseColor2=t.getUniformLocation(this.program,"diffuseColor2"),this.diffuseColor3=t.getUniformLocation(this.program,"diffuseColor3"),this.diffuseDirection1=t.getUniformLocation(this.program,"diffuseDirection1"),this.diffuseDirection2=t.getUniformLocation(this.program,"diffuseDirection2"),this.diffuseDirection3=t.getUniformLocation(this.program,"diffuseDirection3"),this.specularColor1=t.getUniformLocation(this.program,"specularColor1"),this.specularColor2=t.getUniformLocation(this.program,"specularColor2"),this.specularColor3=t.getUniformLocation(this.program,"specularColor3"),this.specularColor4=t.getUniformLocation(this.program,"specularColor4"),this.specularDirection1=t.getUniformLocation(this.program,"specularDirection1"),this.specularDirection2=t.getUniformLocation(this.program,"specularDirection2"),this.specularDirection3=t.getUniformLocation(this.program,"specularDirection3"),this.specularDirection4=t.getUniformLocation(this.program,"specularDirection4"),t.enableVertexAttribArray(this.normal),t.vertexAttribPointer(this.normal,this.components,t.FLOAT,!1,this.mesh.byteStride,Float32Array.BYTES_PER_ELEMENT*4);const a=t.canvas.clientWidth;(e=this.shared).res??(e.res=a),window.addEventListener("resize",r=>{this.shared.res=t.canvas.clientWidth})};x.drawGlassTesseract=function(){const e=this.gl;if(this.opacityFunction){const t=this.opacityFunction.call(this);if(t<=.001)return;e.uniform1f(this.opacity,t)}x.commonTesseractAnimation.call(this),e.uniformMatrix4fv(this.uM3,!1,this.M3),e.uniformMatrix4fv(this.uM4,!1,this.M4),e.uniform4fv(this.glowColor,n.lighting.glow.rgba),e.uniform4fv(this.membraneColor,n.lighting.membrane.rgba),e.uniform4fv(this.diffuseColor1,n.lighting.diffuseLights[0].rgba),e.uniform4fv(this.diffuseColor2,n.lighting.diffuseLights[1].rgba),e.uniform4fv(this.diffuseColor3,n.lighting.diffuseLights[2].rgba),e.uniform4fv(this.diffuseDirection1,n.lighting.diffuseLights[0].xyzw),e.uniform4fv(this.diffuseDirection2,n.lighting.diffuseLights[1].xyzw),e.uniform4fv(this.diffuseDirection3,n.lighting.diffuseLights[2].xyzw),e.uniform4fv(this.specularColor1,n.lighting.specularLights[0].rgba),e.uniform4fv(this.specularColor2,n.lighting.specularLights[1].rgba),e.uniform4fv(this.specularColor3,n.lighting.specularLights[2].rgba),e.uniform4fv(this.specularColor4,n.lighting.specularLights[3].rgba),e.uniform4fv(this.specularDirection1,n.lighting.specularLights[0].xyzw),e.uniform4fv(this.specularDirection2,n.lighting.specularLights[1].xyzw),e.uniform4fv(this.specularDirection3,n.lighting.specularLights[2].xyzw),e.uniform4fv(this.specularDirection4,n.lighting.specularLights[3].xyzw),e.viewport(0,0,this.shared.res,this.shared.res),e.drawArrays(e.TRIANGLES,0,this.mesh.blocks)};x.useClearTarget=function(){const e=this.gl;this.shared.fboAA?e.bindFramebuffer(e.FRAMEBUFFER,this.shared.fboAA):e.bindFramebuffer(e.FRAMEBUFFER,this.shared.fboClear),e.viewport(0,0,this.shared.res,this.shared.res),e.clear(e.COLOR_BUFFER_BIT)};x.resolveClearTarget=function(){const e=this.gl;this.shared.fboAA&&(e.bindFramebuffer(e.READ_FRAMEBUFFER,this.shared.fboAA),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,this.shared.fboClear),e.blitFramebuffer(0,0,this.shared.res,this.shared.res,0,0,this.shared.res,this.shared.res,e.COLOR_BUFFER_BIT,e.NEAREST))};x.initTexturedCompositor=function(){const e=this.gl;this.aTexel=e.getAttribLocation(this.program,"aTexel"),this.uBlurTex=e.getUniformLocation(this.program,"blurTex"),this.uClearTex=e.getUniformLocation(this.program,"clearTex"),this.uLensTex=e.getUniformLocation(this.program,"lensTex"),this.uClarityScale=e.getUniformLocation(this.program,"clarityScale"),this.uCloudShiftSmall=e.getUniformLocation(this.program,"cloudShiftSmall"),this.uCloudShiftMedium=e.getUniformLocation(this.program,"cloudShiftMedium"),this.uCloudShiftLarge=e.getUniformLocation(this.program,"cloudShiftLarge"),e.bindBuffer(e.ARRAY_BUFFER,this.vbo),e.enableVertexAttribArray(this.aTexel),e.vertexAttribPointer(this.aTexel,2,e.FLOAT,!1,this.mesh.byteStride,2*Float32Array.BYTES_PER_ELEMENT),e.bindBuffer(e.ARRAY_BUFFER,null),e.uniform1i(this.uBlurTex,0),e.uniform1i(this.uClearTex,1),e.uniform1i(this.uLensTex,5),this.lensTexture=e.createTexture(),e.activeTexture(e.TEXTURE0+5),e.bindTexture(e.TEXTURE_2D,this.lensTexture),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,new Uint8Array([0,0,0,0]));const t=new Image;t.addEventListener("load",()=>{const a=e.getParameter(e.TEXTURE_BINDING_2D);e.bindTexture(e.TEXTURE_2D,this.lensTexture),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.REPEAT),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR_MIPMAP_LINEAR),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,t),e.generateMipmap(e.TEXTURE_2D),e.bindTexture(e.TEXTURE_2D,a)}),t.src="/tesseract/cloud-1.png"};x.drawTexturedCompositor=function(){const e=this.gl;e.uniform2fv(this.uCloudShiftSmall,[this.dt/12e4%1,this.dt/-95e3%1]),e.uniform2fv(this.uCloudShiftMedium,[this.dt/-37e3%1,this.dt/12e4%1]),e.uniform2fv(this.uCloudShiftLarge,[this.dt/-6e5%1,this.dt/65e3%1]),e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,this.shared.res,this.shared.res),e.uniform1i(this.uBlurTex,this.shared.readTexture),e.uniform1f(this.uClarityScale,n.clarityScale),e.drawArrays(e.TRIANGLE_FAN,0,this.mesh.blocks)};function $(e,t,a,r){const i=e,o=i.createTexture();let l=null,c=null;r??(r=i.RGBA),typeof a=="function"?(l=a(),c=l,window.addEventListener("resize",u=>{const y=i.getParameter(i.TEXTURE_BINDING_2D);l=a(),c!==l&&(i.bindTexture(i.TEXTURE_2D,o),d(),i.bindTexture(i.TEXTURE_2D,y),c=l)})):(l=a,c=l),i.activeTexture(t),i.bindTexture(i.TEXTURE_2D,o),r===i.DEPTH_COMPONENT16||r===i.DEPTH_COMPONENT?(i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.NEAREST),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.NEAREST)):(i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MAG_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR)),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE),d();function d(){if(r===i.RGBA)i.texImage2D(i.TEXTURE_2D,0,r,l,l,0,i.RGBA,i.UNSIGNED_BYTE,null);else if(r===i.DEPTH_COMPONENT)i.texImage2D(i.TEXTURE_2D,0,r,l,l,0,i.DEPTH_COMPONENT,i.UNSIGNED_SHORT,null);else if(r===i.DEPTH_COMPONENT16)i.texImage2D(i.TEXTURE_2D,0,r,l,l,0,i.DEPTH_COMPONENT,i.UNSIGNED_SHORT,null);else throw new Error("Unsupported texture format for blankTexture.")}return o}function K(e){const t=e.checkFramebufferStatus(e.FRAMEBUFFER);if(t!==e.FRAMEBUFFER_COMPLETE){ee("test:");const a=Object.keys(Object.getPrototypeOf(e)).filter(r=>r.startsWith("FRAMEBUFFER"));for(const r of a)e[r]===t&&P("Framebuffer incomplete: "+r)}}const de=class B{constructor(){this.specularLights=[new B.Light({xyzw:[-.707106781,0,.707106781,0]}),new B.Light({xyzw:[0,-.707106781,0,-.707106781]}),new B.Light({xyzw:[.577350269,.577350269,-.577350269,0]}),new B.Light({xyzw:[0,0,-1,0]})],this.diffuseLights=[new B.Light({xyzw:[-.707106781,0,.707106781,0]}),new B.Light({xyzw:[0,-.707106781,0,-.707106781]}),new B.Light({xyzw:[0,0,0,-1]})],this.glow=new B.Light,this.glow.rgba[3]=.05,this.membrane=new B.Light,this.nearFrameColor=[0,0,0,0],this.farFrameColor=[0,0,0,0],this.diffuseOpacity=1,this.specularOpacity=1,this.borderSpecularity=0}};j(de,"Light",class{constructor(e={}){j(this,"xyzw",[0,0,0,0]),j(this,"rgba",[0,0,0,0]),e.xyzw&&(this.xyzw=[...e.xyzw]),e.rgba&&(this.rgba=[...e.rgba])}});let I=de;function me(e,t){const a=Math.sqrt(-2*e**2*Math.log(.06*e*Math.sqrt(2*q)))/(t-1),r=[];let i=0,o=0;for(let c=0;c<t;c++){const d=l(i);r.push(d),o+=2*d,i+=a}return o-=l(0),r.forEach((c,d)=>r[d]=c/o),r;function l(c){return 1/(e*Math.sqrt(2*q))*Math.exp(-.5*(c/e)**2)}}class he extends Array{constructor(){super(...arguments),j(this,"stride",1)}static from(...t){let a=super.from(...t);return t[0].stride&&(a.stride=t[0].stride),a}get blocks(){return this.length/this.stride}get byteStride(){return this.stride*Float32Array.BYTES_PER_ELEMENT}log(t=""){console.log("  "+t+` ${this.length} elements / ${this.stride} stride = ${this.blocks} blocks`);for(let a=0;a<this.length;a+=this.stride){let r=`${a/this.stride})`.padEnd(5)+"<".padStart(5);for(let i=0;i<this.stride;i++)r+=this[a+i].toFixed(2).padStart(7)+(i<this.stride-1?",":"");r+="  >",console.log(r)}}replace(t,a=this.stride){const r=[];let i=0;for(let o=0;o<this.length;o+=a){const l=[];for(let d=0;d<a;d++)l.push(this[o+d]);const c=t(l);r.push(...c),i=c.length}return this.stride=i,this.length=0,this.push(...r),this}interleave(t,a=this.stride){const r=[];let i=0;for(let o=0;o<this.length;o+=a){const l=[];for(let d=0;d<a;d++)l.push(this[o+d]);const c=t(l);r.push(...l,...c),i=c.length}return this.stride+=i,this.length=0,this.push(...r),this}invertTriangles(){return this.replace(Fe,9)}sproutNormals(){return this.replace(t=>{const a=triangleNormal3(t);return[t[0],t[1],t[2],...a,t[3],t[4],t[5],...a,t[6],t[7],t[8],...a]},9)}}const M={};M.square2d=[-1,-1,1,-1,1,1,-1,1];M.texSquare=he.from(M.square2d);M.texSquare.stride=2;M.texSquare.interleave(e=>[(e[0]+1)/2,(e[1]+1)/2]);M.texSquare.stride=4;M.tesseractOutline=ge(Me,8);M.normalTesseract=ge(Ce,8);function Fe(e){return[e[0],e[1],e[2],e[6],e[7],e[8],e[3],e[4],e[5]]}function ge(e,t){const a=new he,r=e.bind(a),i=[-1,1,1,1],o=[-1,-1,1,1],l=[1,-1,1,1],c=[1,1,1,1],d=[1,1,-1,1],u=[1,-1,-1,1],y=[-1,-1,-1,1],T=[-1,1,-1,1],L=[-1,1,1,-1],m=[-1,-1,1,-1],f=[1,-1,1,-1],g=[1,1,1,-1],v=[1,1,-1,-1],A=[1,-1,-1,-1],R=[-1,-1,-1,-1],S=[-1,1,-1,-1];return r(i,o,l,c),r(i,T,y,o),r(T,d,u,y),r(d,c,l,u),r(i,c,d,T),r(l,o,y,u),r(L,m,f,g),r(S,R,m,L),r(S,v,A,R),r(g,f,A,v),r(S,L,g,v),r(m,R,A,f),r(i,L,m,o),r(c,g,f,l),r(d,v,A,u),r(T,S,R,y),r(o,m,f,l),r(y,R,m,o),r(u,A,R,y),r(l,f,A,u),r(i,L,g,c),r(T,S,L,i),r(d,v,S,T),r(c,g,v,d),a.stride=t,a}function Me(e,t,a,r){const i=[],[o,l,c,d]=[[],[],[],[]];for(let u=0;u<4;u++)o[u]=(e[u]+t[u])/2,l[u]=(t[u]+a[u])/2,c[u]=(a[u]+r[u])/2,d[u]=(r[u]+e[u])/2;for(let u=0;u<4;u++)i[u]=(e[u]+t[u]+a[u]+r[u])/4;for(const[u,y,T]of[[e,t,o],[t,a,l],[a,r,c],[r,e,d]]){const L=[],m=[];for(let f=0;f<4;f++)L[f]=u[f]*(1-.04)+i[f]*.04;for(let f=0;f<4;f++)m[f]=y[f]*(1-.04)+i[f]*.04;this.push(...[u,T,y,T,L,T,L,T,y,T,m,T].flat())}}function Ce(e,t,a,r){const i=[];for(let o=0;o<4;o++)i[o]=(e[o]+t[o]+a[o]+r[o])/4;this.push(...[e,i,t,i,a,i,e,i,a,i,r,i].flat())}const De='[{"name":"blossom","string":"{\\"Lstring\\":\\"0.3770087083426957i + -0.7913019518279542j + 0.4250500001960014k + -0.2259162503972059\\",\\"Rstring\\":\\"-0.5671411517174197i + -0.3997880634675983j + 0.0339703232464508k + -0.7192818887397743\\",\\"velocity\\":[0,0,0,0,0.0625,0,0,0,0,0,0,-0.0625],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.03536487511244542,0.13252253894422736,-0.9905488893941868,-8.673617379884035e-19],\\"rgba\\":[0.6862745098039216,0.4117647058823529,1.2352941176470589,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0.34901960784313724,0,0.07058823529411765,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.32941176470588235,0.403921568627451,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.27450980392156865,0.17647058823529413,0.615686274509804,0.10980392156862745]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.058823529411764705,0.047058823529411764,0.07058823529411765,0.5686274509803921]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.35294117647058826,0.12156862745098039,0.23921568627450981,0.09019607843137255],\\"diffuseOpacity\\":1,\\"specularOpacity\\":2,\\"borderSpecularity\\":0.2}}"},{"name":"first light","string":"{\\"Lstring\\":\\"0.1071288310610887i + -0.5278657488370966j + -0.0673330530359743k + 0.8398496441248096\\",\\"Rstring\\":\\"-0.0459106443189584i + 0.9243623345765215j + 0.1179090293992739k + 0.3599221415085698\\",\\"velocity\\":[0,0.0375,0,0,-0.05625,0,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0.4549019607843137,0.9568627450980393,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-1,-1,-1,0.14901960784313725]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[-0.9019607843137255,0.011764705882352941,0.21568627450980393,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[-0.8196078431372549,0.10196078431372549,1,0.1411764705882353]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[-0.0392156862745098,-0.0392156862745098,-0.043137254901960784,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0.11764705882352941,0,-0.09803921568627451,0.058823529411764705]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.17647058823529413,0.12156862745098039,0.058823529411764705,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.29411764705882354,0.08235294117647059,0,0.12549019607843137]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.043137254901960784,0.03137254901960784,0.1568627450980392,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.7843137254901961,0.23529411764705882,0,0],\\"diffuseOpacity\\":3,\\"specularOpacity\\":3,\\"borderSpecularity\\":0.4}}"},{"name":"aquarius","string":"{\\"Lstring\\":\\"0.3606987087850542i + -0.6427843814039939j + -0.0347757345848848k + -0.6749187571787967\\",\\"Rstring\\":\\"0.2324618090832823i + 0.5393663467140035j + 0.7056944671560963k + 0.3962836993609121\\",\\"velocity\\":[0,0.037500000000000006,0,0,0.037500000000000006,0,0,0,0,0,0,0.11249999999999999],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0.11764705882352941,0.5411764705882353,0.6352941176470588,0.12941176470588234]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[1.4470588235294117,2.458823529411765,3,0.12941176470588234]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0.11764705882352941,1.011764705882353,0.5176470588235293,0.12941176470588234]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.6039215686274509,1.2078431372549019,1.015686274509804,3.67843137254902]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[-0.18823529411764706,-0.11372549019607843,-0.12941176470588237,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.17254901960784313,-0.11764705882352941,-0.35294117647058826,0.25882352941176473]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.00392156862745098,0.3058823529411765,0.6392156862745098,0.1450980392156863]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.34901960784313724,0.19215686274509805,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"wintersun","string":"{\\"Lstring\\":\\"0.3719736765396583i + 0.2101507393543021j + -0.0868600418969983k + -0.8999597678969921\\",\\"Rstring\\":\\"-0.5675448115073667i + 0.3688262435741262j + 0.3145224238654931k + 0.6655341718267085\\",\\"velocity\\":[0,0.046875,0,0,-0.046875,0,0,0,0,-0.032812499999999994,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[2.9058823529411764,0,0,0.7835294117647059]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,1.2470588235294118,1.2470588235294118,0.7835294117647059]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[2.8705882352941177,1.223529411764706,0,0.36000000000000004]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0,1.1803921568627451,6.698039215686275,1.828235294117647]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[-0.6666666666666666,-0.043137254901960784,-0.043137254901960784,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-0.01568627450980392,-0.08627450980392157,-0.18823529411764706,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.41568627450980394,0.0392156862745098,0.3137254901960784,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7176470588235294,0.09019607843137255,0,0.5098039215686274]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.3254901960784314,0.2784313725490196,0.8627450980392157,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"trance","string":"{\\"Lstring\\":\\"-0.7227606368739261i + 0.1427279015970619j + 0.5724411835866986k + -0.3599401328360199\\",\\"Rstring\\":\\"0.1062919047636684i + 0.3554399758333309j + 0.9158459902528523k + -0.1535922416657187\\",\\"velocity\\":[0,0,0,0,0,0,0,0,0,0,-0.0525,0.0875],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[1,0,0,3]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0.7529411764705882,1.5058823529411764,3]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[-2.7294117647058824,0.6588235294117647,1.2000000000000002,2.776470588235294]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.3568627450980392,-0.5490196078431373,-4.145098039215687,7]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[-0.8745098039215686,0.10588235294117647,0.13333333333333333,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0,0.07450980392156863,0.12941176470588237,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.9725490196078431,0.5098039215686274,0.3137254901960784,0]},\\"nearFrameColor\\":[0.49411764705882353,0.2092156862745098,0.226078431372549,0],\\"farFrameColor\\":[1,0.62,0.49,1],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"anemochore","string":"{\\"Lstring\\":\\"-0.0805261893707946i + 0.2743728554710255j + 0.7017029562350887k + 0.6525703258675746\\",\\"Rstring\\":\\"0.2435454850858778i + 0.1498350015448846j + 0.8141109929302610k + 0.5054288873636178\\",\\"velocity\\":[0.05,0,0,0,0,-0.0625,-0.03125,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0.2627450980392157,0.19607843137254902,0.1450980392156863,0]},{\\"xyzw\\":[0.6600685039065106,-0.21578419676780547,0.7174669903527193,-0.05466139707421265],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0.3176470588235294,0.09411764705882353,0,0.2]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.9019607843137255,0.6823529411764706,0.5490196078431373,0.2]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.666527037335581,-0.5579300285182619,0.03514599234409593,-0.4931739561254359],\\"rgba\\":[0.21568627450980393,0.07450980392156863,0.043137254901960784,0.054901960784313725]},{\\"xyzw\\":[0.6037489214813726,-0.3757445940833738,0.006975561737554433,-0.7030324184315015],\\"rgba\\":[0.45098039215686275,0.20392156862745098,0.14901960784313725,0]},{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[0.4627450980392157,0.28627450980392155,0.1803921568627451,0.047058823529411764]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.23529411764705882,0.06274509803921569,0.050980392156862744,0.06666666666666667]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.27450980392156865,0.1568627450980392,0.23529411764705882,0.21568627450980393]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"ember iris","string":"{\\"Lstring\\":\\"-0.5579837100826338i + 0.7786196862397065j + -0.2465777870033310k + -0.1469862525466535\\",\\"Rstring\\":\\"0.7850300329947077i + 0.5489283048032018j + -0.1441205277920669k + -0.2482636440357161\\",\\"velocity\\":[0.03125,0,0,0,0,-0.06875,0,-0.0125,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0,0,0,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0.7921568627450981,0.023529411764705882,0.12156862745098039,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[-0.24313725490196078,0.3176470588235294,0,0]},{\\"xyzw\\":[-0.02030172926938055,0.8193101708688632,-0.1270753390018728,-0.5587222403995266],\\"rgba\\":[0.11764705882352941,0.35294117647058826,0.9019607843137255,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.7843137254901961,0,-0.2901960784313726,0.20784313725490197]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[-0.06666666666666668,0.00392156862745098,0.34509803921568627,0]},\\"nearFrameColor\\":[0.0392156862745098,0.011764705882352941,0.00392156862745098,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":0.7,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"captured light","string":"{\\"Lstring\\":\\"0.8480253023376401i + 0.2909808138529828j + -0.4380945786750333k + 0.0652410353674748\\",\\"Rstring\\":\\"-0.6875523541633705i + 0.3206171828092015j + 0.4168948500298034k + -0.5006746112846883\\",\\"velocity\\":[0,0,0.05,0.06875,0,0,0,0,0,-0.0375,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.577350269,0.577350269,-0.577350269,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.20392156862745098,0.22745098039215686,0.396078431372549,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.707106781,0,0.707106781,0],\\"rgba\\":[0,0,0,0]},{\\"xyzw\\":[0.707106781,0,-0.707106781,0],\\"rgba\\":[-0.16862745098039217,-0.23529411764705882,-0.19215686274509805,0]},{\\"xyzw\\":[0,0,0,-1],\\"rgba\\":[0,0,0,0]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.24313725490196078,0.21568627450980393,0.1568627450980392,0.03137254901960784]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0,0,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0,0,0,0],\\"diffuseOpacity\\":3,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"},{"name":"chromophore","string":"{\\"Lstring\\":\\"0.2461767777234436i + -0.1454713892950948j + 0.4874959217027777k + 0.8249744210049221\\",\\"Rstring\\":\\"-0.2729822245975122i + -0.0851213019540162j + 0.2852539441146569k + 0.9148033976466068\\",\\"velocity\\":[0.05,0,0,0,0,-0.05,0,0,0,0,0,0],\\"lighting\\":{\\"specularLights\\":[{\\"xyzw\\":[0.5685073322606132,0.1551953696411359,-0.7520872052930957,-0.2950909114871094],\\"rgba\\":[0.8901960784313725,0.5490196078431373,0.45098039215686275,0.19607843137254902]},{\\"xyzw\\":[0,-0.707106781,0,-0.707106781],\\"rgba\\":[0.2901960784313726,0.1843137254901961,0,0]},{\\"xyzw\\":[0.02030172926938055,-0.8193101708688632,0.1270753390018728,0.5587222403995266],\\"rgba\\":[0.19607843137254902,-1,0.5176470588235295,0]},{\\"xyzw\\":[0,0,-1,0],\\"rgba\\":[0.3764705882352941,0.11372549019607843,0,0]}],\\"diffuseLights\\":[{\\"xyzw\\":[-0.34111195854061166,-0.4786795739877712,2.949029909160572e-17,-0.8090169943749477],\\"rgba\\":[-0.15294117647058825,0.16862745098039217,0.10980392156862745,0.19607843137254902]},{\\"xyzw\\":[0.13048778609679595,-0.573118173234877,2.42861286636753e-17,-0.809016994374948],\\"rgba\\":[0.1843137254901961,-0.1607843137254902,0.16862745098039217,0.19607843137254902]},{\\"xyzw\\":[0,0.5877852522924736,0,-0.8090169943749472],\\"rgba\\":[0.27450980392156865,0.058823529411764705,-0.19607843137254902,0.19607843137254902]}],\\"glow\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0.39215686274509803,0.22745098039215686,0.5294117647058824,0]},\\"membrane\\":{\\"xyzw\\":[0,0,0,0],\\"rgba\\":[0,0.0784313725490196,0,0]},\\"nearFrameColor\\":[0,0,0,0],\\"farFrameColor\\":[0.0392156862745098,0,0,0],\\"diffuseOpacity\\":1,\\"specularOpacity\\":1,\\"borderSpecularity\\":0}}"}]';window.onerror=Ue;document.querySelector(".loading-notice").classList.add("hidden");const ee=console.log.bind(console),z=document.getElementById.bind(document),n={animationSpeeds:[],lighting:new I,viewL:new p,viewR:new p,releasedViewL:new p,releasedViewR:new p,viewSnapT:1,grabStyle:"3d",modelL:new p,modelR:new p,initialModelL:new p,initialModelR:new p,finalModelL:new p,finalModelR:new p,modelSnapT:1,blurPassCount:2,clarityScale:0,animation1:{keepAnimating:!0},animationSet:[],animationCycle:{},upcomingAnimations:[],currentAnimation:{},countdowns:[]},Q=n.animationSet;function P(e){document.querySelector(".feedback").style.visibility="visible",document.querySelector(".feedback").textContent+=e+`
`}function Ue(e,t,a,r,i){P("⚠️ "+e),P(t),P("Line: "+a),P("Col: "+r),P(i)}_e();function _e(){try{let l=function(m){return m<.5?8*m**4:1-Math.pow(-2*m+2,4)/2},c=function(m){var f;if(!n.clarityTransition)return;(f=n.clarityTransition).tStart??(f.tStart=m);const g=Math.min(1,(m-n.clarityTransition.tStart)/n.clarityTransition.duration);n.clarityScale=U(n.clarityTransition.initial,n.clarityTransition.final,g),g===1&&delete n.clarityTransition},d=function(m){var f;if(!n.lightTransition)return;(f=n.lightTransition).tStart??(f.tStart=m);const g=Math.min(1,(m-n.lightTransition.tStart)/n.lightTransition.duration);n.lighting=Ve(n.lightTransition.initial,n.lightTransition.final,g),g===1&&delete n.lightTransition},u=function(m){var f;if(!n.velocityTransition)return;(f=n.velocityTransition).tStart??(f.tStart=m);const g=Math.min(1,(m-n.velocityTransition.tStart)/n.velocityTransition.duration);n.animationSpeeds=Ie(n.velocityTransition.initial,n.velocityTransition.final,g),g===1&&delete n.velocityTransition},y=function(m,f){var g;if(!n.orientationTransition){ie(n.animationSpeeds,n.modelL,n.modelR,f);return}(g=n.orientationTransition).tStart??(g.tStart=m);const v=Math.min(1,(m-n.orientationTransition.tStart)/n.orientationTransition.duration),A=l(v);ie(n.orientationTransition.initial.animationSpeeds,n.orientationTransition.initial.modelL,n.orientationTransition.initial.modelR,f),n.modelL=p.slerpUnit(n.orientationTransition.initial.modelL,n.orientationTransition.final.modelL,A),n.modelR=p.slerpUnit(n.orientationTransition.initial.modelR,n.orientationTransition.final.modelR,A),v===1&&(n.animationSpeeds=[...n.orientationTransition.final.animationSpeeds],delete n.orientationTransition)},T=function(){if(this.t??(this.t=0),this.tLast??(this.tLast=this.dt),!n.pointerdown){const m=this.dt-this.tLast;if(this.t+=m,this.shared.animationState.needUpdate){c(this.t),d(this.t),u(this.t),y(this.t,m),n.modelSnapT<1&&(n.modelSnapT+=(this.dt-this.tLast)/2e3,n.modelSnapT=Math.min(n.modelSnapT,1),n.modelL=p.slerpUnit(n.initialModelL,n.finalModelL,l(n.modelSnapT)),n.modelR=p.slerpUnit(n.initialModelR,n.finalModelR,l(n.modelSnapT))),n.viewSnapT<1&&(n.viewSnapT+=(this.dt-this.tLast)/2e3,n.viewSnapT=Math.min(n.viewSnapT,1),n.viewL=p.slerpUnit(n.releasedViewL,p.from([0,0,0,1]),n.viewSnapT),n.viewR=p.slerpUnit(n.releasedViewR,p.from([0,0,0,1]),n.viewSnapT));const f=this.dt-this.tLast;let g=!1;for(const v of[...n.countdowns])v.remaining-=f,v.remaining<0&&(v.callback(),g=!0);g&&(n.countdowns=n.countdowns.filter(v=>v.remaining>0)),this.shared.animationState.needUpdate=!1}}this.tLast=this.dt,this.gl.uniform4fv(this.qViewL,n.viewL),this.gl.uniform4fv(this.qViewR,n.viewR),this.gl.uniform4fv(this.qModelL,n.modelL),this.gl.uniform4fv(this.qModelR,n.modelR)};var e=l,t=c,a=d,r=u,i=y,o=T;P("Script loaded."),je(),Xe(),We();for(const m of[z("main-canvas")])if(m){const f=m.getBoundingClientRect();m.setAttribute("width",f.width),m.setAttribute("height",f.height)}let L=z("main-canvas").getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1});L||(L=z("main-canvas").getContext("webgl",{alpha:!0,premultipliedAlpha:!0,antialias:!1}));for(const[m,f]of[[L,z("first-title").querySelector(".view-label")]])m.canvas.width=m.canvas.clientWidth,m.canvas.height=m.canvas.clientHeight,f.innerHTML=m.getParameter(m.VERSION)+"<br>"+m.getParameter(m.SHADING_LANGUAGE_VERSION),m instanceof WebGLRenderingContext||(f.innerHTML+="<br>"+m.getParameter(m.MAX_SAMPLES)+"x MSAA support");n.animation1.context=L,n.animation1.showFPS=()=>{z("fps-1").textContent=n.animation1.lastFPS.toFixed(1)+" FPS"},n.animation1.draw=Be(L,{animationState:n.animation1,nearPlane:1,farPlane:100,animator:T},[{init:x.prepareBlurSurfaces,draw:x.useClearTarget},{vertexShader:E.projectorVert,fragmentShader:E.borderFrag,mesh:M.tesseractOutline,components:4,init:x.initTesseractBorder,draw:x.drawTesseractBorder},{vertexShader:E.projectorVert,fragmentShader:E.diffuseFrag,opacityFunction:()=>n.lighting.diffuseOpacity,mesh:M.normalTesseract,components:4,init:x.initGlassTesseract,draw:x.drawGlassTesseract},{vertexShader:E.projectorVert,fragmentShader:E.glitterFrag,opacityFunction:()=>n.lighting.specularOpacity,mesh:M.normalTesseract,components:4,init:x.initGlassTesseract,draw:x.drawGlassTesseract},{draw:x.resolveClearTarget},{vertexShader:E.textureVert,fragmentShader:E.blur1dFrag,mesh:M.texSquare,init:x.initBlur,draw:x.drawBlur},{vertexShader:E.textureVert,fragmentShader:E.texturedCompositorFrag,mesh:M.texSquare,init:x.initTexturedCompositor,draw:x.drawTexturedCompositor}])}catch(l){P(`
🚩 Initialization error: `+l.message+`
`+l.stack)}}function Pe(e){if(!e.createVertexArray){const a=e.getExtension("OES_vertex_array_object");e.VERTEX_ARRAY_BINDING=a.VERTEX_ARRAY_BINDING_OES,e.createVertexArray=a.createVertexArrayOES.bind(a),e.deleteVertexArray=a.deleteVertexArrayOES.bind(a),e.isVertexArray=a.isVertexArrayOES.bind(a),e.bindVertexArray=a.bindVertexArrayOES.bind(a)}const t=e.getExtension("WEBGL_depth_texture");t?(e.appropriateDepthFormat=e.DEPTH_COMPONENT,e.depthTextureExt=t):e.appropriateDepthFormat=e.DEPTH_COMPONENT16}function Be(e,t,a=[]){try{let i=function(o){ze(o,t.animationState),i.pauseTime??(i.pauseTime=0),i.t0??(i.t0=o),i.pauseTime&&(i.t0+=o-i.pauseTime,i.pauseTime=0);const l=o-i.t0;e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT);for(const c of a)c.dt=l,c.program&&(e.bindVertexArray(c.vao),e.useProgram(c.program)),c.draw();t.animationState.keepAnimating?(t.animationState.needUpdate=!0,requestAnimationFrame(i)):i.pauseTime=o};var r=i;if(!a.length)throw new Error("No rendering phases specified.");if(!t.animationState)throw new Error("animationState needed.");Pe(e),t.nearPlane??(t.nearPlane=.1),t.farPlane??(t.farPlane=1e3),t.projection=Ae({near:t.nearPlane,far:t.farPlane,fov:12,aspect:1});for(const o of a){if(o.gl=e,o.shared=t,o.components??(o.components=3),!o.draw)throw new Error("Draw method needed.");if(!o.vertexShader||!o.fragmentShader||!o.mesh){o.init&&o.init();continue}let l=re(e,o.vertexShader,e.VERTEX_SHADER),c=re(e,o.fragmentShader,e.FRAGMENT_SHADER);o.program=e.createProgram(),e.attachShader(o.program,l),e.attachShader(o.program,c),Ne(e,o.program),e.deleteShader(l),e.deleteShader(c),l=null,c=null,o.vao=e.createVertexArray(),e.bindVertexArray(o.vao),o.vbo=e.createBuffer(),e.bindBuffer(e.ARRAY_BUFFER,o.vbo),e.bufferData(e.ARRAY_BUFFER,new Float32Array(o.mesh),e.STATIC_DRAW),o.model=e.getUniformLocation(o.program,"model"),o.view=e.getUniformLocation(o.program,"view"),o.projection=e.getUniformLocation(o.program,"projection"),o.pos=e.getAttribLocation(o.program,"pos"),e.useProgram(o.program),e.uniformMatrix4fv(o.projection,!1,t.projection),e.enableVertexAttribArray(o.pos),e.vertexAttribPointer(o.pos,o.components,e.FLOAT,!1,o.mesh.byteStride,0),o.init&&o.init()}return e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.enable(e.BLEND),e.blendFunc(e.ONE,e.ONE),requestAnimationFrame(i),i}catch(i){document.querySelector(".feedback").style.visibility="visible",i.cause?document.querySelector(".feedback").innerHTML=Oe(i):document.querySelector(".feedback").textContent+="❌ "+i.message+`
`,ee(i)}}function ze(e,t){var a;t.intervalStart??(t.intervalStart=e),t.frameCount??(t.frameCount=0),t.frameCount++;const r=e-t.intervalStart;r>1e3&&(t.lastFPS=1e3*t.frameCount/r,t.intervalStart=e,t.frameCount=0,(a=t.showFPS)==null||a.call(t))}function re(e,t,a){const r=e.createShader(a);if(e.shaderSource(r,t),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw new Error(e.getShaderInfoLog(r),{cause:t});return r}function Ne(e,t){if(e.linkProgram(t),!e.getProgramParameter(t,e.LINK_STATUS))throw new Error(e.getProgramInfoLog(t))}function Oe(e){var t,a;const r=((t=e.cause)==null?void 0:t.split(`
`))||["~"],i=parseInt((a=e.message.match(/\d:(\d+)/))==null?void 0:a[1]),o=r[i-1];return r[i-1]=`<span style="color:#f44">${o}</span>`,`<span style="color:#efa">${e.message}</span>`+r.filter((l,c)=>Math.abs(i-c)<4).join("<br>")}const V=[{L:p.from([0,0,1,1]),R:p.from([0,0,-1,1])},{L:p.from([0,1,0,1]),R:p.from([0,-1,0,1])},{L:p.from([1,0,0,1]),R:p.from([-1,0,0,1])},{L:p.from([1,0,0,1]),R:p.from([1,0,0,1])},{L:p.from([0,1,0,1]),R:p.from([0,1,0,1])},{L:p.from([0,0,1,1]),R:p.from([0,0,1,1])}];function ie(e,t,a,r){for(const[i,o]of e.entries()){if(Math.abs(o)<1e-6)continue;const l=r*o*q/1e3;i<6?(t.postmultiply(V[i].L.atAngle(l)),a.premultiply(V[i].R.atAngle(l))):(t.premultiply(V[i%6].L.atAngle(l)),a.postmultiply(V[i%6].R.atAngle(l)))}}function J(e,t){delete n.clarityTransition,n.clarityTransition={initial:n.clarityScale,final:e,duration:t}}function pe(e,t,a){delete n.velocityTransition,n.velocityTransition={initial:e,final:t,duration:a}}function ke(e,t=2e3){delete n.orientationTransition,n.orientationTransition={initial:{animationSpeeds:[...n.animationSpeeds],modelL:p.from(n.modelL),modelR:p.from(n.modelR)},final:e,duration:t}}function ve(e,t,a=2e3){delete n.lightTransition,n.lightTransition={initial:e,final:t,duration:a}}function qe(e=3e3){J(1,e/2),ve(new I,n.currentAnimation.lighting,e),pe(Array(12).fill(0),n.animationSpeeds,e/4)}function Ie(e,t,a){return e.map((r,i)=>U(r,t[i],a))}function Ve(e,t,a){const r=new I;for(const i of["specularLights","diffuseLights"])for(const o in e[i])r[i][o]=Y(e[i][o],t[i][o],a);return r.glow=Y(e.glow,t.glow,a),r.membrane=Y(e.membrane,t.membrane,a),r.nearFrameColor=e.nearFrameColor.map((i,o)=>U(i,t.nearFrameColor[o],a)),r.farFrameColor=e.farFrameColor.map((i,o)=>U(i,t.farFrameColor[o],a)),r.diffuseOpacity=U(e.diffuseOpacity,t.diffuseOpacity,a),r.specularOpacity=U(e.specularOpacity,t.specularOpacity,a),r.borderSpecularity=U(e.borderSpecularity,t.borderSpecularity,a),r}function Y(e,t,a){const r=[e.rgba[0]>=0&&t.rgba[0]>=0,e.rgba[1]>=0&&t.rgba[1]>=0,e.rgba[2]>=0&&t.rgba[2]>=0];function i(u){return Math.abs(u)<.04045?u/12.92:Math.pow((u+.055)/1.055,2.4)}function o(u){return Math.abs(u)<.0031308?u*12.92:1.055*Math.pow(u,1/2.4)-.055}const l=[r[0]?i(e.rgba[0]):e.rgba[0],r[1]?i(e.rgba[1]):e.rgba[1],r[2]?i(e.rgba[2]):e.rgba[2],e.rgba[3]],c=[r[0]?i(t.rgba[0]):t.rgba[0],r[1]?i(t.rgba[1]):t.rgba[1],r[2]?i(t.rgba[2]):t.rgba[2],t.rgba[3]],d=[U(l[0],c[0],a),U(l[1],c[1],a),U(l[2],c[2],a),U(l[3],c[3],a)];return new I.Light({xyzw:e.xyzw.map((u,y)=>U(u,t.xyzw[y],a)),rgba:[r[0]?o(d[0]):d[0],r[1]?o(d[1]):d[1],r[2]?o(d[2]):d[2],d[3]]})}function U(e,t,a){return a*t+(1-a)*e}function Xe(){const e=JSON.parse(De);for(const{name:t,string:a}of e){const r=JSON.parse(a);r.lighting.glow.rgba[3]===0&&(r.lighting.glow.rgba[3]=.05),n.animationSet.push({title:t,modelL:p.parse(r.Lstring),modelR:p.parse(r.Rstring),animationSpeeds:r.velocity,lighting:r.lighting,active:!0})}}function Z(){const e=[];n.upcomingAnimations=[];const t=n.animationSet.filter(a=>a.active);for(let a=0;a<t.length;a++)e[a]=a;for(;e.length;){const a=Math.floor(Math.random()*e.length),r=e.splice(a,1)[0];n.upcomingAnimations.push(t[r])}n.currentAnimation===n.upcomingAnimations[0]&&n.upcomingAnimations.push(n.upcomingAnimations.shift())}function We(){const e=Array(12).fill(0);Z();const t=n.upcomingAnimations.shift();n.currentAnimation=t,n.modelL=p.from(t.modelL),n.modelR=p.from(t.modelR),n.animationSpeeds=[...t.animationSpeeds],n.lighting=new I,n.countdowns.push({remaining:2e4,callback:a}),window.dispatchEvent(new CustomEvent("tesseract-change",{detail:n.currentAnimation}));function a(){const r=n.upcomingAnimations.shift();n.currentAnimation=r,window.dispatchEvent(new CustomEvent("tesseract-change",{detail:n.currentAnimation})),n.upcomingAnimations.length||Z(),ke(r,2e3),n.countdowns.push({callback:()=>{ve(n.lighting,r.lighting,2e3*2)},remaining:2e3}),n.countdowns.push({callback:()=>{pe(e,r.animationSpeeds.map(i=>1.3*i),2e3/4)},remaining:2e3}),n.countdowns.push({callback:a,remaining:2e4})}}function ae(e){n.grabStyle=e}function je(){function e(){z("main-canvas").clientWidth>350?n.blurPassCount=4:n.blurPassCount=2}window.addEventListener("resize",o=>{for(const l of[n.animation1]){const c=l.context;c.canvas.width=c.canvas.clientWidth,c.canvas.height=c.canvas.clientHeight,c.viewport(0,0,c.canvas.width,c.canvas.height),l.keepAnimating||requestAnimationFrame(l.draw)}e()}),e();const t=o=>{n.lastX=o.clientX,n.lastY=o.clientY,n.pointerdown=!0};z("main-canvas").addEventListener("pointerdown",t);const a=o=>{n.pointerdown=!1,n.releasedViewL=n.viewL,n.releasedViewR=n.viewR,n.viewSnapT=0};z("main-canvas").addEventListener("pointerup",a);const r=o=>{a()};z("main-canvas").addEventListener("pointerleave",r);const i=o=>{if(n.pointerdown){const l=(o.clientX-n.lastX)/o.target.offsetWidth,c=(o.clientY-n.lastY)/o.target.offsetHeight,d=l*q,u=c*q;switch(n.grabStyle){case"3d":n.viewL.premultiply([0,Math.sin(d*.75),0,Math.cos(d*.75)]),n.viewR.postmultiply([0,-Math.sin(d*.75),0,Math.cos(d*.75)]),n.viewL.premultiply([Math.sin(u*.75),0,0,Math.cos(u*.75)]),n.viewR.postmultiply([-Math.sin(u*.75),0,0,Math.cos(u*.75)]);break;case"4d":n.viewL.premultiply([Math.sin(d*.75),0,0,Math.cos(d*.75)]),n.viewR.postmultiply([Math.sin(d*.75),0,0,Math.cos(d*.75)]),n.viewL.premultiply([0,Math.sin(-u*.75),0,Math.cos(-u*.75)]),n.viewR.postmultiply([0,Math.sin(-u*.75),0,Math.cos(-u*.75)]);break}n.viewL.normalize(),n.viewR.normalize()}n.lastX=o.clientX,n.lastY=o.clientY};z("main-canvas").addEventListener("pointermove",i)}const w=document.querySelector.bind(document),_=document.querySelectorAll.bind(document);Ge();function Ge(){const e=w(".underline");let t="left",a={left:0,right:0},r=w(".link-box"),i=!1;qe(3e3),He(),l();const o=_(".link-box a");e.style.right=a.right-o[o.length-1].getBoundingClientRect().right+"px",ae(w('input[name="grab-type"]:checked').value);for(const f of _(".line-link"))f.addEventListener("click",g=>{g.preventDefault()});w(".grab-style").addEventListener("input",f=>{ae(f.target.value)});for(const f of _(".link-box"))f.addEventListener("pointerenter",g=>{const v=f.querySelector(".line-link");r=f,e.classList.remove("no-delay"),v.getBoundingClientRect().left-a.left<parseFloat(getComputedStyle(e).left)?(e.classList.remove("delay-left"),e.classList.add("delay-right"),t="left"):(e.classList.remove("delay-right"),e.classList.add("delay-left"),t="right"),e.style.left=v.getBoundingClientRect().left-a.left+"px",e.style.right=a.right-v.getBoundingClientRect().right+"px"});w(".link-box-container").addEventListener("pointerleave",()=>{e.classList.remove("delay-left"),e.classList.remove("delay-right"),e.classList.add("no-delay"),t==="left"?e.style.right=a.right-r.querySelector("a").getBoundingClientRect().left+"px":e.style.left=r.querySelector("a").getBoundingClientRect().right-a.left+"px"});function l(){a=w(".link-box-container").getBoundingClientRect()}function c(){const f=_(".link-box a");e.classList.remove("delay-right"),e.classList.remove("delay-left"),e.classList.add("no-delay"),e.style.left="100%",e.style.right=a.right-f[f.length-1].getBoundingClientRect().right+"px"}window.addEventListener("resize",()=>{l(),c()}),document.getElementById("contact-box").addEventListener("click",()=>{const f=w(".contact-email");if(f.childElementCount>0)return;const g=A("<`hc\\TU,gRQa[.E^R","You look down and see a tortoise..."),v=document.createElement("a");v.href=`mailto:${g}`,v.textContent=g,f.append(v);function A(R,S){return[...R].map((C,we)=>String.fromCharCode((C.charCodeAt(0)-32-(S.charCodeAt(we%S.length)-32)+95)%95+32)).join("")}});for(const f of[w(".gear"),..._(".link-box")])f.addEventListener("click",g=>{const v=f.dataset.section,A=w("."+v);if(A.classList.contains("opaque"))return d();window.dispatchEvent(new CustomEvent("pane-open")),A.classList.remove("concealed"),A.classList.add("opaque"),A.scrollTop=0;const R=A.querySelector(".scroll-container");R&&(R.scrollTop=0);for(const S of _(".content"))S.classList.contains(v)||(S.classList.remove("opaque"),S.classList.add("concealed"));v!=="settings"&&u(A),J(0,500)}),f.addEventListener("pointerenter",g=>{w(".underline").classList.add("bright-underline")}),f.addEventListener("pointerleave",g=>{w(".underline").classList.remove("bright-underline")});function d(){window.dispatchEvent(new CustomEvent("pane-close"));for(const f of _(".content"))f.classList.remove("opaque"),f.classList.add("concealed");J(1,1500)}for(const f of _(".close"))f.addEventListener("click",d);document.body.addEventListener("click",f=>{}),window.addEventListener("click",f=>{for(const g of _(".content"))if(g.contains(f.target)||g===f.target)return;f.target.classList.contains("link-box")||f.target.classList.contains("line-link")||w(".gear").contains(f.target)||d()});function u(f){u.duration??(u.duration=1100),u.canvas??(u.canvas=document.querySelector(".glint-canvas")),u.ctx??(u.ctx=u.canvas.getContext("2d"));const g=f.getBoundingClientRect();u.canvas.style.width=g.width+"px",u.canvas.style.height=g.height+"px",u.canvas.style.top=g.top+"px",clearTimeout(u.tid),u.canvas.style.display="block",u.tid=setTimeout(()=>u.canvas.style.display="none",u.duration),delete y.t0,requestAnimationFrame(y)}function y(f){if(!u.ctx.createConicGradient)return;const g=80;y.t0??(y.t0=f);const v=Math.min((f-y.t0)/u.duration,1),A=1-(1-v)**2,R=1-v**3,S=-A*Math.PI*2-Math.PI/2,C=u.ctx.createConicGradient(S,-.4*g,1.5*g);C.addColorStop(0,`hsla(22, 100%, 59%, ${R*.02})`),C.addColorStop(.29,`hsla(22, 100%, 59%, ${R*.125})`),C.addColorStop(.34,`hsla(353, 88%, 63%, ${R*.314})`),C.addColorStop(.45,`hsla(8, 100%, 67%, ${R*.376})`),C.addColorStop(.48,`hsla(26, 100%, 65%, ${R*.439})`),C.addColorStop(.5,`hsla(26, 100%, 70%, ${R*.565})`),C.addColorStop(.72,`hsla(151, 51%, 51%, ${R*.376})`),C.addColorStop(.875,`hsla(198, 57%, 49%, ${R*.251})`),C.addColorStop(1,`hsla(198, 57%, 49%, ${R*.02})`),u.ctx.clearRect(0,0,g,g),u.ctx.fillStyle=C,u.ctx.fillRect(0,0,g,g),v<1&&requestAnimationFrame(y)}w(".fullscreen").addEventListener("click",f=>{i=!i,T(i),L(i)});function T(f){f?document.documentElement.requestFullscreen?document.documentElement.requestFullscreen():document.documentElement.webkitRequestFullscreen&&document.documentElement.webkitRequestFullscreen():document.exitFullscreen?document.exitFullscreen():document.webkitCancelFullScreen&&document.webkitCancelFullScreen()}function L(f){f?(w(".name-container").classList.add("fade-out"),w(".link-box-container").classList.add("fade-out"),w(".gear").classList.add("mostly-hidden"),w(".fullscreen").classList.add("mostly-hidden")):(w(".name-container").classList.remove("fade-out"),w(".link-box-container").classList.remove("fade-out"),w(".gear").classList.remove("mostly-hidden"),w(".fullscreen").classList.remove("mostly-hidden"))}function m(){document.fullscreenElement||document.webkitFullscreenElement?i=!0:i=!1,L(i)}document.addEventListener("fullscreenchange",m),document.addEventListener("webkitfullscreenchange",m)}function He(){if(!Q.length){P("Animation data not yet available.");return}const e=w(".ul-animations");for(const t of Q){const a=document.createElement("li"),r=document.createElement("label"),i=document.createElement("input");i.type="checkbox",i.checked=!0,i.dataset.title=t.title,i.addEventListener("input",Ye),r.append(i),r.append(t.title),a.append(r),e.append(a)}}function Ye(){const e=_('.ul-animations input[type="checkbox"]');let t=0;for(const a of e)a.checked&&t++;t===0&&(this.checked=!0);for(const a of e)Q.find(r=>r.title===a.dataset.title).active=a.checked;Z()}$e();function $e(){for(const e of _(".carousel")){const t=document.createElement("div");t.classList.add("carousel-clipping"),e.append(t),e.dataset.current=0,e.addEventListener("rotate",Ke);const a=e.dataset.src.split(", ");if(t.addEventListener("click",()=>{F.noClick||(location=e.closest("section").querySelector("a").href)}),a.length>1){const r=document.createElement("div");r.classList.add("pip-container"),e.append(r);for(const[i,o]of Object.entries(a)){32*a.length/-2;const l=document.createElement("div");l.classList.add("carousel-pip"),l.addEventListener("click",c=>{e.dispatchEvent(new CustomEvent("rotate",{detail:i})),c.stopPropagation()}),r.append(l)}e.querySelector(".carousel-pip").classList.add("current")}for(const r of e.dataset.src.split(", ")){const i=document.createElement("div");i.classList.add("carousel-slide"),i.classList.add("hide-slide"),i.style.backgroundImage=`url(${r})`,t.append(i)}if(be(e),a.length>1){const r=document.createElement("button"),i=document.createElement("button");r.classList.add("spin-left-button"),i.classList.add("spin-right-button"),r.addEventListener("click",o=>{e.dispatchEvent(new CustomEvent("rotate",{detail:"previous"})),o.stopPropagation()}),i.addEventListener("click",o=>{e.dispatchEvent(new CustomEvent("rotate",{detail:"next"})),o.stopPropagation()}),e.append(r),e.append(i),e.addEventListener("touchstart",F),e.addEventListener("touchmove",Qe),e.addEventListener("touchend",Je)}}}function be(e){const t=e.querySelectorAll(".carousel-slide"),a=e.dataset.current,r=t.length;for(const[i,o]of Object.entries(t)){if(o.classList.remove("skip-slide"),i===a){o.classList.remove("slide-left"),o.classList.remove("slide-right"),o.classList.remove("hide-slide");continue}const l=(a-i+r)%r,c=(i-a+r)%r;l===1||c===1?o.classList.remove("hide-slide"):o.classList.add("hide-slide"),l<c?(o.classList.contains("slide-right")&&(o.classList.remove("slide-right"),o.classList.add("skip-slide")),o.classList.add("slide-left")):(o.classList.contains("slide-left")&&(o.classList.remove("slide-left"),o.classList.add("skip-slide")),o.classList.add("slide-right"))}}function Ke(e){const t=e.detail,a=e.currentTarget.dataset.src.split(", ").length,r=Number(e.currentTarget.dataset.current);let i;switch(t){case"next":i=(a+r+1)%a;break;case"previous":i=(a+r-1)%a;break;default:i=t}e.currentTarget.dataset.current=i,be(e.currentTarget);const o=e.currentTarget.querySelectorAll(".carousel-pip");o[r].classList.remove("current"),o[i].classList.add("current")}function F(e){F.noClick=!1,F.contact={x0:e.changedTouches[0].screenX,y0:e.changedTouches[0].screenY}}function Qe(e){if(!F.contact)return;const t=Math.min(document.body.clientWidth,document.body.clientHeight),a=(e.changedTouches[0].screenX-F.contact.x0)/t,r=(e.changedTouches[0].screenY-F.contact.y0)/t;if(!(Math.abs(r/a)>.577)){if(e.preventDefault(),r>.03||r<-.03){F.noClick=!0,delete F.contact;return}a>.02&&(e.currentTarget.dispatchEvent(new CustomEvent("rotate",{detail:"previous"})),delete F.contact,F.noClick=!0),a<-.02&&(e.currentTarget.dispatchEvent(new CustomEvent("rotate",{detail:"next"})),delete F.contact,F.noClick=!0)}}function Je(){delete F.contact}const oe=new Map([["blossom",[[.1,.06,.3],[.07,.03,.21]]],["first light",[[.42,.15,.09],[.52,.05,.01]]],["aquarius",[[.04,.04,.31],[.04,.04,.51],[.01,.06,.12]]],["wintersun",[[.09,.07,.35],[.1,.04,.08],[.09,.07,.35],[.06,.03,.25],[.16,.05,.01]]],["trance",[[.75,.09,.01],[.35,.07,.04],[.31,.11,.01],[.31,.07,.04]]],["anemochore",[[.22,.09,.06],[.35,.16,.13],[.45,.15,.11]]],["ember iris",[[.07,.06,.36],[.07,.03,.25],[.07,.06,.36],[.07,.03,.25],[.07,.06,.36],[.07,.03,.25],[.35,.07,.08],[.55,.09,0]]],["captured light",[[.19,.08,.1],[.12,.05,.06]]],["chromophore",[[.34,.19,.22],[.24,.09,.22],[.08,.12,.24],[.12,.04,.11],[.04,.06,.12],[.12,.04,.11],[.04,.06,.12]]]]),D={},O={},h={position:-1,xy:-1,uv:-1,kernel:null,readTexture:null,blurStep:null,texSampler:null,blurSampler:null,clearSampler:null,hexAspect:null,compositorAspect:null,boost:null,aberration:null,pulseRadius:null,positionMax:null,transform:null,project:null,rgba:null},N={transform:fe(0),project:[]},s={gl:null,readingMode:!1,pulseTime:-3,zPulse:0,resizeCount:0,blurKernelSize:6,canvasWidth:0,canvasHeight:0,textureWidth:1,textureHeight:1,tLast:0,elapsed:0,aspect:1,sceneScale:1,xMax:0,yMax:0,particleDensity:14,maxParticles:0,hexagonProgram:null,flatProgram:null,blurProgram:null,compositorProgram:null,hexagonVertBuffer:null,flatVertBuffer:null,uvBuffer:null,fboAA:null,rbAA:null,fboList:[],textureList:[],activeColorSet:[[.3,.1,.15],[.1,.25,.3]]},b=[];function Ze(){const e=document.querySelector(".render-canvas");return!e||document.documentElement.clientHeight<1?1:e.clientHeight/document.documentElement.clientHeight}function ne(e){if(oe.has(e.title)){s.activeColorSet=oe.get(e.title);return}const t=[],a=({rgba:i})=>i[0]>=0&&i[1]>=0&&i[2]>=0,r=({rgba:i})=>i[0]!==0||i[1]!==0||i[2]!==0;for(const{rgba:i}of e.lighting.diffuseLights.filter(a).filter(r))t.push([i[0],i[1],i[2]]);for(const{rgba:i}of e.lighting.specularLights.filter(a).filter(r))t.push([i[0],i[1],i[2]]);console.log(e.title,"applying colors:");for(const i of t)console.log(i);t.length&&(s.activeColorSet=t)}function et(){const e=document.querySelector(".bokeh-canvas");if(!e)throw Error("No bokeh canvas found");if(s.gl=e.getContext("webgl2",{alpha:!0,premultipliedAlpha:!0,antialias:!1}),!s.gl&&(s.gl=e.getContext("webgl",{alpha:!0,premultipliedAlpha:!0,antialias:!1}),!s.gl))throw Error("Unable to create bokeh rendering context");const t=s.gl;window.addEventListener("resize",le),n.currentAnimation&&ne(n.currentAnimation),window.addEventListener("tesseract-change",d=>{ne(d.detail),se()}),window.addEventListener("pane-close",()=>{s.readingMode=!1}),window.addEventListener("pane-open",()=>{s.readingMode=!0}),t instanceof WebGL2RenderingContext&&(s.fboAA=t.createFramebuffer(),s.rbAA=t.createRenderbuffer());const a=k(t,t.VERTEX_SHADER,D.flatLensVert),r=k(t,t.FRAGMENT_SHADER,D.premultiplyAlpha);s.hexagonProgram=W(t,a,r);const i=k(t,t.VERTEX_SHADER,D.texVert),o=k(t,t.FRAGMENT_SHADER,D.texFrag);s.flatProgram=W(t,i,o);const l=k(t,t.FRAGMENT_SHADER,D.blur1d);s.blurProgram=W(t,i,l);const c=k(t,t.FRAGMENT_SHADER,D.compositor);s.compositorProgram=W(t,i,c),h.position=t.getAttribLocation(s.hexagonProgram,"position"),h.hexAspect=t.getUniformLocation(s.hexagonProgram,"aspect"),h.boost=t.getUniformLocation(s.hexagonProgram,"boost"),h.positionMax=t.getUniformLocation(s.hexagonProgram,"positionMax"),h.transform=t.getUniformLocation(s.hexagonProgram,"transform"),h.project=t.getUniformLocation(s.hexagonProgram,"project"),h.rgba=t.getUniformLocation(s.hexagonProgram,"rgba"),s.hexagonVertBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.hexagonVertBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array(O.hexagon),t.STATIC_DRAW),t.enable(t.BLEND),t.blendFunc(t.SRC_ALPHA,t.ONE),t.clearColor(0,0,0,0),t.useProgram(s.blurProgram),h.blurStep=t.getUniformLocation(s.blurProgram,"blurStep"),h.kernel=t.getUniformLocation(s.blurProgram,"kernel"),t.uniform1fv(h.kernel,me(.1,s.blurKernelSize)),h.blurSampler=t.getUniformLocation(s.compositorProgram,"blurSampler"),h.clearSampler=t.getUniformLocation(s.compositorProgram,"clearSampler"),h.compositorAspect=t.getUniformLocation(s.compositorProgram,"compositorAspect"),h.aberration=t.getUniformLocation(s.compositorProgram,"aberration"),h.pulseRadius=t.getUniformLocation(s.compositorProgram,"pulseRadius"),h.xy=t.getAttribLocation(s.flatProgram,"xy"),h.uv=t.getAttribLocation(s.flatProgram,"uvA"),h.texSampler=t.getUniformLocation(s.flatProgram,"texSampler"),s.flatVertBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.flatVertBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array(O.square),t.STATIC_DRAW),s.uvBuffer=t.createBuffer(),t.bindBuffer(t.ARRAY_BUFFER,s.uvBuffer),t.bufferData(t.ARRAY_BUFFER,new Float32Array([0,1,1,1,1,0,0,0]),t.STATIC_DRAW),s.fboList=[t.createFramebuffer(),t.createFramebuffer(),t.createFramebuffer()];for(const d of s.fboList)t.bindFramebuffer(t.FRAMEBUFFER,d),s.textureList.push(t.createTexture()),t.bindTexture(t.TEXTURE_2D,s.textureList.at(-1)),t.texImage2D(t.TEXTURE_2D,0,t.RGBA,1,1,0,t.RGBA,t.UNSIGNED_BYTE,null),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_S,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_WRAP_T,t.CLAMP_TO_EDGE),t.texParameteri(t.TEXTURE_2D,t.TEXTURE_MIN_FILTER,t.LINEAR),t.framebufferTexture2D(t.FRAMEBUFFER,t.COLOR_ATTACHMENT0,t.TEXTURE_2D,s.textureList.at(-1),0);le(),rt(),se(),requestAnimationFrame(Ee)}function se(){setTimeout(()=>{s.readingMode||(s.pulseTime=0)},19500)}function le(){const e=s.gl,t=document.querySelector(".bokeh-canvas");if(!t||!e)return;s.resizeCount++,s.canvasHeight=Math.max(1,Math.round(Math.min(600,t.clientHeight))),s.canvasWidth=Math.max(1,Math.round(s.canvasHeight*t.clientWidth/t.clientHeight)),s.textureWidth=Math.max(1,Math.min(1024,Math.floor(s.canvasWidth/2))),s.textureHeight=Math.max(1,Math.min(1024,Math.floor(s.canvasHeight/2))),t.height=s.canvasHeight,t.width=s.canvasWidth,s.aspect=s.canvasWidth/s.canvasHeight,s.sceneScale=Ze();const a=s.sceneScale*2;if(s.xMax=.5*a*s.aspect/s.sceneScale,s.yMax=.5*a/s.sceneScale,e.useProgram(s.hexagonProgram),e.uniform2fv(h.positionMax,[s.xMax,s.yMax]),e.useProgram(s.compositorProgram),e.uniform1f(h.compositorAspect,s.aspect),s.fboAA&&e instanceof WebGL2RenderingContext){const o=Math.min(16,e.getParameter(e.MAX_SAMPLES)),l=e.getParameter(e.RENDERBUFFER_BINDING);e.bindRenderbuffer(e.RENDERBUFFER,s.rbAA),e.renderbufferStorageMultisample(e.RENDERBUFFER,o,e.RGBA8,s.textureWidth,s.textureHeight),e.bindFramebuffer(e.FRAMEBUFFER,s.fboAA),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,s.rbAA),e.bindRenderbuffer(e.RENDERBUFFER,l)}const r=document.querySelector(".bokeh-canvas"),i=document.querySelector(".render-canvas");if(!r||!i)throw Error("DOM missing canvas nodes");s.maxParticles=Math.min(300,Math.round(s.particleDensity*(r.clientWidth*r.clientHeight)/(i.clientWidth*i.clientHeight)));for(const o of s.textureList)e.bindTexture(e.TEXTURE_2D,o),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,s.textureWidth,s.textureHeight,0,e.RGBA,e.UNSIGNED_BYTE,null);ye()}function tt(e){b[e]=b.at(-1),b.pop()}function xe(){const e=s.yMax*(2*(Math.random()-.5)),t=2*(Math.random()-.5),a=Math.floor(Math.random()*s.activeColorSet.length);b.push({position:[s.xMax*2*(Math.random()-.5),e,t],lifetime:5+Math.random()*5,spawnDelay:0,age:0,color:[...s.activeColorSet[a],1],colorIndex:a,scale:.85+.1*(1-(e+s.yMax)/s.yMax)+.2/(t+2.01)})}function rt(){for(;b.length<s.maxParticles/2;){const e=6*b.length/s.maxParticles;xe(),b[b.length-1].lifetime=2+Math.random()*4,b[b.length-1].spawnDelay=e}}function it(e){const t=-Math.log(.5)/1.125;for(;b.length<s.maxParticles;)xe(),b[b.length-1].spawnDelay=Math.random()*2;for(let r=0;r<b.length;r++){if(b[r].spawnDelay>0){b[r].spawnDelay-=e,b[r].color[3]=0;continue}if(b[r].age+=e,b[r].age>b[r].lifetime){tt(r),r--;continue}const i=s.activeColorSet[b[r].colorIndex%s.activeColorSet.length];b[r].color[0]=a(b[r].color[0],i[0],e),b[r].color[1]=a(b[r].color[1],i[1],e),b[r].color[2]=a(b[r].color[2],i[2],e),b[r].color[3]=Math.sin(Math.PI*b[r].age/b[r].lifetime)**4}function a(r,i,o){return i-(i-r)*Math.exp(-t*o)}}function Ee(e){s.tLast??(s.tLast=e),e-s.tLast>100&&(s.tLast=e);const t=(s.readingMode?.3:1)*(e-s.tLast)/1e3;s.tLast=e,s.elapsed+=t,s.elapsed%=86400,s.pulseTime+=t,s.zPulse=.6*s.pulseTime-2,it(t),ye(),requestAnimationFrame(Ee)}function X(e,t,a,r,i=!0){const o=s.gl;o.bindFramebuffer(o.FRAMEBUFFER,r),i&&o.clear(o.COLOR_BUFFER_BIT),o.viewport(0,0,s.textureWidth,s.textureHeight),o.useProgram(s.blurProgram),o.enableVertexAttribArray(h.xy),o.enableVertexAttribArray(h.uv),o.bindBuffer(o.ARRAY_BUFFER,s.flatVertBuffer),o.vertexAttribPointer(h.xy,2,o.FLOAT,!1,0,0),o.bindBuffer(o.ARRAY_BUFFER,s.uvBuffer),o.vertexAttribPointer(h.uv,2,o.FLOAT,!1,0,0),o.activeTexture(o.TEXTURE0),o.bindTexture(o.TEXTURE_2D,a),o.uniform1i(h.readTexture,0),o.uniform2f(h.blurStep,e,t),o.drawArrays(o.TRIANGLE_FAN,0,O.square.length/2),o.disableVertexAttribArray(h.xy),o.disableVertexAttribArray(h.uv)}function at(){const e=s.gl;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,s.canvasWidth,s.canvasHeight),e.useProgram(s.compositorProgram),e.enableVertexAttribArray(h.xy),e.enableVertexAttribArray(h.uv),e.bindBuffer(e.ARRAY_BUFFER,s.flatVertBuffer),e.vertexAttribPointer(h.xy,2,e.FLOAT,!1,0,0),e.bindBuffer(e.ARRAY_BUFFER,s.uvBuffer),e.vertexAttribPointer(h.uv,2,e.FLOAT,!1,0,0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,s.textureList[0]),e.uniform1i(h.clearSampler,0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,s.textureList[2]),e.uniform1i(h.blurSampler,1),e.uniform1f(h.aberration,.005+.005*Te(Math.max(0,1-s.zPulse**2))),e.uniform1f(h.pulseRadius,Math.max(s.xMax,s.yMax)*(s.zPulse+1)),e.drawArrays(e.TRIANGLE_FAN,0,O.square.length/2),e.disableVertexAttribArray(h.xy),e.disableVertexAttribArray(h.uv)}function ot(){const e=s.gl;e.viewport(0,0,s.textureWidth,s.textureHeight),e.clear(e.COLOR_BUFFER_BIT),e.blendFunc(e.ONE,e.ONE),e.useProgram(s.hexagonProgram),e.enableVertexAttribArray(h.position),e.bindBuffer(e.ARRAY_BUFFER,s.hexagonVertBuffer),e.vertexAttribPointer(h.position,3,e.FLOAT,!1,0,0),H(N.project),N.project[0]=1/s.aspect,e.uniformMatrix4fv(h.project,!1,N.project);const t=Math.max(s.xMax,s.yMax)*(s.zPulse+1);for(const a of b){if(a.spawnDelay>0)continue;H(N.transform),G(N.transform,fe(Math.PI/10),ce(a.scale*s.sceneScale/4)),G(N.transform,ue(a.position[0],a.position[1],a.position[2]),N.transform),e.uniform4fv(h.rgba,a.color),e.uniformMatrix4fv(h.transform,!1,N.transform);const r=Math.sqrt(a.position[0]**2+a.position[1]**2),i=Math.min(1,Math.max(0,Te(1-Math.abs(r-t))));e.uniform1f(h.boost,1+1.75*i),e.drawArrays(e.TRIANGLE_FAN,0,O.hexagon.length/3)}e.disableVertexAttribArray(h.position)}function ye(){const e=s.gl;e&&(e.bindFramebuffer(e.FRAMEBUFFER,null),e.clear(e.COLOR_BUFFER_BIT),e instanceof WebGL2RenderingContext?e.bindFramebuffer(e.FRAMEBUFFER,s.fboAA):e.bindFramebuffer(e.FRAMEBUFFER,s.fboList[0]),ot(),nt(),X(1/s.textureWidth,0,s.textureList[0],s.fboList[1],!0),X(0,1/s.textureHeight,s.textureList[1],s.fboList[2],!0),X(1/s.textureWidth,0,s.textureList[2],s.fboList[1],!1),X(0,1/s.textureHeight,s.textureList[1],s.fboList[2],!1),at())}function nt(){if(!(s.gl instanceof WebGL2RenderingContext)||!s.fboAA)return;const e=s.gl;e.bindFramebuffer(e.READ_FRAMEBUFFER,s.fboAA),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,s.fboList[0]),e.blitFramebuffer(0,0,s.textureWidth,s.textureHeight,0,0,s.textureWidth,s.textureHeight,e.COLOR_BUFFER_BIT,e.NEAREST)}function W(e,t,a){const r=e.createProgram();if(e.attachShader(r,t),e.attachShader(r,a),e.linkProgram(r),e.getProgramParameter(r,e.LINK_STATUS))return r;const i=e.getProgramInfoLog(r);throw e.deleteProgram(r),Error(i||"Program link failed; no log available")}function k(e,t,a){const r=e.createShader(t);if(!r)throw Error("Unable to create shader");if(e.shaderSource(r,a),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS))return r;throw console.error(e.getShaderInfoLog(r)),e.deleteShader(r),Error("Shader compilation failed")}function Te(e){return e<.5?4*e**3:1-(-2*e+2)**3/2}O.hexagon=[-1,0,0,-1/2,Math.sqrt(3)/2,0,1/2,Math.sqrt(3)/2,0,1,0,0,1/2,-Math.sqrt(3)/2,0,-1/2,-Math.sqrt(3)/2,0];O.square=[-1,1,1,1,1,-1,-1,-1];D.flatLensVert=`
uniform float aspect;
uniform vec2 positionMax;
uniform mat4 transform;
uniform mat4 project;
attribute vec4 position;

varying vec4 projected;

void main() {
  vec4 transformed = transform * position;

  float r = length(vec2(transformed)) / length(positionMax);
  transformed.x /= 0.9 + r * 0.1125;
  transformed.y /= 0.9 + r * 0.1125;

  projected = project * transformed;

  gl_Position = projected;
}
`;D.premultiplyAlpha=`
precision mediump float;
uniform float boost;
uniform vec4 rgba;

varying vec4 projected;

void main() {
  vec4 multiplied = rgba * rgba.a * boost;
  multiplied.a = rgba.a;

  gl_FragColor = multiplied;
}
`;D.texVert=`
attribute vec2 xy;
attribute vec2 uvA;
varying mediump vec2 uv;

void main() {
  gl_Position = vec4(xy, 0, 1);
  uv = uvA;
}
`;D.texFrag=`
precision mediump float;
uniform sampler2D texSampler;
varying mediump vec2 uv;

void main() {
  gl_FragColor = texture2D(texSampler, uv);
}
`;D.compositor=`
precision mediump float;
uniform sampler2D blurSampler;
uniform sampler2D clearSampler;
uniform float compositorAspect;
uniform float aberration;
uniform float pulseRadius;
varying mediump vec2 uv;

float ease(float x) {
  float lo = 0.5 * pow(2., 20. * x - 10.);
  float hi = 1.0 - 0.5 * pow(2., -20. * x + 10.);
  float s = step(0.5, x);
  return max(0., min(1., (1. - s) * lo + s * hi));
}

void main() {
  vec2 deltaCenter = vec2(uv.x, uv.y) - vec2(0.5, 0.55);
  deltaCenter.x *= compositorAspect;

  float boundedDistance = min(pow(length(deltaCenter) + 0.001, 0.25), 1.0);
  vec2 radialOffset = normalize(deltaCenter) * boundedDistance * aberration;
  float uvRadius = length(deltaCenter);
  float radialDifference = uvRadius - pulseRadius;
  float leadingEase = step(0., radialDifference)
                        * ease(abs(uvRadius-pulseRadius));
  float trailingEase = (1. - step(0., radialDifference))
                        * min(1., 1. - exp(uvRadius - pulseRadius));
  float pulseDelta = leadingEase + trailingEase;
  float r = min(1.0, 2.0 * length(deltaCenter) / 2.5);
  float t = pow(1.0  - pow(1.0 - r, 0.55), 1.4);

  vec4 near = texture2D(clearSampler, uv + radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv + radialOffset) * t;
  vec4 seminear = texture2D(clearSampler, uv + 0.5 * radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv + 0.5 * radialOffset) * t;
  vec4 middle = texture2D(clearSampler, uv) * (1.0 - t)
    + texture2D(blurSampler, uv) * t;
  vec4 semifar = texture2D(clearSampler, uv - 0.5 * radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv - 0.5 * radialOffset) * t;
  vec4 far = texture2D(clearSampler, uv - radialOffset) * (1.0 - t)
    + texture2D(blurSampler, uv - radialOffset) * t;

  float v = cos(2.7 * abs(uv.y - 0.475));

  far *=      vec4(0.,   0.,   0.6,   0.2);
  semifar *=  vec4(0.,   0.3,  0.3,   0.2);
  middle *=   vec4(0.1,  0.4,  0.1,   0.2);
  seminear *= vec4(0.3,  0.3,  0.,    0.2);
  near *=     vec4(0.6,  0.,   0.,    0.2);
  
  float smoothR = smoothstep(0., 1., 7.0 * smoothstep(0., 1., pow(0.45 * r, 1.1)))
    * smoothstep(0., 1., 1. - r);
  float centralR = pow(0.85*r, 1.9);
  float outerR = smoothstep(0., 1., 1. - r);

  vec4 aberrantColor = far + semifar + middle + seminear + near;

  float curtainFactor = smoothstep(0.0, 0.2, (1. - 2. * abs(uv.x - 0.5)));

  
  float overallFade = (1. - v * curtainFactor) * (pulseDelta);

  gl_FragColor = aberrantColor * (1. - overallFade) * centralR;
}
`;D.blur1d=`
precision mediump float;
varying vec2 uv;

uniform sampler2D readTexture;
#define kernelSize ${s.blurKernelSize}
uniform float kernel[kernelSize];
uniform vec2 blurStep;

void main (void) {
  vec2 dv = blurStep;

  // double-weight on 0 element:
  vec4 color = texture2D(readTexture, uv) * kernel[0];
  for (int i = 1; i < kernelSize; i++) {
    color += texture2D(readTexture, uv - float(i)*dv) * kernel[i]
            + texture2D(readTexture, uv + float(i)*dv) * kernel[i];
  }

  gl_FragColor = color;
}
`;et();
