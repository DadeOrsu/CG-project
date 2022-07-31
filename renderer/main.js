const depthTextureSize = 2048;

ChaseCamera = function () {
  this.car_frame = glMatrix.mat4.create();

  this.update = (car_frame) =>
    glMatrix.mat4.invert(this.car_frame, car_frame);

  this.matrix = () => {
    let m = glMatrix.mat4.create();
    glMatrix.mat4.lookAt(m, [0, 3, 10], [0, 4, -7], [0, 1, 0]);
    return glMatrix.mat4.multiply(m, m, this.car_frame);
  }
}



FreeCamera = function () {
  let frame = glMatrix.mat4.create();
  let xangle = 0, yangle = 0;
  let eye = glMatrix.vec3.fromValues(0, 1, 0);
  let zero = glMatrix.vec3.create();
  let up = glMatrix.vec3.fromValues(0, 1, 0);

  this.update = (_) => {
    let dir = glMatrix.vec3.fromValues(0, 0, -.1);
    glMatrix.vec3.rotateY(dir, dir, zero, xangle);

    if (Renderer.car.control_keys["w"])
      glMatrix.vec3.add(eye, eye, dir);
    if (Renderer.car.control_keys["s"])
      glMatrix.vec3.scaleAndAdd(eye, eye, dir, -1);

    glMatrix.vec3.cross(dir, dir, up);

    if (Renderer.car.control_keys["d"])
      glMatrix.vec3.add(eye, eye, dir);
    if (Renderer.car.control_keys["a"])
      glMatrix.vec3.scaleAndAdd(eye, eye, dir, -1);

    if (Renderer.car.control_keys[" "])
      glMatrix.vec3.scaleAndAdd(eye, eye, up, .1);
    if (Renderer.car.control_keys["Shift"])
      glMatrix.vec3.scaleAndAdd(eye, eye, up, -.1);
  }

  this.update_angle = (dx, dy) => {
    xangle -= dx / 500;
    yangle = Math.min(Math.max(yangle - dy / 500, -1.4), 1.4);
  }

  this.matrix = () => {
    let m = glMatrix.mat4.create();
    let center = glMatrix.vec3.fromValues(0, 0, -1);

    glMatrix.vec3.rotateX(center, center, zero, yangle);
    glMatrix.vec3.rotateY(center, center, zero, xangle);
    glMatrix.vec3.add(center, eye, center);

    return glMatrix.mat4.lookAt(m, eye, center, up);
  }
}

/*
the FollowFromUpCamera always look at the car from a position abova right over the car
*/
FollowFromUpCamera = function () {

  /* the only data it needs is the position of the camera */
  this.pos = [0, 0, 0];

  /* update the camera with the current car position */
  this.update = function (car_frame) {
    this.pos = car_frame.slice(12, 15);
  }

  /* return the transformation matrix to transform from worlod coordiantes to the view reference frame */
  this.matrix = function () {
    return glMatrix.mat4.lookAt(glMatrix.mat4.create(), [this.pos[0], 50, this.pos[2]], this.pos, [0, 0, -1]);
  }
}

/* the main object to be implementd */
var Renderer = new Object();

/* array of cameras that will be used */
Renderer.cameras = [];
Renderer.cameras.push(new FollowFromUpCamera());
Renderer.cameras.push(new ChaseCamera());
Renderer.cameras.push(new FreeCamera());
// set the camera currently in use
Renderer.currentCamera = 2;

/*
create the buffers for an object as specified in common/shapes/triangle.js
*/
Renderer.createObjectBuffers = function (gl, obj) {

  obj.vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, obj.vertices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  obj.indexBufferTriangles = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferTriangles);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, obj.triangleIndices, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  obj.normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, obj.normals, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // create edges
  var edges = new Uint16Array(obj.numTriangles * 3 * 2);
  for (var i = 0; i < obj.numTriangles; ++i) {
    edges[i * 6 + 0] = obj.triangleIndices[i * 3 + 0];
    edges[i * 6 + 1] = obj.triangleIndices[i * 3 + 1];
    edges[i * 6 + 2] = obj.triangleIndices[i * 3 + 0];
    edges[i * 6 + 3] = obj.triangleIndices[i * 3 + 2];
    edges[i * 6 + 4] = obj.triangleIndices[i * 3 + 1];
    edges[i * 6 + 5] = obj.triangleIndices[i * 3 + 2];
  }

  obj.indexBufferEdges = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferEdges);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edges, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);


  if (obj.texCoords) {
    obj.texCoordsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.texCoordsBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, obj.texCoords, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
};

/*
draw an object as specified in common/shapes/triangle.js for which the buffer 
have alrady been created
*/
Renderer.drawObject = function (gl, shader, obj, fillColor, isSpec, tex, isFlat, useNormalMap) {
  gl.bindBuffer(gl.ARRAY_BUFFER, obj.vertexBuffer);
  gl.enableVertexAttribArray(shader.aPositionIndex);
  gl.vertexAttribPointer(shader.aPositionIndex, 3, gl.FLOAT, false, 0, 0);

  if (!shader.is_shadow) {
    gl.uniform1i(shader.uIsSpecLocation, isSpec);
    gl.uniform1i(shader.uIsFlatLocation, isFlat);
    gl.uniform1i(shader.uUseNormalMapLocation, useNormalMap);

    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normalBuffer);
    gl.enableVertexAttribArray(shader.aNormalIndex);
    gl.vertexAttribPointer(shader.aNormalIndex, 3, gl.FLOAT, false, 0, 0);

    if (tex != undefined) {
      gl.uniform1i(shader.uTexModeLocation, 1);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      gl.bindBuffer(gl.ARRAY_BUFFER, obj.texCoordsBuffer);
      gl.enableVertexAttribArray(shader.aTexCoordsIndex);
      gl.vertexAttribPointer(shader.aTexCoordsIndex, 2, gl.FLOAT, false, 0, 0);

    } else {
      gl.uniform1i(shader.uTexModeLocation, 0);
      gl.disableVertexAttribArray(shader.aTexCoordsIndex);
    }

    gl.uniform4fv(shader.uColorLocation, fillColor);
  }

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, obj.indexBufferTriangles || obj.indexBuffer);
  gl.drawElements(gl.TRIANGLES, obj.triangleIndices.length, gl.UNSIGNED_SHORT, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  gl.disableVertexAttribArray(shader.aPositionIndex);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
};




/*
initialize the object in the scene
*/
Renderer.initializeObjects = function (gl) {
  Game.setScene(scene_0);
  this.car = Game.addCar("mycar");

  this.cube = new Cube();
  this.cylinder = new Cylinder(10);

  /* move wheel down so that it rotates around the x axis */
  let pos = wheel.vertices[0].values;
  let max = -Infinity;
  let min = +Infinity;

  for (let i = 1; i < pos.length; i += 3) {
    max = Math.max(max, pos[i]);
    min = Math.min(min, pos[i]);
  }

  let off = (max - min) / 2;
  for (let i = 1; i < pos.length; i += 3)
    pos[i] -= off;
  
  
  this.wheel = loadOnGPU(gl, wheel);
  this.teapot = loadOnGPU(gl, teapot);
  this.headlight = loadOnGPU(gl, headlight);

  ComputeNormals(this.cube);
  ComputeNormals(this.cylinder);

  Renderer.createObjectBuffers(gl, this.cube);
  Renderer.createObjectBuffers(gl, this.cylinder);

  ComputeNormals(Game.scene.trackObj);
  Renderer.createObjectBuffers(gl, Game.scene.trackObj);

  ComputeNormals(Game.scene.groundObj);
  Renderer.createObjectBuffers(gl, Game.scene.groundObj);

  for (var i = 0; i < Game.scene.buildings.length; ++i) {
    ComputeNormals(Game.scene.buildingsObjTex[i]);
    ComputeNormals(Game.scene.buildingsObjTex[i].roof);
    Renderer.createObjectBuffers(gl, Game.scene.buildingsObjTex[i]);
    Renderer.createObjectBuffers(gl, Game.scene.buildingsObjTex[i].roof);
  }
};

Renderer.bindModelViewMatrix = function (gl, shader, stack) {
  gl.uniformMatrix4fv(shader.uModelMatrixLocation, false, stack.matrix);
  if (shader.is_shadow)
    return;
  let m = glMatrix.mat4.create();
  glMatrix.mat4.multiply(m, this.view, stack.matrix);
  gl.uniformMatrix4fv(shader.uViewMatrixLocation, false, this.view);
  glMatrix.mat4.invert(m, m);
  glMatrix.mat4.transpose(m, m);
  gl.uniformMatrix4fv(shader.uNormalMatrixLocation, false, m);
}


/*
draw the car
*/
Renderer.drawCar = function (gl, shader, stack) {
  let bind = () => this.bindModelViewMatrix(gl, shader, stack);
  let draw = (obj, color) => this.drawObject(gl, shader, obj, [...color, 1], true);

  let m = glMatrix.mat4.create();
  let q = glMatrix.quat.create();

  stack.push();

  stack.multiply(glMatrix.mat4.fromTranslation(m, [0, .5, 0]))
  bind()
  draw(this.teapot, [0, 0.8, 0.2]);

  stack.push();

  let wm = glMatrix.mat4.create();
  let wp = [1, 0, 0.8];
  let ws = [1, 1, 1];
  let wa = 100 * this.car.wheelsAngle;

  this.car.wrot = (this.car.wrot || 0) - 20 * this.car.speed / ws[0];

  stack.multiply(glMatrix.mat4.fromRotationTranslationScale(wm,
    glMatrix.quat.fromEuler(q, this.car.wrot, 0, 0), wp, ws));

  bind();
  draw(this.wheel, [0, 0, 0]);

  stack.pop();
  stack.push();

  stack.multiply(glMatrix.mat4.fromScaling(m, [-1, 1, 1]));
  stack.multiply(wm);

  bind();
  draw(this.wheel, [0, 0, 0]);

  stack.pop();
  stack.push();

  wp[2] = -wp[2];
  stack.multiply(glMatrix.mat4.fromRotationTranslationScale(wm,
    glMatrix.quat.fromEuler(q, this.car.wrot, wa, 0), wp, ws));

  bind();
  draw(this.wheel, [0, 0, 0]);

  stack.pop();
  stack.push();

  stack.multiply(glMatrix.mat4.fromScaling(m, [-1, 1, 1]));
  stack.multiply(glMatrix.mat4.fromRotationTranslationScale(wm,
    glMatrix.quat.fromEuler(q, this.car.wrot, -wa, 0), wp, ws));

  bind();
  draw(this.wheel, [0, 0, 0]);

  stack.pop();
  stack.push();

  stack.multiply(glMatrix.mat4.fromRotationTranslation(m,
    glMatrix.quat.fromEuler(q, -11.3, 0, 0),
    [.8, .8, -1.1]));
  stack.multiply(glMatrix.mat4.fromScaling(m, [.2, .2, .2]));
  bind()
  draw(this.headlight, [.7, .7, .7]);

  stack.pop();

  stack.multiply(glMatrix.mat4.fromRotationTranslation(m,
    glMatrix.quat.fromEuler(q, -11.3, 0, 0),
    [-.8, .8, -1.1]));
  stack.multiply(glMatrix.mat4.fromScaling(m, [.2, .2, .2]));
  bind()
  draw(this.headlight, [.7, .7, .7]);

  stack.pop();
};

Renderer.drawLamp = function (gl, shader, stack, lamp) {
  let m = glMatrix.mat4.create();

  stack.push();
  stack.multiply(glMatrix.mat4.fromTranslation(m, lamp.position));
  stack.multiply(glMatrix.mat4.fromScaling(m, [0.1, lamp.height / 2, 0.1]));
  this.bindModelViewMatrix(gl, shader, stack);
  this.drawObject(gl, shader, this.cylinder, [.5, .4, .4, 1]);

  stack.pop();
  stack.push();
  let t = lamp.position;
  t[1] += lamp.height
  stack.multiply(glMatrix.mat4.fromTranslation(m, t));
  stack.multiply(glMatrix.mat4.fromScaling(m, [.75, .2, .75]));
  this.bindModelViewMatrix(gl, shader, stack);
  this.drawObject(gl, shader, this.cylinder, [.7, .8, .8, 1]);

  stack.pop();
}

Renderer.drawScene = function (gl, shader) {
  Renderer.gl.useProgram(shader);

  var width = this.canvas.width;
  var height = this.canvas.height
  var ratio = width / height;
  var stack = new MatrixStack();

  if (!shader.is_shadow)
    gl.viewport(0, 0, width, height);

  gl.enable(gl.DEPTH_TEST);

  // Clear the framebuffer
  gl.clearColor(0.34, 0.5, 0.74, 1.0);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  Renderer.cameras[Renderer.currentCamera].update(this.car.frame);
  this.view = Renderer.cameras[Renderer.currentCamera].matrix();

  if (!shader.is_shadow) {
    gl.uniformMatrix4fv(shader.uProjectionMatrixLocation, false,
    glMatrix.mat4.perspective(glMatrix.mat4.create(), 3.14 / 4, ratio, 1, 500));
    gl.uniform3fv(shader.uSunDirectionLocation, Game.scene.weather.sunLightDirection);
    gl.uniform3fv(shader.uSunColorLocation, [.6, .6, .6]);
  }

  // headlights
  let hl_left = glMatrix.vec4.create();
  let hl_right = glMatrix.vec4.create();
  let dir_fwd = glMatrix.vec4.create();
  let v = glMatrix.vec4.create();
  let hl_view_left = glMatrix.mat4.create();
  let hl_view_right = glMatrix.mat4.create();
  let hl_proj = glMatrix.mat4.create();

  let hl_pos = [-.8, 1.3, -1.15, 1];
  glMatrix.vec4.transformMat4(hl_left, hl_pos, this.car.frame);
  glMatrix.vec4.transformMat4(hl_right, [-hl_pos[0], hl_pos[1], hl_pos[2], 1], this.car.frame);
  glMatrix.vec4.transformMat4(dir_fwd, [0, -.2, -1, 0], this.car.frame);

  glMatrix.vec4.add(v, hl_left, dir_fwd);
  glMatrix.mat4.lookAt(hl_view_left, hl_left, v, [0, 1, 0]);

  glMatrix.vec4.add(v, hl_right, dir_fwd);
  glMatrix.mat4.lookAt(hl_view_right, hl_right, v, [0, 1, 0]);

  glMatrix.mat4.perspective(hl_proj, .3, 1, .1, 50);

  if (shader.is_shadow) {
    let m = glMatrix.mat4.create();
    glMatrix.mat4.multiply(m, hl_proj,shader.drawing_left ? hl_view_left : hl_view_right);
    gl.uniformMatrix4fv(shader.uVPLocation, false, m);
  } else {
    gl.uniformMatrix4fv(shader.uLeftHeadlightViewMatrixLocation, false, hl_view_left);
    gl.uniformMatrix4fv(shader.uRightHeadlightViewMatrixLocation, false, hl_view_right);
    gl.uniformMatrix4fv(shader.uHeadlightProjMatrixLocation, false, hl_proj);
  }


  // initialize the stack with the identity
  stack.loadIdentity();
  stack.push();

  if (!shader.is_shadow) {
    stack.multiply(this.car.frame);
    this.drawCar(gl, shader, stack);
    stack.pop();
  }

  this.bindModelViewMatrix(gl, shader, stack);

  // drawing the static elements (ground, track and buldings)
  this.drawObject(gl, shader, Game.scene.groundObj, [0.3, 0.7, 0.2, 1.0], false, this.tex.ground);
  this.drawObject(gl, shader, Game.scene.trackObj, [0.9, 0.8, 0.7, 1.0], false, this.tex.track, false, true);

  for (let i in Game.scene.buildingsObjTex) {
    this.drawObject(gl, shader, Game.scene.buildingsObjTex[i], [0.8, 0.8, 0.8, 1.0], false, this.tex["facade" + i % 3], true);
    this.drawObject(gl, shader, Game.scene.buildingsObjTex[i].roof, [0.8, 0.8, 0.8, 1.0], false, this.tex.roof, true);
  }

  let lpos = new Float32Array(Game.scene.lamps.length * 3);
  for (let i in Game.scene.lamps) {
    let l = Game.scene.lamps[i];

    [lpos[3 * i], lpos[3 * i + 1], lpos[3 * i + 2]] = l.position;
    lpos[3 * i + 1] += l.height;

    this.drawLamp(gl, shader, stack, l);
  }

  if (!shader.is_shadow)
    gl.uniform3fv(shader.uLampPositionLocation, lpos);

  gl.useProgram(null);
};

Renderer.shadow_pass = function (gl) {
  gl.viewport(0, 0, depthTextureSize, depthTextureSize);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.FRONT);
  gl.clearDepth(1);

  gl.bindFramebuffer(gl.FRAMEBUFFER, Renderer.fb_left);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  Renderer.depth_shader.drawing_left = true;
  this.drawScene(gl, Renderer.depth_shader);

  Renderer.depth_shader.drawing_left = false;
  gl.bindFramebuffer(gl.FRAMEBUFFER, Renderer.fb_right);
  gl.clear(gl.DEPTH_BUFFER_BIT);
  this.drawScene(gl, Renderer.depth_shader);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.disable(gl.CULL_FACE);
}

Renderer.Display = function () {
  Renderer.currentCamera = parseInt(document.getElementById("camera-select").value);

  Renderer.shadow_pass(Renderer.gl);
  Renderer.drawScene(Renderer.gl, Renderer.shader);
  window.requestAnimationFrame(Renderer.Display);
};

function loadTexture(gl, path, dest, clamp, tu) {
  Renderer.gl.useProgram(Renderer.shader);

  let image = new Image();
  image.src = "../common/textures/" + path;
  image.addEventListener('load', () => {
    gl.activeTexture(gl.TEXTURE0 + (tu ? tu : 0));
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    let wrap = clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);

    Renderer.tex[dest] = texture;
  });
}

function createFramebuffer(gl) {
  gl.activeTexture(gl.TEXTURE0);
  var depthTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, depthTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,      // target
    0,                  // mip level
    gl.DEPTH_COMPONENT, // internal format
    depthTextureSize,   // width
    depthTextureSize,   // height
    0,                  // border
    gl.DEPTH_COMPONENT, // format
    gl.UNSIGNED_INT,    // type
    null);              // data

  var depthFramebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,       // target
    gl.DEPTH_ATTACHMENT,  // attachment point
    gl.TEXTURE_2D,        // texture target
    depthTexture,         // texture
    0);                   // mip level

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  depthFramebuffer.size = depthTextureSize;

  var colorTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, colorTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    depthTextureSize,
    depthTextureSize,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // attach it to the framebuffer
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,        // target
    gl.COLOR_ATTACHMENT0,  // attachment point
    gl.TEXTURE_2D,         // texture target
    colorTexture,         // texture
    0);                    // mip level

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  depthFramebuffer.depthTexture = depthTexture;

  return depthFramebuffer;
}

Renderer.setupAndStart = function () {
  /* create the canvas */
  Renderer.canvas = document.getElementById("OUTPUT-CANVAS");
  Renderer.canvas.onclick = () => Renderer.canvas.requestPointerLock();

  /* get the webgl context */
  Renderer.gl = Renderer.canvas.getContext("webgl");
  /* read the webgl version and log */
  var gl_version = Renderer.gl.getParameter(Renderer.gl.VERSION);
  log("glversion: " + gl_version);
  var GLSL_version = Renderer.gl.getParameter(Renderer.gl.SHADING_LANGUAGE_VERSION)
  log("glsl  version: " + GLSL_version);

  Renderer.gl.getExtension('WEBGL_depth_texture');
  Renderer.gl.getExtension('OES_standard_derivatives');

  /* create the matrix stack */
  Renderer.stack = new MatrixStack();

  /* initialize objects to be rendered */
  Renderer.initializeObjects(Renderer.gl);

  /* create the shader */
  Renderer.shader = new Shader(Renderer.gl);
  Renderer.depth_shader = new DepthShader(Renderer.gl);
  Renderer.gl.useProgram(Renderer.shader);

  /* create the framebuffers for shadow mapping */
  Renderer.fb_left = createFramebuffer(Renderer.gl);
  Renderer.fb_right = createFramebuffer(Renderer.gl);

  Renderer.gl.activeTexture(Renderer.gl.TEXTURE2);
  Renderer.gl.bindTexture(Renderer.gl.TEXTURE_2D, Renderer.fb_left.depthTexture);
  Renderer.gl.uniform1i(Renderer.shader.uLeftDepthSamplerLocation, 2);
  Renderer.gl.activeTexture(Renderer.gl.TEXTURE3);
  Renderer.gl.bindTexture(Renderer.gl.TEXTURE_2D, Renderer.fb_right.depthTexture);
  Renderer.gl.uniform1i(Renderer.shader.uRightDepthSamplerLocation, 3);

  Renderer.tex = {};
  loadTexture(Renderer.gl, "grass_tile.png", "ground");
  loadTexture(Renderer.gl, "street4.png", "track");
  loadTexture(Renderer.gl, "facade1.jpg", "facade0");
  loadTexture(Renderer.gl, "facade2.jpg", "facade1");
  loadTexture(Renderer.gl, "facade3.jpg", "facade2");
  loadTexture(Renderer.gl, "roof.jpg", "roof");
  loadTexture(Renderer.gl, "headlight.png", "headlight", true, 1);
  loadTexture(Renderer.gl, "asphalt_normal_map.jpg", "track_normal", false, 4);

  /* TU: 0 color, 1 headlight, 2/3 shadow, 4 normal */

  Renderer.gl.uniform1i(Renderer.shader.uSamplerLocation, 0);
  Renderer.gl.uniform1i(Renderer.shader.uHeadlightSamplerLocation, 1);
  Renderer.gl.uniform1i(Renderer.shader.uNormalSamplerLocation, 4);

  /*
  add listeners for the mouse / keyboard events
  */
  Renderer.canvas.addEventListener('mousemove', on_mouseMove, false);
  Renderer.canvas.addEventListener('keydown', on_keydown, false);
  Renderer.canvas.addEventListener('keyup', on_keyup, false);

  Renderer.Display();
}

on_mouseMove = function (e) {
  Renderer.cameras[2].update_angle(e.movementX, e.movementY);
}

on_keyup = function (e) {
  Renderer.car.control_keys[e.key.length > 1 ? e.key : e.key.toLowerCase()] = false;
}
on_keydown = function (e) {
  Renderer.car.control_keys[e.key.length > 1 ? e.key : e.key.toLowerCase()] = true;
  if (e.key == "ArrowUp" || e.key == "ArrowDown")
    e.preventDefault();
}

window.onload = Renderer.setupAndStart;



