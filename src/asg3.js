// ================================================================
// Global variables
// ================================================================

// Vertex shader program
var VSHADER_SOURCE = `
    precision mediump float;
    attribute vec4 a_Position;
    attribute vec2 a_UV;
    varying vec2 v_UV;
    uniform mat4 u_ModelMatrix;
    uniform mat4 u_ViewMatrix;
    uniform mat4 u_ProjectionMatrix;
    void main() {
        gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_ModelMatrix * a_Position;
        v_UV = a_UV;
    }`;

// Fragment shader program
var FSHADER_SOURCE = `
    precision mediump float;
    varying vec2 v_UV;
    uniform vec4 u_FragColor;
    uniform sampler2D u_Sampler0;
    uniform sampler2D u_Sampler1;
    uniform sampler2D u_Sampler2;
    uniform sampler2D u_Sampler3;

    uniform int u_whichTexture;

    void main() {
        if (u_whichTexture == -2) {
            // Use fragment color
            gl_FragColor = u_FragColor;
        } else if (u_whichTexture == -1) {
            // Use UV debug color
            gl_FragColor = vec4(v_UV, 1, 1);
        } else if (u_whichTexture == 0) {
            // Use texture0
            gl_FragColor = texture2D(u_Sampler0, v_UV);
        } else if (u_whichTexture == 1) {
            // Use texture1
            gl_FragColor = texture2D(u_Sampler1, v_UV);
        } else if (u_whichTexture == 2) {
            // Use texture0
            gl_FragColor = texture2D(u_Sampler2, v_UV);
        } else if (u_whichTexture == 3) {
            // Use texture1
            gl_FragColor = texture2D(u_Sampler3, v_UV);
        } else {
            // Error: Use yellow to indicate missing texture
            gl_FragColor = vec4(1, 1, 0, 1);
        }
    }`;

let canvas;
let gl;
let a_Position;
let u_ModelMatrix;
let u_ViewMatrix;
let u_ProjectionMatrix;
let a_UV;
let u_FragColor;

let g_textureSources = [
    '../resources/horse.png',
    '../resources/dylan.png',
    '../resources/sea.png',
    '../resources/sky.png',
];
let u_Samplers = [];
let g_Textures = [];

let u_whichTexture;

let g_dragStartAngle = [0, 0];
let g_dragStartMousePos = [0, 0];

let g_lastMouse = undefined;
let g_camera = undefined;

let g_map = undefined;
let g_renderAngle = 70;
let g_renderDistance = 40;
let g_cubesDrawn = 0;

let g_startTime = 0;
let g_seconds = 0;

let g_music = undefined;

// ================================================================
// Main
// ================================================================

function main() {
    
    // Set up canvas and gl variables
    setUpWebGL();
    // Set up GLSL shader programs and connect GLSL variables
    connectVariablesToGLSL();

    // Set up actions for the HTML UI elements
    addActionsForHTMLUI();

    g_camera = new Camera(canvas, {
        fov: 50,
        eye: new Vector3([3,1,-3]),
        at: new Vector3([-100,1,100]),
        up: new Vector3([0,1,0])
    })

    // On click
    canvas.onmousedown = function(ev) { click(ev, true) };
    // On drag
    canvas.onmousemove = function(ev) { if(ev.buttons == 1) { click(ev, false); } };

    document.onkeydown = keydown;

    // Specify the color for clearing <canvas>
    gl.clearColor(0, 0, 0, 1);

    // Initialize textures
    initTextures();

    // Setup the cubemap
    g_map = new CubeMap();

    g_startTime = performance.now()/1000;
    requestAnimationFrame(tick);
}

function tick() {
    let delta = g_seconds;
    g_seconds = performance.now()/1000 - g_startTime;
    delta = g_seconds - delta;

    // console.log(Math.sin(g_seconds));

    renderAllShapes();

    requestAnimationFrame(tick);
}

// ================================================================
// Initializers
// ================================================================

function setUpWebGL() {
    // Retrieve <canvas> element
    canvas = document.getElementById("webgl");

    // Get the rendering context for WebGL
    gl = canvas.getContext("webgl", {
        preserveDrawingBuffer: true
    });

    if (!gl) {
        console.log("Failed to get the rendering context for WebGL");
        return;
    }

    gl.enable(gl.DEPTH_TEST);
}

function connectVariablesToGLSL() {
    // Initialize shaders
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.');
        return;
    }

    a_Position = getAttrib('a_Position');
    a_UV = getAttrib('a_UV');

    u_FragColor = getUniform('u_FragColor');
    u_ModelMatrix = getUniform('u_ModelMatrix');
    u_ViewMatrix = getUniform('u_ViewMatrix');
    u_ProjectionMatrix = getUniform('u_ProjectionMatrix');; 
    u_whichTexture = getUniform('u_whichTexture');

    // Provide default values
    gl.vertexAttrib3f(a_Position, 0.0, 0.0, 0.0);

    let identityMatrix = new Matrix4();
    gl.uniformMatrix4fv(u_ModelMatrix, false, identityMatrix.elements);

    function getAttrib(name) {
        let attribVar = gl.getAttribLocation(gl.program, name);
        if (attribVar < 0) {
            console.log("Failed to get the storage location of " + name);
            return null;
        } else {
            return attribVar;
        }
    }

    function getUniform(name) {
        let uniformVar = gl.getUniformLocation(gl.program, name);
        if (!uniformVar) {
            console.log("Failed to get the storage location of " + name);
            return null;
        } else {
            return uniformVar;
        }
    }
}

function addActionsForHTMLUI() {
    // Play music
    let g_music = document.getElementById("music");

    // Initialize dynamic text
    sendTextTOHTML("distanceLabel", `Render Distance (current: ${g_renderDistance})`);
    sendTextTOHTML("angleLabel", `Render Angle (current: ${g_renderAngle})`);
    
    // Render distance slider
    let distance = document.getElementById("distance");
    distance.addEventListener("input", function() {
        g_renderDistance = this.value;
        sendTextTOHTML("distanceLabel", `Render Distance (current: ${g_renderDistance})`);
    });

    // Render angle slider
    let angle = document.getElementById("angle");
    angle.addEventListener("input", function() {
        g_renderAngle = this.value;
        sendTextTOHTML("angleLabel", `Render Angle (current: ${g_renderAngle})`);
    });

    // Reset sliders button
    let resetSliders = document.getElementById("resetSliders");
    resetSliders.addEventListener("mousedown", function() {
        g_renderDistance = distance.value = 40
        sendTextTOHTML("distanceLabel", `Render Distance (current: ${g_renderDistance})`);
        g_renderAngle = angle.value = 70;
        sendTextTOHTML("angleLabel", `Render Distance (current: ${g_renderAngle})`);
    });

    // Reset camera button
    let resetCamera = document.getElementById("resetCamera");
    resetCamera.addEventListener("mousedown", function() {
        g_camera.reset();
    });
}

function initTextures() {
    for (let i = 0; i < g_textureSources.length; i++) {
        let image = new Image();  // Create the image object
        if (!image) {
        console.log('Failed to create the image object');
        return false;
        }

        var texture = gl.createTexture();   // Create a texture object
        if (!texture) {
            console.log('Failed to create the texture object');
            return false;
        } else {
            g_Textures.push(texture);
        }

        // Register the event handler to be called on loading an image
        image.onload = function(){ sendImageToTEXTURE(i, image); };
        // Tell the browser to load an image
        image.src = g_textureSources[i];
    };
  
    return true;
}
  
function sendImageToTEXTURE(index, image) {

    var u_Sampler = gl.getUniformLocation(gl.program, `u_Sampler${index}`);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
    // Enable texture unit0
    gl.activeTexture(gl[`TEXTURE${index}`]);
    // Bind the texture object to the target
    gl.bindTexture(gl.TEXTURE_2D, g_Textures[index]);
  
    // Set the texture parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    // Set the texture image
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
    
    // Set the texture unit 0 to the sampler
    gl.uniform1i(u_Sampler, index);
    
    gl.clear(gl.COLOR_BUFFER_BIT);   // Clear <canvas>
  
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 0); // Draw the rectangle

    // Add the filled out sampler to our sampler list
    u_Samplers.push(u_Sampler);
}

function clearCanvas() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clear(gl.DEPTH_BUFFER_BIT);
}

// ================================================================
// Event callback methods
// ================================================================

function click(ev, dragStart) {

    // Extract the event click and convert to WebGL canvas space
    let [x, y] = coordinatesEventToGLSpace(ev);

    if (dragStart) {
        // Starting a drag.
        g_lastMouse = [x, y];
    } else {
        // Continuing a drag.
        let deltaX = x-g_lastMouse[0];
        g_camera.pan(deltaX * 20);

        g_lastMouse = [x, y];
    }
}

function keydown(ev) {

    if (ev.keyCode == 87) g_camera.moveForward();
    if (ev.keyCode == 83) g_camera.moveBackward();

    if (ev.keyCode == 65) g_camera.moveLeft();
    if (ev.keyCode == 68) g_camera.moveRight();

    if (ev.keyCode == 81) g_camera.pan(-1);
    if (ev.keyCode == 69) g_camera.pan(1);
}

// ================================================================
// Render methods
// ================================================================

function coordinatesEventToGLSpace(ev) {
    var x = ev.clientX; // x coordinate of a mouse pointer
    var y = ev.clientY; // y coordinate of a mouse pointer
    var rect = ev.target.getBoundingClientRect();

    // Transform from client space to WebGL canvas space
    x = ((x - rect.left) - canvas.height/2)/(canvas.height/2);
    y = (canvas.width/2 - (y - rect.top))/(canvas.width/2);

    return [x, y];
}

function renderAllShapes() {

    // Store the time at the start of this function.
    let startTime = performance.now();

    // Update our camera.
    g_camera.update();
    gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);
    gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);

    // Clear <canvas>
    clearCanvas();

    let root = new Cube();
    root.matrix.translate(0, 0, 0);
    root.matrix.scale(1, 1, 1);

    // let horseCube = new Cube(root);
    // horseCube.setColorHex("ffcc00ff");
    // horseCube.matrix.translate(0, 1, 0);
    // horseCube.setShadingIntensity(0.25);
    // horseCube.matrix.scale(0.5, 0.5, 0.5);
    // horseCube.render();

    // let meCube = new Cube(root);
    // meCube.setColorHex("ffcc00ff");
    // meCube.setShadingIntensity(0.25);
    // meCube.setTextureType(1);
    // meCube.matrix.translate(0.5, 1, 0);
    // meCube.matrix.rotate(45, 1, 1, 1);
    // meCube.matrix.scale(0.2, 0.2, 0.2);
    // meCube.render();

    let sky = new Cube(root);
    sky.setTextureType(3);
    sky.matrix.rotate(g_seconds*0.3, 1, 1, 1);
    sky.matrix.scale(256, 256, 256);
    sky.render();

    let sea = new Cube(root);
    sea.setTextureType(2);
    sea.matrix.translate(0, 0, 0);
    sea.matrix.scale(256, 0, 256);
    sea.render();

    g_cubesDrawn = g_map.render(root, g_seconds, g_camera, g_renderDistance, g_renderAngle);

    updatePerformanceDebug(startTime, performance.now());
}

// ================================================================
// Utility methods
// ================================================================

function updatePerformanceDebug(start, end) {
    let duration = end-start;
    sendTextTOHTML("performance",
                        `ms: ${Math.floor(duration)} | ` +
                        `fps: ${Math.floor(1000/duration)/10}` +
                        `<br>cubes drawn: ${g_cubesDrawn + 2}`); // Plus 2 for ground + skybox
}

function sendTextTOHTML(htmlID, text) {
    let htmlElm = document.getElementById(htmlID);
    if (!htmlElm) {
        console.log(`Failed to get ${htmlID} from HTML.`);
        return;
    }
    htmlElm.innerHTML = text;
}