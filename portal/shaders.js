const vertex = `#version 300 es
layout (location = 0) in vec4 aPosition;
layout (location = 1) in vec2 aTexCoord;

uniform mat4 uViewModel;
uniform mat4 uProjection;

out vec2 vTexCoord;

void main() {
    vTexCoord = aTexCoord;
    gl_Position = uProjection * uViewModel * aPosition;
}
`;

const fragment = `#version 300 es
precision mediump float;

uniform mediump sampler2D uTexture;

in vec2 vTexCoord;
uniform float factor;

out vec4 oColor;

float minf(float a, float b) {
    if (a < b) return a;
    else return b;
}

void main() {
    vec4 textureColor = texture(uTexture, vTexCoord);
    float r = minf(1.0, textureColor[0] * factor);
    float g = minf(1.0, textureColor[1] * factor);
    float b = minf(1.0, textureColor[2] * factor);
    oColor = vec4(r, g, b, textureColor[3]);
}
`;

export default {
    simple: { vertex: vertex, fragment: fragment },
    //portal: { vertex: vertex, fragment: fragment_portal }
};
