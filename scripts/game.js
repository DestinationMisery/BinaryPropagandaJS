// Global variable definition
var canvas;
var gl;
var shaderProgram;
abs = Math.abs;

// Buffers
var worldVertexPositionBuffer = null;
var worldVertexTextureCoordBuffer = null;

// Model-view and projection matrix and model-view matrix stack
var mvMatrixStack = [];
var mvMatrix = mat4.create();
var pMatrix = mat4.create();

// Variables for storing textures
var wallTexture;

// Variable that stores  loading state of textures.
var texturesLoaded = false;

// Keyboard handling helper variable for reading the status of keys
var currentlyPressedKeys = {};

// Variables for storing current position and speed
var pitch = -40;
var pitchRate = 0;
var yaw = 0;
var yawRate = 0;
var xPosition = -2;
var yPosition = 2;
var zPosition = 0;
var speed = 0;

// Used to make us "jog" up and down as we move forward.
var joggingAngle = 0;

// Helper variable for animation
var lastTime = 0;

//
// Matrix utility functions
//
// mvPush   ... push current matrix on matrix stack
// mvPop    ... pop top matrix from stack
// degToRad ... convert degrees to radians
//
function mvPushMatrix() {
  var copy = mat4.create();
  mat4.set(mvMatrix, copy);
  mvMatrixStack.push(copy);
}

function mvPopMatrix() {
  if (mvMatrixStack.length == 0) {
    throw "Invalid popMatrix!";
  }
  mvMatrix = mvMatrixStack.pop();
}

function degToRad(degrees) {
  return degrees * Math.PI / 180;
}

//
// initGL
//
// Initialize WebGL, returning the GL context or null if
// WebGL isn't available or could not be initialized.
//
function initGL(canvas) {
  var gl = null;
  try {
    // Try to grab the standard context. If it fails, fallback to experimental.
    gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
  } catch(e) {}

  // If we don't have a GL context, give up now
  if (!gl) {
    alert("Unable to initialize WebGL. Your browser may not support it.");
  }
  return gl;
}

//
// getShader
//
// Loads a shader program by scouring the current document,
// looking for a script with the specified ID.
//
function getShader(gl, id) {
  var shaderScript = document.getElementById(id);

  // Didn't find an element with the specified ID; abort.
  if (!shaderScript) {
    return null;
  }
  
  // Walk through the source element's children, building the
  // shader source string.
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) {
        shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
  
  // Now figure out what type of shader script we have,
  // based on its MIME type.
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;  // Unknown shader type
  }

  // Send the source to the shader object
  gl.shaderSource(shader, shaderSource);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  }

  return shader;
}

//
// initShaders
//
// Initialize the shaders, so WebGL knows how to light our scene.
//
function initShaders() {
  var fragmentShader = getShader(gl, "shader-fs");
  var vertexShader = getShader(gl, "shader-vs");
  
  // Create the shader program
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  
  // If creating the shader program failed, alert
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Unable to initialize the shader program.");
  }
  
  // start using shading program for rendering
  gl.useProgram(shaderProgram);
  
  // store location of aVertexPosition variable defined in shader
  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");

  // turn on vertex position attribute at specified position
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  // store location of aVertexNormal variable defined in shader
  shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");

  // store location of aTextureCoord variable defined in shader
  gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

  // store location of uPMatrix variable defined in shader - projection matrix 
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  // store location of uMVMatrix variable defined in shader - model-view matrix 
  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  // store location of uSampler variable defined in shader
  shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}

//
// setMatrixUniforms
//
// Set the uniforms in shaders.
//
function setMatrixUniforms() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//
// initTextures
//
// Initialize the textures we'll be using, then initiate a load of
// the texture images. The handleTextureLoaded() callback will finish
// the job; it gets called each time a texture finishes loading.
//
function initTextures() {
  wallTexture = gl.createTexture();
  wallTexture.image = new Image();
  wallTexture.image.onload = function () {
    handleTextureLoaded(wallTexture)
  }
  wallTexture.image.src = "./assets/ground.png";
}

function handleTextureLoaded(texture) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  // Third texture usus Linear interpolation approximation with nearest Mipmap selection
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.bindTexture(gl.TEXTURE_2D, null);

  // when texture loading is finished we can draw scene.
  texturesLoaded = true;
}

//
// handleLoadedWorld
//
// Initialisation of world 
//
function handleLoadedWorld(data) {
  var lines = data.split("\n");
  var vertexCount = 0;
  var vertexPositions = [];
  var vertexTextureCoords = [];
  for (var i in lines) {
    var vals = lines[i].replace(/^\s+/, "").split(/\s+/);
    if (vals.length == 5 && vals[0] != "//") {
      // It is a line describing a vertex; get X, Y and Z first
      vertexPositions.push(parseFloat(vals[0]));
      vertexPositions.push(parseFloat(vals[1]));
      vertexPositions.push(parseFloat(vals[2]));

      // And then the texture coords
      vertexTextureCoords.push(parseFloat(vals[3]));
      vertexTextureCoords.push(parseFloat(vals[4]));

      vertexCount += 1;
    }
  }

  worldVertexPositionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);
  worldVertexPositionBuffer.itemSize = 3;
  worldVertexPositionBuffer.numItems = vertexCount;

  worldVertexTextureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexTextureCoords), gl.STATIC_DRAW);
  worldVertexTextureCoordBuffer.itemSize = 2;
  worldVertexTextureCoordBuffer.numItems = vertexCount;

  document.getElementById("loadingtext").textContent = "";
}

//
// loadWorld
//
// Loading world 
//
function loadWorld() {
  var request = new XMLHttpRequest();
  request.open("GET", "./assets/world.txt");
  request.onreadystatechange = function () {
    if (request.readyState == 4) {
      handleLoadedWorld(request.responseText);
    }
  }
  request.send();
}

//
// drawScene
//
// Draw the scene.
//
function drawScene() {
  // set the rendering environment to full canvas size
  gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
  // Clear the canvas before we start drawing on it.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // If buffers are empty we stop loading the application.
  if (worldVertexTextureCoordBuffer == null || worldVertexPositionBuffer == null) {
    return;
  }
  
  // Establish the perspective with which we want to view the
  // scene. Our field of view is 45 degrees, with a width/height
  // ratio of 640:480, and we only want to see objects between 0.1 units
  // and 100 units away from the camera.
  mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  mat4.identity(mvMatrix);

  // Now move the drawing position a bit to where we want to start
  // drawing the world.
  mat4.rotate(mvMatrix, degToRad(-pitch), [1, 0, 0]);
  mat4.rotate(mvMatrix, degToRad(-yaw), [0, 1, 0]);
  mat4.translate(mvMatrix, [-xPosition, -yPosition, -zPosition]);

  // Activate textures
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, wallTexture);
  gl.uniform1i(shaderProgram.samplerUniform, 0);

  // Set the texture coordinates attribute for the vertices.
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
  gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, worldVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Draw the world by binding the array buffer to the world's vertices
  // array, setting attributes, and pushing it to GL.
  gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
  gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, worldVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

  // Draw the cube.
  setMatrixUniforms();
  gl.drawArrays(gl.TRIANGLES, 0, worldVertexPositionBuffer.numItems);
}

//
// animate
//
// Called every time before redeawing the screen.
//
function animate() {
  var timeNow = new Date().getTime();
  if (lastTime != 0) {
    var elapsed = timeNow - lastTime;

    if (speed != 0) {
      xPosition -= Math.sin(degToRad(yaw)) * speed * elapsed;
      zPosition -= Math.cos(degToRad(yaw)) * speed * elapsed;

    }

    yaw += yawRate * elapsed;
    pitch += pitchRate * elapsed;

  }
  lastTime = timeNow;
}

//
// Keyboard handling helper functions
//
// handleKeyDown    ... called on keyDown event
// handleKeyUp      ... called on keyUp event
//
function handleKeyDown(event) {
  // storing the pressed state for individual key
  if (event.keyCode === 77) {
    toggleMouseMove();
  }
  currentlyPressedKeys[event.keyCode] = true;
}

function handleKeyUp(event) {
  // reseting the pressed state for individual key
  currentlyPressedKeys[event.keyCode] = false;
}

//
// handleKeys
//
// Called every time before redeawing the screen for keyboard
// input handling. Function continuisly updates helper variables.
//
function handleKeys() {
  if (currentlyPressedKeys[74]) {
    // Page Up
    pitchRate = 0.1;
  } else if (currentlyPressedKeys[75]) {
    // Page Down
    pitchRate = -0.1;
  } else {
    pitchRate = 0;
  }

  if (currentlyPressedKeys[37] || currentlyPressedKeys[65]) {
    // Left cursor key or A
    yawRate = 0.1;
  } else if (currentlyPressedKeys[39] || currentlyPressedKeys[68]) {
    // Right cursor key or D
    yawRate = -0.1;
  } else {
    yawRate = 0;
  }

  if (currentlyPressedKeys[38] || currentlyPressedKeys[87]) {
    // Up cursor key or W
    speed = 0.003;
  } else if (currentlyPressedKeys[40] || currentlyPressedKeys[83]) {
    // Down cursor key
    speed = -0.003;
  } else {
    speed = 0;
  }
}


canvasSizeX = 1280;
canvasSizeY = 720;

playgroundSizeX = 5;
playgroundSizeY = 5;

function handleClicks(e) {
  // get pos of click
  coords = canvas.relMouseCoords(event);
  canvasX = coords.x;
  canvasY = coords.y;

  canvasX = (canvasX - (canvasSizeX/2)) / (canvasSizeX/2) * playgroundSizeX;
  canvasY = (canvasY - (canvasSizeY/2)) / (canvasSizeY/2) * playgroundSizeY;
  console.table([canvasX, canvasY, xPosition, zPosition])
  moveTo(canvasX, canvasY, 200)
}

function moveTo(xDesired, zDesired, speed /* from 1 to 1000 */) {

  // move player every frame in the x,y direction until he is there
  var intervalMove = setInterval(function () {
    if (abs(xDesired-xPosition) < 0.1 && abs(zDesired-zPosition) < 0.1) {
      clearInterval(intervalMove);
    }
    xPosition += ((xDesired - xPosition) / (1000 / speed));
    zPosition += ((zDesired - zPosition) / (1000 / speed));
  }, 15);
}

var mouseMoveEngaged = false;
function toggleMouseMove() {
  mouseMoveEngaged = !mouseMoveEngaged;
  if (mouseMoveEngaged) {
    $("#mouseLockState").html("ON")
    $("#mouseLockState").css("color", "#00ff00")
  } else {
    $("#mouseLockState").html("OFF")
    $("#mouseLockState").css("color", "#ff0000")
  }
}

function relMouseCoords(event){

  var totalOffsetX = 0;
  var totalOffsetY = 0;
  var canvasX = 0;
  var canvasY = 0;
  var currentElement = this;

  do{
      totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
      totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
  }
  while(currentElement = currentElement.offsetParent)

  canvasX = event.pageX - totalOffsetX;
  canvasY = event.pageY - totalOffsetY;

  return {x:canvasX, y:canvasY}
}

HTMLCanvasElement.prototype.relMouseCoords = relMouseCoords;

var mouseX = null;
var mouseY = null;

document.addEventListener('mousemove', onMouseUpdate, false);
document.addEventListener('mouseenter', onMouseUpdate, false);

function onMouseUpdate(e) {
    mouseX = e.pageX;
    mouseY = e.pageY;
}

function getMouseX() {
    return x;
}

function getMouseY() {
    return y;
}


function mouseMovePlayground(e) {
  var marginLeft = $("#glcanvas").offset().left;
  var marginTop = 100;
 
  if (mouseMoveEngaged) {
    var outLeft = mouseX < marginLeft;
    var outUp = mouseY < marginTop;
    var outRight = mouseX > marginLeft + canvasSizeX;
    var outDown = mouseY > marginTop + canvasSizeY;
    
    if (outLeft) {
      xPosition -= 0.1;
    }
    if (outUp) {
      zPosition -= 0.1;
    }
    if (outRight) {
      xPosition += 0.1;
    }
    if (outDown) {
      zPosition += 0.1;
    }

  }
}

//
// start
//
// Called when the canvas is created to get the ball rolling.
// Figuratively, that is. There's nothing moving in this demo.
//
function start() {
  canvas = document.getElementById("glcanvas");

  gl = initGL(canvas);      // Initialize the GL context

  // Only continue if WebGL is available and working
  if (gl) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);                      // Set clear color to black, fully opaque
    gl.clearDepth(1.0);                                     // Clear everything
    gl.enable(gl.DEPTH_TEST);                               // Enable depth testing
    gl.depthFunc(gl.LEQUAL);                                // Near things obscure far things

    // Initialize the shaders; this is where all the lighting for the
    // vertices and so forth is established.
    initShaders();
    
    // Next, load and set up the textures we'll be using.
    initTextures();

    // Initialise world objects
    loadWorld();

    // Bind keyboard handling functions to document handlers
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
    
    // Set up to draw the scene periodically.
    setInterval(function() {
      if (texturesLoaded) { // only draw scene and animate when textures are loaded.
        requestAnimationFrame(animate);
        handleKeys();
        mouseMovePlayground();
        drawScene();
      }
    }, 15);
  }
}