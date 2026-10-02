const canvas = document.getElementById("globe");
const gl = canvas.getContext("webgl", { antialias: true });

if (!gl) {
    alert("Seu navegador não suporta WebGL.");
    throw new Error("WebGL indisponível");
}

let rotationX = -0.15;
let rotationY = 0.35;
let zoom = 2.7;

let dragging = false;
let lastX = 0;
let lastY = 0;

const vertexShaderSource = `
attribute vec3 aPosition;
attribute vec2 aUV;

uniform mat4 uProjection;
uniform mat4 uModel;

varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec4 worldPosition = uModel * vec4(aPosition, 1.0);

    vPosition = worldPosition.xyz;
    vNormal = normalize((uModel * vec4(aPosition, 0.0)).xyz);
    vUV = aUV;

    gl_Position = uProjection * worldPosition;
}
`;

const fragmentShaderSource = `
precision highp float;

uniform sampler2D uTexture;

varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {

    vec3 lightDirection = normalize(vec3(-0.7, 0.45, 1.0));

    float light = dot(vNormal, lightDirection);

    light = smoothstep(-0.35, 0.75, light);

    vec4 earth = texture2D(uTexture, vUV);

    vec3 color = earth.rgb * (0.28 + light * 0.85);

    // iluminação noturna suave
    float night = 1.0 - light;

    vec3 nightGlow = vec3(0.035, 0.055, 0.09) * night;

    color += nightGlow;

    gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        throw new Error("Erro no shader");
    }

    return shader;
}

function createProgram(vertexSource, fragmentSource) {

    const vertexShader =
        createShader(gl.VERTEX_SHADER, vertexSource);

    const fragmentShader =
        createShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        throw new Error("Erro no programa WebGL");
    }

    return program;
}

const program =
    createProgram(vertexShaderSource, fragmentShaderSource);

gl.useProgram(program);

const vertices = [];
const normals = [];
const uvs = [];
const indices = [];

const latitudeBands = 100;
const longitudeBands = 160;

for (let lat = 0; lat <= latitudeBands; lat++) {

    const theta = lat * Math.PI / latitudeBands;

    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longitudeBands; lon++) {

        const phi = lon * 2 * Math.PI / longitudeBands;

        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;

        vertices.push(x, y, z);

        normals.push(x, y, z);

        uvs.push(
            1 - lon / longitudeBands,
            1 - lat / latitudeBands
        );
    }
}

for (let lat = 0; lat < latitudeBands; lat++) {

    for (let lon = 0; lon < longitudeBands; lon++) {

        const first =
            lat * (longitudeBands + 1) + lon;

        const second = first + longitudeBands + 1;

        indices.push(
            first,
            second,
            first + 1,

            second,
            second + 1,
            first + 1
        );
    }
}

const positionBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(vertices),
    gl.STATIC_DRAW
);

const normalBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(normals),
    gl.STATIC_DRAW
);

const uvBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);

gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(uvs),
    gl.STATIC_DRAW
);

const indexBuffer = gl.createBuffer();

gl.bindBuffer(
    gl.ELEMENT_ARRAY_BUFFER,
    indexBuffer
);

gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array(indices),
    gl.STATIC_DRAW
);

const aPosition =
    gl.getAttribLocation(program, "aPosition");

const aUV =
    gl.getAttribLocation(program, "aUV");

gl.enableVertexAttribArray(aPosition);

gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

gl.vertexAttribPointer(
    aPosition,
    3,
    gl.FLOAT,
    false,
    0,
    0
);

gl.enableVertexAttribArray(aUV);

gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);

gl.vertexAttribPointer(
    aUV,
    2,
    gl.FLOAT,
    false,
    0,
    0
);

const uProjection =
    gl.getUniformLocation(program, "uProjection");

const uModel =
    gl.getUniformLocation(program, "uModel");

const uTexture =
    gl.getUniformLocation(program, "uTexture");

function loadTexture() {

    return new Promise((resolve, reject) => {

        const image = new Image();

        image.onload = () => {

            const texture = gl.createTexture();

            gl.bindTexture(
                gl.TEXTURE_2D,
                texture
            );

            gl.pixelStorei(
                gl.UNPACK_FLIP_Y_WEBGL,
                true
            );

            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                image
            );

            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_MIN_FILTER,
                gl.LINEAR_MIPMAP_LINEAR
            );

            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_MAG_FILTER,
                gl.LINEAR
            );

            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_S,
                gl.REPEAT
            );

            gl.texParameteri(
                gl.TEXTURE_2D,
                gl.TEXTURE_WRAP_T,
                gl.CLAMP_TO_EDGE
            );

            gl.generateMipmap(
                gl.TEXTURE_2D
            );

            resolve(texture);
        };

        image.onerror = () => {

            reject(
                new Error(
                    "Não foi possível carregar a textura da Terra."
                )
            );

        };

        image.src =
            "../assets/earth/bluemarble-2048.png";
    });
}

function perspective(
    fov,
    aspect,
    near,
    far
) {

    const f =
        1 / Math.tan(fov / 2);

    const rangeInv =
        1 / (near - far);

    return new Float32Array([

        f / aspect, 0, 0, 0,

        0, f, 0, 0,

        0, 0,
        (near + far) * rangeInv,
        -1,

        0, 0,
        near * far * rangeInv * 2,
        0
    ]);
}

function multiply(a, b) {

    const out =
        new Float32Array(16);

    for (let i = 0; i < 4; i++) {

        for (let j = 0; j < 4; j++) {

            out[i * 4 + j] =
                a[i * 4] * b[j] +
                a[i * 4 + 1] * b[j + 4] +
                a[i * 4 + 2] * b[j + 8] +
                a[i * 4 + 3] * b[j + 12];
        }
    }

    return out;
}

function rotationXMatrix(angle) {

    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([

        1, 0, 0, 0,

        0, c, -s, 0,

        0, s, c, 0,

        0, 0, 0, 1
    ]);
}

function rotationYMatrix(angle) {

    const c = Math.cos(angle);
    const s = Math.sin(angle);

    return new Float32Array([

        c, 0, s, 0,

        0, 1, 0, 0,

        -s, 0, c, 0,

        0, 0, 0, 1
    ]);
}

function translationMatrix(z) {

    return new Float32Array([

        1, 0, 0, 0,

        0, 1, 0, 0,

        0, 0, 1, 0,

        0, 0, z, 1
    ]);
}

function resize() {

    const dpr =
        Math.min(window.devicePixelRatio || 1, 2);

    const width =
        canvas.clientWidth * dpr;

    const height =
        canvas.clientHeight * dpr;

    if (
        canvas.width !== width ||
        canvas.height !== height
    ) {

        canvas.width = width;
        canvas.height = height;
    }

    gl.viewport(
        0,
        0,
        canvas.width,
        canvas.height
    );
}

let earthTexture = null;

async function start() {

    try {

        earthTexture =
            await loadTexture();

        document.body.classList.add(
            "earth-ready"
        );

        requestAnimationFrame(render);

    } catch (error) {

        console.error(error);

        const loading =
            document.getElementById("loading");

        if (loading) {

            loading.innerHTML =
                "❌ Textura da Terra não encontrada.<br><small>Verifique assets/earth/bluemarble-2048.png</small>";
        }
    }
}

function render(time) {

    resize();

    gl.clearColor(
        0.005,
        0.008,
        0.015,
        1
    );

    gl.clear(
        gl.COLOR_BUFFER_BIT |
        gl.DEPTH_BUFFER_BIT
    );

    gl.enable(
        gl.DEPTH_TEST
    );

    gl.enable(
        gl.CULL_FACE
    );

    gl.cullFace(
        gl.BACK
    );

    const aspect =
        canvas.width / canvas.height;

    const projection =
        perspective(
            Math.PI / 3,
            aspect,
            0.1,
            100
        );

    const rx =
        rotationXMatrix(rotationX);

    const ry =
        rotationYMatrix(rotationY);

    const translation =
        translationMatrix(-zoom);

    const rotation =
        multiply(ry, rx);

    const model =
        multiply(translation, rotation);

    gl.useProgram(program);

    gl.uniformMatrix4fv(
        uProjection,
        false,
        projection
    );

    gl.uniformMatrix4fv(
        uModel,
        false,
        model
    );

    gl.activeTexture(
        gl.TEXTURE0
    );

    gl.bindTexture(
        gl.TEXTURE_2D,
        earthTexture
    );

    gl.uniform1i(
        uTexture,
        0
    );

    gl.drawElements(
        gl.TRIANGLES,
        indices.length,
        gl.UNSIGNED_SHORT,
        0
    );

    requestAnimationFrame(render);
}

canvas.addEventListener(
    "pointerdown",
    event => {

        dragging = true;

        lastX = event.clientX;
        lastY = event.clientY;

        canvas.setPointerCapture(
            event.pointerId
        );
    }
);

canvas.addEventListener(
    "pointermove",
    event => {

        if (!dragging) return;

        const dx =
            event.clientX - lastX;

        const dy =
            event.clientY - lastY;

        rotationY += dx * 0.008;

        rotationX += dy * 0.008;

        rotationX =
            Math.max(
                -1.45,
                Math.min(1.45, rotationX)
            );

        lastX = event.clientX;
        lastY = event.clientY;
    }
);

canvas.addEventListener(
    "pointerup",
    event => {

        dragging = false;

        try {
            canvas.releasePointerCapture(
                event.pointerId
            );
        } catch {}
    }
);

canvas.addEventListener(
    "pointercancel",
    () => {

        dragging = false;
    }
);

canvas.addEventListener(
    "wheel",
    event => {

        event.preventDefault();

        zoom += event.deltaY * 0.002;

        zoom =
            Math.max(
                1.35,
                Math.min(6, zoom)
            );
    },
    { passive: false }
);

window.addEventListener(
    "resize",
    resize
);

const zoomIn =
    document.getElementById("zoomIn");

const zoomOut =
    document.getElementById("zoomOut");

const reset =
    document.getElementById("reset");

if (zoomIn) {

    zoomIn.onclick = () => {

        zoom -= 0.35;

        zoom =
            Math.max(1.35, zoom);
    };
}

if (zoomOut) {

    zoomOut.onclick = () => {

        zoom += 0.35;

        zoom =
            Math.min(6, zoom);
    };
}

if (reset) {

    reset.onclick = () => {

        rotationX = -0.15;
        rotationY = 0.35;
        zoom = 2.7;
    };
}

const loading =
    document.getElementById("loading");

if (loading) {

    loading.innerHTML =
        "🌍 Carregando Terra real...";
}

start();