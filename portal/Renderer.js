import * as WebGL from './WebGL.js';
import shaders from './shaders.js';
import Portal from './Portal.js';
import UtilsGl from './UtilsGl.js';

const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

const MAX_RECURSION_LEVEL = 2;

export default class Renderer {

    constructor(gl) {
        this.gl = gl;

        gl.clearColor(1, 1, 1, 1);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);

        this.programs = WebGL.buildPrograms(gl, shaders);

        const halfRotation = mat4.create();
        mat4.fromYRotation(halfRotation, Math.PI);
        this.halfRotation = halfRotation;
    }

    prepare(scene) {
        scene.nodes.forEach(node => {
            node.gl = {};
            if (node.mesh) {
                Object.assign(node.gl, this.createModel(node.mesh));
            }
            if (node.image) {
                node.gl.texture = this.createTexture(node.image);
            }
        });
    }

    // region Render

    render(scene, camera) {
        const gl = this.gl;
        this.camera = camera;

        this.portalColorScale = this.getPortalColorScale();

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        const program = this.programs.simple;
        gl.useProgram(program.program);

        const viewMatrix = mat4.create();
        mat4.invert(viewMatrix, camera.getGlobalTransform());

        this.renderRecursive(program, scene, camera.projection, viewMatrix, 0);
    }

    renderRecursive(program, scene, projectionMatrix, viewMatrix, level) {
        const gl = this.gl;
        gl.uniformMatrix4fv(program.uniforms.uProjection, false, projectionMatrix);

        // A. PRIPRAVA STENCIL BUFFERJEV IN NAJGLOBLJI IZRIS

        scene.portals.forEach(portal => {

            // 1. STENCIL BUFFER
            // Portal najprej upodobimo v stencil buffer. Na mestu portala se bo stencil buffer povečal; tako bomo
            // kasneje vedeli, v katere piksle moramo izrisati svet znotraj portala.
            // Zato izklopimo pisanje barv in globine. Tam, kjer bo izrisan portal, bo funkcija NOTEQUAL level
            // spodletela, zato se bo tam povečala vrednost v stencil buffer (INCR).

            gl.colorMask(false, false, false, false);
            gl.depthMask(false);
            gl.disable(gl.DEPTH_TEST);
            gl.enable(gl.STENCIL_TEST);
            gl.stencilOp(gl.INCR, gl.KEEP, gl.KEEP);
            gl.stencilFunc(gl.NOTEQUAL, level, 0xFF);
            gl.stencilMask(0xFF);

            this.renderNode(program, portal, mat4.mul(mat4.create(), viewMatrix, portal.transform));


            // 2. MATRIKA POGLEDA IN PROJEKCIJSKA MATRIKA
            // Izračunati moramo matriko pogleda, ki bo omogočala risanje, kot da gledamo iz povezanege portala.
            // Projekcijo moramo omejiti, sicer bomo prikazovali tudi predmete ZA portalom, ki ne smejo biti vidni.
            // Enostavna moznost je, da spremenimo near clipping plane, tako da se bo zacela ravno "na" portalu.
            // Tako moramo izracunati razdaljo med portalom in "navidezno kamero" (delamo v koordinatah sveta)
            // Slabot te moznosti je, da dobro deluje le, ko je naša projekcijska ravnina "vzporedna pogledu", sicer
            // lahko nekatere dele "prehitro" porežemo. Za boljšo rešitev lahko uporabimo zanimiv pristop, ki
            // kot near clipping plane nastavi poljubno ravnino; mi želimo seveda za near clipping plane nastaviti
            // kar ravnino, v kateri leži površina portala.

            const localToWorld = portal.getGlobalTransform();
            const destWorldToLocal = mat4.invert(mat4.create(), portal.destination.getGlobalTransform());
            const destViewMatrix = UtilsGl.mul(viewMatrix, localToWorld, this.halfRotation, destWorldToLocal);

            const inverseView = mat4.invert(mat4.create(), destViewMatrix);
            const inverseViewPosition = vec3.fromValues(inverseView[12], inverseView[13], inverseView[14]);
            const distance = vec3.distance(portal.destination.translation, inverseViewPosition);
            const clippedProjection = UtilsGl.perspective(this.camera.fov, this.camera.aspect, distance, this.camera.far);

            // const clipPlane = portal.calculateClipPlane(destViewMatrix);
            // const clippedProjection = portal.obliqueProjectionMatrix(projectionMatrix, clipPlane);


            // 3. GLOBLJA REKURZIJA
            // Smiselno je, da gremo najprej najgloblje v rekurzijo in začnemo izrisevati navzgor. Ko se bomo
            // vzpenjali, bomo poskrbeli, da v stencil bufferju ponastavimo vrednosti, kot so bile pred korakom 1.
            // Ko smo najgloblje v rekurziji, bomo preprosto izrisali pogled; za globlje rekurzije daje to kar
            // dober efekt. Takrat spet vklopimo barve in teste za globino, vklopimo pa tudi test za stencil buffer,
            // da bomo risali le najgloblje (skozi pogled zadnjega rekurzivnega portala). Okvirje portalov bomo
            // izpustili.

            if (level < MAX_RECURSION_LEVEL) {
                this.renderRecursive(program, scene, clippedProjection, destViewMatrix, level + 1);
            }
            if (level === MAX_RECURSION_LEVEL) {
                gl.uniformMatrix4fv(program.uniforms.uProjection, false, clippedProjection);
                gl.colorMask(true, true, true, true);
                gl.depthMask(true);
                gl.clear(gl.DEPTH_BUFFER_BIT);
                gl.enable(gl.DEPTH_TEST);
                gl.enable(gl.STENCIL_TEST);
                gl.stencilMask(0x00);
                gl.stencilFunc(gl.EQUAL, level + 1, 0xFF);

                this.renderScene(program, scene, destViewMatrix, false);
            }


            // 4. PONASTAVITEV STENCIL BUFFERJA
            // Kot omenjeno že v točki 3, bomo trenutno najgloblji portal še enkrat izrisali,
            // da zmanjšamo vrednost stencil bufferja, kot je bila pred izrisom tega portala.

            gl.uniformMatrix4fv(program.uniforms.uProjection, false, projectionMatrix);
            gl.colorMask(false, false, false, false);
            gl.depthMask(false);
            gl.enable(gl.STENCIL_TEST);
            gl.stencilOp(gl.DECR, gl.KEEP, gl.KEEP);
            gl.stencilFunc(gl.NOTEQUAL, level + 1, 0xFF);
            gl.stencilMask(0xFF);

            this.renderNode(program, portal, mat4.mul(mat4.create(), viewMatrix, portal.transform));
        });


        // B. IZRIS PORTALOV V Z BUFFER
        // Na položaju portala moramo povečati globino. Če tega ne storimo, bodo objekti, ki so v portalu, morebiti
        // prekriti z drugimi objekti, ki so dejansko za portalom v sceni.

        gl.colorMask(false, false, false, false);
        gl.disable(gl.STENCIL_TEST);
        gl.stencilMask(0x00);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.ALWAYS);
        gl.depthMask(true);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        scene.portals.forEach(portal => {
            this.renderNode(program, portal, mat4.mul(mat4.create(), viewMatrix, portal.transform));
        });


        // C. UPODOBITEV PREOSTALE SCENE NA TRENUTNEM NIVOJU REKURZIJE
        // Upoštevamo stencil buffer in tako izrišemo vse ostalo v sceni na trenutni globini.
        // Najprej izrišemo okvirje portalov, kjer je stencil buffer enak trenutni globini.
        // Nato izrišemo še vse ostalo, kjer je stencil buffer manjši ali enak trenutni globini.

        gl.uniformMatrix4fv(program.uniforms.uProjection, false, projectionMatrix);

        gl.depthFunc(gl.LESS);
        gl.enable(gl.STENCIL_TEST);
        gl.stencilMask(0x00);
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);
        gl.enable(gl.DEPTH_TEST);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


        gl.stencilFunc(gl.EQUAL, level, 0xFF);
        gl.depthFunc(gl.ALWAYS);
        gl.uniform1f(program.uniforms.factor, this.portalColorScale);
        scene.portals.forEach(portal => {
            this.renderNode(program, portal, mat4.mul(mat4.create(), viewMatrix, portal.transform));
        });

        gl.depthFunc(gl.LESS);
        gl.stencilFunc(gl.LEQUAL, level, 0xFF);
        gl.uniform1f(program.uniforms.factor, 1.0);
        this.renderScene(program, scene, viewMatrix, false);
    }

    renderScene(program, scene, viewMatrix, portals) {
        let matrix = mat4.create();
        mat4.copy(matrix, viewMatrix);
        let matrixStack = [];
        scene.traverse(
            node => {
                matrixStack.push(mat4.clone(matrix));
                mat4.mul(matrix, matrix, node.transform);

                if (node instanceof Portal && !portals) return;
                this.renderNode(program, node, matrix);
            },
            () => {
                matrix = matrixStack.pop();
            }
        );
    }

    renderNode(program, node, viewModelMatrix) {
        const gl = this.gl;
        if (node.gl.vao) {
            gl.bindVertexArray(node.gl.vao);
            gl.uniformMatrix4fv(program.uniforms.uViewModel, false, viewModelMatrix);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, node.gl.texture);
            gl.uniform1i(program.uniforms.uTexture, 0);
            gl.drawElements(gl.TRIANGLES, node.gl.indices, gl.UNSIGNED_SHORT, 0);
        }
    }

    getPortalColorScale() {
        return Math.sin(performance.now() / 1000) / 6 + 1;
    }

    // endregion

    createModel(model) {
        const gl = this.gl;

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.vertices), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.texcoords), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(model.normals), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

        const indices = model.indices.length;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(model.indices), gl.STATIC_DRAW);

        return { vao, indices };
    }

    createTexture(texture) {
        const gl = this.gl;
        return WebGL.createTexture(gl, {
            image : texture,
            min   : gl.NEAREST,
            mag   : gl.NEAREST
        });
    }

}
