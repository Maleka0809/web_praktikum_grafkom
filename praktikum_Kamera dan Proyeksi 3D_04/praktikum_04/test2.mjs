import { JSDOM } from 'jsdom';
import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously' });
const window = dom.window;
const document = window.document;

const canvas = document.querySelector('#webglCanvas');
canvas.getContext = (type) => {
  if (type === 'webgl2') {
    return {
      createShader: ()=>1, shaderSource: ()=>{}, compileShader: ()=>{}, getShaderParameter: ()=>true, getShaderInfoLog: ()=>'',
      createProgram: ()=>2, attachShader: ()=>{}, linkProgram: ()=>{}, getProgramParameter: ()=>true, getProgramInfoLog: ()=>'',
      getAttribLocation: ()=>0, getUniformLocation: ()=>0,
      createBuffer: ()=>3, bindBuffer: ()=>{}, bufferData: ()=>{},
      enableVertexAttribArray: ()=>{}, vertexAttribPointer: ()=>{},
      uniformMatrix4fv: ()=>{}, drawArrays: ()=>{},
      viewport: ()=>{}, enable: ()=>{}, scissor: ()=>{}, clearColor: ()=>{}, clear: ()=>{},
      useProgram: ()=>{}, disable: ()=>{}, depthFunc: ()=>{},
      ARRAY_BUFFER: 0x8892, STATIC_DRAW: 0x88E4, FLOAT: 0x1406, TRIANGLES: 0x0004,
      COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x0100, SCISSOR_TEST: 0x0C11, DEPTH_TEST: 0x0B71, LESS: 0x0201,
      VERTEX_SHADER: 0x8B31, FRAGMENT_SHADER: 0x8B30, COMPILE_STATUS: 0x8B81, LINK_STATUS: 0x8B82
    };
  }
  return null;
};

window.requestAnimationFrame = (cb) => {
  if (!window.didRaf) {
    window.didRaf = true;
    cb(16.6); // Call it once
  }
};

let mainCode = fs.readFileSync('main.js', 'utf8');
try {
  window.eval(mainCode);
  console.log('No synchronous errors! DOM Status Badge:', document.querySelector('#statusBadge').textContent);
} catch(e) {
  console.error('ERROR CAUGHT:', e);
}
