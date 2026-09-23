const fs = require('fs');
let code = fs.readFileSync('main.js', 'utf8');
code = 
  const document = { querySelector: () => ({ addEventListener: ()=>{}, textContent: '', value: '' }) };
  const window = { addEventListener: ()=>{} };
  const canvas = { getContext: () => ({
    createShader: ()=>{}, shaderSource: ()=>{}, compileShader: ()=>{}, getShaderParameter: ()=>true,
    createProgram: ()=>{}, attachShader: ()=>{}, linkProgram: ()=>{}, getProgramParameter: ()=>true,
    getAttribLocation: ()=>0, getUniformLocation: ()=>0,
    createBuffer: ()=>{}, bindBuffer: ()=>{}, bufferData: ()=>{},
    enableVertexAttribArray: ()=>{}, vertexAttribPointer: ()=>{},
    uniformMatrix4fv: ()=>{}, drawArrays: ()=>{},
    viewport: ()=>{}, enable: ()=>{}, scissor: ()=>{}, clearColor: ()=>{}, clear: ()=>{},
    useProgram: ()=>{}, disable: ()=>{}, depthFunc: ()=>{}
  }), width: 800, height: 500 };
  const requestAnimationFrame = ()=>{};
  const gl = canvas.getContext('webgl2');
 + code.replace('const canvas = document.querySelector(\"#webglCanvas\");', '').replace('const gl = canvas.getContext(\"webgl2\");', '');

try {
  eval(code);
  console.log('No synchronous errors');
} catch (e) {
  console.error(e);
}
