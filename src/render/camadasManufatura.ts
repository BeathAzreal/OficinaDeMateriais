import type { MeshStandardMaterial } from 'three'
import type { Deposito } from '../modelo/manufatura/deposicao'

/** Coordenada visual de camadas na parede. Não modifica o mapa medido.
 * O campo de alturas não guarda interfaces enterradas: as faixas são uma
 * aproximação pela altura local da coluna e a contagem de passes do modelo.
 */
export function coordenadasCamadas(d: Deposito): Float32Array {
  const topos = new Float32Array(d.nx)
  const passes = new Uint16Array(d.nx)
  for (let k = 0; k < d.altura.length; k++) {
    const i = k % d.nx
    if (d.altura[k] > topos[i]) { topos[i] = d.altura[k]; passes[i] = d.camada[k] }
  }
  const faixas = new Float32Array(d.altura.length)
  for (let k = 0; k < faixas.length; k++) {
    const i = k % d.nx
    if (topos[i] > 0.05) faixas[k] = Math.max(1, passes[i]) * d.altura[k] / topos[i]
  }
  return faixas
}

/** Relevo óptico e acabamento do inox depositado; sem deslocar vértices. */
export function acabamentoCamadas(material: MeshStandardMaterial): void {
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute float camadaVisual; varying float vCamada; varying vec3 vMetal; varying float vLateral;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvCamada = camadaVisual; vMetal = position; vLateral = 1.0 - abs(normal.y);')
    shader.fragmentShader = 'varying float vCamada; varying vec3 vMetal; varying float vLateral;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // Faixas horizontais com pequenas ondas ao longo do avanço, estáveis no tempo.
      float ondulacao = 0.025 * sin(vMetal.x * 170.0) + 0.012 * sin(vMetal.x * 63.0 + vCamada * 1.7);
      float camada = max(0.0, vCamada + ondulacao);
      float fase = fract(camada);
      float sulco = 1.0 - smoothstep(0.025, 0.13, min(fase, 1.0 - fase));
      float faixa = floor(camada);
      float tom = 0.975 + 0.025 * sin(faixa * 2.4 + 0.8);
      // A face superior continua metálica; as interfaces se destacam nas laterais.
      float lateral = smoothstep(0.15, 0.8, vLateral);
      sulco *= lateral;
      diffuseColor.rgb *= tom * (1.0 - 0.26 * sulco);
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + 0.11 * sulco + 0.035 * sin(camada * 6.283185), 0.28, 0.8);
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Bump procedural: saliência arredondada de cada cordão e escamas leves.
      float relevo = 0.0012 * sin(fase * 3.141593) - 0.0006 * sulco;
      relevo += 0.00012 * sin(vMetal.x * 850.0 + camada * 4.0);
      vec3 sx = normalize(dFdx(-vViewPosition));
      vec3 sy = normalize(dFdy(-vViewPosition));
      vec3 r1 = cross(sy, normal);
      vec3 r2 = cross(normal, sx);
      float det = dot(sx, r1);
      vec3 gradiente = sign(det) * (dFdx(relevo) * r1 + dFdy(relevo) * r2);
      if (abs(det) > 0.00001) normal = normalize(abs(det) * normal - gradiente);
    `)
  }
  material.customProgramCacheKey = () => 'manufatura-camadas-v1'
}
