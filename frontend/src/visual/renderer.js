import { WebGPURenderer } from 'three/webgpu';

// Three r180 installs an automatic fallback; disable it before initialization.
export function createRenderer(options){
  if(!globalThis.isSecureContext)throw new Error('WebGPU 需要安全上下文：请通过 HTTPS 或本机 localhost 访问。');
  if(!navigator.gpu)throw new Error('当前浏览器未提供 WebGPU。请使用支持 WebGPU 的浏览器并启用硬件加速。');
  const renderer=new WebGPURenderer({...options,powerPreference:'high-performance'});
  renderer._getFallback=null;
  return renderer;
}

export async function initializeRenderer(renderer){
  await renderer.init();
  if(!renderer.backend.isWebGPUBackend)throw new Error('无法创建 WebGPU 渲染设备。');
  renderer.backend.device.addEventListener('uncapturederror',event=>{
    console.error('WebGPU validation:',event.error.message);
    window.dispatchEvent(new CustomEvent('rendererror',{detail:event.error}));
  });
  return renderer;
}

export const maxAnisotropy=renderer=>Math.min(16,renderer.getMaxAnisotropy());
