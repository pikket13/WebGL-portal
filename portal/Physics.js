import Portal from "./Portal.js";
import Checkpoint from "./Checkpoint.js";

const vec3 = glMatrix.vec3;
const mat4 = glMatrix.mat4;
const quat = glMatrix.quat;

export default class Physics {

    constructor(scene) {
        this.scene = scene;
    }

    update(dt) {
        this.scene.traverse(node => {
            if (node.velocity) {
                vec3.scaleAndAdd(node.translation, node.translation, node.velocity, dt);
                node.updateTransform();
                this.scene.traverse(other => {
                    if (node !== other) {
                        this.resolveCollision(node, other);
                    }
                });
            }
        });
    }

    intervalIntersection(min1, max1, min2, max2) {
        return !(min1 > max2 || min2 > max1);
    }

    aabbIntersection(aabb1, aabb2) {
        return this.intervalIntersection(aabb1.min[0], aabb1.max[0], aabb2.min[0], aabb2.max[0])
            && this.intervalIntersection(aabb1.min[1], aabb1.max[1], aabb2.min[1], aabb2.max[1])
            && this.intervalIntersection(aabb1.min[2], aabb1.max[2], aabb2.min[2], aabb2.max[2]);
    }

    resolveCollision(a, b) {
        // Update bounding boxes with global translation.
        const ta = a.getGlobalTransform();
        const tb = b.getGlobalTransform();

        const posa = mat4.getTranslation(vec3.create(), ta);
        const posb = mat4.getTranslation(vec3.create(), tb);

        const mina = vec3.add(vec3.create(), posa, a.aabb.min);
        const maxa = vec3.add(vec3.create(), posa, a.aabb.max);
        const minb = vec3.add(vec3.create(), posb, b.aabb.min);
        const maxb = vec3.add(vec3.create(), posb, b.aabb.max);

        // Check if there is collision.
        const isColliding = this.aabbIntersection({
            min: mina,
            max: maxa
        }, {
            min: minb,
            max: maxb
        });
        // Preverimo. če je collision
        if (!isColliding) {
            return;
        }

        // Če je portal, kličemo metodo teleport
        if (b instanceof Portal) {
            this.teleport(a, b);
            return;
        }

        // Move node A minimally to avoid collision.
        const diffa = vec3.sub(vec3.create(), maxb, mina);
        const diffb = vec3.sub(vec3.create(), maxa, minb);

        let minDiff = Infinity;
        let minDirection = [0, 0, 0];
        if (diffa[0] >= 0 && diffa[0] < minDiff) {
            minDiff = diffa[0];
            minDirection = [minDiff, 0, 0];
        }
        if (diffa[1] >= 0 && diffa[1] < minDiff) {
            minDiff = diffa[1];
            minDirection = [0, minDiff, 0];
        }
        if (diffa[2] >= 0 && diffa[2] < minDiff) {
            minDiff = diffa[2];
            minDirection = [0, 0, minDiff];
        }
        if (diffb[0] >= 0 && diffb[0] < minDiff) {
            minDiff = diffb[0];
            minDirection = [-minDiff, 0, 0];
        }
        if (diffb[1] >= 0 && diffb[1] < minDiff) {
            minDiff = diffb[1];
            minDirection = [0, -minDiff, 0];
        }
        if (diffb[2] >= 0 && diffb[2] < minDiff) {
            minDiff = diffb[2];
            minDirection = [0, 0, -minDiff];
        }

        // Za jump preverimo, če je collision spodaj
        if (minDirection[1] > 0) {
            a.collisionBottom = true;
            // če je checkpoint, ga nastavimo
            if (b instanceof Checkpoint) {
                a.checkpoint = vec3.clone(b.translation);
                vec3.add(a.checkpoint, a.checkpoint, [0,1,0]);
                a.checkpointRot = vec3.clone(b.rotation);
            }
        }
        // Za side jump preverimo, na kateri koordinati je collision
        else {
            a.collisionSide = true;
            a.closestWall = minDirection;
        }

        vec3.add(a.translation, a.translation, minDirection);
        a.updateTransform();

    }

    teleport(other, portal) {
        // Za uspešno teleportacijo moramo igralca premakniti, popraviti zasuk okoli y osi
        // in popraviti smer vektorja hitrosti. Rotacijo med portaloma lahko določimo kot
        // skalarni produkt med normala vertikalnih ravnin portalov, pri čemer normalo
        // vstopnega portala zasukamo, da kaže v nasprotno smer, saj je to za računanje
        // iz perspektive igralca bolj smiselno.
        const originNormal = portal.getSurfaceNormal();
        vec3.scale(originNormal, originNormal, -1.0);
        const destinationNormal = portal.destination.getSurfaceNormal();

        // Skalarni produkt nam predstavlja kosinus kota, saj sta normali normirani.
        // Preveriti moramo tudi, v katero smer urinega kazalca se moramo zasukati
        const dot = Math.min(1.0, Math.max(-1.0, vec3.dot(originNormal, destinationNormal)));
        let direction = 1;
        const cross = vec3.cross(vec3.create(), originNormal, destinationNormal);
        if (cross[1] < 0) direction *= -1;
        const angle = direction * Math.acos(dot);
        const q = quat.fromEuler(quat.create(), 0, angle * 180 / Math.PI, 0);

        // Objekt "prenesemo" na drugo stran, tako da ga transliramo za razliko položajev obeh
        // portalov. Vektorju moramo tudi popraviti smer in ga rahlo skaliramo, da se ne ujamemo v zanko.
        const portalTranslation = vec3.sub(vec3.create(), portal.translation, other.translation);
        vec3.transformQuat(portalTranslation, portalTranslation, q);
        vec3.scale(portalTranslation, portalTranslation, 1.2);
        other.translation = vec3.add(vec3.create(), portal.destination.translation, portalTranslation);

        // Popravimo vektor hitrosti, da kaže v pravo smer, in rotacijo okoli y osi.
        vec3.transformQuat(other.velocity, other.velocity, q);
        other.rotation[1] = other.rotation[1] + angle;
        if (other.rotation[1] > Math.PI) other.rotation[1] -= 2 * Math.PI;
        if (other.rotation[1] < Math.PI) other.rotation[1] += 2 * Math.PI;

        other.updateTransform();
    }
}
