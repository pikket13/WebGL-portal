export default class UtilsGl {

    static invert(matrix) {
        const inverted = glMatrix.mat4.create();
        glMatrix.mat4.invert(inverted, matrix);
        return inverted;
    }

    static perspective(fov, aspect, near, far) {
        const p = glMatrix.mat4.create();
        glMatrix.mat4.perspective(p, fov, aspect, near, far);
        return p;
    }

    static mul(...matrices) {
        return matrices.reduceRight((previous, current) => {
            const result = glMatrix.mat4.create();
            glMatrix.mat4.mul(result, current, previous);
            return result;
        }, glMatrix.mat4.create());
    }

}
