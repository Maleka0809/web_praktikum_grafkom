const canvas = document.getElementById("canvas");
    const gl = canvas.getContext("webgl2");

    // ==========================================
    // 1. SHADERS (Matrix & Uniform Color)
    // ==========================================
    const vsSource = `
      attribute vec2 aPosition;
      uniform mat3 uModelMatrix;
      
      void main() {
        vec3 worldPos = uModelMatrix * vec3(aPosition, 1.0);
        gl_Position = vec4(worldPos.xy, 0.0, 1.0);
      }
    `;

    const fsSource = `
      precision mediump float;
      uniform vec4 uColor; // Warna dikirim via uniform agar lebih praktis
      
      void main() {
        gl_FragColor = uColor;
      }
    `;

    function createShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, createShader(gl, gl.VERTEX_SHADER, vsSource));
    gl.attachShader(shaderProgram, createShader(gl, gl.FRAGMENT_SHADER, fsSource));
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    // Ambil Lokasi Variabel
    const aPosition = gl.getAttribLocation(shaderProgram, "aPosition");
    const uModelMatrix = gl.getUniformLocation(shaderProgram, "uModelMatrix");
    const uColor = gl.getUniformLocation(shaderProgram, "uColor");
    gl.enableVertexAttribArray(aPosition);

    // ==========================================
    // 2. DATA BUFFER (Garis & Kotak)
    // ==========================================
    
    // Data Garis Sumbu (X dan Y)
    const verticesGaris = new Float32Array([
      -1.0,  0.0,   1.0,  0.0,  // X horizontal
       0.0, -1.0,   0.0,  1.0   // Y vertikal
    ]);
    const bufferGaris = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferGaris);
    gl.bufferData(gl.ARRAY_BUFFER, verticesGaris, gl.STATIC_DRAW);

    // Data Kotak (Local Space)
    const verticesKotak = new Float32Array([
      -0.2,  0.2,   0.2,  0.2,
      -0.2, -0.2,   0.2, -0.2
    ]);
    const bufferKotak = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufferKotak);
    gl.bufferData(gl.ARRAY_BUFFER, verticesKotak, gl.STATIC_DRAW);

    // ==========================================
    // 3. STATE & CONTROLS
    // ==========================================
    let posX = 0.0, posY = 0.0;
    let angle = 0.0;
    let scaleX = 1.0, scaleY = 1.0;
    
    const keys = {};
    window.addEventListener("keydown", (e) => keys[e.key] = true);
    window.addEventListener("keyup", (e) => keys[e.key] = false);

    // ==========================================
    // 4. MATRIX MATH HELPERS
    // ==========================================
    function createIdentity3x3() {
      return [1, 0, 0,  
              0, 1, 0,  
              0, 0, 1];
    }

    function multiply3x3(a, b) {
      let out = new Array(9);
      let a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8];
      let b00 = b[0], b01 = b[1], b02 = b[2], b10 = b[3], b11 = b[4], b12 = b[5], b20 = b[6], b21 = b[7], b22 = b[8];

      out[0] = b00*a00 + b01*a10 + b02*a20; out[1] = b00*a01 + b01*a11 + b02*a21; out[2] = b00*a02 + b01*a12 + b02*a22;
      out[3] = b10*a00 + b11*a10 + b12*a20; out[4] = b10*a01 + b11*a11 + b12*a21; out[5] = b10*a02 + b11*a12 + b12*a22;
      out[6] = b20*a00 + b21*a10 + b22*a20; out[7] = b20*a01 + b21*a11 + b22*a21; out[8] = b20*a02 + b21*a12 + b22*a22;
      return out;
    }

    // ==========================================
    // 5. RENDER LOOP
    // ==========================================
    let lastTime = performance.now();

    function render(time) {
      let deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      // Logika Pergerakan
      const speed = 1.0; 
      if (keys["ArrowUp"]) posY += speed * deltaTime;
      if (keys["ArrowDown"]) posY -= speed * deltaTime;
      if (keys["ArrowLeft"]) posX -= speed * deltaTime;
      if (keys["ArrowRight"]) posX += speed * deltaTime;
      if (keys["q"]) angle -= 2.0 * deltaTime;
      if (keys["e"]) angle += 2.0 * deltaTime;
      
      // Hitung Matriks Kotak (TRS)
      let translationMat = [1, 0, 0, 0, 1, 0, posX, posY, 1];
      let c = Math.cos(angle), s = Math.sin(angle);
      let rotationMat = [c, s, 0, -s, c, 0, 0, 0, 1];
      let scalingMat = [scaleX, 0, 0, 0, scaleY, 0, 0, 0, 1];

      let modelMat = multiply3x3(rotationMat, scalingMat);
      modelMat = multiply3x3(translationMat, modelMat);

      // --- MULAI MENGGAMBAR ---
      gl.clearColor(0.1, 0.1, 0.1, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // 1. GAMBAR GARIS SUMBU (Diam di tengah)
      gl.bindBuffer(gl.ARRAY_BUFFER, bufferGaris);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
      
      gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(createIdentity3x3())); // Matriks Netral
      gl.uniform4f(uColor, 1.0, 1.0, 1.0, 0.3); // Warna Putih Transparan
      gl.drawArrays(gl.LINES, 0, 4);

      // 2. GAMBAR KOTAK (Bergerak)
      gl.bindBuffer(gl.ARRAY_BUFFER, bufferKotak);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
      
      gl.uniformMatrix3fv(uModelMatrix, false, new Float32Array(modelMat)); // Matriks Pergerakan
      gl.uniform4f(uColor, 0.2, 0.6, 1.0, 1.0); // Warna Biru
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);