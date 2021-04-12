import Model from './Model.js';
import UtilsGl from "./UtilsGl.js";

const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;
const vec4 = glMatrix.vec4;
const quat = glMatrix.quat;

export default class Portal extends Model {

    constructor(mesh, texture, options) {
        super(mesh, texture, options);
        this.mesh = mesh;
        this.texture = texture;
    }

    // Posodobi povezan portal.
    updateDestination(destination) {
        this.destination = destination;
    }

    // Vrne normalo ravnine, na kateri je portal. Normala kaže ven iz portala!
    getSurfaceNormal() {
        // Normala v lokalnih koordinatah
        const surfaceNormal = vec3.fromValues(
            this.mesh.normals[0],
            this.mesh.normals[1],
            this.mesh.normals[2]
        );

        // Normalo pravilno zarotiramo
        vec3.transformQuat(surfaceNormal, surfaceNormal, this.getRotationQuaternion());

        // Normaliziramo
        vec3.normalize(surfaceNormal, surfaceNormal);
        return surfaceNormal;
    }

    // Vrne kvaternion, ki predstavlja rotacijo tega portala.
    getRotationQuaternion() {
        const degrees = this.rotation.map(x => x * 180 / Math.PI);
        return quat.fromEuler(quat.create(), ...degrees);
    }

    getPortalView(viewMatrix) {
        const localToWorld = this.getGlobalTransform();
        const destinationWorldToLocal = mat4.invert(mat4.create(), this.destination.getGlobalTransform());
        return UtilsGl.mul(
            viewMatrix,
            localToWorld,
            destinationWorldToLocal
        )
    }

    /*
     * Modifies the given projection matrix so that the near plane of the view frustrum
     * is an arbitrary plane, in this case the plane
     */
    obliqueProjectionMatrix(projectionMatrix, clipPlane) {
        const matrix = mat4.clone(projectionMatrix);

        if (clipPlane[3] >= 0.0) return matrix;
        const q = vec4.fromValues(
            (this.sign(clipPlane.x) + matrix[8]) / matrix[0],
            (this.sign(clipPlane.y) + matrix[9]) / matrix[5],
            -1.0,
            (1.0 + matrix[10]) / matrix[14]
        );

        const scale = 2.0 / vec4.dot(clipPlane, q);
        const c = vec4.scale(vec4.create(), clipPlane, scale);

        matrix[2] = c[0];
        matrix[6] = c[1];
        matrix[10] = c[2] + 1.0;
        matrix[14] = c[3];

        return matrix;
    }

    /*
     * Returns a clip plane in the form (a, b, c, d), such that
     * ax + by + cz + d = 0. The coordinates are world coordinates!
     *
     * Consider a point on a plane, e.g. v = (x, y, z, 1), and the plane
     * defined by a normal and distance, e.g. p = (a, b, c, d).
     *
     * We must transform the plane into the world coordinates.
     * Help: https://www.songho.ca/opengl/gl_normaltransform.html
     */
    calculateClipPlane(viewMatrix) {
        const normal = this.getSurfaceNormal();
        const point = vec3.fromValues(
            this.mesh.vertices[0],
            this.mesh.vertices[1],
            this.mesh.vertices[2]
        );

        //console.log("Normal before: " + normal);
        const degrees = this.rotation.map(x => x * 180 / Math.PI);
        const q = quat.fromEuler(quat.create(), ...degrees);
        vec3.transformQuat(normal, normal, q);
        //console.log("Normal after: " + normal);

        // World coordinates clip plane
        const clipPlane = vec4.fromValues(normal[0], normal[1], normal[2], -vec3.dot(point, normal));

        // Camera coordinates clip plane
        const covariantVM = mat4.transpose(mat4.invert(mat4.create(), viewMatrix), viewMatrix);
        const clipPlaneCamera = vec4.transformMat4(vec4.create(), clipPlane, covariantVM);
        //vec4.transformMat4(clipPlane, clipPlane, viewMatrix);
        //console.log("Camera clip plane: " + clipPlane);
        return clipPlaneCamera;
    }

    calculateClipPlane2(viewMatrix) {
        const d = vec3.length(this.translation);

        const normal = vec3.fromValues(
            this.mesh.normals[0],
            this.mesh.normals[1],
            this.mesh.normals[2]
        )

        const q = this.getRotationQuaternion();
        vec3.transformQuat(normal, normal, q);

        const clipPlane = vec4.fromValues(normal[0], normal[1], normal[2], -d);

        //const covariantViewMatrix = mat4.invert(mat4.create(), viewMatrix);
        //mat4.transpose(covariantViewMatrix, covariantViewMatrix);
        //vec4.transformMat4(clipPlane, clipPlane, covariantViewMatrix);

        return clipPlane;
    }

    sign(f) {
        if (f < 0.0) return -1.0;
        if (f > 0.0) return 1.0;
        return 0.0;
    }
}
